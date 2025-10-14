import crypto from 'crypto';
import type { Request, Response } from 'express';
import resolveAsaasIntegration from '../services/asaas/integrationResolver';
import pool from '../services/db';
import {
  applySubscriptionOverdue,
  applySubscriptionPayment,
  findCompanyIdForCliente,
  findCompanyIdForFinancialFlow,
} from '../services/subscriptionService';
import { normalizeFinancialFlowIdentifier } from '../utils/financialFlowIdentifier';

interface RawBodyRequest extends Request {
  rawBody?: string;
}

interface AsaasPaymentPayload {
  id?: string;
  chargeId?: string;
  subscription?: string;
  customer?: string;
  externalReference?: string;
  status?: string;
  dueDate?: string;
  paymentDate?: string;
  clientPaymentDate?: string;
  confirmedDate?: string;
  creditDate?: string;
  updatedDate?: string;
  billingType?: string;
  value?: number | string | null;
  metadata?: Record<string, unknown> | null;
  [key: string]: unknown;
}

interface AsaasWebhookBody {
  event?: string;
  dateCreated?: string;
  payment?: AsaasPaymentPayload | null;
  [key: string]: unknown;
}

type ChargeRecord = {
  id: number;
  credential_id: number | null;
  financial_flow_id: number | string | null;
  cliente_id: number | string | null;
  company_id: number | null;
};

type CredentialRecord = {
  webhook_secret: string | null;
};

const HANDLED_EVENTS = new Set([
  'PAYMENT_RECEIVED',
  'PAYMENT_CONFIRMED',
  'PAYMENT_OVERDUE',
  'PAYMENT_REFUNDED',
]);

function extractSignature(req: Request): string | null {
  const headerNames = [
    'asaas-signature',
    'asaas-signature-256',
    'x-asaas-signature',
    'x-asaas-signature-256',
    'x-hub-signature',
    'x-hub-signature-256',
  ];

  for (const header of headerNames) {
    const value = req.headers[header];
    if (!value) {
      continue;
    }

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    if (Array.isArray(value)) {
      const first = value.find((item) => typeof item === 'string' && item.trim());
      if (first) {
        return first.trim();
      }
    }
  }

  return null;
}

function decodeSignatureToBuffer(signature: string): Buffer | null {
  const trimmed = signature.replace(/^sha256=/i, '').trim();
  if (!trimmed) {
    return null;
  }

  if (/^[0-9a-f]+$/i.test(trimmed) && trimmed.length % 2 === 0) {
    return Buffer.from(trimmed, 'hex');
  }

  if (/^[0-9a-z+/=]+$/i.test(trimmed)) {
    try {
      const buffer = Buffer.from(trimmed, 'base64');
      if (buffer.length > 0) {
        return buffer;
      }
    } catch (error) {
      console.warn('[AsaasWebhook] Failed to decode base64 signature', error);
    }
  }

  return null;
}

function computeExpectedSignature(secret: string, payload: string): Buffer {
  return crypto.createHmac('sha256', secret).update(payload).digest();
}

function extractChargeId(payment: AsaasPaymentPayload | null | undefined): string | null {
  if (!payment || typeof payment !== 'object') {
    return null;
  }

  const idCandidates = [payment.id, payment.chargeId];
  for (const candidate of idCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

function normalizeCompanyId(value: unknown): number | null {
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

function normalizeClienteId(value: unknown): number | string | null {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return null;
}

function sanitizeString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function extractCompanyIdFromMetadata(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  const record = metadata as Record<string, unknown>;
  const candidates = [record.empresaId, record.companyId, record.companyID, record.empresa];

  for (const candidate of candidates) {
    const normalized = normalizeCompanyId(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function extractCompanyIdFromExternalReference(value: string | null | undefined): number | null {
  const normalized = sanitizeString(value);
  if (!normalized) {
    return null;
  }

  const match = normalized.match(/empresa[-_]?([0-9]+)/i);
  if (match && match[1]) {
    const parsed = Number.parseInt(match[1], 10);
    if (Number.isInteger(parsed)) {
      return parsed;
    }
  }

  return null;
}

async function findCompanyIdBySubscriptionId(subscriptionId: string): Promise<number | null> {
  const result = await pool.query<{ id: unknown }>(
    'SELECT id FROM public.empresas WHERE asaas_subscription_id = $1 LIMIT 1',
    [subscriptionId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return normalizeCompanyId(result.rows[0]?.id);
}

async function findCompanyIdByCustomerId(customerId: string): Promise<number | null> {
  const result = await pool.query<{ id: unknown }>(
    'SELECT id FROM public.empresas WHERE asaas_customer_id = $1 LIMIT 1',
    [customerId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return normalizeCompanyId(result.rows[0]?.id);
}

async function resolveCompanyIdFromPayment(payment: AsaasPaymentPayload | null | undefined): Promise<number | null> {
  if (!payment) {
    return null;
  }

  const metadataCompanyId = extractCompanyIdFromMetadata(payment.metadata ?? null);
  if (metadataCompanyId) {
    return metadataCompanyId;
  }

  const externalReferenceCompanyId = extractCompanyIdFromExternalReference(payment.externalReference);
  if (externalReferenceCompanyId) {
    return externalReferenceCompanyId;
  }

  const subscriptionId = sanitizeString(payment.subscription);
  if (subscriptionId) {
    const companyId = await findCompanyIdBySubscriptionId(subscriptionId);
    if (companyId) {
      return companyId;
    }
  }

  const customerId = sanitizeString(payment.customer);
  if (customerId) {
    const companyId = await findCompanyIdByCustomerId(customerId);
    if (companyId) {
      return companyId;
    }
  }

  return null;
}

async function resolveCredentialIdForCompany(companyId: number): Promise<number | null> {
  if (!Number.isInteger(companyId) || companyId <= 0) {
    return null;
  }

  try {
    const integration = await resolveAsaasIntegration(companyId);
    return integration.credentialId ?? null;
  } catch (error) {
    console.error('[AsaasWebhook] Failed to resolve integration for company', companyId, error);
    return null;
  }
}

function normalizeEventName(event: string | null | undefined): string | null {
  if (typeof event !== 'string') {
    return null;
  }

  const normalized = event.trim().toUpperCase();
  return normalized || null;
}

function shouldMarkAsPaid(event: string): boolean {
  return event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED';
}

function shouldMarkAsRefunded(event: string, status: string | null | undefined): boolean {
  if (event === 'PAYMENT_REFUNDED') {
    return true;
  }

  if (!status) {
    return false;
  }

  const normalized = status.trim().toUpperCase();
  return normalized === 'REFUNDED' || normalized === 'REFUND_PENDING' || normalized === 'REFUND_REQUESTED';
}

function extractPaymentDate(payment: AsaasPaymentPayload | null | undefined): string | null {
  if (!payment) {
    return null;
  }

  const candidates = [
    payment.clientPaymentDate,
    payment.paymentDate,
    payment.confirmedDate,
    payment.creditDate,
    payment.updatedDate,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string') {
      continue;
    }

    const trimmed = candidate.trim();
    if (!trimmed) {
      continue;
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return null;
}

function extractChargeStatus(event: string, payment: AsaasPaymentPayload | null | undefined): string {
  if (payment?.status && typeof payment.status === 'string') {
    return payment.status.trim();
  }

  switch (event) {
    case 'PAYMENT_RECEIVED':
      return 'RECEIVED';
    case 'PAYMENT_CONFIRMED':
      return 'CONFIRMED';
    case 'PAYMENT_OVERDUE':
      return 'OVERDUE';
    default:
      return event;
  }
}

async function findChargeByAsaasId(asaasChargeId: string): Promise<ChargeRecord | null> {
  const result = await pool.query<ChargeRecord>(
    `SELECT ac.id,
            ac.credential_id,
            ac.financial_flow_id,
            ac.cliente_id,
            ff.idempresa AS company_id
       FROM asaas_charges ac
       LEFT JOIN financial_flows ff ON ff.id = ac.financial_flow_id
      WHERE ac.asaas_charge_id = $1`,
    [asaasChargeId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0] ?? null;
  if (!row) {
    return null;
  }

  const normalizedFinancialFlowId = normalizeFinancialFlowIdentifier(row.financial_flow_id);
  const normalizedCompanyId = normalizeCompanyId(row.company_id);

  return {
    ...row,
    financial_flow_id: normalizedFinancialFlowId,
    company_id: normalizedCompanyId,
  };
}

interface FlowContext {
  financialFlowId: number | string | null;
  clienteId: number | string | null;
  companyId: number | null;
}

async function findFinancialFlowContextByExternalReference(
  asaasChargeId: string,
): Promise<FlowContext | null> {
  const result = await pool.query<{ id: unknown; cliente_id: unknown; idempresa: unknown }>(
    `SELECT id, cliente_id, idempresa
       FROM financial_flows
      WHERE external_reference_id = $1
      LIMIT 1`,
    [asaasChargeId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];

  return {
    financialFlowId: normalizeFinancialFlowIdentifier(row.id),
    clienteId: normalizeClienteId(row.cliente_id),
    companyId: normalizeCompanyId(row.idempresa),
  };
}

interface ChargeContext {
  charge: ChargeRecord | null;
  credentialId: number | null;
  financialFlowId: number | string | null;
  clienteId: number | string | null;
  companyId: number | null;
}

async function resolveChargeContext(
  asaasChargeId: string,
  payment: AsaasPaymentPayload | null,
): Promise<ChargeContext | null> {
  let charge: ChargeRecord | null = null;

  try {
    charge = await findChargeByAsaasId(asaasChargeId);
  } catch (error) {
    console.error('[AsaasWebhook] Failed to load charge', error);
    return null;
  }

  if (charge) {
    const companyId = charge.company_id ?? (await resolveCompanyIdFromPayment(payment));
    return {
      charge,
      credentialId: charge.credential_id,
      financialFlowId: charge.financial_flow_id,
      clienteId: charge.cliente_id,
      companyId: companyId ?? null,
    };
  }

  const flowContext = await findFinancialFlowContextByExternalReference(asaasChargeId);

  if (!flowContext) {
    const companyId = await resolveCompanyIdFromPayment(payment);
    return {
      charge: null,
      credentialId: companyId ? await resolveCredentialIdForCompany(companyId) : null,
      financialFlowId: null,
      clienteId: null,
      companyId,
    };
  }

  let companyId = flowContext.companyId;
  if (!companyId) {
    companyId = await resolveCompanyIdFromPayment(payment);
  }

  const credentialId = companyId ? await resolveCredentialIdForCompany(companyId) : null;

  return {
    charge: null,
    credentialId,
    financialFlowId: flowContext.financialFlowId,
    clienteId: flowContext.clienteId,
    companyId: companyId ?? null,
  };
}

function extractDueDate(payment: AsaasPaymentPayload | null | undefined): Date | null {
  if (!payment || typeof payment.dueDate !== 'string') {
    return null;
  }

  const trimmed = payment.dueDate.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

async function findCredentialSecret(credentialId: number): Promise<string | null> {
  const result = await pool.query<CredentialRecord>(
    'SELECT webhook_secret FROM asaas_credentials WHERE id = $1',
    [credentialId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];
  if (!row?.webhook_secret) {
    return null;
  }

  return row.webhook_secret;
}

function resolveEnvWebhookSecret(): string | null {
  const value = process.env.ASAAS_WEBHOOK_SECRET;

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

async function resolveWebhookSecret(credentialId: number | null): Promise<string | null> {
  if (!credentialId) {
    return resolveEnvWebhookSecret();
  }

  const secret = await findCredentialSecret(credentialId);
  if (secret) {
    return secret;
  }

  return resolveEnvWebhookSecret();
}

async function updateCharge(
  asaasChargeId: string,
  event: string,
  status: string,
  paymentDate: string | null,
  payload: AsaasWebhookBody
): Promise<void> {
  await pool.query(
    `UPDATE asaas_charges
       SET status = $1,
           last_event = $2,
           payload = $3,
           paid_at = $4,
           updated_at = NOW()
     WHERE asaas_charge_id = $5`,
    [status, event, JSON.stringify(payload), paymentDate, asaasChargeId]
  );
}

async function updateFinancialFlowAsPaid(
  financialFlowId: number | string,
  paymentDate: string | null,
): Promise<void> {
  const normalizedFinancialFlowId = normalizeFinancialFlowIdentifier(financialFlowId);

  if (normalizedFinancialFlowId === null) {
    return;
  }

  const paidAt = paymentDate ?? new Date().toISOString();
  await pool.query(
    "UPDATE financial_flows SET status = 'pago', pagamento = $1 WHERE id = $2",
    [paidAt, normalizedFinancialFlowId]
  );
}

async function updateFinancialFlowAsRefunded(financialFlowId: number | string): Promise<void> {
  const normalizedFinancialFlowId = normalizeFinancialFlowIdentifier(financialFlowId);

  if (normalizedFinancialFlowId === null) {
    return;
  }

  await pool.query(
    "UPDATE financial_flows SET status = 'estornado', pagamento = NULL WHERE id = $1",
    [normalizedFinancialFlowId],
  );
}

function buildWebhookResponse() {
  return { received: true };
}

function ensureHandledEvent(event: string | null): event is string {
  return Boolean(event && HANDLED_EVENTS.has(event));
}

function resolveWebhookUrl(req: Request): string {
  if (process.env.ASAAS_WEBHOOK_PUBLIC_URL && process.env.ASAAS_WEBHOOK_PUBLIC_URL.trim()) {
    return process.env.ASAAS_WEBHOOK_PUBLIC_URL.trim();
  }

  const protocolHeader = req.headers['x-forwarded-proto'];
  const proto = Array.isArray(protocolHeader)
    ? protocolHeader[0]
    : typeof protocolHeader === 'string'
    ? protocolHeader
    : req.protocol;

  const hostHeader = req.headers['x-forwarded-host'] ?? req.headers.host;
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;

  if (typeof host === 'string' && host.trim()) {
    const normalizedProto = typeof proto === 'string' && proto.trim() ? proto.trim() : 'https';
    return `${normalizedProto}://${host.trim()}/api/integrations/asaas/webhook`;
  }

  return 'https://<SEU_BACKEND>/api/integrations/asaas/webhook';
}

export async function handleAsaasWebhook(req: Request, res: Response) {
  const rawRequest = req as RawBodyRequest;
  const payload = req.body as AsaasWebhookBody | null;
  const normalizedEvent = normalizeEventName(payload?.event ?? null);

  if (!ensureHandledEvent(normalizedEvent)) {
    console.info('[AsaasWebhook] Ignoring unsupported event', payload?.event);
    return res.status(202).json(buildWebhookResponse());
  }

  const payment = payload?.payment ?? null;
  const asaasChargeId = extractChargeId(payment);

  if (!asaasChargeId) {
    console.error('[AsaasWebhook] Missing charge identifier in payload');
    return res.status(202).json(buildWebhookResponse());
  }

  let context: ChargeContext | null = null;

  try {
    context = await resolveChargeContext(asaasChargeId, payment);
  } catch (error) {
    console.error('[AsaasWebhook] Failed to resolve charge context', error);
    return res.status(202).json(buildWebhookResponse());
  }

  if (!context) {
    console.warn('[AsaasWebhook] Unable to resolve charge context for id', asaasChargeId);
    return res.status(202).json(buildWebhookResponse());
  }

  let secret: string | null = null;

  try {
    secret = await resolveWebhookSecret(context.credentialId ?? null);
  } catch (error) {
    console.error('[AsaasWebhook] Failed to load credential secret', error);
    return res.status(202).json(buildWebhookResponse());
  }

  if (!secret) {
    console.error('[AsaasWebhook] Missing webhook secret configuration');
    return res.status(202).json(buildWebhookResponse());
  }

  const signature = extractSignature(req);

  if (!signature) {
    console.error('[AsaasWebhook] Missing signature header');
    return res.status(202).json(buildWebhookResponse());
  }

  const rawBody = rawRequest.rawBody ?? JSON.stringify(payload ?? {});
  const providedSignature = decodeSignatureToBuffer(signature);

  if (!providedSignature) {
    console.error('[AsaasWebhook] Unable to parse provided signature');
    return res.status(202).json(buildWebhookResponse());
  }

  const expectedSignature = computeExpectedSignature(secret, rawBody);

  if (providedSignature.length !== expectedSignature.length) {
    console.error('[AsaasWebhook] Signature length mismatch');
    return res.status(202).json(buildWebhookResponse());
  }

  const isValidSignature = crypto.timingSafeEqual(providedSignature, expectedSignature);
  if (!isValidSignature) {
    console.error('[AsaasWebhook] Invalid signature for charge', asaasChargeId);
    return res.status(202).json(buildWebhookResponse());
  }

  const status = extractChargeStatus(normalizedEvent, payment);
  const paymentDate = shouldMarkAsPaid(normalizedEvent) ? extractPaymentDate(payment) : null;
  const dueDate = normalizedEvent === 'PAYMENT_OVERDUE' ? extractDueDate(payment) : null;
  const isRefunded = shouldMarkAsRefunded(normalizedEvent, status);

  try {
    if (context.charge) {
      await updateCharge(asaasChargeId, normalizedEvent, status, paymentDate, payload ?? {});
    }

    if (context.financialFlowId) {
      if (shouldMarkAsPaid(normalizedEvent)) {
        await updateFinancialFlowAsPaid(context.financialFlowId, paymentDate);
      } else if (isRefunded) {
        await updateFinancialFlowAsRefunded(context.financialFlowId);
      }
    }

    let companyId: number | null = context.companyId ?? null;

    try {
      if (!companyId && context.financialFlowId) {
        companyId = await findCompanyIdForFinancialFlow(context.financialFlowId);
      }

      if (!companyId && context.clienteId != null) {
        companyId = await findCompanyIdForCliente(context.clienteId);
      }
    } catch (lookupError) {
      console.error('[AsaasWebhook] Failed to resolve company for charge', asaasChargeId, lookupError);
    }

    if (!companyId) {
      companyId = await resolveCompanyIdFromPayment(payment);
    }

    if (companyId) {
      try {
        if (shouldMarkAsPaid(normalizedEvent)) {
          const effectivePaymentDate = paymentDate ? new Date(paymentDate) : new Date();
          await applySubscriptionPayment(companyId, effectivePaymentDate);
        } else if (normalizedEvent === 'PAYMENT_OVERDUE') {
          await applySubscriptionOverdue(companyId, dueDate);
        }
      } catch (subscriptionError) {
        console.error(
          '[AsaasWebhook] Failed to update subscription timelines for company',
          companyId,
          subscriptionError,
        );
      }
    }
  } catch (error) {
    console.error('[AsaasWebhook] Failed to persist webhook payload', error);
    return res.status(202).json(buildWebhookResponse());
  }

  console.info('[AsaasWebhook] Processed event', normalizedEvent, 'for charge', asaasChargeId);
  return res.status(202).json(buildWebhookResponse());
}

export async function getAsaasWebhookSecret(req: Request, res: Response) {
  const credentialId = Number(req.params.credentialId);
  if (!Number.isInteger(credentialId) || credentialId <= 0) {
    return res.status(400).json({ error: 'Parâmetro credentialId inválido' });
  }

  let secret: string | null = null;

  try {
    secret = await findCredentialSecret(credentialId);
  } catch (error) {
    console.error('[AsaasWebhook] Failed to load credential secret', error);
    return res.status(500).json({ error: 'Erro ao recuperar o segredo do webhook' });
  }

  if (!secret) {
    return res.status(404).json({ error: 'Credencial não localizada ou sem segredo configurado' });
  }

  const webhookUrl = resolveWebhookUrl(req);

  const instructions = [
    '1. Acesse o painel do Asaas e navegue até Configurações > Integrações > Webhooks.',
    `2. Informe a URL ${webhookUrl} como destino do webhook e selecione os eventos de pagamento desejados (ex.: PAYMENT_RECEIVED, PAYMENT_CONFIRMED, PAYMENT_OVERDUE).`,
    '3. Copie o valor de webhookSecret informado abaixo e utilize-o no campo de assinatura compartilhada do Asaas.',
    '4. Salve a configuração e realize um pagamento de teste para validar o fluxo de confirmação automática.'
  ];

  return res.json({
    credentialId,
    webhookUrl,
    webhookSecret: secret,
    instructions,
  });
}

