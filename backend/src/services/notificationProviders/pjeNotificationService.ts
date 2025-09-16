import type { Request } from 'express';
import {
  createNotification,
  type CreateNotificationInput,
  type Notification,
  type NotificationType,
} from '../notificationService';
import {
  NotificationProviderError,
  type INotificationProvider,
  type NotificationPublisher,
} from './types';

type PjeEventType = 'deadline' | 'movement' | 'intimation' | 'publication';

interface RawPjeWebhookEvent {
  type?: string;
  description?: string;
  occurredAt?: string;
  [key: string]: unknown;
}

interface PjeWebhookEvent {
  type: PjeEventType;
  description: string;
  occurredAt?: string;
  extra: Record<string, unknown>;
}

interface RawPjeWebhookPayload {
  userId?: unknown;
  processNumber?: unknown;
  events?: unknown;
  [key: string]: unknown;
}

interface PjeWebhookPayload {
  userId: string;
  processNumber: string;
  events: PjeWebhookEvent[];
}

const VALID_EVENT_TYPES: readonly PjeEventType[] = [
  'deadline',
  'movement',
  'intimation',
  'publication',
];

function resolveEventType(value: unknown): PjeEventType {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (VALID_EVENT_TYPES.includes(normalized as PjeEventType)) {
      return normalized as PjeEventType;
    }
  }

  return 'movement';
}

function buildPjeNotificationInput(payload: PjeWebhookPayload, event: PjeWebhookEvent): CreateNotificationInput {
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

  const details: string[] = [event.description];

  if (event.occurredAt) {
    details.push(`Ocorrido em ${event.occurredAt}`);
  }

  const message = `${details.join(' — ')} (Processo ${payload.processNumber})`;

  const metadata: Record<string, unknown> = {
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

function resolveNotificationType(eventType: PjeEventType): NotificationType {
  switch (eventType) {
    case 'deadline':
      return 'warning';
    case 'intimation':
      return 'success';
    default:
      return 'info';
  }
}

export class PjeNotificationProvider implements INotificationProvider {
  public readonly id = 'pje';
  private readonly publish: NotificationPublisher;
  private pending: Notification[] = [];
  private subscribed = false;

  constructor(publish: NotificationPublisher = createNotification) {
    this.publish = publish;
  }

  async subscribe(): Promise<void> {
    this.subscribed = true;
  }

  async fetchUpdates(): Promise<Notification[]> {
    const notifications = [...this.pending];
    this.pending = [];
    return notifications;
  }

  async handleWebhook(req: Request): Promise<Notification[]> {
    const payloads = this.normalizePayload(req.body);

    if (!this.subscribed) {
      await this.subscribe();
    }

    const created: Notification[] = [];

    for (const payload of payloads) {
      for (const event of payload.events) {
        const notification = this.publish(buildPjeNotificationInput(payload, event));
        this.pending.push(notification);
        created.push(notification);
      }
    }

    return created;
  }

  private normalizePayload(body: unknown): PjeWebhookPayload[] {
    if (body === null || body === undefined) {
      throw new NotificationProviderError('PJe webhook payload cannot be empty');
    }

    const items: RawPjeWebhookPayload[] = Array.isArray(body) ? body : [body];

    if (items.length === 0) {
      throw new NotificationProviderError('PJe webhook payload cannot be empty');
    }

    return items.map((item, index) => this.normalizePayloadItem(item, index));
  }

  private normalizePayloadItem(raw: RawPjeWebhookPayload, index: number): PjeWebhookPayload {
    if (!raw || typeof raw !== 'object') {
      throw new NotificationProviderError(`PJe webhook payload at index ${index} must be an object`);
    }

    const { userId, processNumber, events } = raw;

    if (typeof userId !== 'string' || userId.trim() === '') {
      throw new NotificationProviderError('PJe webhook payload is missing a valid userId');
    }

    if (typeof processNumber !== 'string' || processNumber.trim() === '') {
      throw new NotificationProviderError('PJe webhook payload is missing a valid processNumber');
    }

    if (!Array.isArray(events) || events.length === 0) {
      throw new NotificationProviderError('PJe webhook payload must include at least one event');
    }

    const normalizedEvents = events.map((event, eventIndex) => this.normalizeEvent(event, eventIndex));

    return {
      userId,
      processNumber,
      events: normalizedEvents,
    };
  }

  private normalizeEvent(raw: unknown, index: number): PjeWebhookEvent {
    if (!raw || typeof raw !== 'object') {
      throw new NotificationProviderError(`PJe event at index ${index} must be an object`);
    }

    const event = raw as RawPjeWebhookEvent;
    const description = typeof event.description === 'string' ? event.description.trim() : '';

    if (!description) {
      throw new NotificationProviderError(`PJe event at index ${index} must include a description`);
    }

    const occurredAt = typeof event.occurredAt === 'string' ? event.occurredAt : undefined;
    const type = resolveEventType(event.type);

    const extra: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(event)) {
      if (!['type', 'description', 'occurredAt'].includes(key)) {
        extra[key] = value as unknown;
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

export const pjeNotificationProvider = new PjeNotificationProvider();
