import projudiNotificationService, {
  FetchIntimacoesResult,
  ProjudiConfigurationError,
  ProjudiNotificationService,
} from './projudiNotificationService';
import {
  finishSyncJobRun,
  startSyncJobRun,
  SyncJobAlreadyRunningError,
} from './syncJobStatusRepository';

export const PROJUDI_SYNC_JOB_NAME = 'projudi_intimacoes_sync';
export const DEFAULT_PROJUDI_INTERVAL_MS = 5 * 60 * 1000;
export const DEFAULT_PROJUDI_LOOKBACK_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_PROJUDI_OVERLAP_MS = 60 * 1000;

export interface ExecuteProjudiSyncOptions {
  manual?: boolean;
  service?: ProjudiNotificationService;
  reference?: Date;
}

export interface ExecuteProjudiSyncResult {
  result: FetchIntimacoesResult;
}

export class ProjudiSyncAlreadyRunningError extends Error {
  constructor() {
    super('Job de sincronização do Projudi já está em execução.');
    this.name = 'ProjudiSyncAlreadyRunningError';
  }
}

export function resolveProjudiIntervalFromEnv(): number {
  const ms = parsePositiveNumber(process.env.PROJUDI_SYNC_INTERVAL_MS);
  if (ms) {
    return ms;
  }

  const minutes = parsePositiveNumber(process.env.PROJUDI_SYNC_INTERVAL_MINUTES);
  if (minutes) {
    return minutes * 60 * 1000;
  }

  const seconds = parsePositiveNumber(process.env.PROJUDI_SYNC_INTERVAL_SECONDS);
  if (seconds) {
    return seconds * 1000;
  }

  return DEFAULT_PROJUDI_INTERVAL_MS;
}

export function resolveProjudiLookbackFromEnv(): number {
  const ms = parsePositiveNumber(process.env.PROJUDI_SYNC_LOOKBACK_MS);
  if (ms) {
    return ms;
  }

  const hours = parsePositiveNumber(process.env.PROJUDI_SYNC_LOOKBACK_HOURS);
  if (hours) {
    return hours * 60 * 60 * 1000;
  }

  const days = parsePositiveNumber(process.env.PROJUDI_SYNC_LOOKBACK_DAYS);
  if (days) {
    return days * 24 * 60 * 60 * 1000;
  }

  return DEFAULT_PROJUDI_LOOKBACK_MS;
}

export function resolveProjudiOverlapFromEnv(): number {
  const ms = parseNonNegativeNumber(process.env.PROJUDI_SYNC_OVERLAP_MS);
  if (ms !== null) {
    return ms;
  }

  const minutes = parseNonNegativeNumber(process.env.PROJUDI_SYNC_OVERLAP_MINUTES);
  if (minutes !== null) {
    return minutes * 60 * 1000;
  }

  const seconds = parseNonNegativeNumber(process.env.PROJUDI_SYNC_OVERLAP_SECONDS);
  if (seconds !== null) {
    return seconds * 1000;
  }

  return DEFAULT_PROJUDI_OVERLAP_MS;
}

export async function executeProjudiSync(
  options: ExecuteProjudiSyncOptions = {},
): Promise<ExecuteProjudiSyncResult> {
  const service = options.service ?? projudiNotificationService;

  if (!service.hasValidConfiguration()) {
    throw new ProjudiConfigurationError(
      'Integração com o Projudi não está configurada. Defina PROJUDI_BASE_URL, PROJUDI_USER e PROJUDI_PASSWORD.',
    );
  }

  const manual = options.manual === true;
  const intervalMs = resolveProjudiIntervalFromEnv();
  const lookbackMs = resolveProjudiLookbackFromEnv();
  const overlapMs = resolveProjudiOverlapFromEnv();

  let runId: number | null = null;
  const manualReference = options.reference ?? null;

  try {
    const start = await startSyncJobRun(PROJUDI_SYNC_JOB_NAME, {
      manual,
      intervalMs,
      lookbackMs,
      overlapMs,
      defaultIntervalMs: DEFAULT_PROJUDI_INTERVAL_MS,
      defaultLookbackMs: DEFAULT_PROJUDI_LOOKBACK_MS,
      defaultOverlapMs: DEFAULT_PROJUDI_OVERLAP_MS,
    });

    runId = start.runId;

    const computedReference = manualReference ?? start.referenceUsed ?? computeInitialReference(start.lookbackMs ?? lookbackMs);

    const result = await service.fetchNewIntimacoes(computedReference);
    const nextReference = computeNextReference(start.overlapMs ?? overlapMs);

    await finishSyncJobRun(runId, {
      success: true,
      nextReference,
      result,
    });

    return { result };
  } catch (error) {
    if (error instanceof SyncJobAlreadyRunningError) {
      throw new ProjudiSyncAlreadyRunningError();
    }

    if (runId !== null) {
      await finishSyncJobRun(runId, {
        success: false,
        error,
      });
    }

    throw error;
  }
}

export function computeNextReference(overlapMs?: number | null): Date {
  const overlap = typeof overlapMs === 'number' && overlapMs >= 0 ? overlapMs : DEFAULT_PROJUDI_OVERLAP_MS;
  return new Date(Date.now() - overlap);
}

export function computeInitialReference(lookbackMs?: number | null): Date {
  const lookback = typeof lookbackMs === 'number' && lookbackMs > 0 ? lookbackMs : DEFAULT_PROJUDI_LOOKBACK_MS;
  return new Date(Date.now() - lookback);
}

function parsePositiveNumber(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function parseNonNegativeNumber(value: string | undefined): number | null {
  if (value === undefined) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}
