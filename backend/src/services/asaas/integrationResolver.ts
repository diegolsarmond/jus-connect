import pool from '../db';
import AsaasClient, { AsaasClientConfig } from './asaasClient';

export type Queryable = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number }>;
};

export const ASAAS_DEFAULT_BASE_URLS = {
  producao: 'https://www.asaas.com/api/v3',
  homologacao: 'https://sandbox.asaas.com/api/v3',
} as const;

export type AsaasEnvironment = keyof typeof ASAAS_DEFAULT_BASE_URLS;

export interface AsaasIntegration {
  baseUrl: string;
  accessToken: string;
  environment: AsaasEnvironment;
}

export class AsaasIntegrationNotConfiguredError extends Error {
  constructor(message = 'Asaas integration credentials are not configured') {
    super(message);
    this.name = 'AsaasIntegrationNotConfiguredError';
  }
}

interface IntegrationRow {
  id: number;
  provider: string;
  url_api: string | null;
  key_value: string | null;
  environment: string | null;
  active: boolean;
}

function normalizeEnvironment(value: string | null): AsaasEnvironment {
  if (value && value.trim().toLowerCase() === 'producao') {
    return 'producao';
  }
  return 'homologacao';
}

function normalizeBaseUrl(environment: AsaasEnvironment, apiUrl: string | null): string {
  const fallback = ASAAS_DEFAULT_BASE_URLS[environment];

  if (!apiUrl) {
    return fallback;
  }

  const trimmed = apiUrl.trim();
  if (!trimmed) {
    return fallback;
  }

  const withoutTrailingSlash = trimmed.replace(/\/+$/, '');

  try {
    const parsed = new URL(withoutTrailingSlash);
    if (parsed.hostname.endsWith('asaas.com')) {
      const pathname = parsed.pathname ?? '';

      if (/\/api\/v\d+$/i.test(pathname)) {
        return withoutTrailingSlash;
      }

      if (/\/api$/i.test(pathname)) {
        return `${withoutTrailingSlash}/v3`;
      }

      if (!pathname || pathname === '/') {
        return `${withoutTrailingSlash}/api/v3`;
      }

      if (!/\/api\//i.test(pathname)) {
        return `${withoutTrailingSlash}/api/v3`;
      }

      return withoutTrailingSlash;
    }
  } catch (error) {
    return fallback;
  }

  return withoutTrailingSlash;
}

function normalizeToken(token: string | null): string {
  if (!token) {
    throw new AsaasIntegrationNotConfiguredError('Active Asaas credential is missing access token');
  }
  const trimmed = token.trim();
  if (!trimmed) {
    throw new AsaasIntegrationNotConfiguredError('Active Asaas credential is missing access token');
  }
  return trimmed;
}

export async function resolveAsaasIntegration(db: Queryable = pool): Promise<AsaasIntegration> {
  const result = await db.query(
    `SELECT id, provider, url_api, key_value, environment, active
     FROM integration_api_keys
     WHERE provider = $1 AND active = TRUE
     ORDER BY updated_at DESC
     LIMIT 1`,
    ['asaas'],
  );

  if (!result.rowCount) {
    throw new AsaasIntegrationNotConfiguredError();
  }

  const row = result.rows[0] as IntegrationRow;

  const environment = normalizeEnvironment(row.environment);
  const baseUrl = normalizeBaseUrl(environment, row.url_api);
  const accessToken = normalizeToken(row.key_value);

  return { baseUrl, accessToken, environment };
}

export async function createAsaasClient(
  db: Queryable = pool,
  overrides: Partial<Omit<AsaasClientConfig, 'accessToken' | 'baseUrl'>> = {},
): Promise<AsaasClient> {
  const integration = await resolveAsaasIntegration(db);
  return new AsaasClient({
    baseUrl: integration.baseUrl,
    accessToken: integration.accessToken,
    ...overrides,
  });
}

export default resolveAsaasIntegration;

