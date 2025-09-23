import type { Request } from 'express';
import type { CreateNotificationInput, Notification } from '../notificationService';

export type NotificationPublisher = (input: CreateNotificationInput) => Promise<Notification>;

export interface INotificationProvider {
  subscribe(): Promise<void>;
  fetchUpdates(): Promise<Notification[]>;
  handleWebhook(req: Request): Promise<Notification[]>;
}

export class NotificationProviderError extends Error {
  constructor(message: string, public readonly statusCode = 400) {
    super(message);
    this.name = 'NotificationProviderError';
  }
}
