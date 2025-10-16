"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.__internal = exports.resolveSubscriptionPayloadFromRow = exports.applySubscriptionOverdue = exports.applySubscriptionPayment = exports.fetchCompanySubscription = exports.findCompanyIdForCliente = exports.findCompanyIdForFinancialFlow = exports.resolvePlanCadence = exports.calculateGraceDeadline = exports.calculateBillingPeriod = exports.calculateTrialEnd = exports.parseCadence = exports.TRIAL_DURATION_DAYS = void 0;
const db_1 = __importDefault(require("./db"));
exports.TRIAL_DURATION_DAYS = 14;
const CADENCE_MONTHLY = 'monthly';
const CADENCE_ANNUAL = 'annual';
const PERIOD_DURATION = {
    monthly: 30,
    annual: 365,
};
const GRACE_DURATION = {
    monthly: 7,
    annual: 30,
};
const FINANCIAL_FLOW_EMPRESA_COLUMNS = ['empresa', 'empresa_id', 'idempresa'];
const CLIENTE_EMPRESA_COLUMNS = ['empresa', 'empresa_id', 'idempresa'];
const CADENCE_VALUES = [CADENCE_MONTHLY, CADENCE_ANNUAL];
const toDate = (value) => {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }
        const parsed = new Date(trimmed);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
};
const toInteger = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.trunc(value);
    }
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number.parseInt(value.trim(), 10);
        if (Number.isFinite(parsed)) {
            return Math.trunc(parsed);
        }
    }
    return null;
};
const toBoolean = (value) => {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value !== 0;
    }
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (!normalized) {
            return null;
        }
        if (['1', 'true', 't', 'yes', 'y', 'sim', 'ativo', 'on'].includes(normalized)) {
            return true;
        }
        if (['0', 'false', 'f', 'no', 'n', 'nao', 'não', 'inativo', 'off'].includes(normalized)) {
            return false;
        }
    }
    return null;
};
const normalizeCadence = (value) => {
    if (typeof value !== 'string') {
        return null;
    }
    const normalized = value.trim().toLowerCase();
    if (CADENCE_VALUES.includes(normalized)) {
        return normalized;
    }
    return null;
};
exports.parseCadence = normalizeCadence;
const addDays = (base, amount) => {
    const result = new Date(base.getTime());
    result.setTime(result.getTime() + amount * 24 * 60 * 60 * 1000);
    return result;
};
const calculateTrialEnd = (startDate) => addDays(startDate, exports.TRIAL_DURATION_DAYS);
exports.calculateTrialEnd = calculateTrialEnd;
const calculateBillingPeriod = (startDate, cadence) => {
    const start = new Date(startDate.getTime());
    const end = addDays(startDate, PERIOD_DURATION[cadence]);
    return { start, end };
};
exports.calculateBillingPeriod = calculateBillingPeriod;
const calculateGraceDeadline = (periodEnd, cadence) => addDays(periodEnd, GRACE_DURATION[cadence]);
exports.calculateGraceDeadline = calculateGraceDeadline;
const hasPositiveAmount = (value) => {
    if (typeof value === 'number') {
        return Number.isFinite(value) && value > 0;
    }
    if (typeof value === 'string') {
        const parsed = Number(value.trim());
        return Number.isFinite(parsed) && parsed > 0;
    }
    return false;
};
const resolvePlanCadence = async (planId, preferredCadence) => {
    const result = await db_1.default.query('SELECT valor_mensal, valor_anual FROM public.planos WHERE id = $1 LIMIT 1', [planId]);
    if (result.rowCount === 0) {
        throw new Error('Plano informado não foi encontrado.');
    }
    const row = result.rows[0];
    const hasMonthly = hasPositiveAmount(row.valor_mensal);
    const hasAnnual = hasPositiveAmount(row.valor_anual);
    if (preferredCadence && ((preferredCadence === 'monthly' && hasMonthly) || (preferredCadence === 'annual' && hasAnnual))) {
        return preferredCadence;
    }
    if (hasMonthly && !hasAnnual) {
        return 'monthly';
    }
    if (!hasMonthly && hasAnnual) {
        return 'annual';
    }
    return preferredCadence ?? 'monthly';
};
exports.resolvePlanCadence = resolvePlanCadence;
const quoteIdentifier = (identifier) => `"${identifier.replace(/"/g, '""')}"`;
let cachedFinancialFlowEmpresaColumn;
let cachedClienteEmpresaColumn;
const ensureFinancialFlowEmpresaColumn = async () => {
    if (cachedFinancialFlowEmpresaColumn !== undefined) {
        return cachedFinancialFlowEmpresaColumn;
    }
    const result = await db_1.default.query(`SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'financial_flows'
        AND column_name = ANY($1)
      LIMIT 1`, [FINANCIAL_FLOW_EMPRESA_COLUMNS]);
    cachedFinancialFlowEmpresaColumn =
        (result.rowCount ?? 0) > 0 ? result.rows[0].column_name : null;
    return cachedFinancialFlowEmpresaColumn;
};
const ensureClienteEmpresaColumn = async () => {
    if (cachedClienteEmpresaColumn !== undefined) {
        return cachedClienteEmpresaColumn;
    }
    const result = await db_1.default.query(`SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'clientes'
        AND column_name = ANY($1)
      LIMIT 1`, [CLIENTE_EMPRESA_COLUMNS]);
    cachedClienteEmpresaColumn = (result.rowCount ?? 0) > 0 ? result.rows[0].column_name : null;
    return cachedClienteEmpresaColumn;
};
const findCompanyIdForFinancialFlow = async (financialFlowId) => {
    if (!Number.isInteger(financialFlowId) || financialFlowId <= 0) {
        return null;
    }
    const column = await ensureFinancialFlowEmpresaColumn();
    if (!column) {
        return null;
    }
    const result = await db_1.default.query(`SELECT ${quoteIdentifier(column)} AS empresa_id
       FROM financial_flows
      WHERE id = $1
      LIMIT 1`, [financialFlowId]);
    if (result.rowCount === 0) {
        return null;
    }
    return toInteger(result.rows[0]?.empresa_id);
};
exports.findCompanyIdForFinancialFlow = findCompanyIdForFinancialFlow;
const findCompanyIdForCliente = async (clienteId) => {
    if ((typeof clienteId !== 'number' || !Number.isInteger(clienteId)) && typeof clienteId !== 'string') {
        return null;
    }
    const column = await ensureClienteEmpresaColumn();
    if (!column) {
        return null;
    }
    const result = await db_1.default.query(`SELECT ${quoteIdentifier(column)} AS empresa_id
       FROM public.clientes
      WHERE id = $1
      LIMIT 1`, [clienteId]);
    if (result.rowCount === 0) {
        return null;
    }
    return toInteger(result.rows[0]?.empresa_id);
};
exports.findCompanyIdForCliente = findCompanyIdForCliente;
const fetchCompanySubscription = async (companyId) => {
    if (!Number.isInteger(companyId) || companyId <= 0) {
        return null;
    }
    const result = await db_1.default.query(`SELECT plano,
            subscription_cadence,
            current_period_start,
            current_period_end,
            grace_expires_at
       FROM public.empresas
      WHERE id = $1
      LIMIT 1`, [companyId]);
    if (result.rowCount === 0) {
        return null;
    }
    const row = result.rows[0];
    return {
        planId: toInteger(row.plano),
        cadence: normalizeCadence(row.subscription_cadence),
        currentPeriodStart: toDate(row.current_period_start),
        currentPeriodEnd: toDate(row.current_period_end),
        graceExpiresAt: toDate(row.grace_expires_at),
    };
};
exports.fetchCompanySubscription = fetchCompanySubscription;
const resolveEffectiveCadence = async (snapshot, requested) => {
    if (requested) {
        return requested;
    }
    if (snapshot?.cadence) {
        return snapshot.cadence;
    }
    if (snapshot?.planId) {
        try {
            return await (0, exports.resolvePlanCadence)(snapshot.planId, null);
        }
        catch (error) {
            console.warn('Não foi possível determinar a recorrência do plano, assumindo mensal.', error);
        }
    }
    return 'monthly';
};
const applySubscriptionPayment = async (companyId, paymentDate, cadenceHint = null) => {
    if (!(paymentDate instanceof Date) || Number.isNaN(paymentDate.getTime())) {
        return;
    }
    const snapshot = await (0, exports.fetchCompanySubscription)(companyId);
    if (!snapshot) {
        return;
    }
    const cadence = await resolveEffectiveCadence(snapshot, cadenceHint);
    const period = (0, exports.calculateBillingPeriod)(paymentDate, cadence);
    const grace = (0, exports.calculateGraceDeadline)(period.end, cadence);
    await db_1.default.query(`UPDATE public.empresas
        SET current_period_start = $1,
            current_period_end = $2,
            grace_expires_at = $3,
            subscription_cadence = $4,
            trial_started_at = NULL,
            trial_ends_at = NULL,
            ativo = TRUE
      WHERE id = $5`, [period.start, period.end, grace, cadence, companyId]);
};
exports.applySubscriptionPayment = applySubscriptionPayment;
const applySubscriptionOverdue = async (companyId, referenceDate, cadenceHint = null) => {
    const snapshot = await (0, exports.fetchCompanySubscription)(companyId);
    if (!snapshot) {
        return;
    }
    const cadence = await resolveEffectiveCadence(snapshot, cadenceHint);
    const baseDate = referenceDate ?? snapshot.currentPeriodEnd ?? new Date();
    if (!(baseDate instanceof Date) || Number.isNaN(baseDate.getTime())) {
        return;
    }
    const graceDeadline = (0, exports.calculateGraceDeadline)(baseDate, cadence);
    await db_1.default.query(`UPDATE public.empresas
        SET grace_expires_at = $1,
            current_period_end = COALESCE(current_period_end, $2),
            subscription_cadence = COALESCE(subscription_cadence, $3)
      WHERE id = $4`, [graceDeadline, baseDate, cadence, companyId]);
};
exports.applySubscriptionOverdue = applySubscriptionOverdue;
const resolveSubscriptionPayloadFromRow = (row, now = new Date()) => {
    const planId = toInteger(row.empresa_plano);
    const isActive = toBoolean(row.empresa_ativo);
    const cadence = normalizeCadence(row.subscription_cadence);
    const trialStartedAt = toDate(row.trial_started_at);
    const trialEndsAt = toDate(row.trial_ends_at);
    const currentPeriodStart = toDate(row.current_period_start);
    const currentPeriodEnd = toDate(row.current_period_end);
    const graceExpiresAt = toDate(row.grace_expires_at);
    const startedAt = currentPeriodStart ?? trialStartedAt ?? null;
    if (planId === null || isActive === false) {
        return {
            planId,
            status: 'inactive',
            cadence,
            startedAt: startedAt ? startedAt.toISOString() : null,
            trialEndsAt: trialEndsAt ? trialEndsAt.toISOString() : null,
            currentPeriodStart: currentPeriodStart ? currentPeriodStart.toISOString() : null,
            currentPeriodEnd: currentPeriodEnd ? currentPeriodEnd.toISOString() : null,
            graceExpiresAt: graceExpiresAt ? graceExpiresAt.toISOString() : null,
        };
    }
    const nowTs = now.getTime();
    if (trialStartedAt &&
        trialEndsAt &&
        !Number.isNaN(trialStartedAt.getTime()) &&
        !Number.isNaN(trialEndsAt.getTime()) &&
        nowTs < trialEndsAt.getTime()) {
        return {
            planId,
            status: 'trialing',
            cadence,
            startedAt: trialStartedAt.toISOString(),
            trialEndsAt: trialEndsAt.toISOString(),
            currentPeriodStart: currentPeriodStart ? currentPeriodStart.toISOString() : null,
            currentPeriodEnd: currentPeriodEnd ? currentPeriodEnd.toISOString() : null,
            graceExpiresAt: graceExpiresAt ? graceExpiresAt.toISOString() : null,
        };
    }
    if (currentPeriodStart &&
        currentPeriodEnd &&
        !Number.isNaN(currentPeriodStart.getTime()) &&
        !Number.isNaN(currentPeriodEnd.getTime()) &&
        nowTs <= currentPeriodEnd.getTime()) {
        return {
            planId,
            status: 'active',
            cadence,
            startedAt: currentPeriodStart.toISOString(),
            trialEndsAt: trialEndsAt ? trialEndsAt.toISOString() : null,
            currentPeriodStart: currentPeriodStart.toISOString(),
            currentPeriodEnd: currentPeriodEnd.toISOString(),
            graceExpiresAt: graceExpiresAt ? graceExpiresAt.toISOString() : null,
        };
    }
    if (graceExpiresAt &&
        !Number.isNaN(graceExpiresAt.getTime()) &&
        nowTs <= graceExpiresAt.getTime()) {
        return {
            planId,
            status: 'grace_period',
            cadence,
            startedAt: currentPeriodStart ? currentPeriodStart.toISOString() : null,
            trialEndsAt: trialEndsAt ? trialEndsAt.toISOString() : null,
            currentPeriodStart: currentPeriodStart ? currentPeriodStart.toISOString() : null,
            currentPeriodEnd: currentPeriodEnd ? currentPeriodEnd.toISOString() : null,
            graceExpiresAt: graceExpiresAt.toISOString(),
        };
    }
    if (trialEndsAt === null &&
        currentPeriodStart === null &&
        currentPeriodEnd === null &&
        graceExpiresAt === null) {
        return {
            planId,
            status: 'pending',
            cadence,
            startedAt: startedAt ? startedAt.toISOString() : null,
            trialEndsAt: null,
            currentPeriodStart: null,
            currentPeriodEnd: null,
            graceExpiresAt: null,
        };
    }
    return {
        planId,
        status: 'past_due',
        cadence,
        startedAt: currentPeriodStart ? currentPeriodStart.toISOString() : null,
        trialEndsAt: trialEndsAt ? trialEndsAt.toISOString() : null,
        currentPeriodStart: currentPeriodStart ? currentPeriodStart.toISOString() : null,
        currentPeriodEnd: currentPeriodEnd ? currentPeriodEnd.toISOString() : null,
        graceExpiresAt: graceExpiresAt ? graceExpiresAt.toISOString() : null,
    };
};
exports.resolveSubscriptionPayloadFromRow = resolveSubscriptionPayloadFromRow;
exports.__internal = {
    resetCaches() {
        cachedFinancialFlowEmpresaColumn = undefined;
        cachedClienteEmpresaColumn = undefined;
    },
};
exports.default = {
    TRIAL_DURATION_DAYS: exports.TRIAL_DURATION_DAYS,
    calculateTrialEnd: exports.calculateTrialEnd,
    calculateBillingPeriod: exports.calculateBillingPeriod,
    calculateGraceDeadline: exports.calculateGraceDeadline,
    parseCadence: exports.parseCadence,
    resolvePlanCadence: exports.resolvePlanCadence,
    findCompanyIdForFinancialFlow: exports.findCompanyIdForFinancialFlow,
    findCompanyIdForCliente: exports.findCompanyIdForCliente,
    fetchCompanySubscription: exports.fetchCompanySubscription,
    applySubscriptionPayment: exports.applySubscriptionPayment,
    applySubscriptionOverdue: exports.applySubscriptionOverdue,
    resolveSubscriptionPayloadFromRow: exports.resolveSubscriptionPayloadFromRow,
};
