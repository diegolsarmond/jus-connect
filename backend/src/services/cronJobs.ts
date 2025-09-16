import projudiNotificationService, {
  FetchIntimacoesResult,
  ProjudiConfigurationError,
  ProjudiNotificationService,
} from './projudiNotificationService';

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_LOOKBACK_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_OVERLAP_MS = 60 * 1000; // 1 minute

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

interface InternalProjudiState {
  enabled: boolean;
  intervalMs: number;
  lookbackMs: number;
  overlapMs: number;
  nextReference: Date;
  lastReferenceUsed: Date | null;
  lastRunAt: Date | null;
  lastSuccessAt: Date | null;
  lastErrorAt: Date | null;
  lastErrorMessage?: string;
  lastResult?: FetchIntimacoesResult;
  nextRunAt: Date | null;
  lastManualTriggerAt: Date | null;
}

export class CronJobsService {
  private readonly projudiService: ProjudiNotificationService;
  private projudiTimer: NodeJS.Timeout | null = null;
  private projudiRunning = false;
  private projudiState: InternalProjudiState;

  constructor(service: ProjudiNotificationService = projudiNotificationService) {
    this.projudiService = service;

    const intervalMs = this.resolveIntervalFromEnv();
    const lookbackMs = this.resolveLookbackFromEnv();
    const overlapMs = this.resolveOverlapFromEnv();

    this.projudiState = {
      enabled: false,
      intervalMs,
      lookbackMs,
      overlapMs,
      nextReference: this.computeInitialReference(lookbackMs),
      lastReferenceUsed: null,
      lastRunAt: null,
      lastSuccessAt: null,
      lastErrorAt: null,
      lastErrorMessage: undefined,
      lastResult: undefined,
      nextRunAt: null,
      lastManualTriggerAt: null,
    };
  }

  startProjudiSyncJob(): void {
    if (!this.projudiService.hasValidConfiguration()) {
      this.stopProjudiSyncJob();
      return;
    }

    this.projudiState.intervalMs = this.resolveIntervalFromEnv();
    this.projudiState.lookbackMs = this.resolveLookbackFromEnv();
    this.projudiState.overlapMs = this.resolveOverlapFromEnv();
    this.projudiState.enabled = true;

    if (!this.projudiState.lastReferenceUsed) {
      this.projudiState.nextReference = this.computeInitialReference();
    }

    if (this.projudiTimer) {
      clearInterval(this.projudiTimer);
    }

    const scheduleNextRun = () => {
      this.projudiState.nextRunAt = new Date(Date.now() + this.projudiState.intervalMs);
    };

    this.projudiTimer = setInterval(() => {
      void this.runProjudiSync(false).catch((error) => {
        if (!(error instanceof ProjudiConfigurationError)) {
          console.error('[CronJobs] Falha ao executar sincronização automática do Projudi.', error);
        }
      });
      scheduleNextRun();
    }, this.projudiState.intervalMs);

    scheduleNextRun();

    void this.runProjudiSync(false).catch((error) => {
      if (!(error instanceof ProjudiConfigurationError)) {
        console.error('[CronJobs] Falha ao executar sincronização inicial do Projudi.', error);
      }
    });
  }

  stopProjudiSyncJob(): void {
    if (this.projudiTimer) {
      clearInterval(this.projudiTimer);
      this.projudiTimer = null;
    }
    this.projudiState.enabled = false;
    this.projudiState.nextRunAt = null;
  }

  async triggerProjudiSyncNow(): Promise<{ status: ProjudiSyncStatus; triggered: boolean }> {
    if (!this.projudiService.hasValidConfiguration()) {
      throw new ProjudiConfigurationError(
        'Integração com o Projudi não está configurada. Defina PROJUDI_BASE_URL, PROJUDI_USER e PROJUDI_PASSWORD.',
      );
    }

    const alreadyRunning = this.projudiRunning;

    if (!alreadyRunning) {
      await this.runProjudiSync(true);
      return { status: this.getProjudiSyncStatus(), triggered: true };
    }

    return { status: this.getProjudiSyncStatus(), triggered: false };
  }

  getProjudiSyncStatus(): ProjudiSyncStatus {
    return {
      enabled: this.projudiState.enabled && this.projudiService.hasValidConfiguration(),
      running: this.projudiRunning,
      intervalMs: this.projudiState.intervalMs,
      lastRunAt: formatOptionalDate(this.projudiState.lastRunAt),
      lastSuccessAt: formatOptionalDate(this.projudiState.lastSuccessAt),
      lastErrorAt: formatOptionalDate(this.projudiState.lastErrorAt),
      lastErrorMessage: this.projudiState.lastErrorMessage,
      lastResult: this.projudiState.lastResult,
      lastReferenceUsed: formatOptionalDate(this.projudiState.lastReferenceUsed),
      nextReference: formatOptionalDate(this.projudiState.nextReference),
      nextRunAt: formatOptionalDate(this.projudiState.nextRunAt),
      lastManualTriggerAt: formatOptionalDate(this.projudiState.lastManualTriggerAt),
    };
  }

  private async runProjudiSync(manual: boolean): Promise<void> {
    if (this.projudiRunning) {
      return;
    }

    if (!this.projudiService.hasValidConfiguration()) {
      this.stopProjudiSyncJob();
      throw new ProjudiConfigurationError(
        'Integração com o Projudi não está configurada. Defina PROJUDI_BASE_URL, PROJUDI_USER e PROJUDI_PASSWORD.',
      );
    }

    this.projudiRunning = true;
    const runStartedAt = new Date();
    this.projudiState.lastRunAt = runStartedAt;
    if (manual) {
      this.projudiState.lastManualTriggerAt = runStartedAt;
    }

    const reference = new Date(this.projudiState.nextReference.getTime());
    this.projudiState.lastReferenceUsed = reference;

    try {
      const result = await this.projudiService.fetchNewIntimacoes(reference);
      this.projudiState.lastResult = result;
      this.projudiState.lastSuccessAt = new Date();
      this.projudiState.lastErrorAt = null;
      this.projudiState.lastErrorMessage = undefined;
      this.projudiState.nextReference = this.computeNextReference(result);
    } catch (error) {
      this.projudiState.lastErrorAt = new Date();
      this.projudiState.lastErrorMessage = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      this.projudiRunning = false;
    }
  }

  private computeNextReference(_result: FetchIntimacoesResult): Date {
    const now = Date.now();
    const overlap = this.projudiState.overlapMs ?? DEFAULT_OVERLAP_MS;
    return new Date(now - overlap);
  }

  private computeInitialReference(lookbackMs?: number): Date {
    const now = Date.now();
    const effectiveLookbackMs = lookbackMs ?? this.projudiState.lookbackMs;
    return new Date(now - effectiveLookbackMs);
  }

  private resolveIntervalFromEnv(): number {
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

    return DEFAULT_INTERVAL_MS;
  }

  private resolveLookbackFromEnv(): number {
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

    return DEFAULT_LOOKBACK_MS;
  }

  private resolveOverlapFromEnv(): number {
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

    return DEFAULT_OVERLAP_MS;
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

function formatOptionalDate(date: Date | null | undefined): string | null {
  if (!date) {
    return null;
  }
  return date.toISOString();
}

const cronJobs = new CronJobsService();

export default cronJobs;
