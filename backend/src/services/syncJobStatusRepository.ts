import { DatabaseError } from 'pg';
import pool from './db';

export interface SyncJobStatusRow {
  jobName: string;
  enabled: boolean;
  running: boolean;
  intervalMs: number | null;
  lookbackMs: number | null;
  overlapMs: number | null;
  lastRunAt: Date | null;
  lastSuccessAt: Date | null;
  lastErrorAt: Date | null;
  lastErrorMessage: string | null;
  lastResult: unknown;
  lastReferenceUsed: Date | null;
  nextReference: Date | null;
  lastManualTriggerAt: Date | null;
}

export interface SyncJobStartOptions {
  manual?: boolean;
  intervalMs?: number | null;
  lookbackMs?: number | null;
  overlapMs?: number | null;
  defaultIntervalMs?: number;
  defaultLookbackMs?: number;
  defaultOverlapMs?: number;
}

export interface SyncJobStartResult {
  runId: number;
  referenceUsed: Date | null;
  intervalMs: number | null;
  lookbackMs: number | null;
  overlapMs: number | null;
}

export interface SyncJobFinishOptions {
  success: boolean;
  nextReference?: Date | null;
  error?: unknown;
  result?: unknown;
}

export interface SyncJobConfiguration {
  enabled?: boolean;
  intervalMs?: number | null;
  lookbackMs?: number | null;
  overlapMs?: number | null;
}

export class SyncJobAlreadyRunningError extends Error {
  constructor(jobName: string) {
    super(`Job de sincronização "${jobName}" já está em execução.`);
    this.name = 'SyncJobAlreadyRunningError';
  }
}

const JOB_ALREADY_RUNNING_CODE = '55000';

const parseNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const parseDate = (value: unknown): Date | null => {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

export async function startSyncJobRun(
  jobName: string,
  options: SyncJobStartOptions = {},
): Promise<SyncJobStartResult> {
  const manual = options.manual === true;
  const intervalOverride = options.intervalMs ?? null;
  const lookbackOverride = options.lookbackMs ?? null;
  const overlapOverride = options.overlapMs ?? null;
  const defaultInterval = options.defaultIntervalMs ?? null;
  const defaultLookback = options.defaultLookbackMs ?? null;
  const defaultOverlap = options.defaultOverlapMs ?? null;

  try {
    const { rows } = await pool.query<{
      run_id: string | number | null;
      reference_used: Date | string | null;
      interval_ms: string | number | null;
      lookback_ms: string | number | null;
      overlap_ms: string | number | null;
    }>(
      'SELECT * FROM public.sync_job_start($1,$2,$3,$4,$5,$6,$7,$8)',
      [
        jobName,
        manual,
        intervalOverride,
        lookbackOverride,
        overlapOverride,
        defaultInterval,
        defaultLookback,
        defaultOverlap,
      ],
    );

    if (!rows.length) {
      throw new Error(`Falha ao iniciar execução do job ${jobName}.`);
    }

    const row = rows[0];
    const runId = parseNumber(row.run_id);
    if (!runId) {
      throw new Error(`Identificador inválido retornado para execução do job ${jobName}.`);
    }

    return {
      runId,
      referenceUsed: parseDate(row.reference_used),
      intervalMs: parseNumber(row.interval_ms),
      lookbackMs: parseNumber(row.lookback_ms),
      overlapMs: parseNumber(row.overlap_ms),
    };
  } catch (error) {
    if (error instanceof DatabaseError && error.code === JOB_ALREADY_RUNNING_CODE) {
      throw new SyncJobAlreadyRunningError(jobName);
    }

    throw error;
  }
}

export async function finishSyncJobRun(runId: number, options: SyncJobFinishOptions): Promise<void> {
  const nextReference = options.nextReference ?? null;
  const success = options.success;
  const errorMessage = success
    ? null
    : options.error instanceof Error
      ? options.error.message
      : options.error != null
        ? String(options.error)
        : null;
  const result = options.result ?? null;

  await pool.query('SELECT public.sync_job_finish($1,$2,$3,$4,$5)', [
    runId,
    success,
    nextReference,
    errorMessage,
    result,
  ]);
}

export async function upsertSyncJobConfiguration(
  jobName: string,
  configuration: SyncJobConfiguration,
): Promise<void> {
  const enabled = configuration.enabled;
  const intervalMs = configuration.intervalMs ?? null;
  const lookbackMs = configuration.lookbackMs ?? null;
  const overlapMs = configuration.overlapMs ?? null;

  await pool.query(
    `INSERT INTO public.sync_job_status (job_name, enabled, interval_ms, lookback_ms, overlap_ms)
     VALUES ($1, COALESCE($2, TRUE), $3, $4, $5)
     ON CONFLICT (job_name)
     DO UPDATE SET
       enabled = COALESCE(EXCLUDED.enabled, public.sync_job_status.enabled),
       interval_ms = COALESCE(EXCLUDED.interval_ms, public.sync_job_status.interval_ms),
       lookback_ms = COALESCE(EXCLUDED.lookback_ms, public.sync_job_status.lookback_ms),
       overlap_ms = COALESCE(EXCLUDED.overlap_ms, public.sync_job_status.overlap_ms)`,
    [jobName, enabled, intervalMs, lookbackMs, overlapMs],
  );
}

export async function fetchSyncJobStatus(jobName: string): Promise<SyncJobStatusRow | null> {
  const { rows } = await pool.query<{
    job_name: string;
    enabled: boolean;
    running: boolean;
    interval_ms: string | number | null;
    lookback_ms: string | number | null;
    overlap_ms: string | number | null;
    last_run_at: Date | string | null;
    last_success_at: Date | string | null;
    last_error_at: Date | string | null;
    last_error_message: string | null;
    last_result: unknown;
    last_reference_used: Date | string | null;
    next_reference: Date | string | null;
    last_manual_trigger_at: Date | string | null;
  }>(
    `SELECT
       job_name,
       enabled,
       running,
       interval_ms,
       lookback_ms,
       overlap_ms,
       last_run_at,
       last_success_at,
       last_error_at,
       last_error_message,
       last_result,
       last_reference_used,
       next_reference,
       last_manual_trigger_at
     FROM public.sync_job_status
     WHERE job_name = $1`,
    [jobName],
  );

  if (!rows.length) {
    return null;
  }

  const row = rows[0];

  return {
    jobName: row.job_name,
    enabled: Boolean(row.enabled),
    running: Boolean(row.running),
    intervalMs: parseNumber(row.interval_ms),
    lookbackMs: parseNumber(row.lookback_ms),
    overlapMs: parseNumber(row.overlap_ms),
    lastRunAt: parseDate(row.last_run_at),
    lastSuccessAt: parseDate(row.last_success_at),
    lastErrorAt: parseDate(row.last_error_at),
    lastErrorMessage: row.last_error_message ?? null,
    lastResult: row.last_result ?? null,
    lastReferenceUsed: parseDate(row.last_reference_used),
    nextReference: parseDate(row.next_reference),
    lastManualTriggerAt: parseDate(row.last_manual_trigger_at),
  };
}
