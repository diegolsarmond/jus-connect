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

function normalizeNumeric(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function normalizeStatus(value: unknown, fallback: string): string {
  const normalized = normalizeOptionalString(value);
  return normalized ?? fallback;
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') {
      return true;
    }
    if (normalized === 'false' || normalized === '0') {
      return false;
    }
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value !== 0;
  }

  return fallback;
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

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const pgError = error as { code?: unknown };
  return pgError.code === '23505';
}

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

interface JuditResponsesPage {
  request_status?: string | null;
  page?: number | string | null;
  page_count?: number | string | null;
  all_pages_count?: number | string | null;
  all_count?: number | string | null;
  page_data?: JuditResponseEntry[];
}

interface JuditResponseEntry {
  request_id?: string | null;
  response_id?: string | null;
  origin?: string | null;
  origin_id?: string | null;
  response_type?: string | null;
  response_data?: unknown;
  tags?: unknown;
  user_id?: string | null;
  created_at?: string | Date | null;
  updated_at?: string | Date | null;
  request_created_at?: string | Date | null;
}

export interface JuditRequestRecord {
  processSyncId: number;
  requestId: string;
  status: string;
  source: JuditRequestSource | string;
  result: unknown;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function mapSyncToRequestRecord(sync: ProcessSyncRecord): JuditRequestRecord {
  const metadata = asRecord(sync.metadata);

  return {
    processSyncId: sync.id,
    requestId: sync.remoteRequestId ?? '',
    status: sync.status,
    source: sync.requestType,
    result: metadata.result ?? null,
    metadata,
    createdAt: sync.createdAt,
    updatedAt: sync.updatedAt,
  };
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
  onDemand?: boolean | null;
  withAttachments?: boolean;
  client?: PoolClient;
}

interface JuditProcessServiceOptions {
  allowLegacyFallback?: boolean;
}

export class JuditProcessService {
  private readonly envApiKey: string | null;
  private readonly envBaseUrl: string | null;
  private readonly maxRetries: number;
  private readonly backoffMs: number;
  private readonly configurationCacheTtlMs: number;
  private readonly allowLegacyCredentialFallback: boolean;
  private configurationCache: JuditIntegrationConfiguration | null = null;
  private configurationCacheExpiresAt = 0;
  private loadingConfiguration: Promise<JuditIntegrationConfiguration | null> | null = null;

  constructor(
    apiKey: string | undefined | null = process.env.JUDIT_API_KEY,
    baseUrl: string | undefined | null = process.env.JUDIT_BASE_URL ?? process.env.JUDIT_API_URL,
    options: JuditProcessServiceOptions = {},
  ) {
    const trimmedKey = typeof apiKey === 'string' ? apiKey.trim() : '';
    this.envApiKey = trimmedKey ? trimmedKey : null;
    const trimmedBaseUrl = typeof baseUrl === 'string' ? baseUrl.trim() : '';
    this.envBaseUrl = trimmedBaseUrl ? trimmedBaseUrl : null;
    this.maxRetries = this.resolveNumericEnv('JUDIT_MAX_RETRIES', DEFAULT_MAX_RETRIES, 1, 10);
    this.backoffMs = this.resolveNumericEnv('JUDIT_BACKOFF_MS', DEFAULT_BACKOFF_MS, 100, 60000);
    this.configurationCacheTtlMs = DEFAULT_CONFIGURATION_CACHE_TTL_MS;
    this.allowLegacyCredentialFallback =
      options.allowLegacyFallback ?? this.resolveBooleanEnv('JUDIT_ALLOW_LEGACY_CREDENTIAL_FALLBACK', true);
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
        try {
          const base = new URL(trimmed);
          const baseSegments = base.pathname
            .split('/')
            .map((segment) => segment.trim())
            .filter(Boolean);

          const requestsUrl = new URL(base.href);
          requestsUrl.search = '';
          requestsUrl.hash = '';
          requestsUrl.hostname = requestsUrl.hostname.replace(/^tracking\./i, 'requests.');
          const requestsSegments = baseSegments
            .filter((segment) => segment.toLowerCase() !== 'tracking');
          const lastRequestSegment = requestsSegments[requestsSegments.length - 1];
          if (!lastRequestSegment || lastRequestSegment.toLowerCase() !== 'requests') {
            requestsSegments.push('requests');
          }
          requestsUrl.pathname = `/${requestsSegments.join('/')}`;

          const trackingUrl = new URL(base.href);
          trackingUrl.search = '';
          trackingUrl.hash = '';
          trackingUrl.hostname = trackingUrl.hostname.replace(/^requests\./i, 'tracking.');
          const trackingSegments = baseSegments
            .filter((segment) => segment.toLowerCase() !== 'requests');
          const lastTrackingSegment = trackingSegments[trackingSegments.length - 1];
          if (!lastTrackingSegment || lastTrackingSegment.toLowerCase() !== 'tracking') {
            trackingSegments.push('tracking');
          }
          trackingUrl.pathname = `/${trackingSegments.join('/')}`;

          return {
            requestsEndpoint: requestsUrl.href.replace(/\/+$/, ''),
            trackingEndpoint: trackingUrl.href.replace(/\/+$/, ''),
          };
        } catch {
          const normalized = trimmed.replace(/\/+$/, '');
          return {
            requestsEndpoint: `${normalized}/requests`,
            trackingEndpoint: `${normalized}/tracking`,
          };
        }
      }
    }

    return {
      requestsEndpoint: REQUESTS_ENDPOINT,
      trackingEndpoint: TRACKING_ENDPOINT,
    };
  }

  private resolveBooleanEnv(name: string, fallback: boolean): boolean {
    const raw = process.env[name];
    if (typeof raw !== 'string') {
      return fallback;
    }

    return normalizeBoolean(raw, fallback);
  }

  private async loadConfigurationFromDatabase(
    executor: Queryable,
    { globalOnly }: { globalOnly: boolean },
  ): Promise<JuditIntegrationConfiguration | null> {
    const result = await executor.query(
      `SELECT id, key_value, url_api
         FROM public.integration_api_keys
        WHERE provider = 'judit' AND active IS TRUE${globalOnly ? ' AND global IS TRUE' : ''}
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

    const endpoints = this.buildEndpoints(
      typeof row.url_api === 'string' && row.url_api.trim() ? row.url_api : this.envBaseUrl,
    );

    return {
      apiKey: keyValue,
      requestsEndpoint: endpoints.requestsEndpoint,
      trackingEndpoint: endpoints.trackingEndpoint,
      integrationId: typeof row.id === 'number' ? row.id : null,
    };
  }

  private async loadConfigurationFromSources(
    client?: PoolClient,
  ): Promise<JuditIntegrationConfiguration | null> {
    if (this.envApiKey) {
      const endpoints = this.buildEndpoints(this.envBaseUrl);
      return {
        apiKey: this.envApiKey,
        requestsEndpoint: endpoints.requestsEndpoint,
        trackingEndpoint: endpoints.trackingEndpoint,
        integrationId: null,
      };
    }

    const executor = client ?? pool;
    const configuration = await this.loadConfigurationFromDatabase(executor, { globalOnly: true });
    if (configuration) {
      return configuration;
    }

    if (!this.allowLegacyCredentialFallback) {
      console.warn('[Judit] Nenhuma credencial global encontrada e fallback legado está desabilitado.');
      return null;
    }

    console.warn('[Judit] Nenhuma credencial global encontrada. Aplicando fallback legado.');

    const legacyConfiguration = await this.loadConfigurationFromDatabase(executor, { globalOnly: false });
    if (!legacyConfiguration) {
      console.warn('[Judit] Fallback legado não encontrou credenciais ativas para a Judit.');
    }

    return legacyConfiguration;
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

      console.error('[Judit] Request failed.', {
        url,
        status: response.status,
        attempt,
        body,
      });
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
      body: JSON.stringify({
        search: {
          search_type: 'lawsuit_cnj',
          search_key: processNumber,
        },
        recurrence: 1,
      }),
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
      body: JSON.stringify({
        search: {
          search_type: 'lawsuit_cnj',
          search_key: processNumber,
        },
        recurrence: 1,
      }),
    });
  }

  async triggerRequest(
    processNumber: string,
    config?: JuditIntegrationConfiguration,
    options: { withAttachments?: boolean; onDemand?: boolean } = {},
  ): Promise<JuditRequestResponse> {
    const resolvedConfig = config ?? (await this.requireConfiguration());
    const payload: Record<string, unknown> = {
      search: {
        search_type: 'lawsuit_cnj',
        search_key: processNumber,
      },
    };

    if (typeof options.withAttachments === 'boolean') {
      payload.with_attachments = options.withAttachments;
    }

    if (typeof options.onDemand === 'boolean') {
      payload.on_demand = options.onDemand;
    }

    return this.requestWithRetry<JuditRequestResponse>(resolvedConfig, resolvedConfig.requestsEndpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
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

  private buildResponsesEndpoint(config: JuditIntegrationConfiguration): string {
    const normalized = typeof config.requestsEndpoint === 'string'
      ? config.requestsEndpoint.replace(/\/+$/, '')
      : '';

    try {
      if (normalized) {
        const url = new URL(normalized);
        const segments = url.pathname
          .split('/')
          .map((segment) => segment.trim())
          .filter(Boolean);

        if (segments.length === 0) {
          url.pathname = '/responses';
        } else {
          segments[segments.length - 1] = 'responses';
          url.pathname = `/${segments.join('/')}`;
        }

        url.search = '';
        url.hash = '';
        return url.href.replace(/\/+$/, '');
      }
    } catch (error) {
      console.warn('[Judit] Falha ao derivar endpoint de respostas, usando fallback.', error);
    }

    if (!normalized) {
      return 'responses';
    }

    return `${normalized}/responses`;
  }

  private async pollResponsesForRequest(
    config: JuditIntegrationConfiguration,
    requestId: string,
    processoId: number,
    processSync: ProcessSyncRecord,
    client: PoolClient,
    source: JuditRequestSource | string,
  ): Promise<ProcessSyncRecord> {
    const responsesEndpoint = this.buildResponsesEndpoint(config);
    let responsesUrl: URL;
    try {
      responsesUrl = new URL(responsesEndpoint);
    } catch {
      responsesUrl = new URL(`${config.requestsEndpoint.replace(/\/+$/, '')}/responses`);
    }
    let page = 1;
    let totalPages = 1;
    const insertedPayloads: unknown[] = [];
    let lastRequestStatus: string | null = null;

    while (page <= totalPages) {
      const pageUrl = new URL(responsesUrl.href);
      pageUrl.searchParams.set('page_size', '50');
      pageUrl.searchParams.set('page', String(page));
      pageUrl.searchParams.set('request_id', requestId);

      const pageResponse = await this.requestWithRetry<JuditResponsesPage>(config, pageUrl.href, {
        method: 'GET',
      });

      lastRequestStatus = typeof pageResponse.request_status === 'string'
        ? pageResponse.request_status
        : lastRequestStatus;

      const pageCount = normalizeNumeric(pageResponse.page_count, page);
      totalPages = pageCount > 0 ? pageCount : page;

      const entries = Array.isArray(pageResponse.page_data) ? pageResponse.page_data : [];

      for (const entry of entries) {
        if (!entry || typeof entry !== 'object') {
          continue;
        }

        const deliveryId = normalizeOptionalString((entry as JuditResponseEntry).response_id);

        try {
          const saved = await registerProcessResponse(
            {
              processoId,
              processSyncId: processSync.id,
              integrationApiKeyId: processSync.integrationApiKeyId,
              deliveryId,
              source: 'polling',
              statusCode: 200,
              receivedAt:
                (entry as JuditResponseEntry).created_at ??
                (entry as JuditResponseEntry).updated_at ??
                null,
              payload: (entry as JuditResponseEntry).response_data ?? entry,
              headers: {
                origin: (entry as JuditResponseEntry).origin ?? null,
                originId: (entry as JuditResponseEntry).origin_id ?? null,
                responseType: (entry as JuditResponseEntry).response_type ?? null,
                tags: (entry as JuditResponseEntry).tags ?? null,
                requestCreatedAt: (entry as JuditResponseEntry).request_created_at ?? null,
                userId: (entry as JuditResponseEntry).user_id ?? null,
              },
            },
            client,
          );
          insertedPayloads.push(saved.payload);
        } catch (error) {
          if (isUniqueViolation(error)) {
            continue;
          }
          throw error;
        }
      }

      page += 1;
    }

    if (insertedPayloads.length > 0) {
      const existingMetadata = asRecord(processSync.metadata);
      const previousResponses = Array.isArray((existingMetadata as any).responses)
        ? ((existingMetadata as any).responses as unknown[])
        : [];

      const metadata = {
        ...existingMetadata,
        status: existingMetadata.status ?? processSync.status,
        result: insertedPayloads[0],
        responses: [...previousResponses, ...insertedPayloads],
      } satisfies Record<string, unknown>;

      const updated = await updateProcessSyncStatus(
        processSync.id,
        {
          metadata,
        },
        client,
      );

      if (updated) {
        processSync = updated;
      }
    }

    await registerSyncAudit(
      {
        processoId,
        processSyncId: processSync.id,
        integrationApiKeyId: processSync.integrationApiKeyId,
        eventType: 'responses_polled',
        eventDetails: {
          requestId,
          storedCount: insertedPayloads.length,
          requestStatus: lastRequestStatus,
          source,
        },
      },
      client,
    );

    return processSync;
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

      const syncRecord = await registerProcessRequest(
        {
          processoId,
          integrationApiKeyId: config.integrationId,
          remoteRequestId: trackingResponse.tracking_id ?? null,
          requestType: 'system',
          requestPayload: {
            action: options.trackingId ? 'renew-tracking' : 'create-tracking',
            process_number: processNumber,
          },
          requestHeaders: this.buildHeaders(config),
          status: 'completed',
          metadata: {
            source: 'ensure_tracking',
            remoteStatus: status,
            hourRange,
            recurrence: trackingResponse.recurrence ?? null,
            trackingId: trackingResponse.tracking_id ?? null,
          },
        },
        useClient,
      );

      await updateProcessSyncStatus(
        syncRecord.id,
        { completedAt: new Date() },
        useClient,
      );

      await registerSyncAudit(
        {
          processoId,
          processSyncId: syncRecord.id,
          integrationApiKeyId: syncRecord.integrationApiKeyId,
          eventType: 'tracking_synced',
          eventDetails: {
            trackingId: trackingResponse.tracking_id ?? null,
            status,
            hourRange,
          },
        },
        useClient,
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
    const requestType = normalizeRequestType(options.source ?? 'system') ?? 'system';
    try {
      if (manageTransaction) {
        await client.query('BEGIN');
      }

      if (options.skipIfPending) {
        const pendingLookup = await client.query(
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
            AND ps.status = 'pending'
            AND ($2::text IS NULL OR ps.request_type = $2)
          ORDER BY ps.requested_at DESC, ps.id DESC
          LIMIT 1`,
          [processoId, requestType]
        );

        if ((pendingLookup.rowCount ?? 0) > 0) {
          if (manageTransaction) {
            await client.query('COMMIT');
          }
          return mapSyncToRequestRecord(
            mapProcessSyncRow(pendingLookup.rows[0] as ProcessSyncRow),
          );
        }
      }

      const config = await this.resolveConfiguration({ client, markUsage: true });
      if (!config) {
        if (manageTransaction) {
          await client.query('ROLLBACK');
        }
        return null;
      }

      const includeAttachments =
        typeof options.withAttachments === 'boolean'
          ? options.withAttachments
          : undefined;

      const onDemandFlag =
        typeof options.onDemand === 'boolean'
          ? options.onDemand
          : undefined;

      const requestPayload: Record<string, unknown> = {
        search: {
          search_type: 'lawsuit_cnj',
          search_key: processNumber,
        },
      };

      if (includeAttachments !== undefined) {
        requestPayload.with_attachments = includeAttachments;
      }

      if (onDemandFlag !== undefined) {
        requestPayload.on_demand = onDemandFlag;
      }

      const response = await this.requestWithRetry<JuditRequestResponse>(
        config,
        config.requestsEndpoint,
        {
          method: 'POST',
          body: JSON.stringify(requestPayload),
        },
      );

      const requestId = response.request_id;
      const status = response.status ?? 'pending';
      const result = response.result ?? null;

      const requestHeaders = this.buildHeaders(config);

      let processSync = await registerProcessRequest(
        {
          processoId,
          integrationApiKeyId: config.integrationId,
          remoteRequestId: requestId,
          requestType,
          requestedBy: options.actorUserId ?? null,
          requestPayload,
          requestHeaders,
          status,
          metadata: {
            source: options.source ?? 'system',
            result,
            trackingId: response.tracking_id ?? null,
            onDemand: onDemandFlag ?? false,
          },
        },
        client,
      );

      if (status !== 'pending') {
        const updated = await updateProcessSyncStatus(
          processSync.id,
          {
            completedAt: new Date(),
          },
          client,
        );
        if (updated) {
          processSync = updated;
        }
      }

      await registerSyncAudit(
        {
          processoId,
          processSyncId: processSync.id,
          integrationApiKeyId: processSync.integrationApiKeyId,
          eventType: 'request_triggered',
          eventDetails: {
            requestId,
            status,
            source: options.source ?? 'system',
            onDemand: onDemandFlag ?? false,
          },
        },
        client,
      );

      if (status === 'completed' && requestId) {
        processSync = await this.pollResponsesForRequest(
          config,
          requestId,
          processoId,
          processSync,
          client,
          options.source ?? 'system',
        );
      }

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

      return mapSyncToRequestRecord(processSync);
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
    const requestType = normalizeRequestType(options.source ?? 'system') ?? 'system';
    const normalizedStatus = normalizeStatus(status, 'pending');
    let resolvedConfig: JuditIntegrationConfiguration | null = null;

    try {
      if (manageTransaction) {
        await client.query('BEGIN');
      }

      let processSync = await findProcessSyncByRemoteId(requestId, client);

      if (!processSync) {
        processSync = await registerProcessRequest(
          {
            processoId,
            remoteRequestId: requestId,
            requestType,
            status: normalizedStatus,
            metadata: {
              source: options.source ?? 'system',
              result,
            },
          },
          client,
        );
      }

      const existingMetadata = asRecord(processSync.metadata);
      const updates: UpdateProcessSyncStatusInput = {
        status: normalizedStatus,
        metadata: {
          ...existingMetadata,
          source: options.source ?? existingMetadata.source ?? 'system',
          result,
          status: normalizedStatus,
        },
      };

      if (normalizedStatus !== 'pending') {
        updates.completedAt = new Date();
      }

      const updated = await updateProcessSyncStatus(processSync.id, updates, client);
      if (updated) {
        processSync = updated;
      }

      await registerSyncAudit(
        {
          processoId,
          processSyncId: processSync.id,
          integrationApiKeyId: processSync.integrationApiKeyId,
          eventType: 'status_update',
          eventDetails: {
            requestId,
            status: normalizedStatus,
            source: options.source ?? 'system',
          },
        },
        client,
      );

      if (normalizedStatus === 'completed' && requestId) {
        if (!resolvedConfig) {
          resolvedConfig = await this.resolveConfiguration({ client, markUsage: false });
        }

        if (resolvedConfig) {
          processSync = await this.pollResponsesForRequest(
            resolvedConfig,
            requestId,
            processoId,
            processSync,
            client,
            options.source ?? 'system',
          );
        }
      }

      if (manageTransaction) {
        await client.query('COMMIT');
      }

      return mapSyncToRequestRecord(processSync);
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
        WHERE ps.processo_id = $1 AND ps.remote_request_id = $2
        ORDER BY ps.requested_at DESC, ps.id DESC
        LIMIT 1`,
        [processoId, requestId]
      );

      if (result.rowCount === 0) {
        return null;
      }

      const row = mapProcessSyncRow(result.rows[0] as ProcessSyncRow);
      return mapSyncToRequestRecord(row);
    } finally {
      if (shouldRelease) {
        useClient.release();
      }
    }
  }
}

const juditProcessService = new JuditProcessService();

export default juditProcessService;
