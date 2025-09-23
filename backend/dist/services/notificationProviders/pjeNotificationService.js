"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pjeNotificationProvider = exports.PjeNotificationProvider = void 0;
const notificationService_1 = require("../notificationService");
const types_1 = require("./types");
const VALID_EVENT_TYPES = [
    'deadline',
    'movement',
    'intimation',
    'publication',
];
function resolveEventType(value) {
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (VALID_EVENT_TYPES.includes(normalized)) {
            return normalized;
        }
    }
    return 'movement';
}
function buildPjeNotificationInput(payload, event) {
    const baseTitle = (() => {
        switch (event.type) {
            case 'deadline':
                return `PJe: prazo atualizado no processo ${payload.processNumber}`;
            case 'intimation':
                return `PJe: nova intimação no processo ${payload.processNumber}`;
            case 'publication':
                return `PJe: publicação no processo ${payload.processNumber}`;
            default:
                return `PJe: movimentação no processo ${payload.processNumber}`;
        }
    })();
    const details = [event.description];
    if (event.occurredAt) {
        details.push(`Ocorrido em ${event.occurredAt}`);
    }
    const message = `${details.join(' — ')} (Processo ${payload.processNumber})`;
    const metadata = {
        provider: 'pje',
        processNumber: payload.processNumber,
        eventType: event.type,
        ...event.extra,
    };
    if (event.occurredAt) {
        metadata.occurredAt = event.occurredAt;
    }
    return {
        userId: payload.userId,
        title: baseTitle,
        message,
        category: 'pje',
        type: resolveNotificationType(event.type),
        metadata,
    };
}
function resolveNotificationType(eventType) {
    switch (eventType) {
        case 'deadline':
            return 'warning';
        case 'intimation':
            return 'success';
        default:
            return 'info';
    }
}
class PjeNotificationProvider {
    constructor(publish = notificationService_1.createNotification) {
        this.id = 'pje';
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
            for (const event of payload.events) {
                const notification = await this.publish(buildPjeNotificationInput(payload, event));
                this.pending.push(notification);
                created.push(notification);
            }
        }
        return created;
    }
    normalizePayload(body) {
        if (body === null || body === undefined) {
            throw new types_1.NotificationProviderError('PJe webhook payload cannot be empty');
        }
        const items = Array.isArray(body) ? body : [body];
        if (items.length === 0) {
            throw new types_1.NotificationProviderError('PJe webhook payload cannot be empty');
        }
        return items.map((item, index) => this.normalizePayloadItem(item, index));
    }
    normalizePayloadItem(raw, index) {
        if (!raw || typeof raw !== 'object') {
            throw new types_1.NotificationProviderError(`PJe webhook payload at index ${index} must be an object`);
        }
        const { userId, processNumber, events } = raw;
        if (typeof userId !== 'string' || userId.trim() === '') {
            throw new types_1.NotificationProviderError('PJe webhook payload is missing a valid userId');
        }
        if (typeof processNumber !== 'string' || processNumber.trim() === '') {
            throw new types_1.NotificationProviderError('PJe webhook payload is missing a valid processNumber');
        }
        if (!Array.isArray(events) || events.length === 0) {
            throw new types_1.NotificationProviderError('PJe webhook payload must include at least one event');
        }
        const normalizedEvents = events.map((event, eventIndex) => this.normalizeEvent(event, eventIndex));
        return {
            userId,
            processNumber,
            events: normalizedEvents,
        };
    }
    normalizeEvent(raw, index) {
        if (!raw || typeof raw !== 'object') {
            throw new types_1.NotificationProviderError(`PJe event at index ${index} must be an object`);
        }
        const event = raw;
        const description = typeof event.description === 'string' ? event.description.trim() : '';
        if (!description) {
            throw new types_1.NotificationProviderError(`PJe event at index ${index} must include a description`);
        }
        const occurredAt = typeof event.occurredAt === 'string' ? event.occurredAt : undefined;
        const type = resolveEventType(event.type);
        const extra = {};
        for (const [key, value] of Object.entries(event)) {
            if (!['type', 'description', 'occurredAt'].includes(key)) {
                extra[key] = value;
            }
        }
        return {
            type,
            description,
            occurredAt,
            extra,
        };
    }
}
exports.PjeNotificationProvider = PjeNotificationProvider;
exports.pjeNotificationProvider = new PjeNotificationProvider();
