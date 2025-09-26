import pool from '../db';
import AsaasClient, { AsaasClientConfig } from './asaasClient';
import {
  ASAAS_DEFAULT_BASE_URLS,
  AsaasEnvironment,
  normalizeAsaasBaseUrl,
  normalizeAsaasEnvironment,
} from './urlNormalization';

export type Queryable = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number }>;
};

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

function resolveBooleanEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (typeof raw !== 'string') {
    return fallback;
  }

  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on', 'habilitado', 'enabled'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off', 'desabilitado', 'disabled'].includes(normalized)) {
    return false;
  }

  return fallback;
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
  const allowLegacyFallback = resolveBooleanEnv('ASAAS_ALLOW_LEGACY_CREDENTIAL_FALLBACK', true);

  const globalResult = await db.query(
    `SELECT id, provider, url_api, key_value, environment, active
     FROM integration_api_keys
     WHERE provider = $1 AND active = TRUE AND global IS TRUE
     ORDER BY updated_at DESC
     LIMIT 1`,
    ['asaas'],
  );

  let row: IntegrationRow | null = null;

  if (globalResult.rowCount > 0) {
    row = globalResult.rows[0] as IntegrationRow;
  } else {
    if (!allowLegacyFallback) {
      console.warn('[Asaas] Nenhuma credencial global encontrada e fallback legado está desabilitado.');
      throw new AsaasIntegrationNotConfiguredError();
    }

    console.warn('[Asaas] Nenhuma credencial global encontrada. Aplicando fallback legado.');

    const legacyResult = await db.query(
      `SELECT id, provider, url_api, key_value, environment, active
       FROM integration_api_keys
       WHERE provider = $1 AND active = TRUE
       ORDER BY updated_at DESC
       LIMIT 1`,
      ['asaas'],
    );

    if (!legacyResult.rowCount) {
      console.warn('[Asaas] Fallback legado não encontrou credenciais ativas para o Asaas.');
      throw new AsaasIntegrationNotConfiguredError();
    }

    row = legacyResult.rows[0] as IntegrationRow;
  }

  if (!row) {
    throw new AsaasIntegrationNotConfiguredError();
  }

  const environment = normalizeAsaasEnvironment(row.environment);
  const baseUrl = normalizeAsaasBaseUrl(environment, row.url_api);
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

export { ASAAS_DEFAULT_BASE_URLS, AsaasEnvironment, normalizeAsaasBaseUrl, normalizeAsaasEnvironment };

