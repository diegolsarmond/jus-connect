import { QueryResultRow } from 'pg';
import pool from './db';

type Queryable = {
  query: (
    text: string,
    params?: unknown[]
  ) => Promise<{ rows: QueryResultRow[]; rowCount: number }>;
};

const ASAAS_PRODUCTION_BASE_URL = 'https://www.asaas.com/api/v3';
const ASAAS_SANDBOX_BASE_URL = 'https://sandbox.asaas.com/api/v3';

const ASAAS_PROVIDER_NAME = 'asaas';

type FetchResponseLike = {
  ok: boolean;
  status: number;
  text(): Promise<string>;
};

type FetchLike = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  }
) => Promise<FetchResponseLike>;

interface IntegrationApiKeyRow extends QueryResultRow {
  id: number;
  provider: string;
  url_api: string | null;
  key_value: string;
  environment: string;
  active: boolean;
}

interface AsaasCustomerRow extends QueryResultRow {
  cliente_id: number;
  integration_api_key_id: number;
  asaas_customer_id: string | null;
  status: string;
  synced_at: string | Date | null;
  last_payload: unknown;
}

export type AsaasCustomerSyncStatus = 'inactive' | 'pending' | 'synced' | 'error';

export interface ClienteLocalData {
  nome: string;
  tipo: string | number | null;
  documento: string | null;
  email: string | null;
  telefone: string | null;
  cep: string | null;
  rua: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
}

export interface AsaasCustomerState {
  integrationActive: boolean;
  integrationApiKeyId: number | null;
  status: AsaasCustomerSyncStatus;
  customerId: string | null;
  syncedAt: string | null;
  lastPayload: unknown;
  errorMessage: string | null;
}

export class AsaasApiError extends Error {
  public readonly status: number;

  public readonly responseBody: unknown;

  constructor(status: number, message: string, responseBody: unknown) {
    super(message);
    this.name = 'AsaasApiError';
    this.status = status;
    this.responseBody = responseBody;
  }
}

export interface AsaasHttpClient {
  createCustomer(payload: Record<string, unknown>): Promise<Record<string, unknown>>;
  updateCustomer(
    customerId: string,
    payload: Record<string, unknown>
  ): Promise<Record<string, unknown>>;
}

export interface AsaasHttpClientConfig {
  apiKey: string;
  baseUrl: string;
  fetchImpl?: FetchLike | null;
}

class DefaultAsaasHttpClient implements AsaasHttpClient {
  private readonly fetchImpl: FetchLike;

  constructor(private readonly config: AsaasHttpClientConfig) {
    const fetchCandidate = config.fetchImpl ?? (globalThis.fetch as FetchLike | undefined);
    if (!fetchCandidate) {
      throw new Error('Fetch API is not available in the current environment');
    }
    this.fetchImpl = fetchCandidate;
  }

  private async performRequest(
    path: string,
    method: string,
    payload: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const url = `${this.config.baseUrl.replace(/\/$/, '')}${path}`;

    let response: FetchResponseLike;
    try {
      response = await this.fetchImpl(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          access_token: this.config.apiKey,
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      throw new AsaasApiError(
        0,
        error instanceof Error
          ? `Falha ao conectar à API do Asaas: ${error.message}`
          : 'Falha ao conectar à API do Asaas.',
        null
      );
    }

    const rawPayload = await response.text();
    let parsedPayload: Record<string, unknown> | null = null;

    if (rawPayload) {
      try {
        parsedPayload = JSON.parse(rawPayload) as Record<string, unknown>;
      } catch (_error) {
        parsedPayload = null;
      }
    }

    if (!response.ok) {
      const message =
        extractErrorMessage(parsedPayload) ??
        `Asaas API request failed with status ${response.status}`;
      throw new AsaasApiError(response.status, message, parsedPayload ?? rawPayload);
    }

    return parsedPayload ?? {};
  }

  async createCustomer(payload: Record<string, unknown>) {
    return this.performRequest('/customers', 'POST', payload);
  }

  async updateCustomer(customerId: string, payload: Record<string, unknown>) {
    const encodedId = encodeURIComponent(customerId);
    return this.performRequest(`/customers/${encodedId}`, 'PUT', payload);
  }
}

export const createAsaasHttpClient = (config: AsaasHttpClientConfig): AsaasHttpClient =>
  new DefaultAsaasHttpClient(config);

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const errorValue = (payload as { error?: unknown; errors?: unknown }).error;

  if (typeof errorValue === 'string') {
    return errorValue;
  }

  if (errorValue && typeof errorValue === 'object') {
    const maybeMessage = (errorValue as { message?: unknown }).message;
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) {
      return maybeMessage.trim();
    }
  }

  const errorsArray = (payload as { errors?: unknown }).errors;
  if (Array.isArray(errorsArray) && errorsArray.length > 0) {
    const firstError = errorsArray[0];
    if (firstError && typeof firstError === 'object') {
      const maybeDescription = (firstError as { description?: unknown }).description;
      if (typeof maybeDescription === 'string' && maybeDescription.trim()) {
        return maybeDescription.trim();
      }
    }
  }

  return null;
}

const INACTIVE_STATE: AsaasCustomerState = {
  integrationActive: false,
  integrationApiKeyId: null,
  status: 'inactive',
  customerId: null,
  syncedAt: null,
  lastPayload: null,
  errorMessage: null,
};

function toIsoString(value: string | Date | null): string | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

function parseLastPayload(value: unknown): unknown {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (_error) {
      return value;
    }
  }
  return value;
}

function extractPayloadErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const errorValue = (payload as { error?: unknown }).error;
  if (typeof errorValue === 'string') {
    return errorValue;
  }
  if (errorValue && typeof errorValue === 'object') {
    const message = (errorValue as { message?: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
  }

  return null;
}

function sanitizeDigits(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const digits = value.replace(/\D/g, '');
  return digits || null;
}

function sanitizeText(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function resolvePersonType(tipo: string | number | null): 'FISICA' | 'JURIDICA' | undefined {
  if (tipo === null || tipo === undefined) {
    return undefined;
  }
  if (typeof tipo === 'number') {
    return tipo === 2 ? 'JURIDICA' : 'FISICA';
  }
  const normalized = tipo.trim();
  if (!normalized) {
    return undefined;
  }
  return normalized === '2' ? 'JURIDICA' : 'FISICA';
}

function buildCustomerPayload(
  clienteId: number,
  dados: ClienteLocalData
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: sanitizeText(dados.nome) ?? dados.nome,
    email: sanitizeText(dados.email),
    cpfCnpj: sanitizeDigits(dados.documento),
    mobilePhone: sanitizeDigits(dados.telefone),
    postalCode: sanitizeDigits(dados.cep),
    address: sanitizeText(dados.rua),
    addressNumber: sanitizeText(dados.numero),
    complement: sanitizeText(dados.complemento),
    province: sanitizeText(dados.bairro),
    city: sanitizeText(dados.cidade),
    state: sanitizeText(dados.uf),
    personType: resolvePersonType(dados.tipo),
    externalReference: String(clienteId),
  };

  const entries = Object.entries(payload).filter(([, value]) => value !== null && value !== undefined);
  return Object.fromEntries(entries);
}

function determineBaseUrl(integration: IntegrationApiKeyRow): string {
  const configuredUrl = integration.url_api?.trim();
  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, '');
  }

  const normalizedEnv = integration.environment?.trim().toLowerCase();
  if (normalizedEnv === 'homologacao') {
    return ASAAS_SANDBOX_BASE_URL;
  }
  return ASAAS_PRODUCTION_BASE_URL;
}

function mapRowToState(row: AsaasCustomerRow): AsaasCustomerState {
  const lastPayload = parseLastPayload(row.last_payload);
  return {
    integrationActive: true,
    integrationApiKeyId: row.integration_api_key_id,
    status: (row.status as AsaasCustomerSyncStatus) ?? 'pending',
    customerId: row.asaas_customer_id,
    syncedAt: toIsoString(row.synced_at),
    lastPayload,
    errorMessage: extractPayloadErrorMessage(lastPayload),
  };
}

export default class AsaasCustomerService {
  constructor(
    private readonly db: Queryable = pool,
    private readonly httpClientFactory: (config: AsaasHttpClientConfig) => AsaasHttpClient = createAsaasHttpClient
  ) {}

  private async findActiveIntegration(): Promise<IntegrationApiKeyRow | null> {
    const result = await this.db.query(
      `SELECT id, provider, url_api, key_value, environment, active
         FROM public.integration_api_keys
        WHERE provider = $1 AND active IS TRUE
        ORDER BY created_at DESC
        LIMIT 1`,
      [ASAAS_PROVIDER_NAME]
    );

    if (result.rowCount === 0) {
      return null;
    }

    return result.rows[0] as IntegrationApiKeyRow;
  }

  private async findMapping(
    clienteId: number,
    integrationId: number
  ): Promise<AsaasCustomerRow | null> {
    const result = await this.db.query(
      `SELECT cliente_id, integration_api_key_id, asaas_customer_id, status, synced_at, last_payload
         FROM public.asaas_customers
        WHERE cliente_id = $1 AND integration_api_key_id = $2
        LIMIT 1`,
      [clienteId, integrationId]
    );

    if (result.rowCount === 0) {
      return null;
    }

    return result.rows[0] as AsaasCustomerRow;
  }

  private async insertMapping(
    clienteId: number,
    integrationId: number
  ): Promise<AsaasCustomerRow> {
    const result = await this.db.query(
      `INSERT INTO public.asaas_customers (cliente_id, integration_api_key_id, status)
       VALUES ($1, $2, 'pending')
       RETURNING cliente_id, integration_api_key_id, asaas_customer_id, status, synced_at, last_payload`,
      [clienteId, integrationId]
    );

    return result.rows[0] as AsaasCustomerRow;
  }

  private buildHttpClient(integration: IntegrationApiKeyRow): AsaasHttpClient {
    const baseUrl = determineBaseUrl(integration);
    return this.httpClientFactory({
      apiKey: integration.key_value,
      baseUrl,
    });
  }

  async ensureCustomer(clienteId: number): Promise<AsaasCustomerState> {
    if (!Number.isInteger(clienteId) || clienteId <= 0) {
      throw new Error('clienteId must be a positive integer');
    }

    const integration = await this.findActiveIntegration();
    if (!integration) {
      return { ...INACTIVE_STATE };
    }

    let mapping = await this.findMapping(clienteId, integration.id);
    if (!mapping) {
      mapping = await this.insertMapping(clienteId, integration.id);
    }

    return mapRowToState(mapping);
  }

  async updateFromLocal(
    clienteId: number,
    dadosCliente: ClienteLocalData
  ): Promise<AsaasCustomerState> {
    if (!Number.isInteger(clienteId) || clienteId <= 0) {
      throw new Error('clienteId must be a positive integer');
    }

    const integration = await this.findActiveIntegration();
    if (!integration) {
      return { ...INACTIVE_STATE };
    }

    let mapping = await this.findMapping(clienteId, integration.id);
    if (!mapping) {
      mapping = await this.insertMapping(clienteId, integration.id);
    }

    const payload = buildCustomerPayload(clienteId, dadosCliente);
    const client = this.buildHttpClient(integration);

    try {
      const response = mapping.asaas_customer_id
        ? await client.updateCustomer(mapping.asaas_customer_id, payload)
        : await client.createCustomer(payload);

      const remoteId =
        typeof response?.id === 'string'
          ? response.id
          : response && Object.prototype.hasOwnProperty.call(response, 'id')
            ? String((response as { id: unknown }).id ?? '') || mapping.asaas_customer_id
            : mapping.asaas_customer_id;

      const updateResult = await this.db.query(
        `UPDATE public.asaas_customers
            SET asaas_customer_id = $1,
                status = 'synced',
                synced_at = NOW(),
                last_payload = $2
          WHERE cliente_id = $3 AND integration_api_key_id = $4
          RETURNING cliente_id, integration_api_key_id, asaas_customer_id, status, synced_at, last_payload`,
        [
          remoteId,
          JSON.stringify({ request: payload, response }),
          clienteId,
          integration.id,
        ]
      );

      return mapRowToState(updateResult.rows[0] as AsaasCustomerRow);
    } catch (error) {
      const message =
        error instanceof AsaasApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Falha desconhecida ao sincronizar cliente com o Asaas.';

      const updateResult = await this.db.query(
        `UPDATE public.asaas_customers
            SET status = 'error',
                synced_at = NULL,
                last_payload = $1
          WHERE cliente_id = $2 AND integration_api_key_id = $3
          RETURNING cliente_id, integration_api_key_id, asaas_customer_id, status, synced_at, last_payload`,
        [
          JSON.stringify({ request: payload, error: { message } }),
          clienteId,
          integration.id,
        ]
      );

      const state = mapRowToState(updateResult.rows[0] as AsaasCustomerRow);
      return {
        ...state,
        errorMessage: message,
      };
    }
  }
}
