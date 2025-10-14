import { EventEmitter } from 'events';

export interface IntegrationWebhookEventMessage {
  empresaId: number;
  event: string;
  payload: Record<string, unknown>;
  occurredAt: string;
}

export interface PublishIntegrationWebhookEventInput {
  empresaId: number;
  event: string;
  payload?: Record<string, unknown>;
  occurredAt?: string | Date;
}

export type IntegrationWebhookEventListener = (event: IntegrationWebhookEventMessage) => void;

const dispatcher = new EventEmitter();

dispatcher.setMaxListeners(0);

const CHANNEL = 'integration:webhook:event';

const ensureTimestamp = (value?: string | Date): string => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
};

export const publishIntegrationWebhookEvent = (
  input: PublishIntegrationWebhookEventInput,
): IntegrationWebhookEventMessage => {
  const message: IntegrationWebhookEventMessage = {
    empresaId: input.empresaId,
    event: input.event,
    payload: input.payload ?? {},
    occurredAt: ensureTimestamp(input.occurredAt),
  };

  try {
    dispatcher.emit(CHANNEL, message);
  } catch (error) {
    console.error('Failed to dispatch integration webhook event', error, {
      event: input.event,
      empresaId: input.empresaId,
    });
  }

  return message;
};

export const subscribeIntegrationWebhookEvents = (
  listener: IntegrationWebhookEventListener,
) => {
  dispatcher.on(CHANNEL, listener);
  return () => {
    dispatcher.off(CHANNEL, listener);
  };
};

export const getIntegrationWebhookDispatcher = () => dispatcher;
