import crypto from 'crypto';
import type { Request, Response } from 'express';
import pool from '../services/db';
import {
  applySubscriptionOverdue,
  applySubscriptionPayment,
  findCompanyIdForCliente,
  findCompanyIdForFinancialFlow,
} from '../services/subscriptionService';

interface RawBodyRequest extends Request {
  rawBody?: string;
}

interface AsaasPaymentPayload {
  id?: string;
  chargeId?: string;
  subscription?: string;
  status?: string;
  dueDate?: string;
  paymentDate?: string;
  clientPaymentDate?: string;
  confirmedDate?: string;
  creditDate?: string;
  updatedDate?: string;
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
  financial_flow_id: number | null;
  cliente_id: number | string | null;
};

type CredentialRecord = {
  webhook_secret: string | null;
};

const HANDLED_EVENTS = new Set([
  'PAYMENT_RECEIVED',
  'PAYMENT_CONFIRMED',
  'PAYMENT_OVERDUE',
]);

function extractSignature(req: Request): string | null {
  const headerNames = ['asaas-signature', 'x-hub-signature', 'x-hub-signature-256'];

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
    'SELECT id, credential_id, financial_flow_id, cliente_id FROM asaas_charges WHERE asaas_charge_id = $1',
    [asaasChargeId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return result.rows[0] ?? null;
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

async function updateFinancialFlowAsPaid(financialFlowId: number, paymentDate: string | null): Promise<void> {
  const paidAt = paymentDate ?? new Date().toISOString();
  await pool.query(
    "UPDATE financial_flows SET status = 'pago', pagamento = $1 WHERE id = $2",
    [paidAt, financialFlowId]
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

  let charge: ChargeRecord | null = null;

  try {
    charge = await findChargeByAsaasId(asaasChargeId);
  } catch (error) {
    console.error('[AsaasWebhook] Failed to load charge', error);
    return res.status(202).json(buildWebhookResponse());
  }

  if (!charge) {
    console.warn('[AsaasWebhook] Charge not found for id', asaasChargeId);
    return res.status(202).json(buildWebhookResponse());
  }

  if (!charge.credential_id) {
    console.error('[AsaasWebhook] Charge without credential reference', charge.id);
    return res.status(202).json(buildWebhookResponse());
  }

  let secret: string | null = null;

  try {
    secret = await findCredentialSecret(charge.credential_id);
  } catch (error) {
    console.error('[AsaasWebhook] Failed to load credential secret', error);
    return res.status(202).json(buildWebhookResponse());
  }

  if (!secret) {
    console.error('[AsaasWebhook] Missing webhook secret for credential', charge.credential_id);
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

  try {
    await updateCharge(asaasChargeId, normalizedEvent, status, paymentDate, payload ?? {});

    if (charge.financial_flow_id && shouldMarkAsPaid(normalizedEvent)) {
      await updateFinancialFlowAsPaid(charge.financial_flow_id, paymentDate);
    }

    let companyId: number | null = null;

    try {
      if (charge.financial_flow_id) {
        companyId = await findCompanyIdForFinancialFlow(charge.financial_flow_id);
      }

      if (!companyId && charge.cliente_id != null) {
        companyId = await findCompanyIdForCliente(charge.cliente_id);
      }
    } catch (lookupError) {
      console.error('[AsaasWebhook] Failed to resolve company for charge', charge.id, lookupError);
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

