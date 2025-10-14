import type { QueryResultRow } from 'pg';
import pool from './db';
import {
  subscribeIntegrationWebhookEvents,
  type IntegrationWebhookEventMessage,
} from './integrationWebhookDispatcher';

interface Queryable {
  query: typeof pool.query;
}

interface InsertedWebhookRow extends QueryResultRow {
  webhook_id: number;
}

const buildDeliveryBody = (message: IntegrationWebhookEventMessage) => ({
  event: message.event,
  occurredAt: message.occurredAt,
  payload: message.payload ?? {},
});

const normalizeOccurredAt = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }
  return parsed.toISOString();
};

export class IntegrationWebhookDeliveryService {
  private readonly db: Queryable;

  constructor(db: Queryable = pool) {
    this.db = db;
  }

  async enqueueDeliveries(message: IntegrationWebhookEventMessage): Promise<number> {
    const body = buildDeliveryBody(message);
    const occurredAt = normalizeOccurredAt(message.occurredAt);

    const inserted = await this.db.query<InsertedWebhookRow>(
      `INSERT INTO integration_webhook_deliveries (webhook_id, empresa_id, event, body, occurred_at)
         SELECT id, idempresa, $2, $3::jsonb, $4::timestamptz
           FROM integration_webhooks
          WHERE active IS TRUE
            AND idempresa = $1
            AND idempresa IS NOT NULL
            AND events @> ARRAY[$2]::text[]
       RETURNING webhook_id`,
      [message.empresaId, message.event, JSON.stringify(body), occurredAt],
    );

    const queued = inserted.rowCount ?? 0;

    if (queued > 0) {
      const webhookIds = inserted.rows
        .map((row) => Number(row.webhook_id))
        .filter((id) => Number.isFinite(id));

      if (webhookIds.length > 0) {
        await this.db.query(
          `UPDATE integration_webhooks
              SET last_delivery = NOW()
            WHERE id = ANY($1::bigint[])`,
          [webhookIds],
        );
      }
    }

    return queued;
  }
}

let unsubscribe: (() => void) | null = null;

export const ensureIntegrationWebhookDeliveryListener = (
  service: IntegrationWebhookDeliveryService = new IntegrationWebhookDeliveryService(),
) => {
  if (unsubscribe) {
    return unsubscribe;
  }

  unsubscribe = subscribeIntegrationWebhookEvents((event) => {
    service
      .enqueueDeliveries(event)
      .catch((error) => {
        console.error('Failed to enqueue integration webhook deliveries', error, {
          event: event.event,
          empresaId: event.empresaId,
        });
      });
  });

  return unsubscribe;
};
