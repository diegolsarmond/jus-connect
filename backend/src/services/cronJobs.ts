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
import juditProcessService from './juditProcessService';
import pool from './db';
import {
  evaluateProcessSyncAvailability,
  type ProcessSyncAvailabilityResult,
} from './processSyncQuotaService';

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_LOOKBACK_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_OVERLAP_MS = 60 * 1000; // 1 minute
const DEFAULT_ASAAS_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

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

export interface JuditScheduledRunStatus {
  hour: number;
  minute: number;
  nextRunAt: string | null;
}

export interface JuditSyncStatus {
  enabled: boolean;
  running: boolean;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage?: string;
  lastManualTriggerAt: string | null;
  scheduledRuns: JuditScheduledRunStatus[];
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
  private readonly asaasService: AsaasChargeSyncService;
  private projudiTimer: NodeJS.Timeout | null = null;
  private projudiRunning = false;
  private asaasTimer: NodeJS.Timeout | null = null;
  private asaasRunning = false;
  private projudiState: InternalProjudiState;
  private asaasState: {
    enabled: boolean;
    intervalMs: number;
    lastRunAt: Date | null;
    lastSuccessAt: Date | null;
    lastErrorAt: Date | null;
    lastErrorMessage?: string;
    lastResult?: AsaasSyncResult;
    nextRunAt: Date | null;
    lastManualTriggerAt: Date | null;
  };
  private juditSchedules: Array<{
    hour: number;
    minute: number;
    timer: NodeJS.Timeout | null;
    nextRunAt: Date | null;
  }>;
  private juditState: {
    enabled: boolean;
    running: boolean;
    lastRunAt: Date | null;
    lastSuccessAt: Date | null;
    lastErrorAt: Date | null;
    lastErrorMessage?: string;
    lastManualTriggerAt: Date | null;
  };

  constructor(
    projudiService: ProjudiNotificationService = projudiNotificationService,
    asaasService: AsaasChargeSyncService = asaasChargeSyncService
  ) {
    this.projudiService = projudiService;
    this.asaasService = asaasService;

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

    this.asaasState = {
      enabled: false,
      intervalMs: this.resolveAsaasIntervalFromEnv(),
      lastRunAt: null,
      lastSuccessAt: null,
      lastErrorAt: null,
      lastErrorMessage: undefined,
      lastResult: undefined,
      nextRunAt: null,
      lastManualTriggerAt: null,
    };

    this.juditSchedules = [8, 12, 16].map((hour) => ({
      hour,
      minute: 0,
      timer: null,
      nextRunAt: null,
    }));

    this.juditState = {
      enabled: false,
      running: false,
      lastRunAt: null,
      lastSuccessAt: null,
      lastErrorAt: null,
      lastErrorMessage: undefined,
      lastManualTriggerAt: null,
    };

    void this.initializeJuditIntegration();
  }

  public async refreshJuditIntegration(): Promise<void> {
    await this.initializeJuditIntegration();
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

  startAsaasChargeSyncJob(): void {
    if (!this.asaasService.hasValidConfiguration()) {
      this.stopAsaasChargeSyncJob();
      return;
    }

    this.asaasState.intervalMs = this.resolveAsaasIntervalFromEnv();
    this.asaasState.enabled = true;

    if (this.asaasTimer) {
      clearInterval(this.asaasTimer);
    }

    const scheduleNextRun = () => {
      this.asaasState.nextRunAt = new Date(Date.now() + this.asaasState.intervalMs);
    };

    this.asaasTimer = setInterval(() => {
      void this.runAsaasChargeSync(false).catch((error) => {
        if (!(error instanceof AsaasConfigurationError)) {
          console.error('[CronJobs] Falha ao executar sincronização automática do Asaas.', error);
        }
      });
      scheduleNextRun();
    }, this.asaasState.intervalMs);

    scheduleNextRun();

    void this.runAsaasChargeSync(false).catch((error) => {
      if (!(error instanceof AsaasConfigurationError)) {
        console.error('[CronJobs] Falha ao executar sincronização inicial do Asaas.', error);
      }
    });
  }

  stopAsaasChargeSyncJob(): void {
    if (this.asaasTimer) {
      clearInterval(this.asaasTimer);
      this.asaasTimer = null;
    }
    this.asaasState.enabled = false;
    this.asaasState.nextRunAt = null;
  }

  async triggerAsaasSyncNow(): Promise<{ status: AsaasSyncStatus; triggered: boolean }> {
    if (!this.asaasService.hasValidConfiguration()) {
      throw new AsaasConfigurationError(
        'Integração com o Asaas não está configurada. Defina ASAAS_API_KEY e ASAAS_API_URL conforme necessário.',
      );
    }

    const alreadyRunning = this.asaasRunning;

    if (!alreadyRunning) {
      await this.runAsaasChargeSync(true);
      return { status: this.getAsaasSyncStatus(), triggered: true };
    }

    return { status: this.getAsaasSyncStatus(), triggered: false };
  }

  getAsaasSyncStatus(): AsaasSyncStatus {
    return {
      enabled: this.asaasState.enabled && this.asaasService.hasValidConfiguration(),
      running: this.asaasRunning,
      intervalMs: this.asaasState.intervalMs,
      lastRunAt: formatOptionalDate(this.asaasState.lastRunAt),
      lastSuccessAt: formatOptionalDate(this.asaasState.lastSuccessAt),
      lastErrorAt: formatOptionalDate(this.asaasState.lastErrorAt),
      lastErrorMessage: this.asaasState.lastErrorMessage,
      lastResult: this.asaasState.lastResult,
      nextRunAt: formatOptionalDate(this.asaasState.nextRunAt),
      lastManualTriggerAt: formatOptionalDate(this.asaasState.lastManualTriggerAt),
    };
  }

  private async initializeJuditIntegration(): Promise<void> {
    try {
      const enabled = await juditProcessService.isEnabled();
      this.juditState.enabled = enabled;

      if (enabled) {
        this.startJuditSchedules();
      } else {
        this.clearJuditSchedules();
      }
    } catch (error) {
      console.error('[CronJobs] Falha ao inicializar agendamentos da Judit.', error);
      this.juditState.enabled = false;
      this.clearJuditSchedules();
    }
  }

  private startJuditSchedules(): void {
    for (const schedule of this.juditSchedules) {
      void this.scheduleNextJuditRun(schedule);
    }
  }

  private clearJuditSchedules(): void {
    for (const schedule of this.juditSchedules) {
      if (schedule.timer) {
        clearTimeout(schedule.timer);
        schedule.timer = null;
      }
      schedule.nextRunAt = null;
    }
  }

  private async scheduleNextJuditRun(schedule: {
    hour: number;
    minute: number;
    timer: NodeJS.Timeout | null;
    nextRunAt: Date | null;
  }): Promise<void> {
    try {
      if (!(await juditProcessService.isEnabled())) {
        this.juditState.enabled = false;
        this.clearJuditSchedules();
        return;
      }

      this.juditState.enabled = true;
      const nextRun = this.computeNextJuditExecution(schedule.hour, schedule.minute);
      schedule.nextRunAt = nextRun;
      const delay = Math.max(0, nextRun.getTime() - Date.now());

      schedule.timer = setTimeout(() => {
        void this.executeScheduledJuditRun(schedule);
      }, delay);
    } catch (error) {
      console.error('[CronJobs] Falha ao agendar próxima execução da Judit.', error);
      this.juditState.enabled = false;
      this.clearJuditSchedules();
    }
  }

  private computeNextJuditExecution(hour: number, minute: number): Date {
    const now = new Date();
    const next = new Date(now);
    next.setHours(hour, minute, 0, 0);

    if (next.getTime() <= now.getTime()) {
      next.setDate(next.getDate() + 1);
    }

    while (next.getDay() === 0) {
      next.setDate(next.getDate() + 1);
    }

    return next;
  }

  private async executeScheduledJuditRun(schedule: {
    hour: number;
    minute: number;
    timer: NodeJS.Timeout | null;
    nextRunAt: Date | null;
  }): Promise<void> {
    schedule.timer = null;
    schedule.nextRunAt = null;

    try {
      await this.runJuditSync('scheduled');
    } catch (error) {
      console.error('[CronJobs] Falha ao executar job agendado da Judit.', error);
    } finally {
      await this.scheduleNextJuditRun(schedule);
    }
  }

  async triggerJuditSyncNow(): Promise<{ status: JuditSyncStatus; triggered: boolean }> {
    if (this.juditState.running) {
      return { status: this.getJuditSyncStatus(), triggered: false };
    }

    await this.runJuditSync('manual');
    return { status: this.getJuditSyncStatus(), triggered: true };
  }

  getJuditSyncStatus(): JuditSyncStatus {
    return {
      enabled: this.juditState.enabled,
      running: this.juditState.running,
      lastRunAt: formatOptionalDate(this.juditState.lastRunAt),
      lastSuccessAt: formatOptionalDate(this.juditState.lastSuccessAt),
      lastErrorAt: formatOptionalDate(this.juditState.lastErrorAt),
      lastErrorMessage: this.juditState.lastErrorMessage,
      lastManualTriggerAt: formatOptionalDate(this.juditState.lastManualTriggerAt),
      scheduledRuns: this.juditSchedules.map((schedule) => ({
        hour: schedule.hour,
        minute: schedule.minute,
        nextRunAt: formatOptionalDate(schedule.nextRunAt),
      })),
    };
  }

  private async runJuditSync(trigger: 'scheduled' | 'manual'): Promise<void> {
    if (!(await juditProcessService.isEnabled())) {
      this.juditState.enabled = false;
      this.clearJuditSchedules();
      return;
    }

    if (this.juditState.running) {
      return;
    }

    this.juditState.enabled = true;
    this.juditState.running = true;
    this.juditState.lastRunAt = new Date();
    if (trigger === 'manual') {
      this.juditState.lastManualTriggerAt = new Date();
    }

    let errors = 0;
    let processed = 0;

    try {
      const processos = await pool.query(
        `SELECT p.id,
                p.numero,
                p.judit_tracking_id,
                p.judit_tracking_hour_range,
                p.idempresa
           FROM public.processos p
           JOIN public.empresas emp ON emp.id = p.idempresa
           JOIN public.planos pl ON pl.id::text = emp.plano::text
          WHERE p.numero IS NOT NULL
            AND COALESCE(pl.sincronizacao_processos_habilitada, FALSE) = TRUE`
      );

      const availabilityCache = new Map<number, ProcessSyncAvailabilityResult>();

      for (const row of processos.rows as Array<{
        id: number;
        numero: string;
        judit_tracking_id: string | null;
        judit_tracking_hour_range: string | null;
        idempresa: number | null;
      }>) {
        const empresaId = row.idempresa ?? null;

        if (!Number.isInteger(empresaId) || empresaId === null || empresaId <= 0) {
          continue;
        }

        let availability = availabilityCache.get(empresaId);

        if (!availability) {
          availability = await evaluateProcessSyncAvailability(empresaId);
          availabilityCache.set(empresaId, availability);
        }

        if (!availability.allowed) {
          continue;
        }

        if (availability.remainingQuota != null && availability.remainingQuota <= 0) {
          continue;
        }

        try {
          await juditProcessService.ensureTrackingForProcess(row.id, row.numero, {
            trackingId: row.judit_tracking_id,
            hourRange: row.judit_tracking_hour_range,
          });

          await juditProcessService.triggerRequestForProcess(row.id, row.numero, {
            source: 'cron',
            skipIfPending: true,
            onDemand: false,
            withAttachments: true,
          });
          if (availability.remainingQuota != null) {
            availability.remainingQuota = Math.max(0, availability.remainingQuota - 1);
          }
          processed += 1;
        } catch (error) {
          errors += 1;
          console.error(
            `[CronJobs] Falha ao sincronizar processo ${row.id} (${row.numero}) com a Judit.`,
            error
          );
        }
      }

      this.juditState.lastSuccessAt = new Date();
      this.juditState.lastErrorAt = errors > 0 ? new Date() : null;
      this.juditState.lastErrorMessage =
        errors > 0
          ? `Ocorreram ${errors} falhas ao sincronizar processos com a Judit.`
          : undefined;
    } catch (error) {
      this.juditState.lastErrorAt = new Date();
      this.juditState.lastErrorMessage =
        error instanceof Error ? error.message : 'Erro desconhecido ao executar sincronização Judit.';
      throw error;
    } finally {
      this.juditState.running = false;
    }

    if (errors > 0) {
      console.warn(
        `[CronJobs] Sincronização Judit processou ${processed} processo(s) com ${errors} falha(s).`
      );
    }
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

  private async runAsaasChargeSync(manual: boolean): Promise<void> {
    if (this.asaasRunning) {
      return;
    }

    if (!this.asaasService.hasValidConfiguration()) {
      this.stopAsaasChargeSyncJob();
      throw new AsaasConfigurationError(
        'Integração com o Asaas não está configurada. Defina ASAAS_API_KEY e ASAAS_API_URL conforme necessário.',
      );
    }

    this.asaasRunning = true;
    const runStartedAt = new Date();
    this.asaasState.lastRunAt = runStartedAt;
    if (manual) {
      this.asaasState.lastManualTriggerAt = runStartedAt;
    }

    try {
      const result = await this.asaasService.syncPendingCharges();
      this.asaasState.lastResult = result;
      this.asaasState.lastSuccessAt = new Date();
      this.asaasState.lastErrorAt = null;
      this.asaasState.lastErrorMessage = undefined;
    } catch (error) {
      this.asaasState.lastErrorAt = new Date();
      this.asaasState.lastErrorMessage = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      this.asaasRunning = false;
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

  private resolveAsaasIntervalFromEnv(): number {
    const ms = parsePositiveNumber(process.env.ASAAS_SYNC_INTERVAL_MS);
    if (ms) {
      return ms;
    }

    return DEFAULT_ASAAS_INTERVAL_MS;
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
