"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CronJobsService = void 0;
const projudiNotificationService_1 = __importStar(require("./projudiNotificationService"));
const asaasChargeSync_1 = __importStar(require("./asaasChargeSync"));
const DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_LOOKBACK_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_OVERLAP_MS = 60 * 1000; // 1 minute
const DEFAULT_ASAAS_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
class CronJobsService {
    constructor(projudiService = projudiNotificationService_1.default, asaasService = asaasChargeSync_1.default) {
        this.projudiTimer = null;
        this.projudiRunning = false;
        this.asaasTimer = null;
        this.asaasRunning = false;
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
    }
    startProjudiSyncJob() {
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
                if (!(error instanceof projudiNotificationService_1.ProjudiConfigurationError)) {
                    console.error('[CronJobs] Falha ao executar sincronização automática do Projudi.', error);
                }
            });
            scheduleNextRun();
        }, this.projudiState.intervalMs);
        scheduleNextRun();
        void this.runProjudiSync(false).catch((error) => {
            if (!(error instanceof projudiNotificationService_1.ProjudiConfigurationError)) {
                console.error('[CronJobs] Falha ao executar sincronização inicial do Projudi.', error);
            }
        });
    }
    stopProjudiSyncJob() {
        if (this.projudiTimer) {
            clearInterval(this.projudiTimer);
            this.projudiTimer = null;
        }
        this.projudiState.enabled = false;
        this.projudiState.nextRunAt = null;
    }
    async triggerProjudiSyncNow() {
        if (!this.projudiService.hasValidConfiguration()) {
            throw new projudiNotificationService_1.ProjudiConfigurationError('Integração com o Projudi não está configurada. Defina PROJUDI_BASE_URL, PROJUDI_USER e PROJUDI_PASSWORD.');
        }
        const alreadyRunning = this.projudiRunning;
        if (!alreadyRunning) {
            await this.runProjudiSync(true);
            return { status: this.getProjudiSyncStatus(), triggered: true };
        }
        return { status: this.getProjudiSyncStatus(), triggered: false };
    }
    getProjudiSyncStatus() {
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
    startAsaasChargeSyncJob() {
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
                if (!(error instanceof asaasChargeSync_1.AsaasConfigurationError)) {
                    console.error('[CronJobs] Falha ao executar sincronização automática do Asaas.', error);
                }
            });
            scheduleNextRun();
        }, this.asaasState.intervalMs);
        scheduleNextRun();
        void this.runAsaasChargeSync(false).catch((error) => {
            if (!(error instanceof asaasChargeSync_1.AsaasConfigurationError)) {
                console.error('[CronJobs] Falha ao executar sincronização inicial do Asaas.', error);
            }
        });
    }
    stopAsaasChargeSyncJob() {
        if (this.asaasTimer) {
            clearInterval(this.asaasTimer);
            this.asaasTimer = null;
        }
        this.asaasState.enabled = false;
        this.asaasState.nextRunAt = null;
    }
    async triggerAsaasSyncNow() {
        if (!this.asaasService.hasValidConfiguration()) {
            throw new asaasChargeSync_1.AsaasConfigurationError('Integração com o Asaas não está configurada. Defina ASAAS_API_KEY e ASAAS_API_URL conforme necessário.');
        }
        const alreadyRunning = this.asaasRunning;
        if (!alreadyRunning) {
            await this.runAsaasChargeSync(true);
            return { status: this.getAsaasSyncStatus(), triggered: true };
        }
        return { status: this.getAsaasSyncStatus(), triggered: false };
    }
    getAsaasSyncStatus() {
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
    async runProjudiSync(manual) {
        if (this.projudiRunning) {
            return;
        }
        if (!this.projudiService.hasValidConfiguration()) {
            this.stopProjudiSyncJob();
            throw new projudiNotificationService_1.ProjudiConfigurationError('Integração com o Projudi não está configurada. Defina PROJUDI_BASE_URL, PROJUDI_USER e PROJUDI_PASSWORD.');
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
        }
        catch (error) {
            this.projudiState.lastErrorAt = new Date();
            this.projudiState.lastErrorMessage = error instanceof Error ? error.message : String(error);
            throw error;
        }
        finally {
            this.projudiRunning = false;
        }
    }
    async runAsaasChargeSync(manual) {
        if (this.asaasRunning) {
            return;
        }
        if (!this.asaasService.hasValidConfiguration()) {
            this.stopAsaasChargeSyncJob();
            throw new asaasChargeSync_1.AsaasConfigurationError('Integração com o Asaas não está configurada. Defina ASAAS_API_KEY e ASAAS_API_URL conforme necessário.');
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
        }
        catch (error) {
            this.asaasState.lastErrorAt = new Date();
            this.asaasState.lastErrorMessage = error instanceof Error ? error.message : String(error);
            throw error;
        }
        finally {
            this.asaasRunning = false;
        }
    }
    computeNextReference(_result) {
        const now = Date.now();
        const overlap = this.projudiState.overlapMs ?? DEFAULT_OVERLAP_MS;
        return new Date(now - overlap);
    }
    computeInitialReference(lookbackMs) {
        const now = Date.now();
        const effectiveLookbackMs = lookbackMs ?? this.projudiState.lookbackMs;
        return new Date(now - effectiveLookbackMs);
    }
    resolveIntervalFromEnv() {
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
    resolveLookbackFromEnv() {
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
    resolveOverlapFromEnv() {
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
    resolveAsaasIntervalFromEnv() {
        const ms = parsePositiveNumber(process.env.ASAAS_SYNC_INTERVAL_MS);
        if (ms) {
            return ms;
        }
        return DEFAULT_ASAAS_INTERVAL_MS;
    }
}
exports.CronJobsService = CronJobsService;
function parsePositiveNumber(value) {
    if (!value) {
        return null;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return null;
    }
    return parsed;
}
function parseNonNegativeNumber(value) {
    if (value === undefined) {
        return null;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return null;
    }
    return parsed;
}
function formatOptionalDate(date) {
    if (!date) {
        return null;
    }
    return date.toISOString();
}
const cronJobs = new CronJobsService();
exports.default = cronJobs;
