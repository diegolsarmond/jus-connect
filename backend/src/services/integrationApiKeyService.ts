import { QueryResultRow } from 'pg';
import pool from './db';

export const API_KEY_PROVIDERS = ['gemini', 'openai'] as const;
export type ApiKeyProvider = (typeof API_KEY_PROVIDERS)[number];

export const API_KEY_ENVIRONMENTS = ['producao', 'homologacao'] as const;
export type ApiKeyEnvironment = (typeof API_KEY_ENVIRONMENTS)[number];

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

type Queryable = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: QueryResultRow[]; rowCount: number }>;
};

export interface IntegrationApiKey {
  id: number;
  provider: ApiKeyProvider;
  key: string;
  environment: ApiKeyEnvironment;
  active: boolean;
  lastUsed: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIntegrationApiKeyInput {
  provider: string;
  key: string;
  environment: string;
  active?: boolean;
  lastUsed?: string | Date | null;
}

export interface UpdateIntegrationApiKeyInput {
  provider?: string;
  key?: string;
  environment?: string;
  active?: boolean;
  lastUsed?: string | Date | null;
}

interface IntegrationApiKeyRow extends QueryResultRow {
  id: number;
  provider: string;
  key_value: string;
  environment: string;
  active: boolean;
  last_used: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
}

function normalizeProvider(value: string | undefined): ApiKeyProvider {
  if (typeof value !== 'string') {
    throw new ValidationError('Provider is required');
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    throw new ValidationError('Provider is required');
  }
  if (!API_KEY_PROVIDERS.includes(normalized as ApiKeyProvider)) {
    throw new ValidationError('Provider must be either Gemini or OpenAI');
  }
  return normalized as ApiKeyProvider;
}

function normalizeEnvironment(value: string | undefined): ApiKeyEnvironment {
  if (typeof value !== 'string') {
    throw new ValidationError('Environment is required');
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    throw new ValidationError('Environment is required');
  }
  if (!API_KEY_ENVIRONMENTS.includes(normalized as ApiKeyEnvironment)) {
    throw new ValidationError('Environment must be produção or homologação');
  }
  return normalized as ApiKeyEnvironment;
}

function normalizeKey(value: string | undefined): string {
  if (typeof value !== 'string') {
    throw new ValidationError('API key value is required');
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new ValidationError('API key value is required');
  }
  return normalized;
}

function normalizeLastUsed(value: unknown): Date | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) {
      return null;
    }
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
      throw new ValidationError('Invalid lastUsed datetime');
    }
    return parsed;
  }
  throw new ValidationError('Invalid lastUsed datetime');
}

function formatDate(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return new Date(value).toISOString();
}

function formatNullableDate(value: string | Date | null): string | null {
  if (!value) {
    return null;
  }
  return formatDate(value);
}

function mapRow(row: IntegrationApiKeyRow): IntegrationApiKey {
  return {
    id: row.id,
    provider: normalizeProvider(row.provider),
    key: row.key_value,
    environment: normalizeEnvironment(row.environment),
    active: row.active,
    lastUsed: formatNullableDate(row.last_used),
    createdAt: formatDate(row.created_at),
    updatedAt: formatDate(row.updated_at),
  };
}

export default class IntegrationApiKeyService {
  constructor(private readonly db: Queryable = pool) {}

  async list(): Promise<IntegrationApiKey[]> {
    const result = await this.db.query(
      `SELECT id, provider, key_value, environment, active, last_used, created_at, updated_at
       FROM integration_api_keys
       ORDER BY created_at DESC`
    );

    return (result.rows as IntegrationApiKeyRow[]).map(mapRow);
  }

  async create(input: CreateIntegrationApiKeyInput): Promise<IntegrationApiKey> {
    const provider = normalizeProvider(input.provider);
    const environment = normalizeEnvironment(input.environment);
    const key = normalizeKey(input.key);
    const active = input.active ?? true;
    const lastUsed = normalizeLastUsed(input.lastUsed);

    const result = await this.db.query(
      `INSERT INTO integration_api_keys (provider, key_value, environment, active, last_used)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, provider, key_value, environment, active, last_used, created_at, updated_at`,
      [provider, key, environment, active, lastUsed]
    );

    return mapRow(result.rows[0] as IntegrationApiKeyRow);
  }

  async update(id: number, updates: UpdateIntegrationApiKeyInput): Promise<IntegrationApiKey | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    if (updates.provider !== undefined) {
      const provider = normalizeProvider(updates.provider);
      fields.push(`provider = $${index}`);
      values.push(provider);
      index += 1;
    }

    if (updates.key !== undefined) {
      const key = normalizeKey(updates.key);
      fields.push(`key_value = $${index}`);
      values.push(key);
      index += 1;
    }

    if (updates.environment !== undefined) {
      const environment = normalizeEnvironment(updates.environment);
      fields.push(`environment = $${index}`);
      values.push(environment);
      index += 1;
    }

    if (updates.active !== undefined) {
      fields.push(`active = $${index}`);
      values.push(Boolean(updates.active));
      index += 1;
    }

    if (updates.lastUsed !== undefined) {
      const lastUsed = normalizeLastUsed(updates.lastUsed);
      fields.push(`last_used = $${index}`);
      values.push(lastUsed);
      index += 1;
    }

    if (fields.length === 0) {
      throw new ValidationError('No fields provided to update');
    }

    const query = `UPDATE integration_api_keys
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${index}
      RETURNING id, provider, key_value, environment, active, last_used, created_at, updated_at`;

    values.push(id);

    const result = await this.db.query(query, values);

    if (result.rowCount === 0) {
      return null;
    }

    return mapRow(result.rows[0] as IntegrationApiKeyRow);
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.db.query('DELETE FROM integration_api_keys WHERE id = $1', [id]);
    return result.rowCount > 0;
  }
}
