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

function assertValidEmpresaId(empresaId: number): asserts empresaId is number {
  if (!Number.isInteger(empresaId) || empresaId <= 0) {
    throw new AsaasIntegrationNotConfiguredError('Identificador de empresa inválido para integração do Asaas');
  }
}

export async function resolveAsaasIntegration(
  empresaId: number,
  db: Queryable = pool,
): Promise<AsaasIntegration> {
  assertValidEmpresaId(empresaId);

  const allowLegacyFallback = resolveBooleanEnv('ASAAS_ALLOW_LEGACY_CREDENTIAL_FALLBACK', true);

  const result = await db.query(
    `SELECT id, provider, url_api, key_value, environment, active
     FROM integration_api_keys
     WHERE provider = $1
       AND active = TRUE
       AND (global IS TRUE OR idempresa = $2)
     ORDER BY updated_at DESC
     LIMIT 1`,
    ['asaas', empresaId],
  );

  let row: IntegrationRow | null = null;

  if (result.rowCount > 0) {
    row = result.rows[0] as IntegrationRow;
  } else {
    if (!allowLegacyFallback) {
      console.warn('[Asaas] Nenhuma credencial encontrada e fallback legado está desabilitado.');
      throw new AsaasIntegrationNotConfiguredError();
    }

    console.warn('[Asaas] Nenhuma credencial encontrada. Aplicando fallback legado.');

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
  empresaId: number,
  db: Queryable = pool,
  overrides: Partial<Omit<AsaasClientConfig, 'accessToken' | 'baseUrl'>> = {},
): Promise<AsaasClient> {
  const integration = await resolveAsaasIntegration(empresaId, db);
  return new AsaasClient({
    baseUrl: integration.baseUrl,
    accessToken: integration.accessToken,
    ...overrides,
  });
}

export default resolveAsaasIntegration;

export { ASAAS_DEFAULT_BASE_URLS, AsaasEnvironment, normalizeAsaasBaseUrl, normalizeAsaasEnvironment };
