import assert from 'node:assert/strict';
import test from 'node:test';
import {
  findProcessByNumber,
  findProcessSyncByRemoteId,
  listProcessSyncs,
  registerProcessRequest,
  registerProcessResponse,
  registerSyncAudit,
  type ProcessSyncRecord,
} from '../src/services/juditProcessService';

interface QueryCall {
  text: string;
  values?: unknown[];
}

interface QueryResponse {
  rows: any[];
  rowCount: number;
}

class FakePool {
  public readonly calls: QueryCall[] = [];

  constructor(private readonly responses: QueryResponse[] = []) {}

  async query(text: string, values?: unknown[]) {
    this.calls.push({ text, values });
    if (this.responses.length === 0) {
      throw new Error('No response configured for query');
    }
    return this.responses.shift()!;
  }
}

test('registerProcessRequest inserts payload and maps response', async () => {
  const insertedRow = {
    id: 101,
    processo_id: 55,
    integration_api_key_id: 7,
    remote_request_id: 'req-123',
    request_type: 'manual',
    requested_by: 9,
    requested_at: '2024-02-01T10:00:00.000Z',
    request_payload: { foo: 'bar' },
    request_headers: null,
    status: 'pending',
    status_reason: null,
    completed_at: null,
    metadata: { attempt: 1 },
    created_at: '2024-02-01T10:00:01.000Z',
    updated_at: '2024-02-01T10:00:01.000Z',
  };

  const pool = new FakePool([{ rows: [insertedRow], rowCount: 1 }]);

  const record = await registerProcessRequest(
    {
      processoId: 55,
      integrationApiKeyId: 7,
      remoteRequestId: 'req-123',
      requestType: 'Manual',
      requestedBy: 9,
      requestPayload: { foo: 'bar' },
      status: 'pending',
      metadata: { attempt: 1 },
    },
    pool as unknown as any,
  );

  assert.equal(pool.calls.length, 1);
  const call = pool.calls[0];
  assert.match(call.text, /INSERT INTO public\.process_sync/i);
  assert.deepEqual(call.values, [
    55,
    7,
    'req-123',
    'manual',
    9,
    null,
    JSON.stringify({ foo: 'bar' }),
    null,
    'pending',
    null,
    JSON.stringify({ attempt: 1 }),
  ]);

  assert.equal(record.id, 101);
  assert.equal(record.processoId, 55);
  assert.equal(record.integrationApiKeyId, 7);
  assert.equal(record.remoteRequestId, 'req-123');
  assert.equal(record.requestType, 'manual');
  assert.equal(record.status, 'pending');
  assert.deepEqual(record.requestPayload, { foo: 'bar' });
  assert.equal(record.statusReason, null);
});

test('registerProcessResponse stores webhook payload with defaults', async () => {
  const insertedRow = {
    id: 88,
    processo_id: 55,
    process_sync_id: 101,
    integration_api_key_id: 7,
    delivery_id: 'delivery-xyz',
    source: 'webhook',
    status_code: 200,
    received_at: '2024-02-01T10:01:00.000Z',
    payload: { success: true },
    headers: { 'x-header': 'value' },
    error_message: null,
    created_at: '2024-02-01T10:01:00.000Z',
  };

  const pool = new FakePool([{ rows: [insertedRow], rowCount: 1 }]);

  const record = await registerProcessResponse(
    {
      processoId: 55,
      processSyncId: 101,
      integrationApiKeyId: 7,
      deliveryId: 'delivery-xyz',
      statusCode: '200',
      payload: { success: true },
      headers: { 'x-header': 'value' },
    },
    pool as unknown as any,
  );

  assert.equal(pool.calls.length, 1);
  const call = pool.calls[0];
  assert.match(call.text, /INSERT INTO public\.process_response/i);
  assert.deepEqual(call.values, [
    55,
    101,
    7,
    'delivery-xyz',
    null,
    200,
    null,
    JSON.stringify({ success: true }),
    JSON.stringify({ 'x-header': 'value' }),
    null,
  ]);

  assert.equal(record.id, 88);
  assert.equal(record.processSyncId, 101);
  assert.deepEqual(record.payload, { success: true });
  assert.equal(record.statusCode, 200);
});

test('registerSyncAudit persists audit trail', async () => {
  const insertedRow = {
    id: 5,
    processo_id: 55,
    process_sync_id: 101,
    process_response_id: 88,
    integration_api_key_id: 7,
    event_type: 'webhook_received',
    event_details: { deliveryId: 'delivery-xyz' },
    observed_at: '2024-02-01T10:02:00.000Z',
    created_at: '2024-02-01T10:02:00.000Z',
  };

  const pool = new FakePool([{ rows: [insertedRow], rowCount: 1 }]);

  const record = await registerSyncAudit(
    {
      processoId: 55,
      processSyncId: 101,
      processResponseId: 88,
      integrationApiKeyId: 7,
      eventType: 'webhook_received',
      eventDetails: { deliveryId: 'delivery-xyz' },
    },
    pool as unknown as any,
  );

  assert.equal(pool.calls.length, 1);
  const call = pool.calls[0];
  assert.match(call.text, /INSERT INTO public\.sync_audit/i);
  assert.equal(call.values?.[0], 55);
  assert.equal(record.eventType, 'webhook_received');
  assert.deepEqual(record.eventDetails, { deliveryId: 'delivery-xyz' });
});

test('listProcessSyncs returns integration metadata when available', async () => {
  const row = {
    id: 101,
    processo_id: 55,
    integration_api_key_id: 7,
    remote_request_id: 'req-123',
    request_type: 'manual',
    requested_by: 9,
    requested_at: '2024-02-01T10:00:00.000Z',
    request_payload: { foo: 'bar' },
    request_headers: null,
    status: 'pending',
    status_reason: null,
    completed_at: null,
    metadata: { attempt: 1 },
    created_at: '2024-02-01T10:00:01.000Z',
    updated_at: '2024-02-01T10:00:01.000Z',
    provider: 'judit',
    environment: 'homologacao',
    url_api: 'https://judit.test',
    active: true,
  };

  const pool = new FakePool([{ rows: [row], rowCount: 1 }]);

  const records = await listProcessSyncs(55, pool as unknown as any);

  assert.equal(pool.calls.length, 1);
  const call = pool.calls[0];
  assert.match(call.text, /FROM public\.process_sync ps/i);
  assert.deepEqual(call.values, [55]);
  assert.equal(records.length, 1);
  const [record] = records;
  assert.equal(record.integration?.provider, 'judit');
  assert.equal(record.integration?.environment, 'homologacao');
});

test('findProcessByNumber returns null when not found', async () => {
  const pool = new FakePool([{ rows: [], rowCount: 0 }]);
  const result = await findProcessByNumber('0000000-00.0000.0.00.0000', pool as unknown as any);
  assert.equal(result, null);
});

test('findProcessSyncByRemoteId returns latest match', async () => {
  const latestRow = {
    id: 105,
    processo_id: 55,
    integration_api_key_id: 7,
    remote_request_id: 'req-123',
    request_type: 'manual',
    requested_by: 9,
    requested_at: '2024-02-01T10:00:00.000Z',
    request_payload: {},
    request_headers: null,
    status: 'pending',
    status_reason: null,
    completed_at: null,
    metadata: {},
    created_at: '2024-02-01T10:00:01.000Z',
    updated_at: '2024-02-01T10:00:01.000Z',
  } satisfies Partial<ProcessSyncRecord> as any;

  const pool = new FakePool([{ rows: [latestRow], rowCount: 1 }]);

  const result = await findProcessSyncByRemoteId('req-123', pool as unknown as any);
  assert.equal(pool.calls.length, 1);
  const call = pool.calls[0];
  assert.match(call.text, /WHERE ps\.remote_request_id = \$1/i);
  assert.equal(call.values?.[0], 'req-123');
  assert.equal(result?.id, 105);
});
