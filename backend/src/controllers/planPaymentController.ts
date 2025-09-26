import { Request, Response } from 'express';
import pool from '../services/db';
import { fetchAuthenticatedUserEmpresa } from '../utils/authUser';
import resolveAsaasIntegration, {
  AsaasIntegrationNotConfiguredError,
} from '../services/asaas/integrationResolver';
import AsaasClient, { AsaasApiError, CustomerPayload } from '../services/asaas/asaasClient';
import AsaasChargeService, {
  ChargeConflictError,
  ValidationError as AsaasChargeValidationError,
} from '../services/asaasChargeService';

const asaasChargeService = new AsaasChargeService();

function parseNumericId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isInteger(parsed)) {
      return parsed;
    }
  }
  return null;
}

function parsePricingMode(value: unknown): 'mensal' | 'anual' {
  if (typeof value !== 'string') {
    return 'mensal';
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'anual' || normalized === 'annual') {
    return 'anual';
  }
  return 'mensal';
}

function parsePaymentMethod(value: unknown): 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'DEBIT_CARD' {
  if (typeof value !== 'string') {
    return 'PIX';
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'boleto') {
    return 'BOLETO';
  }
  if (normalized === 'cartao' || normalized === 'cartão' || normalized === 'credit_card') {
    return 'CREDIT_CARD';
  }
  if (
    normalized === 'debito' ||
    normalized === 'débito' ||
    normalized === 'debit_card' ||
    normalized === 'debitcard' ||
    normalized === 'cartao_debito' ||
    normalized === 'cartão_debito' ||
    normalized === 'cartão_débito'
  ) {
    return 'DEBIT_CARD';
  }
  return 'PIX';
}

function sanitizeString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeDocument(value: unknown): string | null {
  const text = sanitizeString(value);
  if (!text) {
    return null;
  }
  const digits = text.replace(/\D+/g, '');
  return digits.length > 0 ? digits : null;
}

function parseCurrency(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const sanitized = trimmed.replace(/[^\d,.-]/g, '').replace(/\.(?=.*\.)/g, '');
    const normalized = sanitized.replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

type PlanRow = {
  id: number;
  nome: string | null;
  valor_mensal: number | string | null;
  valor_anual: number | string | null;
};

async function loadPlan(planId: number): Promise<PlanRow | null> {
  const result = await pool.query<PlanRow>(
    'SELECT id, nome, valor_mensal, valor_anual FROM public.planos WHERE id = $1 LIMIT 1',
    [planId],
  );
  if (result.rowCount === 0) {
    return null;
  }
  return result.rows[0];
}

async function findEmpresaAsaasCustomerId(empresaId: number): Promise<string | null> {
  const result = await pool.query<{ asaas_customer_id: unknown }>(
    'SELECT asaas_customer_id FROM public.empresas WHERE id = $1 LIMIT 1',
    [empresaId],
  );

  if (result.rowCount === 0) {
    return null;
  }

  const rawValue = result.rows[0]?.asaas_customer_id;

  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();
    return trimmed ? trimmed : null;
  }

  return null;
}

async function persistEmpresaAsaasCustomerId(empresaId: number, customerId: string): Promise<void> {
  const normalizedId = customerId.trim();
  if (!normalizedId) {
    throw new Error('Cannot persist empty Asaas customer identifier');
  }

  const result = await pool.query(
    'UPDATE public.empresas SET asaas_customer_id = $1 WHERE id = $2',
    [normalizedId, empresaId],
  );

  if (result.rowCount === 0) {
    throw new Error('Empresa não encontrada para vincular cliente do Asaas.');
  }
}

function resolvePlanPrice(plan: PlanRow, pricingMode: 'mensal' | 'anual'): number | null {
  if (pricingMode === 'anual') {
    return parseCurrency(plan.valor_anual);
  }
  return parseCurrency(plan.valor_mensal);
}

function buildChargeDescription(plan: PlanRow, pricingMode: 'mensal' | 'anual'): string {
  const planName = sanitizeString(plan.nome) ?? `Plano ${plan.id}`;
  const cadenceLabel = pricingMode === 'anual' ? 'anual' : 'mensal';
  return `Assinatura ${planName} (${cadenceLabel})`;
}

function resolveDueDate(billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'DEBIT_CARD'): string {
  const dueDate = new Date();
  if (billingType === 'BOLETO') {
    dueDate.setDate(dueDate.getDate() + 3);
  }
  return dueDate.toISOString().slice(0, 10);
}

async function createFinancialFlow({
  description,
  value,
  dueDate,
  externalReference,
}: {
  description: string;
  value: number;
  dueDate: string;
  externalReference: string;
}): Promise<{ id: number; descricao: string; valor: string; vencimento: string; status: string } | null> {
  const result = await pool.query(
    `INSERT INTO financial_flows (
        tipo,
        descricao,
        vencimento,
        valor,
        status,
        cliente_id,
        fornecedor_id,
        external_provider,
        external_reference_id
      )
      VALUES ('receita', $1, $2, $3, 'pendente', NULL, NULL, 'asaas', $4)
      RETURNING id, descricao, valor::text AS valor, vencimento::text AS vencimento, status`,
    [description, dueDate, value, externalReference],
  );

  if (result.rowCount === 0) {
    return null;
  }
  return result.rows[0] as {
    id: number;
    descricao: string;
    valor: string;
    vencimento: string;
    status: string;
  };
}

export const createPlanPayment = async (req: Request, res: Response) => {
  if (!req.auth) {
    res.status(401).json({ error: 'Token inválido.' });
    return;
  }

  const planId = parseNumericId(req.body?.planId);
  if (planId == null) {
    res.status(400).json({ error: 'Plano inválido.' });
    return;
  }

  const pricingMode = parsePricingMode(req.body?.pricingMode);
  const billingType = parsePaymentMethod(req.body?.paymentMethod);

  const companyName = sanitizeString(req.body?.billing?.companyName ?? req.body?.companyName);
  const companyDocument = sanitizeDocument(req.body?.billing?.document ?? req.body?.companyDocument);
  const billingEmail = sanitizeString(req.body?.billing?.email ?? req.body?.billingEmail);
  const notes = sanitizeString(req.body?.billing?.notes ?? req.body?.notes);

  if (!companyName) {
    res.status(400).json({ error: 'Informe a razão social ou nome do responsável pela cobrança.' });
    return;
  }

  if (!companyDocument) {
    res.status(400).json({ error: 'Informe um CPF ou CNPJ válido para gerar a cobrança no Asaas.' });
    return;
  }

  if (!billingEmail) {
    res.status(400).json({ error: 'Informe um e-mail para enviar as notificações de cobrança.' });
    return;
  }

  const empresaLookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);
  if (!empresaLookup.success) {
    res.status(empresaLookup.status).json({ error: empresaLookup.message });
    return;
  }

  const empresaId = empresaLookup.empresaId;
  if (empresaId == null) {
    res.status(400).json({ error: 'Associe o usuário a uma empresa para gerenciar o plano.' });
    return;
  }

  const plan = await loadPlan(planId);
  if (!plan) {
    res.status(404).json({ error: 'Plano não encontrado.' });
    return;
  }

  const price = resolvePlanPrice(plan, pricingMode);
  if (price == null || price <= 0) {
    res.status(400).json({ error: 'O plano selecionado não possui valor configurado para esta recorrência.' });
    return;
  }

  const description = buildChargeDescription(plan, pricingMode);
  const dueDate = resolveDueDate(billingType);
  const externalReference = `plan-${planId}-empresa-${empresaId}-${Date.now()}`;

  let integration;
  try {
    integration = await resolveAsaasIntegration();
  } catch (error) {
    if (error instanceof AsaasIntegrationNotConfiguredError) {
      res.status(503).json({ error: 'Integração com o Asaas não está configurada.' });
      return;
    }
    console.error('Falha ao carregar integração do Asaas', error);
    res.status(500).json({ error: 'Não foi possível preparar a integração com o Asaas.' });
    return;
  }

  const client = new AsaasClient({
    baseUrl: integration.baseUrl,
    accessToken: integration.accessToken,
  });

  const customerPayload: CustomerPayload = {
    name: companyName,
    cpfCnpj: companyDocument,
    email: billingEmail,
    externalReference: `empresa-${empresaId}`,
    observations: notes ?? undefined,
    notificationDisabled: false,
  };

  let existingCustomerId: string | null = null;
  try {
    existingCustomerId = await findEmpresaAsaasCustomerId(empresaId);
  } catch (error) {
    console.error('Falha ao consultar vínculo de cliente Asaas para empresa', error);
    res.status(500).json({ error: 'Não foi possível verificar o cadastro da empresa no Asaas.' });
    return;
  }

  let customerId: string | null = existingCustomerId;

  try {
    if (customerId) {
      try {
        const customer = await client.updateCustomer(customerId, customerPayload);
        customerId = customer.id;
      } catch (error) {
        console.error('Falha ao atualizar cliente no Asaas', error);
        if (error instanceof AsaasApiError && error.status === 404) {
          const customer = await client.createCustomer(customerPayload);
          customerId = customer.id;
        } else {
          throw error;
        }
      }
    } else {
      const customer = await client.createCustomer(customerPayload);
      customerId = customer.id;
    }
  } catch (error) {
    console.error('Falha ao preparar cliente no Asaas', error);
    const message =
      error instanceof Error && 'message' in error
        ? (error as Error).message
        : 'Não foi possível preparar o cliente no Asaas.';
    res.status(502).json({ error: message });
    return;
  }

  if (!customerId) {
    res.status(502).json({ error: 'Não foi possível preparar o cliente no Asaas.' });
    return;
  }

  try {
    await persistEmpresaAsaasCustomerId(empresaId, customerId);
  } catch (error) {
    console.error('Falha ao persistir vínculo de cliente Asaas para empresa', error);
    res.status(500).json({ error: 'Não foi possível vincular o cliente do Asaas à empresa.' });
    return;
  }

  const flow = await createFinancialFlow({
    description,
    value: price,
    dueDate,
    externalReference,
  });

  if (!flow) {
    res.status(500).json({ error: 'Não foi possível registrar a cobrança localmente.' });
    return;
  }

  try {
    const chargeResult = await asaasChargeService.createCharge({
      financialFlowId: flow.id,
      billingType,
      value: price,
      dueDate,
      description,
      customer: customerId,
      payerEmail: billingEmail,
      payerName: companyName,
      customerDocument: companyDocument,
      metadata: {
        planId,
        pricingMode,
        empresaId,
        origin: 'plan-payment',
      },
    });

    res.status(201).json({
      plan: {
        id: plan.id,
        nome: plan.nome,
        pricingMode,
        price,
      },
      paymentMethod: billingType,
      charge: chargeResult.charge,
      flow: chargeResult.flow,
    });
  } catch (error) {
    if (error instanceof AsaasChargeValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error instanceof ChargeConflictError) {
      res.status(409).json({ error: error.message });
      return;
    }
    console.error('Falha ao criar cobrança do plano no Asaas', error);
    res.status(502).json({ error: 'Não foi possível criar a cobrança do plano no Asaas.' });
  }
};

export default { createPlanPayment };
