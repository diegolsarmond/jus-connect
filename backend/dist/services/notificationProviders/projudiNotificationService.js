"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projudiNotificationProvider = exports.ProjudiNotificationProvider = void 0;
const notificationService_1 = require("../notificationService");
const types_1 = require("./types");
const VALID_ALERT_TYPES = [
    'deadline',
    'document',
    'task',
    'hearing',
    'movement',
];
function resolveAlertType(value) {
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (VALID_ALERT_TYPES.includes(normalized)) {
            return normalized;
        }
    }
    return 'movement';
}
function resolveNotificationType(kind) {
    switch (kind) {
        case 'deadline':
            return 'warning';
        case 'hearing':
            return 'success';
        default:
            return 'info';
    }
}
function buildNotificationTitle(alert) {
    const processPart = alert.processNumber ? ` no processo ${alert.processNumber}` : '';
    switch (alert.kind) {
        case 'deadline':
            return `Projudi: novo prazo${processPart}`;
        case 'document':
            return `Projudi: novo documento disponível${processPart}`;
        case 'task':
            return `Projudi: nova tarefa${processPart}`;
        case 'hearing':
            return `Projudi: audiência atualizada${processPart}`;
        default:
            return `Projudi: atualização${processPart}`;
    }
}
function buildNotificationMessage(alert) {
    const details = [alert.description];
    if (alert.processNumber) {
        details.push(`Processo ${alert.processNumber}`);
    }
    if (alert.dueDate) {
        details.push(`Prazo em ${alert.dueDate}`);
    }
    return details.join(' — ');
}
class ProjudiNotificationProvider {
    constructor(publish = notificationService_1.createNotification) {
        this.id = 'projudi';
        this.pending = [];
        this.subscribed = false;
        this.publish = publish;
    }
    async subscribe() {
        this.subscribed = true;
    }
    async fetchUpdates() {
        const notifications = [...this.pending];
        this.pending = [];
        return notifications;
    }
    async handleWebhook(req) {
        const payloads = this.normalizePayload(req.body);
        if (!this.subscribed) {
            await this.subscribe();
        }
        const created = [];
        for (const payload of payloads) {
            for (const alert of payload.alerts) {
                const notification = this.publish({
                    userId: payload.userId,
                    title: buildNotificationTitle(alert),
                    message: buildNotificationMessage(alert),
                    category: 'projudi',
                    type: resolveNotificationType(alert.kind),
                    metadata: {
                        provider: 'projudi',
                        alertType: alert.kind,
                        processNumber: alert.processNumber,
                        dueDate: alert.dueDate,
                        ...alert.extra,
                    },
                });
                this.pending.push(notification);
                created.push(notification);
            }
        }
        return created;
    }
    normalizePayload(body) {
        if (body === null || body === undefined) {
            throw new types_1.NotificationProviderError('Projudi webhook payload cannot be empty');
        }
        const items = Array.isArray(body) ? body : [body];
        if (items.length === 0) {
            throw new types_1.NotificationProviderError('Projudi webhook payload cannot be empty');
        }
        return items.map((item, index) => this.normalizePayloadItem(item, index));
    }
    normalizePayloadItem(raw, index) {
        if (!raw || typeof raw !== 'object') {
            throw new types_1.NotificationProviderError(`Projudi webhook payload at index ${index} must be an object`);
        }
        const { userId, alerts } = raw;
        if (typeof userId !== 'string' || userId.trim() === '') {
            throw new types_1.NotificationProviderError('Projudi webhook payload is missing a valid userId');
        }
        if (!Array.isArray(alerts) || alerts.length === 0) {
            throw new types_1.NotificationProviderError('Projudi webhook payload must include at least one alert');
        }
        const normalizedAlerts = alerts.map((alert, alertIndex) => this.normalizeAlert(alert, alertIndex));
        return {
            userId,
            alerts: normalizedAlerts,
        };
    }
    normalizeAlert(raw, index) {
        if (!raw || typeof raw !== 'object') {
            throw new types_1.NotificationProviderError(`Projudi alert at index ${index} must be an object`);
        }
        const alert = raw;
        const description = typeof alert.description === 'string' ? alert.description.trim() : '';
        if (!description) {
            throw new types_1.NotificationProviderError(`Projudi alert at index ${index} must include a description`);
        }
        const processNumber = typeof alert.processNumber === 'string' && alert.processNumber.trim() !== ''
            ? alert.processNumber
            : undefined;
        const dueDate = typeof alert.dueDate === 'string' && alert.dueDate.trim() !== '' ? alert.dueDate : undefined;
        const kind = resolveAlertType(alert.kind);
        const extra = {};
        for (const [key, value] of Object.entries(alert)) {
            if (!['kind', 'description', 'processNumber', 'dueDate'].includes(key)) {
                extra[key] = value;
            }
        }
        return {
            kind,
            description,
            processNumber,
            dueDate,
            extra,
        };
    }
}
exports.ProjudiNotificationProvider = ProjudiNotificationProvider;
exports.projudiNotificationProvider = new ProjudiNotificationProvider();
