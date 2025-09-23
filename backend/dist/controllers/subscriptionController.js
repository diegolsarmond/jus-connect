"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSubscription = void 0;
const db_1 = __importDefault(require("../services/db"));
const subscriptionService_1 = require("../services/subscriptionService");
const parseNumericId = (value) => {
    if (typeof value === 'number' && Number.isInteger(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }
        const parsed = Number(trimmed);
        if (Number.isInteger(parsed)) {
            return parsed;
        }
    }
    return null;
};
const parseStatus = (value) => {
    if (typeof value !== 'string') {
        return null;
    }
    const normalized = value.trim().toLowerCase();
    if (normalized === 'active' || normalized === 'trialing') {
        return normalized;
    }
    return null;
};
const parseStartDate = (value) => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value;
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
const createSubscription = async (req, res) => {
    const companyId = parseNumericId(req.body?.companyId);
    const planId = parseNumericId(req.body?.planId);
    const status = parseStatus(req.body?.status) ?? 'active';
    const startDate = parseStartDate(req.body?.startDate);
    const cadenceInput = (0, subscriptionService_1.parseCadence)(req.body?.cadence);
    if (companyId == null || planId == null || !startDate) {
        res.status(400).json({ error: 'Dados inválidos para criar assinatura.' });
        return;
    }
    const isActive = status === 'active' || status === 'trialing';
    let cadence;
    try {
        cadence = await (0, subscriptionService_1.resolvePlanCadence)(planId, cadenceInput);
    }
    catch (error) {
        console.error('Erro ao determinar recorrência do plano', error);
        res.status(400).json({ error: 'Plano informado é inválido para criar assinatura.' });
        return;
    }
    const isTrialing = status === 'trialing';
    const trialEndsAt = isTrialing ? (0, subscriptionService_1.calculateTrialEnd)(startDate) : null;
    const period = isTrialing
        ? { start: startDate, end: trialEndsAt }
        : (0, subscriptionService_1.calculateBillingPeriod)(startDate, cadence);
    const graceExpiresAt = isTrialing || !period.end ? trialEndsAt : (0, subscriptionService_1.calculateGraceDeadline)(period.end, cadence);
    try {
        const result = await db_1.default.query(`UPDATE public.empresas
         SET plano = $1,
             ativo = $2,
             datacadastro = $3,
             trial_started_at = $4,
             trial_ends_at = $5,
             current_period_start = $6,
             current_period_end = $7,
             grace_expires_at = $8,
             subscription_cadence = $9
       WHERE id = $10
       RETURNING id, nome_empresa, plano, ativo, datacadastro, trial_started_at, trial_ends_at, current_period_start, current_period_end, grace_expires_at, subscription_cadence`, [
            planId,
            isActive,
            startDate,
            isTrialing ? startDate : null,
            trialEndsAt,
            period.start ?? null,
            period.end ?? null,
            graceExpiresAt ?? null,
            cadence,
            companyId,
        ]);
        if (result.rowCount === 0) {
            res.status(404).json({ error: 'Empresa não encontrada.' });
            return;
        }
        const updated = result.rows[0];
        res.status(201).json({
            id: `subscription-${updated.id}`,
            companyId: updated.id,
            planId: updated.plano,
            status,
            isActive: updated.ativo,
            startDate: updated.datacadastro,
            cadence: updated.subscription_cadence,
            trialEndsAt: trialEndsAt ? trialEndsAt.toISOString() : null,
            currentPeriodStart: updated.current_period_start,
            currentPeriodEnd: updated.current_period_end,
            graceExpiresAt: updated.grace_expires_at,
        });
    }
    catch (error) {
        console.error('Erro ao criar assinatura', error);
        res.status(500).json({ error: 'Não foi possível criar a assinatura.' });
    }
};
exports.createSubscription = createSubscription;
exports.default = { createSubscription: exports.createSubscription };
