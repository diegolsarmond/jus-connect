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
  isGlobal: boolean;
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
  credential_id: number | null;
  global: unknown;
  idempresa: unknown;
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

function isTruthy(value: unknown): boolean {
  if (value === true) {
    return true;
  }
  if (value === false) {
    return false;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', 't', '1', 'yes', 'y'].includes(normalized)) {
      return true;
    }
    if (['false', 'f', '0', 'no', 'n'].includes(normalized)) {
      return false;
    }
  }
  if (typeof value === 'number') {
    if (value === 1) {
      return true;
    }
    if (value === 0) {
      return false;
    }
  }
  return false;
}

const PROVIDER_FILTER = 'asaas';

export type IntegrationScopePreference = 'company-first' | 'global-first';

async function findScopedIntegration(
  db: Queryable,
  empresaId: number,
  environment: AsaasEnvironment | undefined,
  scope: IntegrationScopePreference,
): Promise<IntegrationRow | null> {
  const params: unknown[] = [PROVIDER_FILTER, empresaId];
  const where: string[] = [
    'i.active = TRUE',
    '(i.global IS TRUE OR i.idempresa = $2)',
    'LOWER(TRIM(i.provider)) = $1',
  ];

  const orderClauses =
    scope === 'global-first'
      ? ['CASE WHEN i.global IS TRUE THEN 0 ELSE 1 END']
      : ['CASE WHEN i.idempresa = $2 THEN 0 ELSE 1 END'];

  if (environment) {
    params.push(environment);
    where.push('i.environment = $3');
  }

  const query = `SELECT i.id, i.provider, i.url_api, i.key_value, i.environment, i.active, c.id AS credential_id, i.global, i.idempresa
       FROM integration_api_keys i
       LEFT JOIN asaas_credentials c ON c.integration_api_key_id = i.id
       WHERE ${where.join('\n         AND ')}
       ORDER BY ${orderClauses.join(', ')}, i.updated_at DESC
       LIMIT 20`;

  const result = await db.query(query, params);

  if (result.rowCount === 0) {
    return null;
  }

  const rows = result.rows as IntegrationRow[];
  const [row] = rows;
  return row ?? null;
}

async function findLegacyIntegration(
  db: Queryable,
  environment?: AsaasEnvironment,
): Promise<IntegrationRow | null> {
  const params: unknown[] = [PROVIDER_FILTER];
  const where: string[] = ['i.active = TRUE', 'LOWER(TRIM(i.provider)) = $1'];

  if (environment) {
    params.push(environment);
    where.push('i.environment = $2');
  }

  const query = `SELECT i.id, i.provider, i.url_api, i.key_value, i.environment, i.active, c.id AS credential_id, i.global, i.idempresa
         FROM integration_api_keys i
         LEFT JOIN asaas_credentials c ON c.integration_api_key_id = i.id
         WHERE ${where.join('\n           AND ')}
         ORDER BY i.updated_at DESC
         LIMIT 20`;

  const result = await db.query(query, params);

  if (result.rowCount === 0) {
    return null;
  }

  const rows = result.rows as IntegrationRow[];
  const [row] = rows;
  return row ?? null;
}

export type ResolveAsaasIntegrationOptions = {
  scope?: IntegrationScopePreference;
};

export async function resolveAsaasIntegration(
  empresaId: number,
  db: Queryable = pool,
  environment?: AsaasEnvironment,
  options?: ResolveAsaasIntegrationOptions,
): Promise<AsaasIntegration> {
  assertValidEmpresaId(empresaId);

  const allowLegacyFallback = resolveBooleanEnv('ASAAS_ALLOW_LEGACY_CREDENTIAL_FALLBACK', true);

  const normalizedEnvironment = environment
    ? normalizeAsaasEnvironment(environment)
    : undefined;

  const scope = options?.scope ?? 'company-first';

  let row = await findScopedIntegration(db, empresaId, normalizedEnvironment, scope);

  if (!row && normalizedEnvironment) {
    row = await findScopedIntegration(db, empresaId, undefined, scope);
  }

  if (!row) {
    if (!allowLegacyFallback) {
      console.warn(
        '[Asaas] Nenhuma credencial global encontrada e fallback legado está desabilitado.',
      );
      throw new AsaasIntegrationNotConfiguredError();
    }

    console.warn('[Asaas] Nenhuma credencial global encontrada. Aplicando fallback legado.');

    row = await findLegacyIntegration(db, normalizedEnvironment);

    if (!row && normalizedEnvironment) {
      row = await findLegacyIntegration(db);
    }

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
  const isGlobal = isTruthy(row.global);

  const rawCredentialId = row.credential_id as unknown;
  let credentialId: number | null = null;

  if (typeof rawCredentialId === 'number' && Number.isFinite(rawCredentialId)) {
    credentialId = Math.trunc(rawCredentialId);
  } else if (typeof rawCredentialId === 'string' && rawCredentialId.trim()) {
    const parsed = Number.parseInt(rawCredentialId.trim(), 10);
    if (Number.isFinite(parsed)) {
      credentialId = parsed;
    }
  }

  return {
    baseUrl,
    accessToken,
    environment: resolvedEnvironment,
    integrationId: row.id,
    credentialId,
    isGlobal,
  };
}

export const createAsaasClient = async (
  empresaId: number,
  db: Queryable = pool,
  overrides: Partial<Omit<AsaasClientConfig, 'accessToken' | 'baseUrl'>> = {},
  environment?: AsaasEnvironment,
): Promise<AsaasClient> => {
  const normalizedEnvironment = environment
    ? normalizeAsaasEnvironment(environment)
    : undefined;
  const integration = await resolveAsaasIntegration(empresaId, db, normalizedEnvironment);
  return new AsaasClient({
    baseUrl: integration.baseUrl,
    accessToken: integration.accessToken,
    ...overrides,
  });
};

export default resolveAsaasIntegration;

export { ASAAS_DEFAULT_BASE_URLS, normalizeAsaasBaseUrl, normalizeAsaasEnvironment };

if (typeof module !== 'undefined') {
  module.exports = {
    resolveAsaasIntegration,
    createAsaasClient,
    AsaasIntegrationNotConfiguredError,
    ASAAS_DEFAULT_BASE_URLS,
    normalizeAsaasBaseUrl,
    normalizeAsaasEnvironment,
    default: resolveAsaasIntegration,
  } satisfies Record<string, unknown>;
}
