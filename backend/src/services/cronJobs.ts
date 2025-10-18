import projudiNotificationService, {
  FetchIntimacoesResult,
  ProjudiConfigurationError,
  ProjudiNotificationService,
} from './projudiNotificationService';
import asaasChargeSyncService, {
  AsaasChargeSyncService,
  AsaasConfigurationError,
  AsaasSyncResult,
} from './asaasChargeSync';
import {
  executeProjudiSync,
  ProjudiSyncAlreadyRunningError,
  PROJUDI_SYNC_JOB_NAME,
  resolveProjudiIntervalFromEnv,
} from './projudiSyncRunner';
import {
  executeAsaasSync,
  AsaasSyncAlreadyRunningError,
  ASAAS_SYNC_JOB_NAME,
  resolveAsaasIntervalFromEnv,
} from './asaasSyncRunner';
import {
  fetchSyncJobStatus,
  SyncJobStatusRow,
  upsertSyncJobConfiguration,
} from './syncJobStatusRepository';

const CONNECTION_ERROR_CODES = new Set(['ENOTFOUND', 'ECONNREFUSED', 'EAI_AGAIN']);

export interface ProjudiSyncStatus {
  enabled: boolean;
  running: boolean;
  intervalMs: number;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage?: string;
  lastResult?: FetchIntimacoesResult;
  lastReferenceUsed: string | null;
  nextReference: string | null;
  nextRunAt: string | null;
  lastManualTriggerAt: string | null;
}

export interface AsaasSyncStatus {
  enabled: boolean;
  running: boolean;
  intervalMs: number;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage?: string;
  lastResult?: AsaasSyncResult;
  nextRunAt: string | null;
  lastManualTriggerAt: string | null;
}

export class CronJobsService {
  private readonly projudiService: ProjudiNotificationService;
  private readonly asaasService: AsaasChargeSyncService;
  private readonly upsertSyncJobConfigurationFn = upsertSyncJobConfiguration;

  constructor(
    projudiService: ProjudiNotificationService = projudiNotificationService,
    asaasService: AsaasChargeSyncService = asaasChargeSyncService,
  ) {
    this.projudiService = projudiService;
    this.asaasService = asaasService;
  }

  async startProjudiSyncJob(): Promise<void> {
    await this.stopProjudiSyncJob();
  }

  async stopProjudiSyncJob(): Promise<void> {
    try {
      await this.upsertSyncJobConfigurationFn(PROJUDI_SYNC_JOB_NAME, {
        enabled: false,
      });
    } catch (error) {
      if (
        this.handleSyncJobConnectionError(
          error,
          'Ignorando a configuração do job de sincronização do Projudi: falha ao conectar ao banco de dados.',
        )
      ) {
        return;
      }

      throw error;
    }
  }

  async triggerProjudiSyncNow(): Promise<{ status: ProjudiSyncStatus; triggered: boolean }> {
    if (!this.projudiService.hasValidConfiguration()) {
      throw new ProjudiConfigurationError(
        'Integração com o Projudi não está configurada. Defina PROJUDI_BASE_URL, PROJUDI_USER e PROJUDI_PASSWORD.',
      );
    }

    try {
      await executeProjudiSync({ manual: true, service: this.projudiService });
      const status = await this.getProjudiSyncStatus();
      return { status, triggered: true };
    } catch (error) {
      if (error instanceof ProjudiSyncAlreadyRunningError) {
        const status = await this.getProjudiSyncStatus();
        return { status, triggered: false };
      }

      throw error;
    }
  }

  async getProjudiSyncStatus(): Promise<ProjudiSyncStatus> {
    const row = await fetchSyncJobStatus(PROJUDI_SYNC_JOB_NAME);
    return this.mapProjudiStatus(row);
  }

  async startAsaasChargeSyncJob(): Promise<void> {
    if (!this.asaasService.hasValidConfiguration()) {
      await this.stopAsaasChargeSyncJob();
      return;
    }

    try {
      await this.upsertSyncJobConfigurationFn(ASAAS_SYNC_JOB_NAME, {
        enabled: true,
        intervalMs: resolveAsaasIntervalFromEnv(),
      });
    } catch (error) {
      if (
        this.handleSyncJobConnectionError(
          error,
          'Ignorando a configuração do job de sincronização do Asaas: falha ao conectar ao banco de dados.',
        )
      ) {
        return;
      }

      throw error;
    }
  }

  async stopAsaasChargeSyncJob(): Promise<void> {
    try {
      await this.upsertSyncJobConfigurationFn(ASAAS_SYNC_JOB_NAME, {
        enabled: false,
      });
    } catch (error) {
      if (
        this.handleSyncJobConnectionError(
          error,
          'Ignorando a configuração do job de sincronização do Asaas: falha ao conectar ao banco de dados.',
        )
      ) {
        return;
      }

      throw error;
    }
  }

  async triggerAsaasSyncNow(): Promise<{ status: AsaasSyncStatus; triggered: boolean }> {
    if (!this.asaasService.hasValidConfiguration()) {
      throw new AsaasConfigurationError(
        'Integração com o Asaas não está configurada. Defina ASAAS_ACCESS_TOKEN (ou ASAAS_API_KEY) e ASAAS_API_URL conforme necessário.',
      );
    }

    try {
      await executeAsaasSync({ manual: true, service: this.asaasService });
      const status = await this.getAsaasSyncStatus();
      return { status, triggered: true };
    } catch (error) {
      if (error instanceof AsaasSyncAlreadyRunningError) {
        const status = await this.getAsaasSyncStatus();
        return { status, triggered: false };
      }

      throw error;
    }
  }

  async getAsaasSyncStatus(): Promise<AsaasSyncStatus> {
    const row = await fetchSyncJobStatus(ASAAS_SYNC_JOB_NAME);
    return this.mapAsaasStatus(row);
  }

  private mapProjudiStatus(row: SyncJobStatusRow | null): ProjudiSyncStatus {
    const intervalMs = row?.intervalMs ?? resolveProjudiIntervalFromEnv();
    const lastResult = this.normalizeProjudiResult(row?.lastResult);
    const nextRunAt = this.computeNextRunAt(row, intervalMs);

    return {
      enabled: Boolean(row?.enabled) && this.projudiService.hasValidConfiguration(),
      running: Boolean(row?.running),
      intervalMs,
      lastRunAt: formatOptionalDate(row?.lastRunAt),
      lastSuccessAt: formatOptionalDate(row?.lastSuccessAt),
      lastErrorAt: formatOptionalDate(row?.lastErrorAt),
      lastErrorMessage: row?.lastErrorMessage ?? undefined,
      lastResult: lastResult,
      lastReferenceUsed: formatOptionalDate(row?.lastReferenceUsed),
      nextReference: formatOptionalDate(row?.nextReference),
      nextRunAt: formatOptionalDate(nextRunAt),
      lastManualTriggerAt: formatOptionalDate(row?.lastManualTriggerAt),
    };
  }

  private mapAsaasStatus(row: SyncJobStatusRow | null): AsaasSyncStatus {
    const intervalMs = row?.intervalMs ?? resolveAsaasIntervalFromEnv();
    const lastResult = this.normalizeAsaasResult(row?.lastResult);
    const nextRunAt = this.computeNextRunAt(row, intervalMs);

    return {
      enabled: Boolean(row?.enabled) && this.asaasService.hasValidConfiguration(),
      running: Boolean(row?.running),
      intervalMs,
      lastRunAt: formatOptionalDate(row?.lastRunAt),
      lastSuccessAt: formatOptionalDate(row?.lastSuccessAt),
      lastErrorAt: formatOptionalDate(row?.lastErrorAt),
      lastErrorMessage: row?.lastErrorMessage ?? undefined,
      lastResult,
      nextRunAt: formatOptionalDate(nextRunAt),
      lastManualTriggerAt: formatOptionalDate(row?.lastManualTriggerAt),
    };
  }

  private handleSyncJobConnectionError(error: unknown, message: string): boolean {
    const errno = (error as NodeJS.ErrnoException).code;

    if (errno && CONNECTION_ERROR_CODES.has(errno)) {
      console.warn(message, error);
      return true;
    }

    return false;
  }

  private computeNextRunAt(row: SyncJobStatusRow | null, intervalMs: number): Date | null {
    if (!row?.lastRunAt || !Number.isFinite(intervalMs) || intervalMs <= 0) {
      return null;
    }

    return new Date(row.lastRunAt.getTime() + intervalMs);
  }

  private normalizeProjudiResult(value: unknown): FetchIntimacoesResult | undefined {
    if (!value || typeof value !== 'object') {
      return undefined;
    }

    const candidate = value as FetchIntimacoesResult;
    return candidate?.source === 'projudi' ? candidate : undefined;
  }

  private normalizeAsaasResult(value: unknown): AsaasSyncResult | undefined {
    if (!value || typeof value !== 'object') {
      return undefined;
    }

    const candidate = value as AsaasSyncResult;
    return typeof candidate?.totalCharges === 'number' ? candidate : undefined;
  }
}

function formatOptionalDate(date: Date | null | undefined): string | null {
  if (!date) {
    return null;
  }
  return date.toISOString();
}

const cronJobs = new CronJobsService();

export default cronJobs;
