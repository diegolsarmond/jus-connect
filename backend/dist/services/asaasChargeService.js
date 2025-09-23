"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChargeConflictError = exports.ValidationError = exports.ASAAS_BILLING_TYPES = void 0;
const db_1 = __importDefault(require("./db"));
exports.ASAAS_BILLING_TYPES = ['PIX', 'BOLETO', 'CREDIT_CARD'];
class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
class ChargeConflictError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ChargeConflictError';
    }
}
exports.ChargeConflictError = ChargeConflictError;
const DEFAULT_BASE_URL = 'https://api.asaas.com/v3/';
class HttpAsaasClient {
    constructor(config) {
        this.config = config;
    }
    resolveBaseUrl() {
        const configured = this.config.baseUrl ?? process.env.ASAAS_BASE_URL;
        const base = configured && configured.trim() ? configured.trim() : DEFAULT_BASE_URL;
        return base.endsWith('/') ? base : `${base}/`;
    }
    async createCharge(payload) {
        const url = new URL('payments', this.resolveBaseUrl());
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.config.apiKey}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            let errorBody;
            try {
                errorBody = await response.json();
            }
            catch (error) {
                errorBody = await response.text();
            }
            const error = new Error('Falha ao criar cobrança no Asaas');
            error.status = response.status;
            error.body = errorBody;
            throw error;
        }
        const data = (await response.json());
        return data;
    }
}
async function defaultClientFactory({ integrationApiKeyId, db, }) {
    if (integrationApiKeyId) {
        const result = await db.query('SELECT id, provider, key_value, url_api FROM integration_api_keys WHERE id = $1', [integrationApiKeyId]);
        if (result.rowCount === 0) {
            throw new ValidationError('Chave de integração do Asaas não encontrada');
        }
        const row = result.rows[0];
        const keyValue = typeof row.key_value === 'string' ? row.key_value : null;
        if (!keyValue) {
            throw new ValidationError('Chave de API do Asaas inválida');
        }
        const provider = typeof row.provider === 'string' ? row.provider.trim().toLowerCase() : '';
        if (provider && provider !== 'asaas') {
            console.warn('integration_api_keys apontada para o Asaas contém provider diferente de "asaas":', row.provider);
        }
        const baseUrl = typeof row.url_api === 'string' && row.url_api.trim() ? row.url_api : null;
        return new HttpAsaasClient({ apiKey: keyValue, baseUrl });
    }
    const apiKey = process.env.ASAAS_API_KEY;
    if (!apiKey) {
        throw new ValidationError('Nenhuma credencial do Asaas configurada');
    }
    return new HttpAsaasClient({ apiKey, baseUrl: process.env.ASAAS_BASE_URL });
}
function normalizeBillingType(value) {
    if (typeof value !== 'string') {
        throw new ValidationError('paymentMethod é obrigatório');
    }
    const normalized = value.trim().toUpperCase();
    if (!exports.ASAAS_BILLING_TYPES.includes(normalized)) {
        throw new ValidationError('paymentMethod deve ser PIX, BOLETO ou CREDIT_CARD');
    }
    return normalized;
}
function ensureCustomerIdentifier(clienteId, asaasCustomerId, customer) {
    if (typeof asaasCustomerId === 'string' && asaasCustomerId.trim()) {
        return asaasCustomerId.trim();
    }
    if (typeof customer === 'string' && customer.trim()) {
        return customer.trim();
    }
    if (typeof clienteId === 'number' && Number.isFinite(clienteId)) {
        return String(clienteId);
    }
    throw new ValidationError('Identificador do cliente no Asaas é obrigatório');
}
function formatDueDate(value) {
    if (value instanceof Date) {
        return value.toISOString().slice(0, 10);
    }
    const trimmed = value.trim();
    if (!trimmed) {
        throw new ValidationError('Data de vencimento inválida');
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return trimmed;
    }
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
        throw new ValidationError('Data de vencimento inválida');
    }
    return parsed.toISOString().slice(0, 10);
}
function normalizeValue(value) {
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            throw new ValidationError('Valor da cobrança inválido');
        }
        return value;
    }
    if (typeof value === 'string') {
        const normalized = Number(value);
        if (!Number.isFinite(normalized)) {
            throw new ValidationError('Valor da cobrança inválido');
        }
        return normalized;
    }
    throw new ValidationError('Valor da cobrança inválido');
}
function extractPixPayload(response) {
    const payload = typeof response.pixCopiaECola === 'string'
        ? response.pixCopiaECola
        : typeof response.pixPayload === 'string'
            ? response.pixPayload
            : null;
    const qrCode = typeof response.pixQrCode === 'string'
        ? response.pixQrCode
        : typeof response.pixQrCodeImage === 'string'
            ? response.pixQrCodeImage
            : null;
    return { payload, qrCode };
}
function extractBoletoUrl(response) {
    if (typeof response.boletoUrl === 'string' && response.boletoUrl.trim()) {
        return response.boletoUrl;
    }
    if (typeof response.bankSlipUrl === 'string' && response.bankSlipUrl.trim()) {
        return response.bankSlipUrl;
    }
    return null;
}
function hasCreditCardNumberLast4(card) {
    return 'creditCardNumberLast4' in card;
}
function hasBrandProperty(card) {
    return 'brand' in card;
}
function resolveCardNumber(card) {
    if (typeof card.creditCardNumber === 'string' && card.creditCardNumber.trim()) {
        return card.creditCardNumber;
    }
    if (hasCreditCardNumberLast4(card)) {
        const { creditCardNumberLast4 } = card;
        if (typeof creditCardNumberLast4 === 'string' && creditCardNumberLast4.trim()) {
            return creditCardNumberLast4;
        }
    }
    return null;
}
function resolveCardBrand(card) {
    if (typeof card.creditCardBrand === 'string' && card.creditCardBrand.trim()) {
        return card.creditCardBrand;
    }
    if (hasBrandProperty(card)) {
        const { brand } = card;
        if (typeof brand === 'string' && brand.trim()) {
            return brand;
        }
    }
    return null;
}
function extractCardInfo(response) {
    const creditCard = response.creditCard ?? response.creditCardData ?? null;
    let last4 = null;
    let brand = null;
    if (creditCard) {
        const rawNumber = resolveCardNumber(creditCard);
        if (rawNumber && rawNumber.length >= 4) {
            last4 = rawNumber.slice(-4);
        }
        const rawBrand = resolveCardBrand(creditCard);
        if (rawBrand) {
            brand = rawBrand;
        }
    }
    return { last4, brand };
}
function mapFlowStatus(chargeStatus) {
    if (!chargeStatus) {
        return 'pendente';
    }
    const normalized = chargeStatus.trim().toUpperCase();
    const paidStatuses = new Set([
        'RECEIVED',
        'RECEIVED_IN_CASH',
        'RECEIVED_PARTIALLY',
        'CONFIRMED',
    ]);
    if (paidStatuses.has(normalized)) {
        return 'pago';
    }
    return 'pendente';
}
function normalizeInsertRow(row) {
    return {
        id: Number(row.id),
        financialFlowId: Number(row.financial_flow_id),
        clienteId: row.cliente_id === null || row.cliente_id === undefined ? null : Number(row.cliente_id),
        integrationApiKeyId: row.integration_api_key_id === null || row.integration_api_key_id === undefined
            ? null
            : Number(row.integration_api_key_id),
        asaasChargeId: String(row.asaas_charge_id),
        billingType: String(row.billing_type),
        status: String(row.status),
        dueDate: new Date(row.due_date).toISOString().slice(0, 10),
        value: String(row.value),
        invoiceUrl: row.invoice_url ? String(row.invoice_url) : null,
        pixPayload: row.pix_payload ? String(row.pix_payload) : null,
        pixQrCode: row.pix_qr_code ? String(row.pix_qr_code) : null,
        boletoUrl: row.boleto_url ? String(row.boleto_url) : null,
        cardLast4: row.card_last4 ? String(row.card_last4) : null,
        cardBrand: row.card_brand ? String(row.card_brand) : null,
        createdAt: new Date(row.created_at).toISOString(),
        updatedAt: new Date(row.updated_at).toISOString(),
    };
}
class AsaasChargeService {
    constructor(db = db_1.default, clientFactory = defaultClientFactory) {
        this.db = db;
        this.clientFactory = clientFactory;
    }
    async createCharge(input, options) {
        const dbClient = options?.dbClient ?? this.db;
        const billingType = normalizeBillingType(input.billingType);
        const value = normalizeValue(input.value);
        const dueDate = formatDueDate(input.dueDate);
        const customer = ensureCustomerIdentifier(input.clienteId, input.asaasCustomerId, input.customer);
        const existingCharge = await dbClient.query('SELECT id FROM asaas_charges WHERE financial_flow_id = $1', [input.financialFlowId]);
        if (existingCharge.rowCount > 0) {
            throw new ChargeConflictError('O fluxo financeiro já possui uma cobrança vinculada ao Asaas');
        }
        const payload = {
            billingType,
            customer,
            value,
            dueDate,
            description: input.description ?? undefined,
            externalReference: input.externalReferenceId ?? String(input.financialFlowId),
        };
        if (input.additionalFields) {
            for (const [key, val] of Object.entries(input.additionalFields)) {
                if (val !== undefined) {
                    payload[key] = val;
                }
            }
        }
        if (input.metadata) {
            payload.metadata = input.metadata;
        }
        if (input.payerEmail) {
            payload.customerEmail = input.payerEmail;
        }
        if (input.payerName) {
            payload.customerName = input.payerName;
        }
        if (input.customerDocument) {
            payload.customerCpfCnpj = input.customerDocument;
        }
        if (input.remoteIp) {
            payload.remoteIp = input.remoteIp;
        }
        if (billingType === 'CREDIT_CARD') {
            if (!input.cardToken || !input.cardToken.trim()) {
                throw new ValidationError('cardToken é obrigatório para cobranças via cartão de crédito');
            }
            payload.creditCardToken = input.cardToken.trim();
        }
        const asaasClient = options?.asaasClient ?? (await this.clientFactory({ integrationApiKeyId: input.integrationApiKeyId, db: dbClient }));
        const chargeResponse = await asaasClient.createCharge(payload);
        const { payload: pixPayload, qrCode: pixQrCode } = extractPixPayload(chargeResponse);
        const boletoUrl = extractBoletoUrl(chargeResponse);
        const { last4: cardLast4, brand: cardBrand } = extractCardInfo(chargeResponse);
        const flowStatus = mapFlowStatus(chargeResponse.status);
        const insertResult = await dbClient.query(`INSERT INTO asaas_charges (
        financial_flow_id,
        cliente_id,
        integration_api_key_id,
        asaas_charge_id,
        billing_type,
        status,
        due_date,
        value,
        invoice_url,
        pix_payload,
        pix_qr_code,
        boleto_url,
        card_last4,
        card_brand,
        raw_response
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
      )
      RETURNING
        id,
        financial_flow_id,
        cliente_id,
        integration_api_key_id,
        asaas_charge_id,
        billing_type,
        status,
        due_date,
        value,
        invoice_url,
        pix_payload,
        pix_qr_code,
        boleto_url,
        card_last4,
        card_brand,
        created_at,
        updated_at
      `, [
            input.financialFlowId,
            input.clienteId ?? null,
            input.integrationApiKeyId ?? null,
            chargeResponse.id,
            billingType,
            chargeResponse.status,
            dueDate,
            value,
            chargeResponse.invoiceUrl ?? null,
            pixPayload,
            pixQrCode,
            boletoUrl,
            cardLast4,
            cardBrand,
            JSON.stringify(chargeResponse),
        ]);
        if (insertResult.rowCount === 0) {
            throw new Error('Falha ao persistir cobrança do Asaas');
        }
        const charge = normalizeInsertRow(insertResult.rows[0]);
        const updateResult = await dbClient.query(`UPDATE financial_flows
         SET external_provider = $1,
             external_reference_id = $2,
             status = $3
       WHERE id = $4
       RETURNING *`, ['asaas', chargeResponse.id, flowStatus, input.financialFlowId]);
        if (updateResult.rowCount === 0) {
            throw new Error('Fluxo financeiro não encontrado para atualização');
        }
        return { charge, flow: updateResult.rows[0] };
    }
}
exports.default = AsaasChargeService;
