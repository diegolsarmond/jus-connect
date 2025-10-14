import { URL } from 'url';
import { QueryResultRow } from 'pg';
import pool from './db';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

interface Queryable {
  query: (text: string, params?: unknown[]) => Promise<{ rows: QueryResultRow[]; rowCount: number }>;
}

export interface IntegrationWebhook {
  id: number;
  name: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  lastDelivery: string | null;
  empresaId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIntegrationWebhookInput {
  name: string;
  url: string;
  events: string[];
  secret: string;
  active?: boolean;
  empresaId: number;
}

export interface UpdateIntegrationWebhookInput {
  name?: string;
  url?: string;
  events?: string[];
  secret?: string;
  active?: boolean;
}

interface IntegrationWebhookRow extends QueryResultRow {
  id: number;
  name: string;
  target_url: string;
  events: string[];
  secret: string;
  active: boolean;
  last_delivery: string | Date | null;
  idempresa: number | string | null;
  created_at: string | Date;
  updated_at: string | Date;
}

const isValidHttpProtocol = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (error) {
    return false;
  }
};

const formatDate = (value: string | Date) => {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return new Date(value).toISOString();
};

const formatNullableDate = (value: string | Date | null) => {
  if (!value) {
    return null;
  }
  return formatDate(value);
};

const mapRowToWebhook = (row: IntegrationWebhookRow): IntegrationWebhook => ({
  id: row.id,
  name: row.name,
  url: row.target_url,
  events: Array.isArray(row.events) ? row.events : [],
  secret: row.secret,
  active: row.active,
  lastDelivery: formatNullableDate(row.last_delivery),
  empresaId: row.idempresa === null ? null : Number(row.idempresa),
  createdAt: formatDate(row.created_at),
  updatedAt: formatDate(row.updated_at),
});

const normalizeName = (value: string | undefined) => {
  if (typeof value !== 'string') {
    throw new ValidationError('Nome do webhook é obrigatório.');
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ValidationError('Nome do webhook é obrigatório.');
  }
  return trimmed;
};

const normalizeUrl = (value: string | undefined) => {
  if (typeof value !== 'string') {
    throw new ValidationError('URL do webhook é obrigatória.');
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ValidationError('URL do webhook é obrigatória.');
  }
  if (!isValidHttpProtocol(trimmed)) {
    throw new ValidationError('Informe uma URL válida utilizando HTTP ou HTTPS.');
  }
  return trimmed;
};

const normalizeSecret = (value: string | undefined) => {
  if (typeof value !== 'string') {
    throw new ValidationError('Segredo do webhook é obrigatório.');
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ValidationError('Segredo do webhook é obrigatório.');
  }
  return trimmed;
};

const normalizeEvents = (value: string[] | undefined) => {
  if (!Array.isArray(value)) {
    throw new ValidationError('Selecione ao menos um evento para o webhook.');
  }
  const normalized = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => Boolean(item));
  if (normalized.length === 0) {
    throw new ValidationError('Selecione ao menos um evento para o webhook.');
  }
  return Array.from(new Set(normalized));
};

class WebhookService {
  private readonly db: Queryable;

  constructor(db: Queryable = pool) {
    this.db = db;
  }

  async listByEmpresa(empresaId: number): Promise<IntegrationWebhook[]> {
    const result = await this.db.query(
      `SELECT id, name, target_url, events, secret, active, last_delivery, idempresa, created_at, updated_at
         FROM integration_webhooks
        WHERE idempresa = $1
        ORDER BY created_at DESC`,
      [empresaId],
    );

    return result.rows.map((row) => mapRowToWebhook(row as IntegrationWebhookRow));
  }

  async create(input: CreateIntegrationWebhookInput): Promise<IntegrationWebhook> {
    const name = normalizeName(input.name);
    const url = normalizeUrl(input.url);
    const secret = normalizeSecret(input.secret);
    const events = normalizeEvents(input.events);
    const active = input.active === undefined ? true : Boolean(input.active);

    const result = await this.db.query(
      `INSERT INTO integration_webhooks (name, target_url, events, secret, active, idempresa)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, target_url, events, secret, active, last_delivery, idempresa, created_at, updated_at`,
      [name, url, events, secret, active, input.empresaId],
    );

    const [row] = result.rows as IntegrationWebhookRow[];
    return mapRowToWebhook(row);
  }

  async updateStatus(id: number, empresaId: number, active: boolean): Promise<IntegrationWebhook | null> {
    const result = await this.db.query(
      `UPDATE integration_webhooks
          SET active = $1
        WHERE id = $2
          AND idempresa = $3
      RETURNING id, name, target_url, events, secret, active, last_delivery, idempresa, created_at, updated_at`,
      [Boolean(active), id, empresaId],
    );

    if (result.rowCount === 0) {
      return null;
    }

    const [row] = result.rows as IntegrationWebhookRow[];
    return mapRowToWebhook(row);
  }

  async update(
    id: number,
    empresaId: number,
    input: UpdateIntegrationWebhookInput,
  ): Promise<IntegrationWebhook | null> {
    const name = normalizeName(input.name);
    const url = normalizeUrl(input.url);
    const secret = normalizeSecret(input.secret);
    const events = normalizeEvents(input.events);
    const active = input.active === undefined ? null : Boolean(input.active);

    const result = await this.db.query(
      `UPDATE integration_webhooks
          SET name = $1,
              target_url = $2,
              events = $3,
              secret = $4,
              active = COALESCE($5, active),
              updated_at = NOW()
        WHERE id = $6
          AND idempresa = $7
      RETURNING id, name, target_url, events, secret, active, last_delivery, idempresa, created_at, updated_at`,
      [name, url, events, secret, active, id, empresaId],
    );

    if (result.rowCount === 0) {
      return null;
    }

    const [row] = result.rows as IntegrationWebhookRow[];
    return mapRowToWebhook(row);
  }

  async delete(id: number, empresaId: number): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM integration_webhooks WHERE id = $1 AND idempresa = $2`,
      [id, empresaId],
    );

    return result.rowCount > 0;
  }
}

export default WebhookService;
