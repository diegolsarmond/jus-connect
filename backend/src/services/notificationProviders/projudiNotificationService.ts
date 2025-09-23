import type { Request } from 'express';
import {
  createNotification,
  type Notification,
  type NotificationType,
} from '../notificationService';
import {
  NotificationProviderError,
  type INotificationProvider,
  type NotificationPublisher,
} from './types';

type ProjudiAlertType = 'deadline' | 'document' | 'task' | 'hearing' | 'movement';

interface RawProjudiAlert {
  kind?: string;
  description?: string;
  processNumber?: string;
  dueDate?: string;
  [key: string]: unknown;
}

interface ProjudiAlert {
  kind: ProjudiAlertType;
  description: string;
  processNumber?: string;
  dueDate?: string;
  extra: Record<string, unknown>;
}

interface RawProjudiPayload {
  userId?: unknown;
  alerts?: unknown;
  [key: string]: unknown;
}

interface ProjudiWebhookPayload {
  userId: string;
  alerts: ProjudiAlert[];
}

const VALID_ALERT_TYPES: readonly ProjudiAlertType[] = [
  'deadline',
  'document',
  'task',
  'hearing',
  'movement',
];

function resolveAlertType(value: unknown): ProjudiAlertType {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (VALID_ALERT_TYPES.includes(normalized as ProjudiAlertType)) {
      return normalized as ProjudiAlertType;
    }
  }

  return 'movement';
}

function resolveNotificationType(kind: ProjudiAlertType): NotificationType {
  switch (kind) {
    case 'deadline':
      return 'warning';
    case 'hearing':
      return 'success';
    default:
      return 'info';
  }
}

function buildNotificationTitle(alert: ProjudiAlert): string {
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

function buildNotificationMessage(alert: ProjudiAlert): string {
  const details: string[] = [alert.description];

  if (alert.processNumber) {
    details.push(`Processo ${alert.processNumber}`);
  }

  if (alert.dueDate) {
    details.push(`Prazo em ${alert.dueDate}`);
  }

  return details.join(' — ');
}

export class ProjudiNotificationProvider implements INotificationProvider {
  public readonly id = 'projudi';
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
      for (const alert of payload.alerts) {
        const notification = await this.publish({
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

  private normalizePayload(body: unknown): ProjudiWebhookPayload[] {
    if (body === null || body === undefined) {
      throw new NotificationProviderError('Projudi webhook payload cannot be empty');
    }

    const items: RawProjudiPayload[] = Array.isArray(body) ? body : [body];

    if (items.length === 0) {
      throw new NotificationProviderError('Projudi webhook payload cannot be empty');
    }

    return items.map((item, index) => this.normalizePayloadItem(item, index));
  }

  private normalizePayloadItem(raw: RawProjudiPayload, index: number): ProjudiWebhookPayload {
    if (!raw || typeof raw !== 'object') {
      throw new NotificationProviderError(`Projudi webhook payload at index ${index} must be an object`);
    }

    const { userId, alerts } = raw;

    if (typeof userId !== 'string' || userId.trim() === '') {
      throw new NotificationProviderError('Projudi webhook payload is missing a valid userId');
    }

    if (!Array.isArray(alerts) || alerts.length === 0) {
      throw new NotificationProviderError('Projudi webhook payload must include at least one alert');
    }

    const normalizedAlerts = alerts.map((alert, alertIndex) => this.normalizeAlert(alert, alertIndex));

    return {
      userId,
      alerts: normalizedAlerts,
    };
  }

  private normalizeAlert(raw: unknown, index: number): ProjudiAlert {
    if (!raw || typeof raw !== 'object') {
      throw new NotificationProviderError(`Projudi alert at index ${index} must be an object`);
    }

    const alert = raw as RawProjudiAlert;
    const description = typeof alert.description === 'string' ? alert.description.trim() : '';

    if (!description) {
      throw new NotificationProviderError(`Projudi alert at index ${index} must include a description`);
    }

    const processNumber = typeof alert.processNumber === 'string' && alert.processNumber.trim() !== ''
      ? alert.processNumber
      : undefined;

    const dueDate = typeof alert.dueDate === 'string' && alert.dueDate.trim() !== '' ? alert.dueDate : undefined;
    const kind = resolveAlertType(alert.kind);

    const extra: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(alert)) {
      if (!['kind', 'description', 'processNumber', 'dueDate'].includes(key)) {
        extra[key] = value as unknown;
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

export const projudiNotificationProvider = new ProjudiNotificationProvider();
