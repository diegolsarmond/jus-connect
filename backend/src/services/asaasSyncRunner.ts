import asaasChargeSyncService, {
  AsaasChargeSyncService,
  AsaasConfigurationError,
  AsaasSyncResult,
} from './asaasChargeSync';
import {
  finishSyncJobRun,
  startSyncJobRun,
  SyncJobAlreadyRunningError,
} from './syncJobStatusRepository';

export const ASAAS_SYNC_JOB_NAME = 'asaas_charge_sync';
export const DEFAULT_ASAAS_INTERVAL_MS = 5 * 60 * 1000;

export interface ExecuteAsaasSyncOptions {
  manual?: boolean;
  service?: AsaasChargeSyncService;
}

export interface ExecuteAsaasSyncResult {
  result: AsaasSyncResult;
}

export class AsaasSyncAlreadyRunningError extends Error {
  constructor() {
    super('Job de sincronização do Asaas já está em execução.');
    this.name = 'AsaasSyncAlreadyRunningError';
  }
}

export function resolveAsaasIntervalFromEnv(): number {
  const ms = parsePositiveNumber(process.env.ASAAS_SYNC_INTERVAL_MS);
  if (ms) {
    return ms;
  }

  const minutes = parsePositiveNumber(process.env.ASAAS_SYNC_INTERVAL_MINUTES);
  if (minutes) {
    return minutes * 60 * 1000;
  }

  const seconds = parsePositiveNumber(process.env.ASAAS_SYNC_INTERVAL_SECONDS);
  if (seconds) {
    return seconds * 1000;
  }

  return DEFAULT_ASAAS_INTERVAL_MS;
}

export async function executeAsaasSync(
  options: ExecuteAsaasSyncOptions = {},
): Promise<ExecuteAsaasSyncResult> {
  const service = options.service ?? asaasChargeSyncService;

  if (!service.hasValidConfiguration()) {
    throw new AsaasConfigurationError(
      'Integração com o Asaas não está configurada. Defina ASAAS_ACCESS_TOKEN (ou ASAAS_API_KEY) e ASAAS_API_URL conforme necessário.',
    );
  }

  const manual = options.manual === true;
  const intervalMs = resolveAsaasIntervalFromEnv();

  let runId: number | null = null;

  try {
    const start = await startSyncJobRun(ASAAS_SYNC_JOB_NAME, {
      manual,
      intervalMs,
      defaultIntervalMs: DEFAULT_ASAAS_INTERVAL_MS,
      defaultLookbackMs: 0,
      defaultOverlapMs: 0,
    });

    runId = start.runId;

    const result = await service.syncPendingCharges();

    await finishSyncJobRun(runId, {
      success: true,
      result,
    });

    return { result };
  } catch (error) {
    if (error instanceof SyncJobAlreadyRunningError) {
      throw new AsaasSyncAlreadyRunningError();
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
