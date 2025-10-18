import pool from './db';
import { normalizeFinancialFlowIdentifier } from '../utils/financialFlowIdentifier';

export const TRIAL_DURATION_DAYS = 14;
const CADENCE_MONTHLY = 'monthly' as const;
const CADENCE_ANNUAL = 'annual' as const;

export type SubscriptionCadence = typeof CADENCE_MONTHLY | typeof CADENCE_ANNUAL;

const PERIOD_DURATION: Record<SubscriptionCadence, number> = {
  monthly: 30,
  annual: 365,
};

const GRACE_DURATION: Record<SubscriptionCadence, number> = {
  monthly: 7,
  annual: 30,
};

const FINANCIAL_FLOW_EMPRESA_COLUMNS = ['empresa', 'empresa_id', 'idempresa'] as const;
const CLIENTE_EMPRESA_COLUMNS = ['empresa', 'empresa_id', 'idempresa'] as const;

const CADENCE_VALUES: SubscriptionCadence[] = [CADENCE_MONTHLY, CADENCE_ANNUAL];

export type SubscriptionStatus =
  | 'inactive'
  | 'pending'
  | 'trialing'
  | 'active'
  | 'grace_period'
  | 'past_due';

export interface ResolvedSubscriptionPayload {
  planId: number | null;
  status: SubscriptionStatus;
  cadence: SubscriptionCadence | null;
  startedAt: string | null;
  trialEndsAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  graceExpiresAt: string | null;
}

export interface CompanySubscriptionSnapshot {
  planId: number | null;
  cadence: SubscriptionCadence | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  graceExpiresAt: Date | null;
  isActive: boolean | null;
}

const toDate = (value: unknown): Date | null => {
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

const toInteger = (value: unknown): number | null => {
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

const toBoolean = (value: unknown): boolean | null => {
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

const normalizeCadence = (value: unknown): SubscriptionCadence | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (CADENCE_VALUES.includes(normalized as SubscriptionCadence)) {
    return normalized as SubscriptionCadence;
  }

  return null;
};

export const parseCadence = normalizeCadence;

const addDays = (base: Date, amount: number): Date => {
  const result = new Date(base.getTime());
  result.setTime(result.getTime() + amount * 24 * 60 * 60 * 1000);
  return result;
};

export const calculateTrialEnd = (startDate: Date): Date => addDays(startDate, TRIAL_DURATION_DAYS);

export const calculateBillingPeriod = (
  startDate: Date,
  cadence: SubscriptionCadence,
): { start: Date; end: Date } => {
  const start = new Date(startDate.getTime());
  const end = addDays(startDate, PERIOD_DURATION[cadence]);
  return { start, end };
};

export const calculateGraceDeadline = (periodEnd: Date, cadence: SubscriptionCadence): Date =>
  addDays(periodEnd, GRACE_DURATION[cadence]);

const hasPositiveAmount = (value: unknown): boolean => {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) && parsed > 0;
  }

  return false;
};

export const resolvePlanCadence = async (
  planId: number,
  preferredCadence: SubscriptionCadence | null,
): Promise<SubscriptionCadence> => {
  const result = await pool.query<{ valor_mensal: unknown; valor_anual: unknown }>(
    'SELECT valor_mensal, valor_anual FROM public.planos WHERE id = $1 LIMIT 1',
    [planId],
  );

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

const quoteIdentifier = (identifier: string): string => `"${identifier.replace(/"/g, '""')}"`;

let cachedFinancialFlowEmpresaColumn: string | null | undefined;
let cachedClienteEmpresaColumn: string | null | undefined;

const ensureFinancialFlowEmpresaColumn = async (): Promise<string | null> => {
  if (cachedFinancialFlowEmpresaColumn !== undefined) {
    return cachedFinancialFlowEmpresaColumn;
  }

  const result = await pool.query<{ column_name: string }>(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'financial_flows'
        AND column_name = ANY($1)
      LIMIT 1`,
    [FINANCIAL_FLOW_EMPRESA_COLUMNS],
  );

  cachedFinancialFlowEmpresaColumn =
    (result.rowCount ?? 0) > 0 ? result.rows[0].column_name : null;
  return cachedFinancialFlowEmpresaColumn;
};

const ensureClienteEmpresaColumn = async (): Promise<string | null> => {
  if (cachedClienteEmpresaColumn !== undefined) {
    return cachedClienteEmpresaColumn;
  }

  const result = await pool.query<{ column_name: string }>(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'clientes'
        AND column_name = ANY($1)
      LIMIT 1`,
    [CLIENTE_EMPRESA_COLUMNS],
  );

  cachedClienteEmpresaColumn = (result.rowCount ?? 0) > 0 ? result.rows[0].column_name : null;
  return cachedClienteEmpresaColumn;
};

export const findCompanyIdForFinancialFlow = async (
  financialFlowId: number | string,
): Promise<number | null> => {
  const normalizedFinancialFlowId = normalizeFinancialFlowIdentifier(financialFlowId);

  if (normalizedFinancialFlowId === null) {
    return null;
  }

  const column = await ensureFinancialFlowEmpresaColumn();
  if (!column) {
    return null;
  }

  const result = await pool.query<{ empresa_id: unknown }>(
    `SELECT ${quoteIdentifier(column)} AS empresa_id
       FROM financial_flows
      WHERE id = $1
      LIMIT 1`,
    [normalizedFinancialFlowId],
  );

  if (result.rowCount === 0) {
    return null;
  }

  return toInteger(result.rows[0]?.empresa_id);
};

export const findCompanyIdForCliente = async (clienteId: number | string): Promise<number | null> => {
  if ((typeof clienteId !== 'number' || !Number.isInteger(clienteId)) && typeof clienteId !== 'string') {
    return null;
  }

  const column = await ensureClienteEmpresaColumn();
  if (!column) {
    return null;
  }

  const result = await pool.query<{ empresa_id: unknown }>(
    `SELECT ${quoteIdentifier(column)} AS empresa_id
       FROM public.clientes
      WHERE id = $1
      LIMIT 1`,
    [clienteId],
  );

  if (result.rowCount === 0) {
    return null;
  }

  return toInteger(result.rows[0]?.empresa_id);
};

export const fetchCompanySubscription = async (
  companyId: number,
): Promise<CompanySubscriptionSnapshot | null> => {
  if (!Number.isInteger(companyId) || companyId <= 0) {
    return null;
  }

  const result = await pool.query<{
    plano: unknown;
    subscription_cadence: unknown;
    current_period_start: unknown;
    current_period_end: unknown;
    grace_expires_at: unknown;
    ativo: unknown;
  }>(
    `SELECT plano,
            subscription_cadence,
            current_period_start,
            current_period_end,
            grace_expires_at,
            ativo
       FROM public.empresas
      WHERE id = $1
      LIMIT 1`,
    [companyId],
  );

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
    isActive: toBoolean(row.ativo),
  };
};

const resolveEffectiveCadence = async (
  snapshot: CompanySubscriptionSnapshot | null,
  requested: SubscriptionCadence | null,
): Promise<SubscriptionCadence> => {
  if (requested) {
    return requested;
  }

  if (snapshot?.cadence) {
    return snapshot.cadence;
  }

  if (snapshot?.planId) {
    try {
      return await resolvePlanCadence(snapshot.planId, null);
    } catch (error) {
      console.warn('Não foi possível determinar a recorrência do plano, assumindo mensal.', error);
    }
  }

  return 'monthly';
};

export const applySubscriptionPayment = async (
  companyId: number,
  paymentDate: Date,
  cadenceHint: SubscriptionCadence | null = null,
): Promise<void> => {
  if (!(paymentDate instanceof Date) || Number.isNaN(paymentDate.getTime())) {
    return;
  }

  const snapshot = await fetchCompanySubscription(companyId);
  if (!snapshot) {
    return;
  }

  const cadence = await resolveEffectiveCadence(snapshot, cadenceHint);
  const period = calculateBillingPeriod(paymentDate, cadence);
  const grace = calculateGraceDeadline(period.end, cadence);

  await pool.query(
    `UPDATE public.empresas
        SET current_period_start = $1,
            current_period_end = $2,
            grace_expires_at = $3,
            subscription_cadence = $4,
            trial_started_at = NULL,
            trial_ends_at = NULL,
            ativo = TRUE
      WHERE id = $5`,
    [period.start, period.end, grace, cadence, companyId],
  );
};

export const applySubscriptionOverdue = async (
  companyId: number,
  referenceDate: Date | null,
  cadenceHint: SubscriptionCadence | null = null,
): Promise<void> => {
  const snapshot = await fetchCompanySubscription(companyId);
  if (!snapshot) {
    return;
  }

  const cadence = await resolveEffectiveCadence(snapshot, cadenceHint);
  const baseDate = referenceDate ?? snapshot.currentPeriodEnd ?? new Date();

  if (!(baseDate instanceof Date) || Number.isNaN(baseDate.getTime())) {
    return;
  }

  const graceDeadline = calculateGraceDeadline(baseDate, cadence);

  await pool.query(
    `UPDATE public.empresas
        SET grace_expires_at = $1,
            current_period_end = COALESCE(current_period_end, $2),
            subscription_cadence = COALESCE(subscription_cadence, $3)
      WHERE id = $4`,
    [graceDeadline, baseDate, cadence, companyId],
  );
};

export const resolveSubscriptionPayloadFromRow = (
  row: {
    empresa_plano?: unknown;
    empresa_ativo?: unknown;
    trial_started_at?: unknown;
    trial_ends_at?: unknown;
    current_period_start?: unknown;
    current_period_end?: unknown;
    grace_expires_at?: unknown;
    subscription_cadence?: unknown;
  },
  now: Date = new Date(),
): ResolvedSubscriptionPayload => {
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
  if (
    trialStartedAt &&
    trialEndsAt &&
    !Number.isNaN(trialStartedAt.getTime()) &&
    !Number.isNaN(trialEndsAt.getTime()) &&
    nowTs < trialEndsAt.getTime()
  ) {
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

  if (
    currentPeriodStart &&
    currentPeriodEnd &&
    !Number.isNaN(currentPeriodStart.getTime()) &&
    !Number.isNaN(currentPeriodEnd.getTime()) &&
    nowTs <= currentPeriodEnd.getTime()
  ) {
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

  if (
    graceExpiresAt &&
    !Number.isNaN(graceExpiresAt.getTime()) &&
    nowTs <= graceExpiresAt.getTime()
  ) {
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

  if (
    trialEndsAt === null &&
    currentPeriodStart === null &&
    currentPeriodEnd === null &&
    graceExpiresAt === null
  ) {
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

export const __internal = {
  resetCaches() {
    cachedFinancialFlowEmpresaColumn = undefined;
    cachedClienteEmpresaColumn = undefined;
  },
};

export default {
  TRIAL_DURATION_DAYS,
  calculateTrialEnd,
  calculateBillingPeriod,
  calculateGraceDeadline,
  parseCadence,
  resolvePlanCadence,
  findCompanyIdForFinancialFlow,
  findCompanyIdForCliente,
  fetchCompanySubscription,
  applySubscriptionPayment,
  applySubscriptionOverdue,
  resolveSubscriptionPayloadFromRow,
};
