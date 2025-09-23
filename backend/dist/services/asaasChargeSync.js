"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.asaasChargeSyncService = exports.AsaasChargeSyncService = exports.createDefaultAsaasClient = exports.AsaasConfigurationError = exports.PAID_PAYMENT_STATUSES = exports.OPEN_PAYMENT_STATUSES = void 0;
const url_1 = require("url");
const db_1 = __importDefault(require("./db"));
const notificationService_1 = require("./notificationService");
const subscriptionService_1 = require("./subscriptionService");
exports.OPEN_PAYMENT_STATUSES = [
    'PENDING',
    'PENDING_RETRY',
    'AWAITING_RISK_ANALYSIS',
    'AUTHORIZED',
    'BANK_SLIP_VIEWED',
    'OVERDUE',
];
exports.PAID_PAYMENT_STATUSES = ['RECEIVED', 'RECEIVED_IN_CASH', 'CONFIRMED'];
const OPEN_PAYMENT_STATUS_SET = new Set(exports.OPEN_PAYMENT_STATUSES);
const PAID_PAYMENT_STATUS_SET = new Set(exports.PAID_PAYMENT_STATUSES);
const DEFAULT_PAGE_SIZE = 100;
class AsaasConfigurationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AsaasConfigurationError';
    }
}
exports.AsaasConfigurationError = AsaasConfigurationError;
function normalizeStatus(value) {
    if (!value) {
        return '';
    }
    return value.trim().toUpperCase();
}
function parseDate(value) {
    if (!value) {
        return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }
    return parsed;
}
class HttpAsaasClient {
    constructor(apiKey = process.env.ASAAS_API_KEY ?? null, apiUrl = process.env.ASAAS_API_URL ?? 'https://www.asaas.com/api/v3') {
        this.apiKey = apiKey && apiKey.trim() ? apiKey.trim() : null;
        this.apiUrl = apiUrl && apiUrl.trim() ? apiUrl.trim() : 'https://www.asaas.com/api/v3';
    }
    hasValidConfiguration() {
        return Boolean(this.apiKey);
    }
    async listPayments(params) {
        if (!this.hasValidConfiguration()) {
            throw new AsaasConfigurationError('Integração com o Asaas não está configurada. Defina ASAAS_API_KEY e ASAAS_API_URL conforme necessário.');
        }
        const statuses = Array.from(new Set(params.status.map((status) => normalizeStatus(status)))).filter(Boolean);
        if (statuses.length === 0) {
            return { data: [], hasMore: false, totalCount: 0, limit: params.limit, offset: params.offset };
        }
        const searchParams = new url_1.URLSearchParams();
        for (const status of statuses) {
            searchParams.append('status', status);
        }
        if (typeof params.limit === 'number') {
            searchParams.set('limit', String(params.limit));
        }
        if (typeof params.offset === 'number') {
            searchParams.set('offset', String(params.offset));
        }
        if (params.updatedSince) {
            searchParams.set('updatedSince', params.updatedSince);
        }
        const url = `${this.apiUrl.replace(/\/$/, '')}/payments?${searchParams.toString()}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${this.apiKey}`,
            },
        });
        if (!response.ok) {
            throw new Error(`Falha ao consultar cobranças no Asaas: ${response.status} ${response.statusText}`);
        }
        const body = (await response.json());
        if (!body || !Array.isArray(body.data)) {
            return { data: [], hasMore: false, totalCount: 0, limit: body?.limit, offset: body?.offset };
        }
        return {
            data: body.data.map((item) => ({
                ...item,
                status: normalizeStatus(item.status),
            })),
            hasMore: Boolean(body.hasMore),
            totalCount: typeof body.totalCount === 'number' ? body.totalCount : body.data.length,
            limit: typeof body.limit === 'number' ? body.limit : params.limit,
            offset: typeof body.offset === 'number' ? body.offset : params.offset,
        };
    }
}
const createDefaultAsaasClient = () => new HttpAsaasClient();
exports.createDefaultAsaasClient = createDefaultAsaasClient;
class AsaasChargeSyncService {
    constructor(db = db_1.default, client = (0, exports.createDefaultAsaasClient)(), pageSize = DEFAULT_PAGE_SIZE) {
        this.db = db;
        this.client = client;
        this.pageSize = pageSize;
    }
    hasValidConfiguration() {
        return this.client.hasValidConfiguration();
    }
    async syncPendingCharges() {
        if (!this.hasValidConfiguration()) {
            throw new AsaasConfigurationError('Integração com o Asaas não está configurada. Defina ASAAS_API_KEY e ASAAS_API_URL conforme necessário.');
        }
        const charges = await this.loadPendingCharges();
        if (charges.length === 0) {
            return {
                totalCharges: 0,
                paymentsRetrieved: 0,
                chargesUpdated: 0,
                flowsUpdated: 0,
                fetchedStatuses: this.statusesToFetch,
            };
        }
        const payments = await this.fetchPayments();
        const paymentsById = new Map(payments.map((payment) => [payment.id, payment]));
        let chargesUpdated = 0;
        let flowsUpdated = 0;
        for (const charge of charges) {
            const payment = paymentsById.get(charge.asaas_id);
            if (!payment) {
                continue;
            }
            const paymentStatus = normalizeStatus(payment.status);
            let statusChanged = false;
            if (paymentStatus && paymentStatus !== normalizeStatus(charge.status)) {
                await this.db.query('UPDATE asaas_charges SET status = $1 WHERE id = $2', [paymentStatus, charge.id]);
                chargesUpdated += 1;
                statusChanged = true;
            }
            if (charge.financial_flow_id) {
                const flowUpdate = this.buildFinancialFlowUpdate(paymentStatus, payment.paymentDate);
                if (flowUpdate) {
                    const [flowStatus, paymentDate] = flowUpdate;
                    await this.db.query('UPDATE financial_flows SET status = $1, pagamento = $2 WHERE id = $3', [flowStatus, paymentDate, charge.financial_flow_id]);
                    flowsUpdated += 1;
                    await this.updateSubscriptionForCharge(charge.financial_flow_id, paymentStatus, paymentDate, payment.dueDate);
                }
            }
            if (statusChanged) {
                await this.notifyChargeUpdate(charge, payment, paymentStatus || charge.status);
            }
        }
        return {
            totalCharges: charges.length,
            paymentsRetrieved: payments.length,
            chargesUpdated,
            flowsUpdated,
            fetchedStatuses: this.statusesToFetch,
        };
    }
    get statusesToFetch() {
        return [...exports.OPEN_PAYMENT_STATUSES, ...exports.PAID_PAYMENT_STATUSES];
    }
    async loadPendingCharges() {
        const { rows } = await this.db.query('SELECT id, asaas_id, financial_flow_id, status FROM asaas_charges WHERE status = ANY($1)', [exports.OPEN_PAYMENT_STATUSES]);
        return rows;
    }
    async fetchPayments() {
        const statuses = this.statusesToFetch;
        const payments = [];
        let offset = 0;
        while (true) {
            const response = await this.client.listPayments({ status: statuses, limit: this.pageSize, offset });
            if (Array.isArray(response.data)) {
                for (const payment of response.data) {
                    payments.push({
                        ...payment,
                        status: normalizeStatus(payment.status),
                    });
                }
            }
            const hasMore = Boolean(response.hasMore);
            const limit = typeof response.limit === 'number' && response.limit > 0 ? response.limit : this.pageSize;
            if (!hasMore) {
                break;
            }
            offset += limit;
            if (limit <= 0) {
                break;
            }
        }
        return payments;
    }
    async notifyChargeUpdate(charge, payment, status) {
        const normalizedStatus = normalizeStatus(status);
        const type = PAID_PAYMENT_STATUS_SET.has(normalizedStatus)
            ? 'success'
            : normalizedStatus === 'OVERDUE'
                ? 'warning'
                : 'info';
        const dueDate = payment.dueDate ?? null;
        const paymentDate = payment.paymentDate ?? null;
        const value = payment.value ?? null;
        const statusLabel = normalizedStatus.replace(/_/g, ' ').toLowerCase();
        const messageParts = [`Cobrança ${payment.id} agora está ${statusLabel}.`];
        if (paymentDate) {
            messageParts.push(`Pagamento registrado em ${paymentDate}.`);
        }
        else if (dueDate) {
            messageParts.push(`Vencimento em ${dueDate}.`);
        }
        try {
            await (0, notificationService_1.createNotification)({
                userId: 'finance',
                title: `Cobrança atualizada (${normalizedStatus})`,
                message: messageParts.join(' '),
                category: 'payments',
                type,
                metadata: {
                    chargeId: charge.id,
                    asaasId: charge.asaas_id,
                    financialFlowId: charge.financial_flow_id,
                    status: normalizedStatus,
                    dueDate,
                    paymentDate,
                    value,
                },
            });
        }
        catch (error) {
            console.error('Falha ao enviar notificação de cobrança do Asaas', error);
        }
    }
    buildFinancialFlowUpdate(status, paymentDate) {
        const normalizedStatus = normalizeStatus(status);
        if (PAID_PAYMENT_STATUS_SET.has(normalizedStatus)) {
            return ['pago', parseDate(paymentDate)];
        }
        if (OPEN_PAYMENT_STATUS_SET.has(normalizedStatus)) {
            return ['pendente', null];
        }
        return null;
    }
    async updateSubscriptionForCharge(financialFlowId, paymentStatus, paymentDate, dueDate) {
        const normalizedStatus = normalizeStatus(paymentStatus);
        let companyId = null;
        try {
            companyId = await (0, subscriptionService_1.findCompanyIdForFinancialFlow)(financialFlowId);
        }
        catch (error) {
            console.error('[AsaasChargeSync] Failed to resolve company for financial flow', financialFlowId, error);
            return;
        }
        if (!companyId) {
            return;
        }
        try {
            if (PAID_PAYMENT_STATUS_SET.has(normalizedStatus)) {
                const effectivePaymentDate = paymentDate ?? new Date();
                await (0, subscriptionService_1.applySubscriptionPayment)(companyId, effectivePaymentDate);
            }
            else if (normalizedStatus === 'OVERDUE') {
                const parsedDueDate = parseDate(dueDate);
                await (0, subscriptionService_1.applySubscriptionOverdue)(companyId, parsedDueDate);
            }
        }
        catch (error) {
            console.error('[AsaasChargeSync] Failed to update subscription timeline', { companyId, financialFlowId }, error);
        }
    }
}
exports.AsaasChargeSyncService = AsaasChargeSyncService;
exports.asaasChargeSyncService = new AsaasChargeSyncService();
exports.default = exports.asaasChargeSyncService;
