"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleAsaasWebhook = handleAsaasWebhook;
exports.getAsaasWebhookSecret = getAsaasWebhookSecret;
const crypto_1 = __importDefault(require("crypto"));
const db_1 = __importDefault(require("../services/db"));
const subscriptionService_1 = require("../services/subscriptionService");
const HANDLED_EVENTS = new Set([
    'PAYMENT_RECEIVED',
    'PAYMENT_CONFIRMED',
    'PAYMENT_OVERDUE',
]);
function extractSignature(req) {
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
function decodeSignatureToBuffer(signature) {
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
        }
        catch (error) {
            console.warn('[AsaasWebhook] Failed to decode base64 signature', error);
        }
    }
    return null;
}
function computeExpectedSignature(secret, payload) {
    return crypto_1.default.createHmac('sha256', secret).update(payload).digest();
}
function extractChargeId(payment) {
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
function normalizeEventName(event) {
    if (typeof event !== 'string') {
        return null;
    }
    const normalized = event.trim().toUpperCase();
    return normalized || null;
}
function shouldMarkAsPaid(event) {
    return event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED';
}
function extractPaymentDate(payment) {
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
function extractChargeStatus(event, payment) {
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
async function findChargeByAsaasId(asaasChargeId) {
    const result = await db_1.default.query('SELECT id, credential_id, financial_flow_id, cliente_id FROM asaas_charges WHERE asaas_charge_id = $1', [asaasChargeId]);
    if (result.rowCount === 0) {
        return null;
    }
    return result.rows[0] ?? null;
}
function extractDueDate(payment) {
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
async function findCredentialSecret(credentialId) {
    const result = await db_1.default.query('SELECT webhook_secret FROM asaas_credentials WHERE id = $1', [credentialId]);
    if (result.rowCount === 0) {
        return null;
    }
    const row = result.rows[0];
    if (!row?.webhook_secret) {
        return null;
    }
    return row.webhook_secret;
}
async function updateCharge(asaasChargeId, event, status, paymentDate, payload) {
    await db_1.default.query(`UPDATE asaas_charges
       SET status = $1,
           last_event = $2,
           payload = $3,
           paid_at = $4,
           updated_at = NOW()
     WHERE asaas_charge_id = $5`, [status, event, JSON.stringify(payload), paymentDate, asaasChargeId]);
}
async function updateFinancialFlowAsPaid(financialFlowId, paymentDate) {
    const paidAt = paymentDate ?? new Date().toISOString();
    await db_1.default.query("UPDATE financial_flows SET status = 'pago', pagamento = $1 WHERE id = $2", [paidAt, financialFlowId]);
}
function buildWebhookResponse() {
    return { received: true };
}
function ensureHandledEvent(event) {
    return Boolean(event && HANDLED_EVENTS.has(event));
}
function resolveWebhookUrl(req) {
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
async function handleAsaasWebhook(req, res) {
    const rawRequest = req;
    const payload = req.body;
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
    let charge = null;
    try {
        charge = await findChargeByAsaasId(asaasChargeId);
    }
    catch (error) {
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
    let secret = null;
    try {
        secret = await findCredentialSecret(charge.credential_id);
    }
    catch (error) {
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
    const isValidSignature = crypto_1.default.timingSafeEqual(providedSignature, expectedSignature);
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
        let companyId = null;
        try {
            if (charge.financial_flow_id) {
                companyId = await (0, subscriptionService_1.findCompanyIdForFinancialFlow)(charge.financial_flow_id);
            }
            if (!companyId && charge.cliente_id != null) {
                companyId = await (0, subscriptionService_1.findCompanyIdForCliente)(charge.cliente_id);
            }
        }
        catch (lookupError) {
            console.error('[AsaasWebhook] Failed to resolve company for charge', charge.id, lookupError);
        }
        if (companyId) {
            try {
                if (shouldMarkAsPaid(normalizedEvent)) {
                    const effectivePaymentDate = paymentDate ? new Date(paymentDate) : new Date();
                    await (0, subscriptionService_1.applySubscriptionPayment)(companyId, effectivePaymentDate);
                }
                else if (normalizedEvent === 'PAYMENT_OVERDUE') {
                    await (0, subscriptionService_1.applySubscriptionOverdue)(companyId, dueDate);
                }
            }
            catch (subscriptionError) {
                console.error('[AsaasWebhook] Failed to update subscription timelines for company', companyId, subscriptionError);
            }
        }
    }
    catch (error) {
        console.error('[AsaasWebhook] Failed to persist webhook payload', error);
        return res.status(202).json(buildWebhookResponse());
    }
    console.info('[AsaasWebhook] Processed event', normalizedEvent, 'for charge', asaasChargeId);
    return res.status(202).json(buildWebhookResponse());
}
async function getAsaasWebhookSecret(req, res) {
    const credentialId = Number(req.params.credentialId);
    if (!Number.isInteger(credentialId) || credentialId <= 0) {
        return res.status(400).json({ error: 'Parâmetro credentialId inválido' });
    }
    let secret = null;
    try {
        secret = await findCredentialSecret(credentialId);
    }
    catch (error) {
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
