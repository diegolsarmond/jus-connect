import { QueryResultRow } from 'pg';
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
