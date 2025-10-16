import { Request, Response } from 'express';
import pool from '../services/db';
import { fetchAuthenticatedUserEmpresa } from '../utils/authUser';
import { buildErrorResponse } from '../utils/errorResponse';
import {
  resolveAsaasIntegration,
  AsaasIntegrationNotConfiguredError,
} from '../services/asaas/integrationResolver';
import AsaasClient, { AsaasApiError, CustomerPayload } from '../services/asaas/asaasClient';
import AsaasSubscriptionService from '../services/asaas/subscriptionService';
import { normalizeAsaasEnvironment } from '../services/asaas/urlNormalization';

import AsaasChargeService, {
  ChargeConflictError,
  ValidationError as AsaasChargeValidationError,
} from '../services/asaasChargeService';
import { calculateGraceDeadline, parseCadence as parseSubscriptionCadence } from '../services/subscriptionService';
import { normalizeFinancialFlowIdentifierFromRow } from '../utils/financialFlowIdentifier';

const asaasChargeService = new AsaasChargeService();
const asaasSubscriptionService = new AsaasSubscriptionService();

function handleAsaasError(
  res: Response,
  error: unknown,
  fallbackMessage: string,
  fallbackStatus = 502,
): error is AsaasApiError {
  if (error instanceof AsaasApiError) {
    const normalizedStatus =
      Number.isInteger(error.status) && error.status >= 400 && error.status < 600
        ? error.status
        : fallbackStatus;
    res
      .status(normalizedStatus)
      .json(
        buildErrorResponse(error, fallbackMessage, {
          expose: normalizedStatus < 500,
        })
      );
    return true;
  }

  return false;
}

function resolveConfiguredAsaasEnvironment() {
  const rawEnvironment = process.env.ASAAS_ENVIRONMENT;
  if (typeof rawEnvironment === 'string' && rawEnvironment.trim()) {
    return normalizeAsaasEnvironment(rawEnvironment);
  }
  return undefined;
}

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

function sanitizeIp(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const candidate = value.split(',')[0]?.trim() ?? '';
  if (!candidate) {
    return null;
  }

  if (/^[0-9a-fA-F:.]+$/.test(candidate)) {
    return candidate;
  }

  return null;
}

function sanitizeMetadataRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const entries = Object.entries(value as Record<string, unknown>);
  const metadata: Record<string, unknown> = {};

  for (const [key, entryValue] of entries) {
    if (typeof key !== 'string') {
      continue;
    }
    metadata[key] = entryValue;
  }

  return metadata;
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

type EmpresaCustomerRow = {
  asaas_customer_id: string | null;
};

async function findEmpresaAsaasCustomerId(empresaId: number): Promise<string | null> {
  const result = await pool.query<EmpresaCustomerRow>(
    'SELECT asaas_customer_id FROM public.empresas WHERE id = $1 LIMIT 1',
    [empresaId],
  );

  if (result.rowCount === 0) {
    return null;
  }

  const rawValue = result.rows[0]?.asaas_customer_id;
  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();
    return trimmed.length > 0 ? trimmed : null;
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

const CADENCE_DURATION_DAYS: Record<'monthly' | 'annual', number> = {
  monthly: 30,
  annual: 365,
};

type EmpresaSubscriptionRow = {
  id: number;
  nome_empresa: string | null;
  asaas_subscription_id: string | null;
  trial_started_at: Date | string | null;
  trial_ends_at: Date | string | null;
  subscription_trial_ends_at: Date | string | null;
  current_period_start: Date | string | null;
  current_period_end: Date | string | null;
  subscription_current_period_ends_at: Date | string | null;
  grace_expires_at: Date | string | null;
  subscription_grace_period_ends_at: Date | string | null;
  subscription_cadence: string | null;
};

async function loadEmpresaSubscriptionState(
  empresaId: number,
): Promise<EmpresaSubscriptionRow | null> {
  const result = await pool.query<EmpresaSubscriptionRow>(
    `SELECT id,
            nome_empresa,
            asaas_subscription_id,
            trial_started_at,
            trial_ends_at,
            subscription_trial_ends_at,
            current_period_start,
            current_period_end,
            subscription_current_period_ends_at,
            grace_expires_at,
            subscription_grace_period_ends_at,
            subscription_cadence
       FROM public.empresas
      WHERE id = $1
      LIMIT 1`,

    [empresaId],
  );

  if (result.rowCount === 0) {
    return null;
  }

  return result.rows[0];
}

const parseDateColumn = (value: unknown): Date | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getTime());
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
};

const formatDateToYMD = (date: Date): string => date.toISOString().slice(0, 10);

const cloneDate = (date: Date | null): Date | null => (date ? new Date(date.getTime()) : null);


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

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

const PAID_CHARGE_STATUSES = new Set(['RECEIVED', 'RECEIVED_IN_CASH', 'RECEIVED_PARTIALLY', 'CONFIRMED']);

function isChargePaid(status: unknown): boolean {
  if (typeof status !== 'string') {
    return false;
  }

  const normalized = status.trim().toUpperCase();
  if (!normalized) {
    return false;
  }

  return PAID_CHARGE_STATUSES.has(normalized);
}

async function resolvePlanPaymentAccountId(): Promise<string | null> {
  const envValue = sanitizeString(process.env.PLAN_PAYMENT_ACCOUNT_ID);
  if (envValue && isValidUuid(envValue)) {
    return envValue;
  }

  const result = await pool.query<{ id: string }>(
    'SELECT id::text AS id FROM public.accounts WHERE idempresa = 2 LIMIT 1',
  );

  if (result.rowCount === 0) {
    return null;
  }

  const rawId = sanitizeString(result.rows[0]?.id);
  if (rawId && isValidUuid(rawId)) {
    return rawId;
  }

  return null;
}

async function createFinancialFlow({
  description,
  value,
  dueDate,
  accountId,
  empresaId,
}: {
  description: string;
  value: number;
  dueDate: string;
  accountId: string | null;
  empresaId: number;
}): Promise<{ id: number | string; descricao: string; valor: string; vencimento: string; status: string } | null> {
  const result = await pool.query(
    `INSERT INTO financial_flows (
        tipo,
        descricao,
        vencimento,
        valor,
        status,
        conta_id,
        cliente_id,
        fornecedor_id,
        external_provider,
        external_reference_id,
        idempresa
      )
      VALUES ('receita', $1, $2, $3, 'pendente', $4, NULL, NULL, 'asaas', NULL, $5)
      RETURNING id, descricao, valor::text AS valor, vencimento::text AS vencimento, status`,
    [description, dueDate, value, accountId, empresaId],
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0] as {
    id: unknown;
    descricao: string;
    valor: string;
    vencimento: string;
    status: string;
  };

  let id: number | string;
  try {
    id = normalizeFinancialFlowIdentifierFromRow(row.id);
  } catch (error) {
    return null;
  }

  return {
    id,
    descricao: row.descricao,
    valor: row.valor,
    vencimento: row.vencimento,
    status: row.status,
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
  const cardToken = sanitizeString(req.body?.cardToken ?? req.body?.card?.token);
  let cardMetadata = sanitizeMetadataRecord(req.body?.cardMetadata ?? req.body?.card?.metadata);

  if (cardMetadata) {
    const candidate = cardMetadata.remoteIp;
    if (typeof candidate === 'string') {
      const sanitized = sanitizeIp(candidate);
      if (sanitized) {
        cardMetadata.remoteIp = sanitized;
      } else {
        delete cardMetadata.remoteIp;
      }
    }
  }

  const forwardedForHeader = req.headers['x-forwarded-for'];
  const forwardedFor = Array.isArray(forwardedForHeader) ? forwardedForHeader[0] : forwardedForHeader;
  const remoteIp =
    (cardMetadata?.remoteIp as string | undefined) ??
    sanitizeIp(req.body?.remoteIp) ??
    sanitizeIp(forwardedFor) ??
    sanitizeIp(req.ip);

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

  if (billingType === 'CREDIT_CARD' && !cardToken) {
    res.status(400).json({ error: 'Informe o token do cartão para concluir a cobrança via cartão.' });
    return;
  }

  const description = buildChargeDescription(plan, pricingMode);
  const externalReference = `plan-${planId}-empresa-${empresaId}-${Date.now()}`;

  const empresaState = await loadEmpresaSubscriptionState(empresaId);
  if (!empresaState) {
    res.status(404).json({ error: 'Empresa não encontrada.' });
    return;
  }

  const existingSubscriptionId = sanitizeString(empresaState.asaas_subscription_id);
  const existingTrialStartedAt = parseDateColumn(empresaState.trial_started_at);
  const existingTrialEndsAt =
    parseDateColumn(empresaState.subscription_trial_ends_at) ??
    parseDateColumn(empresaState.trial_ends_at);
  const existingCurrentPeriodStart = parseDateColumn(empresaState.current_period_start);
  const existingCurrentPeriodEnd =
    parseDateColumn(empresaState.subscription_current_period_ends_at) ??
    parseDateColumn(empresaState.current_period_end);
  const existingGraceExpiresAt =
    parseDateColumn(empresaState.subscription_grace_period_ends_at) ??
    parseDateColumn(empresaState.grace_expires_at);
  const existingCadence = parseSubscriptionCadence(empresaState.subscription_cadence) ?? 'monthly';

  const defaultDueDateStr = resolveDueDate(billingType);
  const defaultDueDate = parseDateColumn(defaultDueDateStr) ?? new Date();

  let nextDueDateDate = existingTrialEndsAt ?? existingCurrentPeriodEnd ?? defaultDueDate;
  if (nextDueDateDate.getTime() < defaultDueDate.getTime()) {
    nextDueDateDate = defaultDueDate;
  }
  const nextDueDate = formatDateToYMD(nextDueDateDate);

  const trialPayload = (() => {
    const start = existingTrialStartedAt ? formatDateToYMD(existingTrialStartedAt) : null;
    const end = existingTrialEndsAt ? formatDateToYMD(existingTrialEndsAt) : null;
    if (!start && !end) {
      return null;
    }
    return {
      ...(start ? { startDate: start } : {}),
      ...(end ? { endDate: end } : {}),
    } as { startDate?: string; endDate?: string };
  })();

  let integration;
  try {
    const environment = resolveConfiguredAsaasEnvironment();
    integration = await resolveAsaasIntegration(
      empresaId,
      undefined,
      environment,
      { scope: 'global-first' },
    );
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
          if (handleAsaasError(res, error, 'Não foi possível preparar o cliente no Asaas.')) {
            return;
          }
          throw error;
        }
      }
    } else {
      const customer = await client.createCustomer(customerPayload);
      customerId = customer.id;
    }
  } catch (error) {
    console.error('Falha ao preparar cliente no Asaas', error);
    if (handleAsaasError(res, error, 'Não foi possível preparar o cliente no Asaas.')) {
      return;
    }

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

  const subscriptionCycle = pricingMode === 'anual' ? 'YEARLY' : 'MONTHLY';

  let subscriptionResult;
  try {
    subscriptionResult = await asaasSubscriptionService.createOrUpdateSubscription({
      integration,
      payload: {
        subscriptionId: existingSubscriptionId ?? undefined,
        customer: customerId,
        billingType,
        cycle: subscriptionCycle,
        value: price,
        nextDueDate,
        description,
        externalReference,
        metadata: {
          planId,
          empresaId,
          pricingMode,
        },
        ...(trialPayload ? { trial: trialPayload } : {}),
      },
    });
  } catch (error) {
    console.error('Falha ao sincronizar assinatura no Asaas', error);
    if (handleAsaasError(res, error, 'Não foi possível criar ou atualizar a assinatura no Asaas.')) {
      return;
    }

    const message =
      error instanceof Error && 'message' in error
        ? (error as Error).message
        : 'Não foi possível criar ou atualizar a assinatura no Asaas.';
    res.status(502).json({ error: message });
    return;
  }

  const { subscription, timeline } = subscriptionResult;

  let resolvedCadence = timeline.cadence ?? existingCadence;
  if (resolvedCadence !== 'monthly' && resolvedCadence !== 'annual') {
    resolvedCadence = existingCadence;
  }

  let resolvedTrialStartedAt = timeline.trialStart ?? existingTrialStartedAt ?? null;
  let resolvedTrialEndsAt = timeline.trialEnd ?? existingTrialEndsAt ?? null;

  let resolvedCurrentPeriodStart =
    timeline.currentPeriodStart ??
    existingCurrentPeriodStart ??
    (resolvedTrialEndsAt ? new Date(resolvedTrialEndsAt.getTime()) : null);
  let resolvedCurrentPeriodEnd =
    timeline.currentPeriodEnd ??
    existingCurrentPeriodEnd ??
    (nextDueDateDate ? new Date(nextDueDateDate.getTime()) : null);

  if (resolvedCurrentPeriodEnd && !resolvedCurrentPeriodStart) {
    const start = new Date(resolvedCurrentPeriodEnd.getTime());
    start.setUTCDate(start.getUTCDate() - CADENCE_DURATION_DAYS[resolvedCadence]);
    resolvedCurrentPeriodStart = start;
  } else if (resolvedCurrentPeriodStart && !resolvedCurrentPeriodEnd) {
    const end = new Date(resolvedCurrentPeriodStart.getTime());
    end.setUTCDate(end.getUTCDate() + CADENCE_DURATION_DAYS[resolvedCadence]);
    resolvedCurrentPeriodEnd = end;
  }

  const resolvedGraceExpiresAt =
    timeline.gracePeriodEnd ??
    existingGraceExpiresAt ??
    (resolvedCurrentPeriodEnd
      ? calculateGraceDeadline(resolvedCurrentPeriodEnd, resolvedCadence)
      : null);

  const shouldAwaitConfirmation =
    billingType === 'PIX' || billingType === 'BOLETO' || billingType === 'CREDIT_CARD' || billingType === 'DEBIT_CARD';
  const initialSubscriptionStatus = shouldAwaitConfirmation ? 'pending' : 'active';
  const initialActiveFlag = initialSubscriptionStatus === 'active';

  const updateResult = await pool.query(
    `UPDATE public.empresas
        SET plano = $1,
            ativo = $2,
            asaas_subscription_id = $3,
            trial_started_at = COALESCE($4, trial_started_at),
            trial_ends_at = COALESCE($5, trial_ends_at),
            current_period_start = COALESCE($6, current_period_start),
            current_period_end = COALESCE($7, current_period_end),
            grace_expires_at = COALESCE($8, grace_expires_at),
            subscription_trial_ends_at = COALESCE($5, subscription_trial_ends_at),
            subscription_current_period_ends_at = COALESCE($7, subscription_current_period_ends_at),
            subscription_grace_period_ends_at = COALESCE($8, subscription_grace_period_ends_at),
            subscription_cadence = $9,
            subscription_status = $10
       WHERE id = $11
       RETURNING id, nome_empresa, plano, ativo, trial_started_at, trial_ends_at, current_period_start, current_period_end, grace_expires_at, subscription_cadence, asaas_subscription_id`,
    [
      planId,
      initialActiveFlag,
      subscription.id,
      cloneDate(resolvedTrialStartedAt),
      cloneDate(resolvedTrialEndsAt),
      cloneDate(resolvedCurrentPeriodStart),
      cloneDate(resolvedCurrentPeriodEnd),
      cloneDate(resolvedGraceExpiresAt),
      resolvedCadence,
      initialSubscriptionStatus,
      empresaId,
    ],
  );

  if (updateResult.rowCount === 0) {
    res.status(404).json({ error: 'Empresa não encontrada.' });

    return;
  }

  let accountId: string | null = null;
  try {
    accountId = await resolvePlanPaymentAccountId();
  } catch (error) {
    console.error('Falha ao resolver conta padrão para fluxo financeiro do plano', error);
    res
      .status(500)
      .json({ error: 'Não foi possível determinar a conta para registrar a cobrança.' });
    return;
  }

  const flow = await createFinancialFlow({
    description,
    value: price,
    dueDate: nextDueDate,
    accountId,
    empresaId,
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
      dueDate: nextDueDate,
      description,
      customer: customerId,
      payerEmail: billingEmail,
      payerName: companyName,
      customerDocument: companyDocument,
      cardToken: cardToken ?? undefined,
      metadata: {
        planId,
        pricingMode,
        empresaId,
        origin: 'plan-payment',
        subscriptionId: subscription.id,
        ...(cardMetadata ? { cardMetadata } : {}),
      },
      remoteIp: remoteIp ?? undefined,
    });

    const subscriptionInfo = {
      id: subscription.id,
      status: sanitizeString((subscription as Record<string, unknown>).status) ?? null,
      cycle:
        sanitizeString((subscription as Record<string, unknown>).cycle) ??
        (subscriptionCycle as string),
      nextDueDate: sanitizeString(subscription.nextDueDate) ?? nextDueDate,
      cadence: resolvedCadence,
      trialStart: resolvedTrialStartedAt ? resolvedTrialStartedAt.toISOString() : null,
      trialEnd: resolvedTrialEndsAt ? resolvedTrialEndsAt.toISOString() : null,
      currentPeriodStart: resolvedCurrentPeriodStart
        ? resolvedCurrentPeriodStart.toISOString()
        : null,
      currentPeriodEnd: resolvedCurrentPeriodEnd ? resolvedCurrentPeriodEnd.toISOString() : null,
      gracePeriodEnd: resolvedGraceExpiresAt ? resolvedGraceExpiresAt.toISOString() : null,
    };

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
      subscription: subscriptionInfo,
    });

    if (billingType === 'CREDIT_CARD' || billingType === 'DEBIT_CARD') {
      const paid = isChargePaid(chargeResult.charge?.status);
      if (paid) {
        try {
          await pool.query(
            `UPDATE public.empresas SET subscription_status = 'active', ativo = TRUE WHERE id = $1`,
            [empresaId],
          );
        } catch (statusError) {
          console.error('Falha ao atualizar status da assinatura após cobrança no cartão', statusError);
        }
      }
    }
  } catch (error) {
    if (error instanceof AsaasChargeValidationError) {
      res
        .status(400)
        .json(
          buildErrorResponse(
            error,
            'Não foi possível validar os dados da cobrança do plano.',
            { expose: true }
          )
        );
      return;
    }
    if (error instanceof ChargeConflictError) {
      res
        .status(409)
        .json(
          buildErrorResponse(
            error,
            'Já existe uma cobrança ativa para este plano.',
            { expose: true }
          )
        );
      return;
    }
    if (handleAsaasError(res, error, 'Não foi possível criar a cobrança do plano no Asaas.')) {
      return;
    }
    console.error('Falha ao criar cobrança do plano no Asaas', error);
    res.status(502).json({ error: 'Não foi possível criar a cobrança do plano no Asaas.' });
  }
};

type CurrentPlanPaymentRow = {
  flow_id: unknown;
  flow_descricao: string | null;
  flow_valor: string | number | null;
  flow_vencimento: Date | string | null;
  flow_status: string | null;
  charge_id: number | string | null;
  charge_financial_flow_id: unknown;
  charge_asaas_charge_id: string | null;
  charge_billing_type: string | null;
  charge_status: string | null;
  charge_due_date: Date | string | null;
  charge_value: string | number | null;
  charge_invoice_url: string | null;
  charge_pix_payload: string | null;
  charge_pix_qr_code: string | null;
  charge_boleto_url: string | null;
  charge_card_last4: string | null;
  charge_card_brand: string | null;
  plan_id: number | string | null;
  plan_nome: string | null;
  plan_valor_mensal: string | number | null;
  plan_valor_anual: string | number | null;
  subscription_cadence: string | null;
};

export const getCurrentPlanPayment = async (req: Request, res: Response) => {
  if (!req.auth) {
    res.status(401).json({ error: 'Token inválido.' });
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

  const result = await pool.query<CurrentPlanPaymentRow>(
    `SELECT
        ff.id AS flow_id,
        ff.descricao AS flow_descricao,
        ff.valor AS flow_valor,
        ff.vencimento AS flow_vencimento,
        ff.status AS flow_status,
        ac.id AS charge_id,
        ac.financial_flow_id AS charge_financial_flow_id,
        ac.asaas_charge_id AS charge_asaas_charge_id,
        ac.billing_type AS charge_billing_type,
        ac.status AS charge_status,
        ac.due_date AS charge_due_date,
        ac.value AS charge_value,
        ac.invoice_url AS charge_invoice_url,
        ac.pix_payload AS charge_pix_payload,
        ac.pix_qr_code AS charge_pix_qr_code,
        ac.boleto_url AS charge_boleto_url,
        ac.card_last4 AS charge_card_last4,
        ac.card_brand AS charge_card_brand,
        p.id AS plan_id,
        p.nome AS plan_nome,
        p.valor_mensal AS plan_valor_mensal,
        p.valor_anual AS plan_valor_anual,
        e.subscription_cadence AS subscription_cadence
      FROM financial_flows ff
      JOIN asaas_charges ac ON ac.financial_flow_id = ff.id
      JOIN empresas e ON e.id = ff.idempresa
      LEFT JOIN planos p ON p.id = e.plano
     WHERE ff.idempresa = $1
       AND ff.status = 'pendente'
       AND ac.billing_type = ANY(ARRAY['PIX','BOLETO','CREDIT_CARD','DEBIT_CARD'])
       AND COALESCE((ac.raw_response::jsonb -> 'metadata' ->> 'origin'), '') = 'plan-payment'
     ORDER BY ac.created_at DESC, ff.vencimento DESC
     LIMIT 1`,
    [empresaId],
  );

  if (result.rowCount === 0) {
    res.status(404).json({ error: 'Nenhuma cobrança pendente encontrada para o plano atual.' });
    return;
  }

  const row = result.rows[0];
  let flowId: number | string;
  try {
    flowId = normalizeFinancialFlowIdentifierFromRow(row.flow_id);
  } catch (error) {
    res.status(500).json({ error: 'Não foi possível identificar o fluxo financeiro.' });
    return;
  }

  let chargeFlowId: number | string;
  try {
    chargeFlowId = normalizeFinancialFlowIdentifierFromRow(row.charge_financial_flow_id);
  } catch (error) {
    res.status(500).json({ error: 'Não foi possível identificar a cobrança do Asaas.' });
    return;
  }

  const planId = parseNumericId(row.plan_id);
  const planName = sanitizeString(row.plan_nome);
  const cadence = parseSubscriptionCadence(row.subscription_cadence) ?? 'monthly';
  const pricingMode: 'mensal' | 'anual' = cadence === 'annual' ? 'anual' : 'mensal';
  const planPrice =
    pricingMode === 'anual'
      ? parseCurrency(row.plan_valor_anual)
      : parseCurrency(row.plan_valor_mensal);

  const chargeDueDate = parseDateColumn(row.charge_due_date);
  const flowDueDate = parseDateColumn(row.flow_vencimento);
  const paymentMethod = parsePaymentMethod(row.charge_billing_type);

  res.json({
    plan: {
      id: planId,
      nome: planName,
      pricingMode,
      price: planPrice,
    },
    paymentMethod,
    charge: {
      id: parseNumericId(row.charge_id),
      financialFlowId: chargeFlowId,
      asaasChargeId: sanitizeString(row.charge_asaas_charge_id),
      billingType: paymentMethod,
      status: sanitizeString(row.charge_status),
      dueDate: chargeDueDate ? chargeDueDate.toISOString().slice(0, 10) : null,
      value:
        row.charge_value === null || row.charge_value === undefined
          ? null
          : String(row.charge_value),
      invoiceUrl: sanitizeString(row.charge_invoice_url),
      boletoUrl: sanitizeString(row.charge_boleto_url),
      pixPayload: sanitizeString(row.charge_pix_payload),
      pixQrCode: sanitizeString(row.charge_pix_qr_code),
      cardLast4: sanitizeString(row.charge_card_last4),
      cardBrand: sanitizeString(row.charge_card_brand),
    },
    flow: {
      id: flowId,
      descricao: sanitizeString(row.flow_descricao),
      valor:
        row.flow_valor === null || row.flow_valor === undefined
          ? null
          : String(row.flow_valor),
      vencimento: flowDueDate ? flowDueDate.toISOString().slice(0, 10) : null,
      status: sanitizeString(row.flow_status),
    },
  });
};

export default { createPlanPayment, getCurrentPlanPayment };
