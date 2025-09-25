"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerProcessRequest = registerProcessRequest;
exports.updateProcessSyncStatus = updateProcessSyncStatus;
exports.registerProcessResponse = registerProcessResponse;
exports.registerSyncAudit = registerSyncAudit;
exports.listProcessSyncs = listProcessSyncs;
exports.listProcessResponses = listProcessResponses;
exports.listSyncAudits = listSyncAudits;
exports.findProcessByNumber = findProcessByNumber;
exports.findProcessSyncByRemoteId = findProcessSyncByRemoteId;
const db_1 = __importDefault(require("./db"));
const EMPTY_OBJECT = {};
function normalizeOptionalString(value) {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}
function normalizeNullableNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.trunc(value);
    }
    if (typeof value === 'string') {
        const parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}
function normalizeStatus(value, fallback) {
    const normalized = normalizeOptionalString(value);
    return normalized ?? fallback;
}
function normalizeRequestType(value) {
    const normalized = normalizeOptionalString(value);
    if (!normalized) {
        return null;
    }
    return normalized.toLowerCase();
}
function normalizeDateInput(value) {
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
function toJsonText(value, fallback) {
    if (value === undefined || value === null) {
        return fallback;
    }
    try {
        return JSON.stringify(value);
    }
    catch (error) {
        if (fallback !== undefined) {
            return fallback;
        }
        throw error;
    }
}
function parseJsonColumn(value, fallback) {
    if (value === null || value === undefined) {
        return fallback;
    }
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        }
        catch (error) {
            return fallback;
        }
    }
    if (typeof value === 'object') {
        return value;
    }
    return fallback;
}
function formatTimestamp(value) {
    if (value instanceof Date) {
        return value.toISOString();
    }
    return new Date(value).toISOString();
}
function formatNullableTimestamp(value) {
    if (!value) {
        return null;
    }
    return formatTimestamp(value);
}
function mapIntegration(row) {
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
function mapProcessSyncRow(row) {
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
function mapProcessResponseRow(row) {
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
function mapSyncAuditRow(row) {
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
async function registerProcessRequest(input, client = db_1.default) {
    const requestType = normalizeRequestType(input.requestType);
    const statusValue = normalizeStatus(input.status, 'pending');
    const result = await client.query(`INSERT INTO public.process_sync (
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
       updated_at`, [
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
    ]);
    return mapProcessSyncRow(result.rows[0]);
}
async function updateProcessSyncStatus(id, updates, client = db_1.default) {
    const assignments = [];
    const values = [];
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
    return mapProcessSyncRow(result.rows[0]);
}
async function registerProcessResponse(input, client = db_1.default) {
    const result = await client.query(`INSERT INTO public.process_response (
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
       created_at`, [
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
    ]);
    return mapProcessResponseRow(result.rows[0]);
}
async function registerSyncAudit(input, client = db_1.default) {
    const eventType = normalizeStatus(input.eventType, 'event');
    const result = await client.query(`INSERT INTO public.sync_audit (
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
       created_at`, [
        normalizeNullableNumber(input.processoId),
        normalizeNullableNumber(input.processSyncId),
        normalizeNullableNumber(input.processResponseId),
        normalizeNullableNumber(input.integrationApiKeyId),
        eventType,
        toJsonText(input.eventDetails, '{}'),
        normalizeDateInput(input.observedAt),
    ]);
    return mapSyncAuditRow(result.rows[0]);
}
async function listProcessSyncs(processoId, client = db_1.default) {
    const result = await client.query(`SELECT
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
     ORDER BY ps.requested_at DESC, ps.id DESC`, [processoId]);
    return result.rows.map((row) => mapProcessSyncRow(row));
}
async function listProcessResponses(processoId, client = db_1.default) {
    const result = await client.query(`SELECT
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
     ORDER BY pr.received_at DESC, pr.id DESC`, [processoId]);
    return result.rows.map((row) => mapProcessResponseRow(row));
}
async function listSyncAudits(processoId, client = db_1.default) {
    const result = await client.query(`SELECT
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
     ORDER BY sa.observed_at DESC, sa.id DESC`, [processoId]);
    return result.rows.map((row) => mapSyncAuditRow(row));
}
async function findProcessByNumber(processNumber, client = db_1.default) {
    const normalized = normalizeOptionalString(processNumber);
    if (!normalized) {
        return null;
    }
    const result = await client.query(`SELECT id FROM public.processos WHERE numero = $1 ORDER BY id ASC LIMIT 1`, [normalized]);
    if (result.rowCount === 0) {
        return null;
    }
    return { id: result.rows[0].id };
}
async function findProcessSyncByRemoteId(remoteRequestId, client = db_1.default) {
    const normalized = normalizeOptionalString(remoteRequestId);
    if (!normalized) {
        return null;
    }
    const result = await client.query(`SELECT
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
     LIMIT 1`, [normalized]);
    if (result.rowCount === 0) {
        return null;
    }
    return mapProcessSyncRow(result.rows[0]);
}
