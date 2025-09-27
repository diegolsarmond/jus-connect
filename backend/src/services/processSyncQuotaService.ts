import { fetchPlanLimitsForCompany, type CompanyPlanLimits } from './planLimitsService';
import pool from './db';

const toNonNegativeInteger = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return 0;
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.trunc(parsed));
    }
  }

  return 0;
};

const getCurrentMonthStart = (reference: Date = new Date()): Date => {
  const monthStart = new Date(reference);
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  return monthStart;
};

export const countCompanyProcessSyncUsage = async (
  companyId: number,
  referenceDate: Date = new Date(),
): Promise<number> => {
  if (!Number.isInteger(companyId) || companyId <= 0) {
    return 0;
  }

  const since = getCurrentMonthStart(referenceDate).toISOString();

  const [syncResult, consultaResult] = await Promise.all([
    pool.query<{ total: unknown }>(
      `SELECT COUNT(*)::bigint AS total
         FROM public.process_sync ps
         JOIN public.processos p ON p.id = ps.processo_id
        WHERE p.idempresa IS NOT DISTINCT FROM $1
          AND COALESCE(ps.requested_at, ps.created_at) >= $2::timestamptz`,
      [companyId, since],
    ),
    pool.query<{ total: unknown }>(
      `SELECT COUNT(*)::bigint AS total
         FROM public.processo_consultas_api pc
         JOIN public.processos p ON p.id = pc.processo_id
        WHERE p.idempresa IS NOT DISTINCT FROM $1
          AND pc.consultado_em >= $2::timestamptz`,
      [companyId, since],
    ),
  ]);

  const syncCount = syncResult.rowCount > 0 ? toNonNegativeInteger(syncResult.rows[0]?.total) : 0;
  const consultaCount =
    consultaResult.rowCount > 0 ? toNonNegativeInteger(consultaResult.rows[0]?.total) : 0;

  return syncCount + consultaCount;
};

export type ProcessSyncAvailabilityReason = 'disabled' | 'quota_exceeded';

export interface ProcessSyncAvailabilityResult {
  allowed: boolean;
  remainingQuota: number | null;
  planLimits: CompanyPlanLimits | null;
  reason?: ProcessSyncAvailabilityReason;
}

export const evaluateProcessSyncAvailability = async (
  companyId: number,
  planLimits?: CompanyPlanLimits | null,
): Promise<ProcessSyncAvailabilityResult> => {
  const limits = planLimits ?? (await fetchPlanLimitsForCompany(companyId));

  if (!limits || limits.sincronizacaoProcessosHabilitada !== true) {
    return {
      allowed: false,
      remainingQuota: limits?.sincronizacaoProcessosCota ?? null,
      planLimits: limits,
      reason: 'disabled',
    };
  }

  if (limits.sincronizacaoProcessosCota == null) {
    return {
      allowed: true,
      remainingQuota: null,
      planLimits: limits,
    };
  }

  const usage = await countCompanyProcessSyncUsage(companyId);
  const remaining = Math.max(0, limits.sincronizacaoProcessosCota - usage);

  if (remaining <= 0) {
    return {
      allowed: false,
      remainingQuota: 0,
      planLimits: limits,
      reason: 'quota_exceeded',
    };
  }

  return {
    allowed: true,
    remainingQuota: remaining,
    planLimits: limits,
  };
};
