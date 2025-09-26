import { PoolClient, QueryResultRow } from 'pg';
import { setTimeout as delay } from 'timers/promises';
import pool from './db';

type Queryable = {
  query: (
    text: string,
    params?: unknown[],
  ) => Promise<{ rows: QueryResultRow[]; rowCount: number }>;
};

export interface ProcessSyncIntegrationInfo {
  id: number;
  provider: string;
  environment: string;
  apiUrl: string | null;
  active: boolean;
}

export interface ProcessSyncRecord {
  id: number;
  processoId: number | null;
  integrationApiKeyId: number | null;
  integration?: ProcessSyncIntegrationInfo | null;
  remoteRequestId: string | null;
  requestType: string;
  requestedBy: number | null;
  requestedAt: string;
  requestPayload: unknown;
  requestHeaders: unknown;
  status: string;
  statusReason: string | null;
  completedAt: string | null;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessResponseRecord {
  id: number;
  processoId: number | null;
  processSyncId: number | null;
  integrationApiKeyId: number | null;
  integration?: ProcessSyncIntegrationInfo | null;
  deliveryId: string | null;
  source: string;
  statusCode: number | null;
  receivedAt: string;
  payload: unknown;
  headers: unknown;
  errorMessage: string | null;
  createdAt: string;
}

export interface SyncAuditRecord {
  id: number;
  processoId: number | null;
  processSyncId: number | null;
  processResponseId: number | null;
  integrationApiKeyId: number | null;
  integration?: ProcessSyncIntegrationInfo | null;
  eventType: string;
  eventDetails: unknown;
  observedAt: string;
  createdAt: string;
}

interface ProcessSyncRow extends QueryResultRow {
  id: number;
  processo_id: number | null;
  integration_api_key_id: number | null;
  remote_request_id: string | null;
  request_type: string;
  requested_by: number | null;
  requested_at: string | Date;
  request_payload: unknown;
  request_headers: unknown;
  status: string;
  status_reason: string | null;
  completed_at: string | Date | null;
  metadata: unknown;
  created_at: string | Date;
  updated_at: string | Date;
  provider?: string | null;
  environment?: string | null;
  url_api?: string | null;
  active?: boolean | null;
}

interface ProcessResponseRow extends QueryResultRow {
  id: number;
  processo_id: number | null;
  process_sync_id: number | null;
  integration_api_key_id: number | null;
  delivery_id: string | null;
  source: string;
  status_code: number | null;
  received_at: string | Date;
  payload: unknown;
  headers: unknown;
  error_message: string | null;
  created_at: string | Date;
  provider?: string | null;
  environment?: string | null;
  url_api?: string | null;
  active?: boolean | null;
}

interface SyncAuditRow extends QueryResultRow {
  id: number;
  processo_id: number | null;
  process_sync_id: number | null;
  process_response_id: number | null;
  integration_api_key_id: number | null;
  event_type: string;
  event_details: unknown;
  observed_at: string | Date;
  created_at: string | Date;
  provider?: string | null;
  environment?: string | null;
  url_api?: string | null;
  active?: boolean | null;
}

const EMPTY_OBJECT = {} as const;

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeNullableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeStatus(value: unknown, fallback: string): string {
  const normalized = normalizeOptionalString(value);
  return normalized ?? fallback;
}

function normalizeRequestType(value: unknown): string | null {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return null;
  }
  return normalized.toLowerCase();
}

function normalizeDateInput(value: unknown): string | Date | null {
  if (value === undefined) {
    return null;
  }
  if (value === null) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  return null;
}

function toJsonText(value: unknown, fallback: string | null): string | null {
  if (value === undefined || value === null) {
    return fallback;
  }

  try {
    return JSON.stringify(value);
  } catch (error) {
    if (fallback !== undefined) {
      return fallback;
    }
    throw error;
  }
}

function parseJsonColumn<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      return fallback;
    }
  }

  if (typeof value === 'object') {
    return value as T;
  }

  return fallback;
}

function formatTimestamp(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return new Date(value).toISOString();
}

function formatNullableTimestamp(value: string | Date | null): string | null {
  if (!value) {
    return null;
  }
  return formatTimestamp(value);
}

function mapIntegration(row: { integration_api_key_id?: number | null; provider?: string | null; environment?: string | null; url_api?: string | null; active?: boolean | null; }): ProcessSyncIntegrationInfo | null {
  if (!row.integration_api_key_id) {
    return null;
  }
  return {
    id: row.integration_api_key_id,
    provider: row.provider ?? 'judit',
    environment: row.environment ?? 'producao',
    apiUrl: row.url_api ?? null,
    active: row.active ?? true,
  };
}

function mapProcessSyncRow(row: ProcessSyncRow): ProcessSyncRecord {
  return {
    id: row.id,
    processoId: row.processo_id ?? null,
    integrationApiKeyId: row.integration_api_key_id ?? null,
    integration: mapIntegration(row),
    remoteRequestId: row.remote_request_id ?? null,
    requestType: row.request_type,
    requestedBy: row.requested_by ?? null,
    requestedAt: formatTimestamp(row.requested_at),
    requestPayload: parseJsonColumn(row.request_payload, { ...EMPTY_OBJECT }),
    requestHeaders: parseJsonColumn(row.request_headers, null),
    status: row.status,
    statusReason: row.status_reason ?? null,
    completedAt: formatNullableTimestamp(row.completed_at ?? null),
    metadata: parseJsonColumn(row.metadata, { ...EMPTY_OBJECT }),
    createdAt: formatTimestamp(row.created_at),
    updatedAt: formatTimestamp(row.updated_at),
  };
}

function mapProcessResponseRow(row: ProcessResponseRow): ProcessResponseRecord {
  return {
    id: row.id,
    processoId: row.processo_id ?? null,
    processSyncId: row.process_sync_id ?? null,
    integrationApiKeyId: row.integration_api_key_id ?? null,
    integration: mapIntegration(row),
    deliveryId: row.delivery_id ?? null,
    source: row.source,
    statusCode: row.status_code ?? null,
    receivedAt: formatTimestamp(row.received_at),
    payload: parseJsonColumn(row.payload, { ...EMPTY_OBJECT }),
    headers: parseJsonColumn(row.headers, null),
    errorMessage: row.error_message ?? null,
    createdAt: formatTimestamp(row.created_at),
  };
}

function mapSyncAuditRow(row: SyncAuditRow): SyncAuditRecord {
  return {
    id: row.id,
    processoId: row.processo_id ?? null,
    processSyncId: row.process_sync_id ?? null,
    processResponseId: row.process_response_id ?? null,
    integrationApiKeyId: row.integration_api_key_id ?? null,
    integration: mapIntegration(row),
    eventType: row.event_type,
    eventDetails: parseJsonColumn(row.event_details, { ...EMPTY_OBJECT }),
    observedAt: formatTimestamp(row.observed_at),
    createdAt: formatTimestamp(row.created_at),
  };
}

export interface RegisterProcessRequestInput {
  processoId?: number | null;
  integrationApiKeyId?: number | null;
  remoteRequestId?: string | null;
  requestType?: string | null;
  requestedBy?: number | null;
  requestedAt?: string | Date | null;
  requestPayload?: unknown;
  requestHeaders?: unknown;
  status?: string | null;
  statusReason?: string | null;
  metadata?: unknown;
}

export async function registerProcessRequest(
  input: RegisterProcessRequestInput,
  client: Queryable = pool,
): Promise<ProcessSyncRecord> {
  const requestType = normalizeRequestType(input.requestType);
  const statusValue = normalizeStatus(input.status, 'pending');

  const result = await client.query(
    `INSERT INTO public.process_sync (
       processo_id,
       integration_api_key_id,
       remote_request_id,
       request_type,
       requested_by,
       requested_at,
       request_payload,
       request_headers,
       status,
       status_reason,
       metadata
     ) VALUES (
       $1,
       $2,
       $3,
       COALESCE($4, 'manual'),
       $5,
       COALESCE($6::timestamptz, NOW()),
       COALESCE($7::jsonb, '{}'::jsonb),
       $8::jsonb,
       $9,
       $10,
       $11::jsonb
     )
     RETURNING
       id,
       processo_id,
       integration_api_key_id,
       remote_request_id,
       request_type,
       requested_by,
       requested_at,
       request_payload,
       request_headers,
       status,
       status_reason,
       completed_at,
       metadata,
       created_at,
       updated_at`,
    [
      normalizeNullableNumber(input.processoId),
      normalizeNullableNumber(input.integrationApiKeyId),
      normalizeOptionalString(input.remoteRequestId),
      requestType,
      normalizeNullableNumber(input.requestedBy),
      normalizeDateInput(input.requestedAt),
      toJsonText(input.requestPayload, '{}'),
      toJsonText(input.requestHeaders, null),
      statusValue,
      normalizeOptionalString(input.statusReason),
      toJsonText(input.metadata, '{}'),
    ],
  );

  return mapProcessSyncRow(result.rows[0] as ProcessSyncRow);
}

export interface UpdateProcessSyncStatusInput {
  status?: string | null;
  statusReason?: string | null;
  completedAt?: string | Date | null;
  metadata?: unknown;
}

export async function updateProcessSyncStatus(
  id: number,
  updates: UpdateProcessSyncStatusInput,
  client: Queryable = pool,
): Promise<ProcessSyncRecord | null> {
  const assignments: string[] = [];
  const values: unknown[] = [];
  let index = 1;

  if (Object.prototype.hasOwnProperty.call(updates, 'status')) {
    assignments.push(`status = $${index++}`);
    values.push(updates.status === null ? null : normalizeStatus(updates.status, 'pending'));
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'statusReason')) {
    assignments.push(`status_reason = $${index++}`);
    values.push(updates.statusReason === null ? null : normalizeOptionalString(updates.statusReason));
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'completedAt')) {
    assignments.push(`completed_at = $${index++}::timestamptz`);
    values.push(normalizeDateInput(updates.completedAt ?? null));
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'metadata')) {
    assignments.push(`metadata = $${index++}::jsonb`);
    values.push(toJsonText(updates.metadata ?? null, '{}'));
  }

  assignments.push(`updated_at = NOW()`);

  const query = `UPDATE public.process_sync SET ${assignments.join(', ')} WHERE id = $${index} RETURNING
      id,
      processo_id,
      integration_api_key_id,
      remote_request_id,
      request_type,
      requested_by,
      requested_at,
      request_payload,
      request_headers,
      status,
      status_reason,
      completed_at,
      metadata,
      created_at,
      updated_at`;

  values.push(id);

  const result = await client.query(query, values);
  if (result.rowCount === 0) {
    return null;
  }
  return mapProcessSyncRow(result.rows[0] as ProcessSyncRow);
}

export interface RegisterProcessResponseInput {
  processoId?: number | null;
  processSyncId?: number | null;
  integrationApiKeyId?: number | null;
  deliveryId?: string | null;
  source?: string | null;
  statusCode?: number | null;
  receivedAt?: string | Date | null;
  payload?: unknown;
  headers?: unknown;
  errorMessage?: string | null;
}

export async function registerProcessResponse(
  input: RegisterProcessResponseInput,
  client: Queryable = pool,
): Promise<ProcessResponseRecord> {
  const result = await client.query(
    `INSERT INTO public.process_response (
       processo_id,
       process_sync_id,
       integration_api_key_id,
       delivery_id,
       source,
       status_code,
       received_at,
       payload,
       headers,
       error_message
     ) VALUES (
       $1,
       $2,
       $3,
       $4,
       COALESCE($5, 'webhook'),
       $6,
       COALESCE($7::timestamptz, NOW()),
       COALESCE($8::jsonb, '{}'::jsonb),
       $9::jsonb,
       $10
     )
     RETURNING
       id,
       processo_id,
       process_sync_id,
       integration_api_key_id,
       delivery_id,
       source,
       status_code,
       received_at,
       payload,
       headers,
       error_message,
       created_at`,
    [
      normalizeNullableNumber(input.processoId),
      normalizeNullableNumber(input.processSyncId),
      normalizeNullableNumber(input.integrationApiKeyId),
      normalizeOptionalString(input.deliveryId),
      normalizeOptionalString(input.source),
      input.statusCode === undefined ? null : normalizeNullableNumber(input.statusCode),
      normalizeDateInput(input.receivedAt),
      toJsonText(input.payload, '{}'),
      toJsonText(input.headers, null),
      normalizeOptionalString(input.errorMessage),
    ],
  );

  return mapProcessResponseRow(result.rows[0] as ProcessResponseRow);
}

export interface RegisterSyncAuditInput {
  processoId?: number | null;
  processSyncId?: number | null;
  processResponseId?: number | null;
  integrationApiKeyId?: number | null;
  eventType: string;
  eventDetails?: unknown;
  observedAt?: string | Date | null;
}

export async function registerSyncAudit(
  input: RegisterSyncAuditInput,
  client: Queryable = pool,
): Promise<SyncAuditRecord> {
  const eventType = normalizeStatus(input.eventType, 'event');

  const result = await client.query(
    `INSERT INTO public.sync_audit (
       processo_id,
       process_sync_id,
       process_response_id,
       integration_api_key_id,
       event_type,
       event_details,
       observed_at
     ) VALUES (
       $1,
       $2,
       $3,
       $4,
       $5,
       COALESCE($6::jsonb, '{}'::jsonb),
       COALESCE($7::timestamptz, NOW())
     )
     RETURNING
       id,
       processo_id,
       process_sync_id,
       process_response_id,
       integration_api_key_id,
       event_type,
       event_details,
       observed_at,
       created_at`,
    [
      normalizeNullableNumber(input.processoId),
      normalizeNullableNumber(input.processSyncId),
      normalizeNullableNumber(input.processResponseId),
      normalizeNullableNumber(input.integrationApiKeyId),
      eventType,
      toJsonText(input.eventDetails, '{}'),
      normalizeDateInput(input.observedAt),
    ],
  );

  return mapSyncAuditRow(result.rows[0] as SyncAuditRow);
}

export async function listProcessSyncs(
  processoId: number,
  client: Queryable = pool,
): Promise<ProcessSyncRecord[]> {
  const result = await client.query(
    `SELECT
       ps.id,
       ps.processo_id,
       ps.integration_api_key_id,
       ps.remote_request_id,
       ps.request_type,
       ps.requested_by,
       ps.requested_at,
       ps.request_payload,
       ps.request_headers,
       ps.status,
       ps.status_reason,
       ps.completed_at,
       ps.metadata,
       ps.created_at,
       ps.updated_at,
       iak.provider,
       iak.environment,
       iak.url_api,
       iak.active
     FROM public.process_sync ps
     LEFT JOIN public.integration_api_keys iak ON iak.id = ps.integration_api_key_id
     WHERE ps.processo_id = $1
     ORDER BY ps.requested_at DESC, ps.id DESC`,
    [processoId],
  );

  return result.rows.map((row) => mapProcessSyncRow(row as ProcessSyncRow));
}

export async function listProcessResponses(
  processoId: number,
  client: Queryable = pool,
): Promise<ProcessResponseRecord[]> {
  const result = await client.query(
    `SELECT
       pr.id,
       pr.processo_id,
       pr.process_sync_id,
       pr.integration_api_key_id,
       pr.delivery_id,
       pr.source,
       pr.status_code,
       pr.received_at,
       pr.payload,
       pr.headers,
       pr.error_message,
       pr.created_at,
       iak.provider,
       iak.environment,
       iak.url_api,
       iak.active
     FROM public.process_response pr
     LEFT JOIN public.integration_api_keys iak ON iak.id = pr.integration_api_key_id
     WHERE pr.processo_id = $1
     ORDER BY pr.received_at DESC, pr.id DESC`,
    [processoId],
  );

  return result.rows.map((row) => mapProcessResponseRow(row as ProcessResponseRow));
}

export async function listSyncAudits(
  processoId: number,
  client: Queryable = pool,
): Promise<SyncAuditRecord[]> {
  const result = await client.query(
    `SELECT
       sa.id,
       sa.processo_id,
       sa.process_sync_id,
       sa.process_response_id,
       sa.integration_api_key_id,
       sa.event_type,
       sa.event_details,
       sa.observed_at,
       sa.created_at,
       iak.provider,
       iak.environment,
       iak.url_api,
       iak.active
     FROM public.sync_audit sa
     LEFT JOIN public.integration_api_keys iak ON iak.id = sa.integration_api_key_id
     WHERE sa.processo_id = $1
     ORDER BY sa.observed_at DESC, sa.id DESC`,
    [processoId],
  );

  return result.rows.map((row) => mapSyncAuditRow(row as SyncAuditRow));
}

export async function findProcessByNumber(
  processNumber: string,
  client: Queryable = pool,
): Promise<{ id: number } | null> {
  const normalized = normalizeOptionalString(processNumber);
  if (!normalized) {
    return null;
  }

  const result = await client.query(
    `SELECT id FROM public.processos WHERE numero = $1 ORDER BY id ASC LIMIT 1`,
    [normalized],
  );

  if (result.rowCount === 0) {
    return null;
  }

  return { id: (result.rows[0] as QueryResultRow).id as number };
}

export async function findProcessSyncByRemoteId(
  remoteRequestId: string,
  client: Queryable = pool,
): Promise<ProcessSyncRecord | null> {
  const normalized = normalizeOptionalString(remoteRequestId);
  if (!normalized) {
    return null;
  }

  const result = await client.query(
    `SELECT
       ps.id,
       ps.processo_id,
       ps.integration_api_key_id,
       ps.remote_request_id,
       ps.request_type,
       ps.requested_by,
       ps.requested_at,
       ps.request_payload,
       ps.request_headers,
       ps.status,
       ps.status_reason,
       ps.completed_at,
       ps.metadata,
       ps.created_at,
       ps.updated_at,
       iak.provider,
       iak.environment,
       iak.url_api,
       iak.active
     FROM public.process_sync ps
     LEFT JOIN public.integration_api_keys iak ON iak.id = ps.integration_api_key_id
     WHERE ps.remote_request_id = $1
     ORDER BY ps.id DESC
     LIMIT 1`,
    [normalized],
  );

  if (result.rowCount === 0) {
    return null;
  }

  return mapProcessSyncRow(result.rows[0] as ProcessSyncRow);
}


const TRACKING_ENDPOINT = 'https://tracking.prod.judit.io/tracking';
const REQUESTS_ENDPOINT = 'https://requests.prod.judit.io/requests';

const DEFAULT_CONFIGURATION_CACHE_TTL_MS = 60_000;

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BACKOFF_MS = 500;

interface JuditIntegrationConfiguration {
  apiKey: string;
  requestsEndpoint: string;
  trackingEndpoint: string;
  integrationId: number | null;
}

export class JuditConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JuditConfigurationError';
  }
}

export class JuditApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'JuditApiError';
    this.status = status;
    this.body = body;
  }
}

export type JuditRequestSource = 'details' | 'manual' | 'cron' | 'webhook' | 'system';

export interface JuditTrackingResponse {
  tracking_id: string;
  process_number?: string;
  hour_range?: string | null;
  status?: string | null;
  recurrence?: number | null;
}

export interface JuditRequestResponse {
  request_id: string;
  status: string;
  result?: unknown;
  tracking_id?: string;
}

export interface JuditRequestRecord {
  requestId: string;
  status: string;
  source: JuditRequestSource;
  result: unknown;
  createdAt: string;
  updatedAt: string;
}

interface EnsureTrackingOptions {
  trackingId?: string | null;
  hourRange?: string | null;
  client?: PoolClient;
}

interface TriggerRequestOptions {
  source: JuditRequestSource;
  actorUserId?: number | null;
  skipIfPending?: boolean;
  client?: PoolClient;
}

export class JuditProcessService {
  private readonly envApiKey: string | null;
  private readonly maxRetries: number;
  private readonly backoffMs: number;
  private readonly configurationCacheTtlMs: number;
  private configurationCache: JuditIntegrationConfiguration | null = null;
  private configurationCacheExpiresAt = 0;
  private loadingConfiguration: Promise<JuditIntegrationConfiguration | null> | null = null;

  constructor(apiKey: string | undefined | null = process.env.JUDIT_API_KEY) {
    const trimmedKey = typeof apiKey === 'string' ? apiKey.trim() : '';
    this.envApiKey = trimmedKey ? trimmedKey : null;
    this.maxRetries = this.resolveNumericEnv('JUDIT_MAX_RETRIES', DEFAULT_MAX_RETRIES, 1, 10);
    this.backoffMs = this.resolveNumericEnv('JUDIT_BACKOFF_MS', DEFAULT_BACKOFF_MS, 100, 60000);
    this.configurationCacheTtlMs = DEFAULT_CONFIGURATION_CACHE_TTL_MS;
  }

  async isEnabled(): Promise<boolean> {
    try {
      const config = await this.resolveConfiguration({ markUsage: false });
      return config !== null;
    } catch (error) {
      console.error('[Judit] Falha ao verificar configuração da integração.', error);
      return false;
    }
  }

  private buildEndpoints(baseUrl: string | null | undefined): {
    requestsEndpoint: string;
    trackingEndpoint: string;
  } {
    if (typeof baseUrl === 'string') {
      const trimmed = baseUrl.trim();
      if (trimmed) {
        const normalized = trimmed.replace(/\/+$/, '');
        return {
          requestsEndpoint: `${normalized}/requests`,
          trackingEndpoint: `${normalized}/tracking`,
        };
      }
    }

    return {
      requestsEndpoint: REQUESTS_ENDPOINT,
      trackingEndpoint: TRACKING_ENDPOINT,
    };
  }

  private async loadConfigurationFromSources(
    client?: PoolClient,
  ): Promise<JuditIntegrationConfiguration | null> {
    if (this.envApiKey) {
      const endpoints = this.buildEndpoints(null);
      return {
        apiKey: this.envApiKey,
        requestsEndpoint: endpoints.requestsEndpoint,
        trackingEndpoint: endpoints.trackingEndpoint,
        integrationId: null,
      };
    }

    const executor = client ?? pool;
    const result = await executor.query(
      `SELECT id, key_value, url_api
         FROM public.integration_api_keys
        WHERE provider = 'judit' AND active IS TRUE
        ORDER BY (environment = 'producao') DESC,
                 last_used DESC NULLS LAST,
                 updated_at DESC,
                 id DESC
        LIMIT 1`,
    );

    if (result.rowCount === 0) {
      return null;
    }

    const row = result.rows[0] as {
      id: number | null;
      key_value: unknown;
      url_api: unknown;
    };

    const keyValue = typeof row.key_value === 'string' ? row.key_value.trim() : '';
    if (!keyValue) {
      return null;
    }

    const endpoints = this.buildEndpoints(typeof row.url_api === 'string' ? row.url_api : null);

    return {
      apiKey: keyValue,
      requestsEndpoint: endpoints.requestsEndpoint,
      trackingEndpoint: endpoints.trackingEndpoint,
      integrationId: typeof row.id === 'number' ? row.id : null,
    };
  }

  private async resolveConfiguration(options: {
    client?: PoolClient;
    forceRefresh?: boolean;
    markUsage?: boolean;
  } = {}): Promise<JuditIntegrationConfiguration | null> {
    const now = Date.now();
    if (!options.forceRefresh && this.configurationCache && now < this.configurationCacheExpiresAt) {
      if (options.markUsage && this.configurationCache.integrationId) {
        void this.markIntegrationAsUsed(this.configurationCache.integrationId, options.client);
      }
      return this.configurationCache;
    }

    if (this.loadingConfiguration) {
      try {
        const cached = await this.loadingConfiguration;
        if (!options.forceRefresh && cached && this.configurationCache && now < this.configurationCacheExpiresAt) {
          if (options.markUsage && this.configurationCache.integrationId) {
            void this.markIntegrationAsUsed(this.configurationCache.integrationId, options.client);
          }
          return this.configurationCache;
        }
      } catch {
        // ignore and fetch a new configuration
      }
    }

    const loader = this.loadConfigurationFromSources(options.client);
    this.loadingConfiguration = loader;

    try {
      const configuration = await loader;
      this.configurationCache = configuration;
      this.configurationCacheExpiresAt = Date.now() + this.configurationCacheTtlMs;

      if (configuration && options.markUsage && configuration.integrationId) {
        void this.markIntegrationAsUsed(configuration.integrationId, options.client);
      }

      return configuration;
    } finally {
      this.loadingConfiguration = null;
    }
  }

  private async requireConfiguration(options: { client?: PoolClient } = {}): Promise<JuditIntegrationConfiguration> {
    const configuration = await this.resolveConfiguration({ ...options, markUsage: true });
    if (!configuration) {
      throw new JuditConfigurationError('Integração com a Judit está desabilitada.');
    }
    return configuration;
  }

  private async markIntegrationAsUsed(integrationId: number, client?: PoolClient): Promise<void> {
    try {
      const executor = client ?? pool;
      await executor.query('UPDATE public.integration_api_keys SET last_used = NOW() WHERE id = $1', [integrationId]);
    } catch (error) {
      console.warn('[Judit] Falha ao atualizar last_used da credencial Judit.', error);
    }
  }

  invalidateConfigurationCache(): void {
    this.configurationCache = null;
    this.configurationCacheExpiresAt = 0;
  }

  private resolveNumericEnv(name: string, fallback: number, min: number, max: number): number {
    const raw = process.env[name];
    if (!raw) {
      return fallback;
    }

    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    return Math.min(Math.max(parsed, min), max);
  }

  private buildHeaders(config: JuditIntegrationConfiguration): HeadersInit {
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'api-key': config.apiKey,
    } satisfies HeadersInit;
  }

  private async requestWithRetry<T>(
    config: JuditIntegrationConfiguration,
    url: string,
    init: RequestInit,
    attempt = 0,
  ): Promise<T> {
    try {
      const response = await fetch(url, {
        ...init,
        headers: { ...init.headers, ...this.buildHeaders(config) },
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return (await response.json()) as T;
        }

        const text = await response.text();
        return JSON.parse(text) as T;
      }

      const retryable = response.status >= 500 || response.status === 429;
      const body = await this.safeParseBody(response);

      if (retryable && attempt + 1 < this.maxRetries) {
        await delay(this.backoffMs * 2 ** attempt);
        return this.requestWithRetry<T>(config, url, init, attempt + 1);
      }

      throw new JuditApiError(`Requisição para Judit falhou com status ${response.status}`, response.status, body);
    } catch (error) {
      if (error instanceof JuditApiError) {
        throw error;
      }

      if (attempt + 1 < this.maxRetries) {
        await delay(this.backoffMs * 2 ** attempt);
        return this.requestWithRetry<T>(config, url, init, attempt + 1);
      }

      throw error;
    }
  }

  private async safeParseBody(response: Response): Promise<unknown> {
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      const text = await response.text();
      if (!text) {
        return null;
      }
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  async createTracking(
    processNumber: string,
    config?: JuditIntegrationConfiguration,
  ): Promise<JuditTrackingResponse> {
    const resolvedConfig = config ?? (await this.requireConfiguration());

    return this.requestWithRetry<JuditTrackingResponse>(resolvedConfig, resolvedConfig.trackingEndpoint, {
      method: 'POST',
      body: JSON.stringify({ process_number: processNumber, recurrence: 1 }),
    });
  }

  async renewTracking(
    trackingId: string,
    processNumber: string,
    config?: JuditIntegrationConfiguration,
  ): Promise<JuditTrackingResponse> {
    const resolvedConfig = config ?? (await this.requireConfiguration());
    const url = `${resolvedConfig.trackingEndpoint}/${encodeURIComponent(trackingId)}`;
    return this.requestWithRetry<JuditTrackingResponse>(resolvedConfig, url, {
      method: 'PUT',
      body: JSON.stringify({ process_number: processNumber, recurrence: 1 }),
    });
  }

  async triggerRequest(
    processNumber: string,
    config?: JuditIntegrationConfiguration,
  ): Promise<JuditRequestResponse> {
    const resolvedConfig = config ?? (await this.requireConfiguration());
    return this.requestWithRetry<JuditRequestResponse>(resolvedConfig, resolvedConfig.requestsEndpoint, {
      method: 'POST',
      body: JSON.stringify({
        search: {
          search_type: 'lawsuit_cnj',
          search_key: processNumber,
        },
        with_attachments: true,
      }),
    });
  }

  async getRequestStatusFromApi(
    requestId: string,
    config?: JuditIntegrationConfiguration,
  ): Promise<JuditRequestResponse> {
    const resolvedConfig = config ?? (await this.requireConfiguration());
    const url = `${resolvedConfig.requestsEndpoint}/${encodeURIComponent(requestId)}`;
    return this.requestWithRetry<JuditRequestResponse>(resolvedConfig, url, { method: 'GET' });
  }

  async ensureTrackingForProcess(
    processoId: number,
    processNumber: string,
    options: EnsureTrackingOptions = {}
  ): Promise<JuditTrackingResponse | null> {
    const useClient = options.client ?? (await pool.connect());
    const shouldRelease = !options.client;
    const manageTransaction = !options.client;

    try {
      const config = await this.resolveConfiguration({ client: useClient, markUsage: true });
      if (!config) {
        return null;
      }

      if (manageTransaction) {
        await useClient.query('BEGIN');
      }

      let trackingResponse: JuditTrackingResponse;

      if (options.trackingId) {
        try {
          trackingResponse = await this.renewTracking(options.trackingId, processNumber, config);
        } catch (error) {
          console.warn('[Judit] Falha ao renovar tracking, criando um novo.', error);
          trackingResponse = await this.createTracking(processNumber, config);
        }
      } else {
        trackingResponse = await this.createTracking(processNumber, config);
      }

      const hourRange = typeof trackingResponse.hour_range === 'string' ? trackingResponse.hour_range : null;
      const status = trackingResponse.status ?? 'active';

      await useClient.query(
        `UPDATE public.processos
           SET judit_tracking_id = $1,
               judit_tracking_hour_range = $2,
               atualizado_em = NOW()
         WHERE id = $3`,
        [trackingResponse.tracking_id, hourRange, processoId]
      );

      await useClient.query(
        `INSERT INTO public.processo_sync (processo_id, provider, status, tracking_id, hour_range, last_synced_at)
           VALUES ($1, 'judit', $2, $3, $4, NOW())
           ON CONFLICT (processo_id, provider)
           DO UPDATE SET
             status = EXCLUDED.status,
             tracking_id = EXCLUDED.tracking_id,
             hour_range = EXCLUDED.hour_range,
             last_synced_at = EXCLUDED.last_synced_at,
             atualizado_em = NOW()`,
        [processoId, status, trackingResponse.tracking_id, hourRange]
      );

      if (manageTransaction) {
        await useClient.query('COMMIT');
      }
      return trackingResponse;
    } catch (error) {
      if (manageTransaction) {
        await useClient.query('ROLLBACK');
      }
      throw error;
    } finally {
      if (shouldRelease) {
        useClient.release();
      }
    }
  }

  async triggerRequestForProcess(
    processoId: number,
    processNumber: string,
    options: TriggerRequestOptions
  ): Promise<JuditRequestRecord | null> {
    const client = options.client ?? (await pool.connect());
    const shouldRelease = !options.client;
    const manageTransaction = !options.client;

    try {
      if (manageTransaction) {
        await client.query('BEGIN');
      }

      if (options.skipIfPending) {
        const pendingLookup = await client.query(
          `SELECT request_id, status, source, result, criado_em, atualizado_em
             FROM public.processo_judit_requests
            WHERE processo_id = $1 AND status = 'pending'
            ORDER BY atualizado_em DESC
            LIMIT 1`,
          [processoId]
        );

        if ((pendingLookup.rowCount ?? 0) > 0) {
          const row = pendingLookup.rows[0];
          if (manageTransaction) {
            await client.query('COMMIT');
          }
          return {
            requestId: row.request_id,
            status: row.status,
            source: row.source,
            result: row.result,
            createdAt: row.criado_em.toISOString?.() ?? row.criado_em,
            updatedAt: row.atualizado_em.toISOString?.() ?? row.atualizado_em,
          };
        }
      }

      const config = await this.resolveConfiguration({ client, markUsage: true });
      if (!config) {
        if (manageTransaction) {
          await client.query('ROLLBACK');
        }
        return null;
      }

      const response = await this.triggerRequest(processNumber, config);

      const requestId = response.request_id;
      const status = response.status ?? 'pending';
      const result = response.result ?? null;

      const upsert = await client.query(
        `INSERT INTO public.processo_judit_requests (processo_id, request_id, status, source, result)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (request_id)
           DO UPDATE SET
             status = EXCLUDED.status,
             source = EXCLUDED.source,
             result = EXCLUDED.result,
             atualizado_em = NOW()
           RETURNING request_id, status, source, result, criado_em, atualizado_em`,
        [processoId, requestId, status, options.source, result]
      );

      const row = upsert.rows[0];

      await client.query(
        `UPDATE public.processo_sync
            SET last_request_id = $1,
                last_request_status = $2,
                last_request_payload = $3,
                atualizado_em = NOW()
          WHERE processo_id = $4 AND provider = 'judit'`,
        [requestId, status, result, processoId]
      );

      if (options.actorUserId) {
        await client.query(
          `INSERT INTO public.processo_consultas_api (processo_id, sucesso, detalhes)
             VALUES ($1, $2, $3)`,
          [
            processoId,
            status === 'completed',
            JSON.stringify({
              provider: 'judit',
              action: 'trigger-request',
              source: options.source,
              requestId,
              status,
              actorUserId: options.actorUserId,
            }),
          ]
        );
      }

      if (manageTransaction) {
        await client.query('COMMIT');
      }

      return {
        requestId: row.request_id,
        status: row.status,
        source: row.source,
        result: row.result,
        createdAt: row.criado_em.toISOString?.() ?? row.criado_em,
        updatedAt: row.atualizado_em.toISOString?.() ?? row.atualizado_em,
      };
    } catch (error) {
      if (manageTransaction) {
        await client.query('ROLLBACK');
      }
      throw error;
    } finally {
      if (shouldRelease) {
        client.release();
      }
    }
  }

  async updateRequestStatus(
    processoId: number,
    requestId: string,
    status: string,
    result: unknown,
    options: { source?: JuditRequestSource; client?: PoolClient } = {}
  ): Promise<JuditRequestRecord | null> {
    const client = options.client ?? (await pool.connect());
    const shouldRelease = !options.client;
    const manageTransaction = !options.client;

    try {
      if (manageTransaction) {
        await client.query('BEGIN');
      }

      const upsert = await client.query(
        `INSERT INTO public.processo_judit_requests (processo_id, request_id, status, source, result)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (request_id)
           DO UPDATE SET
             status = EXCLUDED.status,
             source = EXCLUDED.source,
             result = EXCLUDED.result,
             atualizado_em = NOW()
           RETURNING request_id, status, source, result, criado_em, atualizado_em`,
        [processoId, requestId, status, options.source ?? 'system', result]
      );

      const row = upsert.rows[0];

      await client.query(
        `UPDATE public.processo_sync
            SET last_request_id = $1,
                last_request_status = $2,
                last_request_payload = $3,
                last_synced_at = NOW(),
                atualizado_em = NOW()
          WHERE processo_id = $4 AND provider = 'judit'`,
        [requestId, status, result, processoId]
      );

      if (manageTransaction) {
        await client.query('COMMIT');
      }

      return {
        requestId: row.request_id,
        status: row.status,
        source: row.source,
        result: row.result,
        createdAt: row.criado_em.toISOString?.() ?? row.criado_em,
        updatedAt: row.atualizado_em.toISOString?.() ?? row.atualizado_em,
      };
    } catch (error) {
      if (manageTransaction) {
        await client.query('ROLLBACK');
      }
      throw error;
    } finally {
      if (shouldRelease) {
        client.release();
      }
    }
  }

  async getStoredRequest(
    processoId: number,
    requestId: string,
    client?: PoolClient
  ): Promise<JuditRequestRecord | null> {
    const useClient = client ?? (await pool.connect());
    const shouldRelease = !client;

    try {
      const result = await useClient.query(
        `SELECT request_id, status, source, result, criado_em, atualizado_em
           FROM public.processo_judit_requests
          WHERE processo_id = $1 AND request_id = $2
          LIMIT 1`,
        [processoId, requestId]
      );

      if (result.rowCount === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        requestId: row.request_id,
        status: row.status,
        source: row.source,
        result: row.result,
        createdAt: row.criado_em.toISOString?.() ?? row.criado_em,
        updatedAt: row.atualizado_em.toISOString?.() ?? row.atualizado_em,
      };
    } finally {
      if (shouldRelease) {
        useClient.release();
      }
    }
  }
}

const juditProcessService = new JuditProcessService();

export default juditProcessService;
