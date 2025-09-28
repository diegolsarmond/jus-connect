"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChargeConflictError = exports.ValidationError = exports.ASAAS_BILLING_TYPES = void 0;
const financialFlowIdentifier_1 = require("../utils/financialFlowIdentifier");
const db_1 = __importDefault(require("./db"));
const integrationResolver_1 = __importStar(require("./asaas/integrationResolver"));
exports.ASAAS_BILLING_TYPES = ['PIX', 'BOLETO', 'CREDIT_CARD', 'DEBIT_CARD'];
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
function normalizeEmpresaId(value) {
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
function extractEmpresaId(row) {
    const candidates = ['idempresa', 'empresa_id', 'empresa'];
    for (const candidate of candidates) {
        if (Object.prototype.hasOwnProperty.call(row, candidate)) {
            const value = normalizeEmpresaId(row[candidate]);
            if (value !== null) {
                return value;
            }
        }
    }
    return null;
}
function isTruthy(value) {
    if (value === true) {
        return true;
    }
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        return ['true', 't', '1', 'yes', 'y'].includes(normalized);
    }
    if (typeof value === 'number') {
        return value === 1;
    }
    return false;
}
async function defaultClientFactory({ integrationApiKeyId, financialFlowId, db, }) {
    const normalizedFinancialFlowId = (0, financialFlowIdentifier_1.normalizeFinancialFlowIdentifier)(financialFlowId);
    if (normalizedFinancialFlowId === null) {
        throw new ValidationError('Identificador do fluxo financeiro inválido');
    }
    const flowResult = await db.query('SELECT id, idempresa, empresa_id, empresa FROM financial_flows WHERE id = $1', [normalizedFinancialFlowId]);
    if (flowResult.rowCount === 0) {
        throw new ValidationError('Fluxo financeiro não encontrado');
    }
    const flowRow = flowResult.rows[0];
    const flowEmpresaId = extractEmpresaId(flowRow);
    if (integrationApiKeyId) {
        const result = await db.query('SELECT id, provider, key_value, url_api, idempresa, global FROM integration_api_keys WHERE id = $1', [integrationApiKeyId]);
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
        const integrationEmpresaId = extractEmpresaId(row);
        const isGlobalKey = isTruthy(row.global);
        if (!isGlobalKey) {
            if (integrationEmpresaId === null || flowEmpresaId === null || integrationEmpresaId !== flowEmpresaId) {
                throw new ValidationError('Chave de integração do Asaas não pertence à empresa do fluxo financeiro');
            }
        }
        const baseUrl = typeof row.url_api === 'string' && row.url_api.trim() ? row.url_api : null;
        const credentialLookup = await db.query('SELECT id FROM asaas_credentials WHERE integration_api_key_id = $1', [integrationApiKeyId]);
        let credentialId = null;
        if (credentialLookup.rowCount > 0) {
            const rawId = credentialLookup.rows[0]?.id;
            if (typeof rawId === 'number' && Number.isFinite(rawId)) {
                credentialId = Math.trunc(rawId);
            }
            else if (typeof rawId === 'string' && rawId.trim()) {
                const parsed = Number.parseInt(rawId.trim(), 10);
                if (Number.isFinite(parsed)) {
                    credentialId = parsed;
                }
            }
        }
        return {
            client: new HttpAsaasClient({ apiKey: keyValue, baseUrl }),
            credentialId,
            integrationApiKeyId,
        };
    }
    if (flowEmpresaId !== null) {
        try {
            const integration = await (0, integrationResolver_1.default)(flowEmpresaId, db);
            return {
                client: new HttpAsaasClient({ apiKey: integration.accessToken, baseUrl: integration.baseUrl }),
                credentialId: integration.credentialId ?? null,
                integrationApiKeyId: integration.integrationId ?? null,
            };
        }
        catch (error) {
            if (!(error instanceof integrationResolver_1.AsaasIntegrationNotConfiguredError)) {
                console.error('Falha ao resolver integração do Asaas para empresa', flowEmpresaId, error);
            }
        }
    }
    const apiKey = process.env.ASAAS_API_KEY;
    if (!apiKey) {
        throw new ValidationError('Nenhuma credencial do Asaas configurada');
    }
    return {
        client: new HttpAsaasClient({ apiKey, baseUrl: process.env.ASAAS_BASE_URL }),
        credentialId: null,
        integrationApiKeyId: null,
    };
}
function normalizeBillingType(value) {
    if (typeof value !== 'string') {
        throw new ValidationError('paymentMethod é obrigatório');
    }
    const normalized = value.trim().toUpperCase();
    if (!exports.ASAAS_BILLING_TYPES.includes(normalized)) {
        throw new ValidationError('paymentMethod deve ser PIX, BOLETO, CREDIT_CARD ou DEBIT_CARD');
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
    const financialFlowId = (0, financialFlowIdentifier_1.normalizeFinancialFlowIdentifierFromRow)(row.financial_flow_id);
    const credentialValue = row.credential_id;
    let credentialId = null;
    if (typeof credentialValue === 'number' && Number.isFinite(credentialValue)) {
        credentialId = Math.trunc(credentialValue);
    }
    else if (typeof credentialValue === 'string' && credentialValue.trim()) {
        const parsed = Number.parseInt(credentialValue.trim(), 10);
        if (Number.isFinite(parsed)) {
            credentialId = parsed;
        }
    }
    const payloadValue = row.payload;
    const parsedPayload = payloadValue && typeof payloadValue === 'object' ? payloadValue : null;
    const paidAtValue = row.paid_at;
    const paidAt = paidAtValue === null || paidAtValue === undefined
        ? null
        : new Date(paidAtValue).toISOString();
    return {
        id: Number(row.id),
        financialFlowId,
        clienteId: row.cliente_id === null || row.cliente_id === undefined ? null : Number(row.cliente_id),
        integrationApiKeyId: row.integration_api_key_id === null || row.integration_api_key_id === undefined
            ? null
            : Number(row.integration_api_key_id),
        credentialId,
        asaasChargeId: String(row.asaas_charge_id),
        billingType: String(row.billing_type),
        status: String(row.status),
        dueDate: new Date(row.due_date).toISOString().slice(0, 10),
        value: String(row.value),
        invoiceUrl: row.invoice_url ? String(row.invoice_url) : null,
        lastEvent: row.last_event === null || row.last_event === undefined ? null : String(row.last_event),
        payload: parsedPayload,
        paidAt,
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
        const normalizedFinancialFlowId = (0, financialFlowIdentifier_1.normalizeFinancialFlowIdentifier)(input.financialFlowId);
        if (normalizedFinancialFlowId === null) {
            throw new ValidationError('Identificador do fluxo financeiro inválido');
        }
        const existingCharge = await dbClient.query('SELECT id FROM asaas_charges WHERE financial_flow_id = $1', [normalizedFinancialFlowId]);
        if (existingCharge.rowCount > 0) {
            throw new ChargeConflictError('O fluxo financeiro já possui uma cobrança vinculada ao Asaas');
        }
        const payload = {
            billingType,
            customer,
            value,
            dueDate,
            description: input.description ?? undefined,
            externalReference: input.externalReferenceId ?? String(normalizedFinancialFlowId),
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
        if (billingType === 'CREDIT_CARD' || billingType === 'DEBIT_CARD') {
            if (!input.cardToken || !input.cardToken.trim()) {
                throw new ValidationError('cardToken é obrigatório para cobranças via cartão');
            }
            payload.creditCardToken = input.cardToken.trim();
        }
        let resolvedCredentialId = (options === null || options === void 0 ? void 0 : options.credentialId) ?? null;
        let resolvedIntegrationApiKeyId = (options === null || options === void 0 ? void 0 : options.integrationApiKeyId) ?? (input.integrationApiKeyId ?? null);
        let asaasClient;
        if (options === null || options === void 0 ? void 0 : options.asaasClient) {
            asaasClient = options.asaasClient;
        }
        else {
            const clientResolution = await this.clientFactory({
                integrationApiKeyId: input.integrationApiKeyId,
                financialFlowId: normalizedFinancialFlowId,
                db: dbClient,
            });
            asaasClient = clientResolution.client;
            if (clientResolution.credentialId !== null && clientResolution.credentialId !== undefined) {
                resolvedCredentialId = clientResolution.credentialId;
            }
            if (clientResolution.integrationApiKeyId !== null && clientResolution.integrationApiKeyId !== undefined) {
                resolvedIntegrationApiKeyId = clientResolution.integrationApiKeyId;
            }
        }
        const chargeResponse = await asaasClient.createCharge(payload);
        const { payload: pixPayload, qrCode: pixQrCode } = extractPixPayload(chargeResponse);
        const boletoUrl = extractBoletoUrl(chargeResponse);
        const { last4: cardLast4, brand: cardBrand } = extractCardInfo(chargeResponse);
        const flowStatus = mapFlowStatus(chargeResponse.status);
        const insertResult = await dbClient.query(`INSERT INTO asaas_charges (
        financial_flow_id,
        cliente_id,
        integration_api_key_id,
        credential_id,
        asaas_charge_id,
        billing_type,
        status,
        due_date,
        value,
        invoice_url,
        last_event,
        payload,
        paid_at,
        pix_payload,
        pix_qr_code,
        boleto_url,
        card_last4,
        card_brand,
        raw_response
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
      )
      RETURNING
        id,
        financial_flow_id,
        cliente_id,
        integration_api_key_id,
        credential_id,
        asaas_charge_id,
        billing_type,
        status,
        due_date,
        value,
        invoice_url,
        last_event,
        payload,
        paid_at,
        pix_payload,
        pix_qr_code,
        boleto_url,
        card_last4,
        card_brand,
        raw_response,
        created_at,
        updated_at
      `, [
            normalizedFinancialFlowId,
            input.clienteId ?? null,
            resolvedIntegrationApiKeyId,
            resolvedCredentialId,
            chargeResponse.id,
            billingType,
            chargeResponse.status,
            dueDate,
            value,
            chargeResponse.invoiceUrl ?? null,
            null,
            null,
            null,
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
       RETURNING *`, ['asaas', chargeResponse.id, flowStatus, normalizedFinancialFlowId]);
        if (updateResult.rowCount === 0) {
            throw new Error('Fluxo financeiro não encontrado para atualização');
        }
        return { charge, flow: updateResult.rows[0] };
    }
}
exports.default = AsaasChargeService;
