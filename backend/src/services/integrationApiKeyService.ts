import { QueryResultRow } from 'pg';
import { URL } from 'url';
import pool from './db';

export const API_KEY_PROVIDERS = ['gemini', 'openai', 'asaas', 'judit'] as const;
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
  provider: string;
  apiUrl: string | null;
  key: string;
  environment: string;
  active: boolean;
  lastUsed: string | null;
  empresaId: number | null;
  global: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIntegrationApiKeyInput {
  provider: string;
  apiUrl?: string | null;
  key: string;
  environment: string;
  active?: boolean;
  lastUsed?: string | Date | null;
  empresaId?: number | null;
  global?: boolean;
}

export interface UpdateIntegrationApiKeyInput {
  provider?: string;
  apiUrl?: string | null;
  key?: string;
  environment?: string;
  active?: boolean;
  lastUsed?: string | Date | null;
  empresaId?: number | null;
  global?: boolean;
}

interface IntegrationApiKeyRow extends QueryResultRow {
  id: number;
  provider: string;
  url_api: string | null;
  key_value: string;
  environment: string;
  active: boolean;
  last_used: string | Date | null;
  idempresa: number | string | null;
  global: boolean;
  created_at: string | Date;
  updated_at: string | Date;
}

export const ASAAS_DEFAULT_API_URLS: Record<ApiKeyEnvironment, string> = {
  producao: 'https://api.asaas.com/api/v3',
  homologacao: 'https://sandbox.asaas.com/api/v3',
};

function getDefaultApiUrl(
  provider: ApiKeyProvider,
  environment: ApiKeyEnvironment,
): string | null {
  if (provider === 'asaas') {
    return ASAAS_DEFAULT_API_URLS[environment] ?? null;
  }

  return null;
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
    throw new ValidationError('Provider must be Gemini, OpenAI, Asaas or Judit');
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

function normalizeOptionalApiUrl(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new ValidationError('API URL must be a string value');
  }
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  try {
    const parsedUrl = new URL(normalized);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new ValidationError('API URL must use HTTP or HTTPS protocol');
    }
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError('API URL must be a valid URL');
  }
  return normalized;
}

function resolveApiUrl(
  provider: ApiKeyProvider,
  environment: ApiKeyEnvironment,
  value: string | null | undefined,
): string | null {
  const normalized = normalizeOptionalApiUrl(value);
  if (normalized) {
    return normalized;
  }

  return getDefaultApiUrl(provider, environment);
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

function normalizeOptionalEmpresaId(value: unknown): number | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
      throw new ValidationError('empresaId must be a positive integer');
    }
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
      throw new ValidationError('empresaId must be a positive integer');
    }
    return parsed;
  }

  throw new ValidationError('empresaId must be a positive integer');
}

function mapEmpresaIdFromRow(value: number | string | null): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    if (Number.isFinite(value) && Number.isInteger(value)) {
      return value;
    }
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed) && Number.isInteger(parsed)) {
      return parsed;
    }
  }

  return null;
}

let hasLoggedUnexpectedProvider = false;
let hasLoggedUnexpectedEnvironment = false;

function mapProviderFromRow(value: string): string {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const lowerCased = trimmed.toLowerCase();
  if (API_KEY_PROVIDERS.includes(lowerCased as ApiKeyProvider)) {
    return lowerCased;
  }

  if (!hasLoggedUnexpectedProvider) {
    console.warn('integration_api_keys has unexpected provider value:', value);
    hasLoggedUnexpectedProvider = true;
  }
  return trimmed;
}

function mapEnvironmentFromRow(value: string): string {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const lowerCased = trimmed.toLowerCase();
  if (API_KEY_ENVIRONMENTS.includes(lowerCased as ApiKeyEnvironment)) {
    return lowerCased;
  }

  if (!hasLoggedUnexpectedEnvironment) {
    console.warn('integration_api_keys has unexpected environment value:', value);
    hasLoggedUnexpectedEnvironment = true;
  }
  return trimmed;
}

function mapRow(row: IntegrationApiKeyRow): IntegrationApiKey {
  return {
    id: row.id,
    provider: mapProviderFromRow(row.provider),
    apiUrl: typeof row.url_api === 'string' ? row.url_api.trim() || null : null,
    key: row.key_value,
    environment: mapEnvironmentFromRow(row.environment),
    active: row.active,
    lastUsed: formatNullableDate(row.last_used),
    empresaId: mapEmpresaIdFromRow(row.idempresa ?? null),
    global: Boolean(row.global),
    createdAt: formatDate(row.created_at),
    updatedAt: formatDate(row.updated_at),
  };
}

export default class IntegrationApiKeyService {
  constructor(private readonly db: Queryable = pool) {}

  async list(): Promise<IntegrationApiKey[]> {
    const result = await this.db.query(
      `SELECT id, provider, url_api, key_value, environment, active, last_used, idempresa, global, created_at, updated_at
       FROM integration_api_keys
       ORDER BY created_at DESC`
    );

    return (result.rows as IntegrationApiKeyRow[]).map(mapRow);
  }

  async create(input: CreateIntegrationApiKeyInput): Promise<IntegrationApiKey> {
    const provider = normalizeProvider(input.provider);
    const environment = normalizeEnvironment(input.environment);
    const apiUrl = resolveApiUrl(provider, environment, input.apiUrl);
    const key = normalizeKey(input.key);
    const active = input.active ?? true;
    const lastUsed = normalizeLastUsed(input.lastUsed);
    const empresaId = normalizeOptionalEmpresaId(input.empresaId);
    const global = Boolean(input.global);

    const result = await this.db.query(
      `INSERT INTO integration_api_keys (provider, url_api, key_value, environment, active, last_used, idempresa, global)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, provider, url_api, key_value, environment, active, last_used, idempresa, global, created_at, updated_at`,
      [provider, apiUrl, key, environment, active, lastUsed, empresaId, global]
    );

    return mapRow(result.rows[0] as IntegrationApiKeyRow);
  }

  async update(id: number, updates: UpdateIntegrationApiKeyInput): Promise<IntegrationApiKey | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    let provider: ApiKeyProvider | undefined;
    if (updates.provider !== undefined) {
      provider = normalizeProvider(updates.provider);
      fields.push(`provider = $${index}`);
      values.push(provider);
      index += 1;
    }

    let environment: ApiKeyEnvironment | undefined;
    if (updates.environment !== undefined) {
      environment = normalizeEnvironment(updates.environment);
      fields.push(`environment = $${index}`);
      values.push(environment);
      index += 1;
    }

    if (updates.apiUrl !== undefined) {
      let resolvedProvider = provider;
      let resolvedEnvironment = environment;

      if (!resolvedProvider || !resolvedEnvironment) {
        const currentResult = await this.db.query(
          'SELECT provider, environment FROM integration_api_keys WHERE id = $1',
          [id],
        );

        if (currentResult.rowCount === 0) {
          return null;
        }

        const currentRow = currentResult.rows[0] as {
          provider: string;
          environment: string;
        };

        if (!resolvedProvider) {
          resolvedProvider = normalizeProvider(currentRow.provider);
        }

        if (!resolvedEnvironment) {
          resolvedEnvironment = normalizeEnvironment(currentRow.environment);
        }
      }

      if (!resolvedProvider || !resolvedEnvironment) {
        throw new ValidationError('Unable to resolve provider and environment for API URL');
      }

      const apiUrl = resolveApiUrl(resolvedProvider, resolvedEnvironment, updates.apiUrl);
      fields.push(`url_api = $${index}`);
      values.push(apiUrl);
      index += 1;
    }

    if (updates.key !== undefined) {
      const key = normalizeKey(updates.key);
      fields.push(`key_value = $${index}`);
      values.push(key);
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

    if (updates.empresaId !== undefined) {
      const empresaId = normalizeOptionalEmpresaId(updates.empresaId);
      fields.push(`idempresa = $${index}`);
      values.push(empresaId);
      index += 1;
    }

    if (updates.global !== undefined) {
      fields.push(`global = $${index}`);
      values.push(Boolean(updates.global));
      index += 1;
    }

    if (fields.length === 0) {
      throw new ValidationError('No fields provided to update');
    }

    const query = `UPDATE integration_api_keys
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${index}
      RETURNING id, provider, url_api, key_value, environment, active, last_used, idempresa, global, created_at, updated_at`;

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

  async findById(id: number): Promise<IntegrationApiKey | null> {
    if (!Number.isInteger(id) || id <= 0) {
      return null;
    }

    const result = await this.db.query(
      `SELECT id, provider, url_api, key_value, environment, active, last_used, idempresa, global, created_at, updated_at
       FROM integration_api_keys
       WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return null;
    }

    return mapRow(result.rows[0] as IntegrationApiKeyRow);
  }
}
