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
  integrationId: number;
  credentialId: number | null;
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

async function findCredentialId(
  db: Queryable,
  integrationId: number,
): Promise<number | null> {
  const result = await db.query('SELECT id FROM asaas_credentials WHERE integration_api_key_id = $1', [
    integrationId,
  ]);

  if (result.rowCount === 0) {
    return null;
  }

  const rawId = (result.rows[0] as { id?: unknown })?.id;

  if (typeof rawId === 'number' && Number.isFinite(rawId)) {
    return Math.trunc(rawId);
  }

  if (typeof rawId === 'string' && rawId.trim()) {
    const parsed = Number.parseInt(rawId.trim(), 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
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

function assertValidEmpresaId(empresaId: number): asserts empresaId is number {
  if (!Number.isInteger(empresaId) || empresaId <= 0) {
    throw new AsaasIntegrationNotConfiguredError('Identificador de empresa inválido para integração do Asaas');
  }
}

const PROVIDER_FILTER = 'asaas';

async function findScopedIntegration(
  db: Queryable,
  empresaId: number,
  environment?: AsaasEnvironment,
): Promise<IntegrationRow | null> {
  const result = await db.query(
    `SELECT id, provider, url_api, key_value, environment, active
       FROM integration_api_keys
       WHERE active = TRUE
         AND (global IS DISTINCT FROM FALSE OR idempresa = $2)
         AND LOWER(TRIM(provider)) = $1
       ORDER BY updated_at DESC
       LIMIT 20`,
    [PROVIDER_FILTER, empresaId],
  );

  if (result.rowCount === 0) {
    return null;
  }

  const rows = result.rows as IntegrationRow[];

  if (environment) {
    const matched = rows.find(
      (row) => normalizeAsaasEnvironment(row.environment) === environment,
    );
    if (matched) {
      return matched;
    }
  }

  return rows[0] ?? null;
}

async function findLegacyIntegration(
  db: Queryable,
  environment?: AsaasEnvironment,
): Promise<IntegrationRow | null> {
  const result = await db.query(
    `SELECT id, provider, url_api, key_value, environment, active
         FROM integration_api_keys
         WHERE active = TRUE
           AND LOWER(TRIM(provider)) = $1
         ORDER BY updated_at DESC
         LIMIT 20`,
    [PROVIDER_FILTER],
  );

  if (result.rowCount === 0) {
    return null;
  }

  const rows = result.rows as IntegrationRow[];

  if (environment) {
    const matched = rows.find(
      (row) => normalizeAsaasEnvironment(row.environment) === environment,
    );
    if (matched) {
      return matched;
    }
  }

  return rows[0] ?? null;
}

export async function resolveAsaasIntegration(
  empresaId: number,
  db: Queryable = pool,
  environment?: AsaasEnvironment,
): Promise<AsaasIntegration> {
  assertValidEmpresaId(empresaId);

  const allowLegacyFallback = resolveBooleanEnv('ASAAS_ALLOW_LEGACY_CREDENTIAL_FALLBACK', true);

  const normalizedEnvironment = environment
    ? normalizeAsaasEnvironment(environment)
    : undefined;

  let row = await findScopedIntegration(db, empresaId, normalizedEnvironment);

  if (!row) {
    if (!allowLegacyFallback) {
      console.warn(
        '[Asaas] Nenhuma credencial global encontrada e fallback legado está desabilitado.',
      );
      throw new AsaasIntegrationNotConfiguredError();
    }

    console.warn('[Asaas] Nenhuma credencial global encontrada. Aplicando fallback legado.');

    row = await findLegacyIntegration(db, normalizedEnvironment);

    if (!row) {
      console.warn('[Asaas] Fallback legado não encontrou credenciais ativas para o Asaas.');
      throw new AsaasIntegrationNotConfiguredError();
    }
  }

  if (!row) {
    throw new AsaasIntegrationNotConfiguredError();
  }

  const resolvedEnvironment = normalizeAsaasEnvironment(row.environment);
  const baseUrl = normalizeAsaasBaseUrl(resolvedEnvironment, row.url_api);
  const accessToken = normalizeToken(row.key_value);

  const credentialId = await findCredentialId(db, row.id);

  return { baseUrl, accessToken, environment: resolvedEnvironment, integrationId: row.id, credentialId };
}

export async function createAsaasClient(
  empresaId: number,
  db: Queryable = pool,
  overrides: Partial<Omit<AsaasClientConfig, 'accessToken' | 'baseUrl'>> = {},
  environment?: AsaasEnvironment,
): Promise<AsaasClient> {
  const normalizedEnvironment = environment
    ? normalizeAsaasEnvironment(environment)
    : undefined;
  const integration = await resolveAsaasIntegration(empresaId, db, normalizedEnvironment);
  return new AsaasClient({
    baseUrl: integration.baseUrl,
    accessToken: integration.accessToken,
    ...overrides,
  });
}

export default resolveAsaasIntegration;

export { ASAAS_DEFAULT_BASE_URLS, AsaasEnvironment, normalizeAsaasBaseUrl, normalizeAsaasEnvironment };
