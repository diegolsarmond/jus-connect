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
const DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_LOOKBACK_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_OVERLAP_MS = 60 * 1000; // 1 minute
class CronJobsService {
    constructor(service = projudiNotificationService_1.default) {
        this.projudiTimer = null;
        this.projudiRunning = false;
        this.projudiService = service;
        this.projudiState = {
            enabled: false,
            intervalMs: this.resolveIntervalFromEnv(),
            lookbackMs: this.resolveLookbackFromEnv(),
            overlapMs: this.resolveOverlapFromEnv(),
            nextReference: this.computeInitialReference(),
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
    computeNextReference(_result) {
        const now = Date.now();
        const overlap = this.projudiState.overlapMs ?? DEFAULT_OVERLAP_MS;
        return new Date(now - overlap);
    }
    computeInitialReference() {
        const now = Date.now();
        return new Date(now - this.projudiState.lookbackMs);
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
