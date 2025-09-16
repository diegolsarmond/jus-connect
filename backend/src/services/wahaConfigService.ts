import { QueryResultRow } from 'pg';
import pool from './db';

export interface WahaConfig {
  baseUrl: string;
  apiKey: string;
  webhookSecret: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertWahaConfigInput {
  baseUrl: string;
  apiKey: string;
  webhookSecret?: string | null;
  isActive?: boolean;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

type Queryable = {
  query: (
    text: string,
    params?: unknown[],
  ) => Promise<{ rows: QueryResultRow[]; rowCount: number }>;
};

interface WahaSettingsRow extends QueryResultRow {
  id: number;
  base_url: string;
  api_key: string;
  webhook_secret: string | null;
  is_active: boolean;
  created_at: string | Date;
  updated_at: string | Date;
}

function normalizeBaseUrl(value: string | undefined): string {
  if (typeof value !== 'string') {
    throw new ValidationError('baseUrl is required');
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ValidationError('baseUrl is required');
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch (error) {
    throw new ValidationError('baseUrl must be a valid URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new ValidationError('baseUrl must use http or https');
  }
  parsed.pathname = parsed.pathname.replace(/\/$/, '');
  parsed.hash = '';
  return parsed.toString().replace(/\/$/, '');
}

function normalizeApiKey(value: string | undefined): string {
  if (typeof value !== 'string') {
    throw new ValidationError('apiKey is required');
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ValidationError('apiKey is required');
  }
  return trimmed;
}

function normalizeSecret(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function formatDate(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return new Date(value).toISOString();
}

function mapRow(row: WahaSettingsRow): WahaConfig {
  return {
    baseUrl: row.base_url,
    apiKey: row.api_key,
    webhookSecret: row.webhook_secret,
    isActive: row.is_active,
    createdAt: formatDate(row.created_at),
    updatedAt: formatDate(row.updated_at),
  };
}

export default class WahaConfigService {
  constructor(private readonly db: Queryable = pool) {}

  async getConfig(): Promise<WahaConfig | null> {
    const result = await this.db.query(
      `SELECT id, base_url, api_key, webhook_secret, is_active, created_at, updated_at
         FROM waha_settings
         WHERE id = 1`
    );

    if (result.rowCount === 0) {
      return null;
    }

    return mapRow(result.rows[0] as WahaSettingsRow);
  }

  async requireConfig(): Promise<WahaConfig> {
    const config = await this.getConfig();
    if (!config) {
      throw new ValidationError('WAHA integration is not configured');
    }
    if (!config.isActive) {
      throw new ValidationError('WAHA integration is disabled');
    }
    return config;
  }

  async saveConfig(input: UpsertWahaConfigInput): Promise<WahaConfig> {
    const baseUrl = normalizeBaseUrl(input.baseUrl);
    const apiKey = normalizeApiKey(input.apiKey);
    const webhookSecret = normalizeSecret(input.webhookSecret ?? null);
    const isActive = input.isActive ?? true;

    const result = await this.db.query(
      `INSERT INTO waha_settings (id, base_url, api_key, webhook_secret, is_active)
       VALUES (1, $1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE
         SET base_url = EXCLUDED.base_url,
             api_key = EXCLUDED.api_key,
             webhook_secret = EXCLUDED.webhook_secret,
             is_active = EXCLUDED.is_active
       RETURNING id, base_url, api_key, webhook_secret, is_active, created_at, updated_at`,
      [baseUrl, apiKey, webhookSecret, isActive]
    );

    return mapRow(result.rows[0] as WahaSettingsRow);
  }
}
