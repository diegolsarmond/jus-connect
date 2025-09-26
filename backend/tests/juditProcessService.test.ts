import assert from 'node:assert/strict';
import test from 'node:test';
import pool from '../src/services/db';
import { handleJuditWebhook } from '../src/controllers/juditWebhookController';
import * as juditProcessServiceModule from '../src/services/juditProcessService';

const {
  JuditProcessService,
  JuditApiError,
  findProcessByNumber,
  findProcessSyncByRemoteId,
  listProcessSyncs,
  listProcessResponses,
  listSyncAudits,
  registerProcessRequest,
  registerProcessResponse,
  registerSyncAudit,
} = juditProcessServiceModule;

type ProcessSyncRecord = juditProcessServiceModule.ProcessSyncRecord;

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

type QueryHandler = (text: string, values?: unknown[]) => QueryResponse | null;

class RecordingClient {
  public readonly calls: QueryCall[] = [];
  public releaseCalled = false;

  constructor(private readonly handler?: QueryHandler) {}

  async query(text: string, values?: unknown[]) {
    this.calls.push({ text, values });
    if (this.handler) {
      const response = this.handler(text, values);
      if (response) {
        return response;
      }
    }
    return { rows: [], rowCount: 1 } satisfies QueryResponse;
  }

  release() {
    this.releaseCalled = true;
  }
}

class MockResponse {
  public statusCode = 200;
  public jsonBody: unknown = null;

  status(code: number) {
    this.statusCode = code;
    return this;
  }

  json(body: unknown) {
    this.jsonBody = body;
    return this;
  }
}

test('loadConfigurationFromSources resolves endpoints for requests host base url', async () => {
  const pool = new FakePool([
    {
      rows: [
        {
          id: 55,
          key_value: 'db-key',
          url_api: 'https://requests.prod.judit.io',
        },
      ],
      rowCount: 1,
    },
  ]);

  const service = new JuditProcessService(null);

  const config = await (service as any).loadConfigurationFromSources(pool as unknown as any);

  assert.ok(config);
  assert.equal(config?.apiKey, 'db-key');
  assert.equal(config?.requestsEndpoint, 'https://requests.prod.judit.io/requests');
  assert.equal(config?.trackingEndpoint, 'https://tracking.prod.judit.io/tracking');
  assert.match(pool.calls[0]?.text ?? '', /global IS TRUE/);
});

test('loadConfigurationFromSources swaps host when base url points to tracking domain', async () => {
  const pool = new FakePool([
    {
      rows: [
        {
          id: 77,
          key_value: 'db-key',
          url_api: 'https://tracking.prod.judit.io/tracking',
        },
      ],
      rowCount: 1,
    },
  ]);

  const service = new JuditProcessService(null);

  const config = await (service as any).loadConfigurationFromSources(pool as unknown as any);

  assert.ok(config);
  assert.equal(config?.apiKey, 'db-key');
  assert.equal(config?.requestsEndpoint, 'https://requests.prod.judit.io/requests');
  assert.equal(config?.trackingEndpoint, 'https://tracking.prod.judit.io/tracking');
});

test('loadConfigurationFromSources preserves custom path segments when deriving endpoints', async () => {
  const pool = new FakePool([
    {
      rows: [
        {
          id: 88,
          key_value: 'db-key',
          url_api: 'https://tracking.prod.judit.io/api/v1/tracking',
        },
      ],
      rowCount: 1,
    },
  ]);

  const service = new JuditProcessService(null);

  const config = await (service as any).loadConfigurationFromSources(pool as unknown as any);

  assert.ok(config);
  assert.equal(config?.apiKey, 'db-key');
  assert.equal(config?.requestsEndpoint, 'https://requests.prod.judit.io/api/v1/requests');
  assert.equal(config?.trackingEndpoint, 'https://tracking.prod.judit.io/api/v1/tracking');
});

test('loadConfigurationFromSources honors base url provided via constructor when using env key', async () => {
  const service = new JuditProcessService('env-key', 'https://judit.test/api');

  const config = await (service as any).loadConfigurationFromSources();

  assert.ok(config);
  assert.equal(config?.apiKey, 'env-key');
  assert.equal(config?.requestsEndpoint, 'https://judit.test/api/requests');
  assert.equal(config?.trackingEndpoint, 'https://judit.test/api/tracking');
  assert.equal(config?.integrationId, null);
});

test('loadConfigurationFromSources uses fallback base url when database row omits url_api', async () => {
  const pool = new FakePool([
    {
      rows: [
        {
          id: 91,
          key_value: 'db-key',
          url_api: null,
        },
      ],
      rowCount: 1,
    },
  ]);

  const service = new JuditProcessService(null, 'https://judit.test');

  const config = await (service as any).loadConfigurationFromSources(pool as unknown as any);

  assert.ok(config);
  assert.equal(config?.apiKey, 'db-key');
  assert.equal(config?.requestsEndpoint, 'https://judit.test/requests');
  assert.equal(config?.trackingEndpoint, 'https://judit.test/tracking');
  assert.equal(config?.integrationId, 91);
});

test('loadConfigurationFromSources falls back to legacy credential when no global exists', async () => {
  const pool = new FakePool([
    { rows: [], rowCount: 0 },
    {
      rows: [
        {
          id: 101,
          key_value: 'legacy-key',
          url_api: null,
        },
      ],
      rowCount: 1,
    },
  ]);

  const warnMock = test.mock.method(console, 'warn');

  const service = new JuditProcessService(null, 'https://judit.test', { allowLegacyFallback: true });

  const config = await (service as any).loadConfigurationFromSources(pool as unknown as any);

  assert.ok(config);
  assert.equal(config?.apiKey, 'legacy-key');
  assert.equal(config?.requestsEndpoint, 'https://judit.test/requests');
  assert.equal(config?.trackingEndpoint, 'https://judit.test/tracking');
  assert.equal(pool.calls.length, 2);
  assert.match(pool.calls[0]?.text ?? '', /global IS TRUE/);
  assert.match(pool.calls[1]?.text ?? '', /FROM public\.integration_api_keys/);
  assert.ok(
    warnMock.mock.calls.some((call) =>
      String(call.arguments[0]).includes('Nenhuma credencial global encontrada'),
    ),
  );

  warnMock.mock.restore();
});

test('loadConfigurationFromSources does not fallback when disabled', async () => {
  const pool = new FakePool([
    {
      rows: [],
      rowCount: 0,
    },
  ]);

  const warnMock = test.mock.method(console, 'warn');

  const service = new JuditProcessService(null, 'https://judit.test', { allowLegacyFallback: false });

  const config = await (service as any).loadConfigurationFromSources(pool as unknown as any);

  assert.equal(config, null);
  assert.equal(pool.calls.length, 1);
  assert.match(pool.calls[0]?.text ?? '', /global IS TRUE/);
  assert.ok(
    warnMock.mock.calls.some((call) =>
      String(call.arguments[0]).includes('Nenhuma credencial global encontrada'),
    ),
  );

  warnMock.mock.restore();
});

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

test('ensureTrackingForProcess creates tracking via Judit API', async (t) => {
  const insertedRow = {
    id: 301,
    processo_id: 42,
    integration_api_key_id: null,
    remote_request_id: 'trk-123',
    request_type: 'system',
    requested_by: null,
    requested_at: new Date('2024-02-01T10:00:00.000Z'),
    request_payload: { action: 'create-tracking', process_number: '0000000-00.0000.0.00.0000' },
    request_headers: null,
    status: 'completed',
    status_reason: null,
    completed_at: null,
    metadata: { source: 'ensure_tracking', remoteStatus: 'active', trackingId: 'trk-123', hourRange: '08-12' },
    created_at: new Date('2024-02-01T10:00:01.000Z'),
    updated_at: new Date('2024-02-01T10:00:01.000Z'),
  } satisfies Record<string, unknown>;

  const updatedRow = {
    ...insertedRow,
    completed_at: new Date('2024-02-01T10:00:02.000Z'),
    updated_at: new Date('2024-02-01T10:00:02.000Z'),
  } satisfies Record<string, unknown>;

  const auditRow = {
    id: 11,
    processo_id: 42,
    process_sync_id: 301,
    process_response_id: null,
    integration_api_key_id: null,
    event_type: 'tracking_synced',
    event_details: { trackingId: 'trk-123' },
    observed_at: new Date('2024-02-01T10:00:03.000Z'),
    created_at: new Date('2024-02-01T10:00:03.000Z'),
  } satisfies Record<string, unknown>;

  const pool = new FakePool([
    { rows: [], rowCount: 1 },
    { rows: [insertedRow], rowCount: 1 },
    { rows: [updatedRow], rowCount: 1 },
    { rows: [auditRow], rowCount: 1 },
  ]);

  const service = new JuditProcessService('test-key');

  const fetchMock = t.mock.method(globalThis as any, 'fetch', async (input: any, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : String(input);
    assert.equal(url, 'https://tracking.prod.judit.io/tracking');
    assert.equal(init?.method, 'POST');
    const body = JSON.parse((init?.body ?? '{}') as string);
    assert.deepStrictEqual(body.search, {
      search_type: 'lawsuit_cnj',
      search_key: '0000000-00.0000.0.00.0000',
    });
    assert.equal(body.recurrence, 1);

    return new Response(JSON.stringify({
      tracking_id: 'trk-123',
      hour_range: '08-12',
      status: 'active',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  const tracking = await service.ensureTrackingForProcess(42, '0000000-00.0000.0.00.0000', {
    client: pool as unknown as any,
  });

  assert.equal(fetchMock.mock.calls.length, 1);
  assert.ok(tracking);
  assert.equal(tracking?.tracking_id, 'trk-123');
  assert.equal(tracking?.status, 'active');

  assert.equal(pool.calls.length, 4);
  assert.match(pool.calls[0].text, /UPDATE public\.processos/i);
  assert.match(pool.calls[1].text, /INSERT INTO public\.process_sync/i);
  assert.match(pool.calls[2].text, /UPDATE public\.process_sync/i);
  assert.match(pool.calls[3].text, /INSERT INTO public\.sync_audit/i);
});

test('Judit request lifecycle polls completed responses and stores them', async (t) => {
  const service = new JuditProcessService('test-key');

  let storedSyncRow: Record<string, unknown> | null = null;
  const polledResponses: unknown[] = [];
  const auditEvents: Array<{ type: string; details: unknown }> = [];

  const requestHandler: QueryHandler = (text, values) => {
    if (/FROM public\.process_sync ps/.test(text) && /status = 'pending'/.test(text)) {
      return { rows: [], rowCount: 0 } satisfies QueryResponse;
    }
    if (/FROM public\.process_sync ps/.test(text) && /remote_request_id/.test(text)) {
      if (storedSyncRow) {
        return { rows: [storedSyncRow], rowCount: 1 } satisfies QueryResponse;
      }
      return { rows: [], rowCount: 0 } satisfies QueryResponse;
    }
    if (/INSERT INTO public\.process_sync/.test(text)) {
      storedSyncRow = {
        id: 777,
        processo_id: values?.[0],
        integration_api_key_id: values?.[1],
        remote_request_id: values?.[2],
        request_type: values?.[3],
        requested_by: values?.[4],
        requested_at: new Date('2024-01-01T10:00:00.000Z'),
        request_payload: JSON.parse((values?.[6] ?? '{}') as string),
        request_headers: values?.[7] ? JSON.parse(values?.[7] as string) : null,
        status: values?.[8],
        status_reason: values?.[9] ?? null,
        completed_at: null,
        metadata: JSON.parse((values?.[10] ?? '{}') as string),
        created_at: new Date('2024-01-01T10:00:01.000Z'),
        updated_at: new Date('2024-01-01T10:00:01.000Z'),
      } satisfies Record<string, unknown>;

      return { rows: [storedSyncRow], rowCount: 1 } satisfies QueryResponse;
    }
    if (/INSERT INTO public\.sync_audit/.test(text)) {
      const eventType = typeof values?.[4] === 'string' ? (values?.[4] as string) : '';
      const eventDetails = values?.[5] ? JSON.parse(String(values?.[5])) : {};
      auditEvents.push({ type: eventType, details: eventDetails });

      return {
        rows: [
          {
            id: 990,
            processo_id: values?.[0],
            process_sync_id: values?.[1],
            process_response_id: values?.[2],
            integration_api_key_id: values?.[3],
            event_type: eventType,
            event_details: eventDetails,
            observed_at: new Date('2024-01-01T10:00:02.000Z'),
            created_at: new Date('2024-01-01T10:00:02.000Z'),
          },
        ],
        rowCount: 1,
      } satisfies QueryResponse;
    }
    if (/UPDATE public\.process_sync/.test(text)) {
      const hasStatus = /status = \$\d+/.test(text);
      const hasStatusReason = /status_reason = \$\d+/.test(text);
      const hasCompletedAt = /completed_at = \$\d+::timestamptz/.test(text);
      const hasMetadata = /metadata = \$\d+::jsonb/.test(text);

      let index = 0;
      const nextStatus = hasStatus
        ? (typeof values?.[index] === 'string' ? (values?.[index++] as string) : storedSyncRow?.status ?? 'pending')
        : storedSyncRow?.status ?? 'pending';

      if (hasStatusReason) {
        index += 1;
      }

      let nextCompletedAt = storedSyncRow?.completed_at ?? null;
      if (hasCompletedAt) {
        const completedValue = values?.[index++];
        if (completedValue instanceof Date) {
          nextCompletedAt = completedValue;
        } else if (completedValue) {
          nextCompletedAt = new Date(String(completedValue));
        } else {
          nextCompletedAt = null;
        }
      }

      let nextMetadata = storedSyncRow?.metadata ?? {};
      if (hasMetadata) {
        const metadataValue = values?.[index++];
        if (typeof metadataValue === 'string') {
          nextMetadata = JSON.parse(metadataValue);
        } else if (metadataValue && typeof metadataValue === 'object') {
          nextMetadata = metadataValue;
        }
      }

      storedSyncRow = {
        ...(storedSyncRow ?? {}),
        id: 777,
        processo_id: 55,
        integration_api_key_id: 15,
        remote_request_id: 'req-flow',
        request_type: 'manual',
        requested_by: null,
        requested_at: new Date('2024-01-01T10:00:00.000Z'),
        request_payload: storedSyncRow?.request_payload ?? {},
        request_headers: null,
        status: nextStatus,
        status_reason: null,
        completed_at: nextCompletedAt ?? storedSyncRow?.completed_at ?? new Date('2024-01-01T10:05:00.000Z'),
        metadata: nextMetadata,
        created_at: new Date('2024-01-01T10:00:01.000Z'),
        updated_at: new Date('2024-01-01T10:05:00.000Z'),
      } satisfies Record<string, unknown>;

      return { rows: [storedSyncRow], rowCount: 1 } satisfies QueryResponse;
    }
    if (/INSERT INTO public\.process_response/.test(text)) {
      const payloadValue = values?.[7];
      const payload = typeof payloadValue === 'string' ? JSON.parse(payloadValue) : payloadValue ?? {};
      const headersValue = values?.[8];
      const headers = typeof headersValue === 'string' ? JSON.parse(headersValue) : headersValue ?? null;
      polledResponses.push(payload);

      return {
        rows: [
          {
            id: 301 + polledResponses.length,
            processo_id: values?.[0],
            process_sync_id: values?.[1],
            integration_api_key_id: values?.[2],
            delivery_id: values?.[3],
            source: values?.[4] ?? 'polling',
            status_code: values?.[5] ?? 200,
            received_at: '2024-01-01T10:10:00.000Z',
            payload,
            headers,
            error_message: values?.[9] ?? null,
            created_at: '2024-01-01T10:10:00.000Z',
          },
        ],
        rowCount: 1,
      } satisfies QueryResponse;
    }
    return null;
  };

  const requestClient = new RecordingClient(requestHandler);

  const fetchMock = t.mock.method(globalThis as any, 'fetch', async (input: any, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : String(input);

    if (url === 'https://requests.prod.judit.io/requests') {
      assert.equal(init?.method, 'POST');
      assert.equal(typeof init?.body, 'string');
      const payload = JSON.parse(init?.body as string);
      assert.deepEqual(payload, {
        search: {
          search_type: 'lawsuit_cnj',
          search_key: '0000000-00.0000.0.00.0000',
        },
        with_attachments: true,
        on_demand: true,
      });
      return new Response(JSON.stringify({
        request_id: 'req-flow',
        status: 'pending',
        result: null,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url === 'https://requests.prod.judit.io/requests/req-flow') {
      return new Response(JSON.stringify({
        request_id: 'req-flow',
        status: 'completed',
        result: { delivered: true },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.startsWith('https://requests.prod.judit.io/responses')) {
      const responseUrl = new URL(url);
      assert.equal(responseUrl.searchParams.get('request_id'), 'req-flow');
      assert.equal(responseUrl.searchParams.get('page'), '1');
      assert.equal(responseUrl.searchParams.get('page_size'), '50');

      return new Response(
        JSON.stringify({
          request_status: 'completed',
          page: 1,
          page_count: 1,
          all_pages_count: 1,
          all_count: 1,
          page_data: [
            {
              request_id: 'req-flow',
              response_id: 'resp-001',
              origin: 'api',
              response_type: 'lawsuit',
              response_data: { delivered: true, fromPolling: true },
              created_at: '2024-01-01T10:06:00.000Z',
              updated_at: '2024-01-01T10:06:00.000Z',
            },
          ],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    throw new Error(`Unexpected fetch call to ${url}`);
  });

  let statusResponse: juditProcessServiceModule.JuditRequestResponse;

  try {
    const triggerRecord = await service.triggerRequestForProcess(55, '0000000-00.0000.0.00.0000', {
      source: 'manual',
      client: requestClient as unknown as any,
      withAttachments: true,
      onDemand: true,
    });

    assert.ok(triggerRecord);
    assert.equal(triggerRecord?.requestId, 'req-flow');
    assert.equal(triggerRecord?.status, 'pending');
    assert.equal(triggerRecord?.processSyncId, 777);
    assert.equal((triggerRecord?.metadata as any).onDemand, true);
    assert.ok(requestClient.calls.some((call) => /INSERT INTO public\.process_sync/i.test(call.text)));

    statusResponse = await service.getRequestStatusFromApi('req-flow');
    assert.equal(statusResponse.status, 'completed');

    const updatedRecord = await service.updateRequestStatus(
      55,
      'req-flow',
      statusResponse.status ?? 'pending',
      statusResponse.result ?? null,
      { client: requestClient as unknown as any },
    );

    assert.ok(updatedRecord);
    assert.equal(updatedRecord?.status, 'completed');
    assert.deepEqual(updatedRecord?.metadata.result, polledResponses[0]);
    assert.ok(requestClient.calls.some((call) => /UPDATE public\.process_sync/i.test(call.text)));
  } finally {
    fetchMock.mock.restore();
  }

  assert.equal(polledResponses.length, 1);
  assert.deepEqual(polledResponses[0], { delivered: true, fromPolling: true });
  assert.ok(storedSyncRow);
  assert.deepEqual(((storedSyncRow?.metadata ?? {}) as any).responses, polledResponses);
  assert.ok(
    auditEvents.some(
      (event) => event.type === 'responses_polled' && (event.details as any).storedCount === 1,
    ),
  );

  const responseHandler: QueryHandler = (text, values) => {
    if (/INSERT INTO public\.process_response/.test(text)) {
      const payload = JSON.parse((values?.[7] ?? '{}') as string);
      const headers = values?.[8] ? JSON.parse(values?.[8] as string) : null;
      return {
        rows: [
          {
            id: 401,
            processo_id: values?.[0],
            process_sync_id: values?.[1],
            integration_api_key_id: values?.[2],
            delivery_id: values?.[3],
            source: values?.[4] ?? 'webhook',
            status_code: values?.[5],
            received_at: '2024-01-01T10:10:00.000Z',
            payload,
            headers,
            error_message: values?.[9] ?? null,
            created_at: '2024-01-01T10:10:00.000Z',
          },
        ],
        rowCount: 1,
      } satisfies QueryResponse;
    }
    return null;
  };

  const responseClient = new RecordingClient(responseHandler);

  const responseRecord = await registerProcessResponse(
    {
      processoId: 55,
      processSyncId: 777,
      integrationApiKeyId: 15,
      deliveryId: 'delivery-1',
      source: 'polling',
      statusCode: 200,
      payload: statusResponse.result,
      headers: { 'x-source': 'judit' },
    },
    responseClient as unknown as any,
  );

  assert.equal(responseClient.calls.length, 1);
  assert.match(responseClient.calls[0].text, /INSERT INTO public\.process_response/i);
  assert.equal(responseClient.calls[0].values?.[0], 55);
  assert.equal(responseRecord.statusCode, 200);
  assert.equal(responseRecord.source, 'polling');
  assert.deepEqual(responseRecord.payload, { delivered: true });
  assert.deepEqual(responseRecord.headers, { 'x-source': 'judit' });

  assert.equal(polledResponses.length, 1);
});

test('triggerRequestForProcess persists immediate responses when request completes', async (t) => {
  const service = new JuditProcessService('test-key');

  let storedSyncRow: Record<string, unknown> | null = null;
  const polledResponses: unknown[] = [];
  const auditEvents: Array<{ type: string; details: unknown }> = [];

  const requestHandler: QueryHandler = (text, values) => {
    if (/FROM public\.process_sync ps/.test(text) && /status = 'pending'/.test(text)) {
      return { rows: [], rowCount: 0 } satisfies QueryResponse;
    }
    if (/FROM public\.process_sync ps/.test(text) && /remote_request_id/.test(text)) {
      if (storedSyncRow) {
        return { rows: [storedSyncRow], rowCount: 1 } satisfies QueryResponse;
      }
      return { rows: [], rowCount: 0 } satisfies QueryResponse;
    }
    if (/INSERT INTO public\.process_sync/.test(text)) {
      storedSyncRow = {
        id: 881,
        processo_id: values?.[0],
        integration_api_key_id: values?.[1],
        remote_request_id: values?.[2],
        request_type: values?.[3],
        requested_by: values?.[4],
        requested_at: new Date('2024-02-01T08:00:00.000Z'),
        request_payload: JSON.parse((values?.[6] ?? '{}') as string),
        request_headers: values?.[7] ? JSON.parse(values?.[7] as string) : null,
        status: values?.[8],
        status_reason: values?.[9] ?? null,
        completed_at: null,
        metadata: JSON.parse((values?.[10] ?? '{}') as string),
        created_at: new Date('2024-02-01T08:00:01.000Z'),
        updated_at: new Date('2024-02-01T08:00:01.000Z'),
      } satisfies Record<string, unknown>;

      return { rows: [storedSyncRow], rowCount: 1 } satisfies QueryResponse;
    }
    if (/INSERT INTO public\.sync_audit/.test(text)) {
      const eventType = typeof values?.[4] === 'string' ? (values?.[4] as string) : '';
      const eventDetails = values?.[5] ? JSON.parse(String(values?.[5])) : {};
      auditEvents.push({ type: eventType, details: eventDetails });

      return {
        rows: [
          {
            id: 1001,
            processo_id: values?.[0],
            process_sync_id: values?.[1],
            process_response_id: values?.[2],
            integration_api_key_id: values?.[3],
            event_type: eventType,
            event_details: eventDetails,
            observed_at: new Date('2024-02-01T08:00:02.000Z'),
            created_at: new Date('2024-02-01T08:00:02.000Z'),
          },
        ],
        rowCount: 1,
      } satisfies QueryResponse;
    }
    if (/UPDATE public\.process_sync/.test(text)) {
      const hasStatus = /status = \$\d+/.test(text);
      const hasStatusReason = /status_reason = \$\d+/.test(text);
      const hasCompletedAt = /completed_at = \$\d+::timestamptz/.test(text);
      const hasMetadata = /metadata = \$\d+::jsonb/.test(text);

      let index = 0;
      const nextStatus = hasStatus
        ? (typeof values?.[index] === 'string' ? (values?.[index++] as string) : storedSyncRow?.status ?? 'pending')
        : storedSyncRow?.status ?? 'pending';

      if (hasStatusReason) {
        index += 1;
      }

      let nextCompletedAt = storedSyncRow?.completed_at ?? null;
      if (hasCompletedAt) {
        const completedValue = values?.[index++];
        if (completedValue instanceof Date) {
          nextCompletedAt = completedValue;
        } else if (completedValue) {
          nextCompletedAt = new Date(String(completedValue));
        } else {
          nextCompletedAt = null;
        }
      }

      let nextMetadata = storedSyncRow?.metadata ?? {};
      if (hasMetadata) {
        const metadataValue = values?.[index++];
        if (typeof metadataValue === 'string') {
          nextMetadata = JSON.parse(metadataValue);
        } else if (metadataValue && typeof metadataValue === 'object') {
          nextMetadata = metadataValue;
        }
      }

      storedSyncRow = {
        ...(storedSyncRow ?? {}),
        id: 881,
        processo_id: 77,
        integration_api_key_id: 25,
        remote_request_id: 'immediate-req',
        request_type: 'manual',
        requested_by: null,
        requested_at: new Date('2024-02-01T08:00:00.000Z'),
        request_payload: storedSyncRow?.request_payload ?? {},
        request_headers: null,
        status: nextStatus,
        status_reason: null,
        completed_at: nextCompletedAt ?? storedSyncRow?.completed_at ?? new Date('2024-02-01T08:00:05.000Z'),
        metadata: nextMetadata,
        created_at: new Date('2024-02-01T08:00:01.000Z'),
        updated_at: new Date('2024-02-01T08:00:05.000Z'),
      } satisfies Record<string, unknown>;

      return { rows: [storedSyncRow], rowCount: 1 } satisfies QueryResponse;
    }
    if (/INSERT INTO public\.process_response/.test(text)) {
      const payloadValue = values?.[7];
      const payload = typeof payloadValue === 'string' ? JSON.parse(payloadValue) : payloadValue ?? {};
      const headersValue = values?.[8];
      const headers = typeof headersValue === 'string' ? JSON.parse(headersValue) : headersValue ?? null;
      polledResponses.push(payload);

      return {
        rows: [
          {
            id: 511 + polledResponses.length,
            processo_id: values?.[0],
            process_sync_id: values?.[1],
            integration_api_key_id: values?.[2],
            delivery_id: values?.[3],
            source: values?.[4] ?? 'polling',
            status_code: values?.[5] ?? 200,
            received_at: '2024-02-01T08:00:06.000Z',
            payload,
            headers,
            error_message: values?.[9] ?? null,
            created_at: '2024-02-01T08:00:06.000Z',
          },
        ],
        rowCount: 1,
      } satisfies QueryResponse;
    }
    return null;
  };

  const requestClient = new RecordingClient(requestHandler);

  const fetchMock = t.mock.method(globalThis as any, 'fetch', async (input: any, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : String(input);

    if (url === 'https://requests.prod.judit.io/requests') {
      assert.equal(init?.method, 'POST');
      return new Response(JSON.stringify({
        request_id: 'immediate-req',
        status: 'completed',
        result: { immediate: true },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.startsWith('https://requests.prod.judit.io/responses')) {
      const responseUrl = new URL(url);
      assert.equal(responseUrl.searchParams.get('request_id'), 'immediate-req');

      return new Response(
        JSON.stringify({
          request_status: 'completed',
          page: 1,
          page_count: 1,
          all_pages_count: 1,
          all_count: 1,
          page_data: [
            {
              request_id: 'immediate-req',
              response_id: 'resp-immediate',
              origin: 'api',
              response_type: 'lawsuit',
              response_data: { immediate: true, fromPolling: true },
              created_at: '2024-02-01T08:00:04.000Z',
              updated_at: '2024-02-01T08:00:04.000Z',
            },
          ],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    throw new Error(`Unexpected fetch call to ${url}`);
  });

  try {
    const triggerRecord = await service.triggerRequestForProcess(77, '1111111-11.1111.1.11.1111', {
      source: 'manual',
      client: requestClient as unknown as any,
      withAttachments: false,
      onDemand: false,
    });

    assert.ok(triggerRecord);
    assert.equal(triggerRecord?.status, 'completed');
    assert.equal(triggerRecord?.processSyncId, 881);
    assert.deepEqual(triggerRecord?.metadata.result, { immediate: true, fromPolling: true });
    assert.deepEqual((triggerRecord?.metadata as any).responses, [{ immediate: true, fromPolling: true }]);
  } finally {
    fetchMock.mock.restore();
  }

  assert.equal(polledResponses.length, 1);
  assert.deepEqual(polledResponses[0], { immediate: true, fromPolling: true });
  assert.ok(
    auditEvents.some(
      (event) => event.type === 'responses_polled' && (event.details as any).requestId === 'immediate-req',
    ),
  );
});

test('triggerRequestForProcess forwards attachment preference to Judit', async (t) => {
  const service = new JuditProcessService('test-key');

  const config = {
    apiKey: 'test-key',
    requestsEndpoint: 'https://requests.prod.judit.io/requests',
    trackingEndpoint: 'https://tracking.prod.judit.io/tracking',
    integrationId: 15,
  };

  const resolveMock = t.mock.method(service as any, 'resolveConfiguration', async () => config);

  const requestHandler: QueryHandler = (text, values) => {
    if (/INSERT INTO public\.process_sync/.test(text)) {
      const payload = values?.[6] ? JSON.parse(String(values?.[6])) : {};
      const headers = values?.[7] ? JSON.parse(String(values?.[7])) : null;
      const metadata = values?.[10] ? JSON.parse(String(values?.[10])) : {};

      return {
        rows: [
          {
            id: 701,
            processo_id: values?.[0],
            integration_api_key_id: values?.[1],
            remote_request_id: values?.[2],
            request_type: values?.[3] ?? 'manual',
            requested_by: values?.[4] ?? null,
            requested_at: new Date('2024-01-01T10:00:00.000Z'),
            request_payload: payload,
            request_headers: headers,
            status: values?.[8] ?? 'pending',
            status_reason: values?.[9] ?? null,
            completed_at: null,
            metadata,
            created_at: new Date('2024-01-01T10:00:01.000Z'),
            updated_at: new Date('2024-01-01T10:00:01.000Z'),
          },
        ],
        rowCount: 1,
      } satisfies QueryResponse;
    }

    if (/INSERT INTO public\.sync_audit/.test(text)) {
      const eventDetails = values?.[5] ? JSON.parse(String(values?.[5])) : {};
      return {
        rows: [
          {
            id: 801,
            processo_id: values?.[0] ?? null,
            process_sync_id: values?.[1] ?? null,
            process_response_id: values?.[2] ?? null,
            integration_api_key_id: values?.[3] ?? null,
            event_type: values?.[4] ?? 'request_triggered',
            event_details: eventDetails,
            observed_at: new Date('2024-01-01T10:00:02.000Z'),
            created_at: new Date('2024-01-01T10:00:02.000Z'),
          },
        ],
        rowCount: 1,
      } satisfies QueryResponse;
    }

    return null;
  };

  const requestClient = new RecordingClient(requestHandler);

  let requestCalls = 0;

  const fetchMock = t.mock.method(globalThis as any, 'fetch', async (input: any, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : String(input);

    if (url === config.requestsEndpoint) {
      requestCalls += 1;
      const payload = JSON.parse(String(init?.body ?? '{}'));

      if (requestCalls === 1) {
        assert.deepEqual(payload, {
          search: {
            search_type: 'lawsuit_cnj',
            search_key: '0000000-00.0000.0.00.0000',
          },
        });
      } else if (requestCalls === 2) {
        assert.equal(payload.with_attachments, false);
        assert.equal(payload.on_demand, false);
      } else {
        assert.fail(`Unexpected number of request calls: ${requestCalls}`);
      }

      return new Response(
        JSON.stringify({
          request_id: `req-${requestCalls}`,
          status: 'pending',
          result: null,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    throw new Error(`Unexpected fetch call to ${url}`);
  });

  try {
    const defaultRecord = await service.triggerRequestForProcess(55, '0000000-00.0000.0.00.0000', {
      source: 'manual',
      client: requestClient as unknown as any,
    });

    assert.equal(defaultRecord?.requestId, 'req-1');
    assert.equal(defaultRecord?.status, 'pending');
    assert.equal((defaultRecord?.metadata as any).onDemand, false);

    const withoutAttachments = await service.triggerRequestForProcess(56, '1111111-11.1111.1.11.1111', {
      source: 'manual',
      client: requestClient as unknown as any,
      withAttachments: false,
      onDemand: false,
    });

    assert.equal(withoutAttachments?.requestId, 'req-2');
    assert.equal(withoutAttachments?.status, 'pending');
    assert.equal((withoutAttachments?.metadata as any).onDemand, false);
    assert.equal(requestCalls, 2);
  } finally {
    fetchMock.mock.restore();
    resolveMock.mock.restore();
  }
});

test('triggerRequestForProcess returns existing pending manual request when skipIfPending is true', async (t) => {
  const service = new JuditProcessService('test-key');

  const resolveMock = t.mock.method(
    service as any,
    'resolveConfiguration',
    async () => {
      throw new Error('resolveConfiguration should not be called when pending request exists');
    }
  );

  const pendingRow = {
    id: 901,
    processo_id: 101,
    integration_api_key_id: 33,
    remote_request_id: 'existing-req',
    request_type: 'manual',
    requested_by: 88,
    requested_at: '2024-01-01T10:00:00.000Z',
    request_payload: { foo: 'bar' },
    request_headers: { Authorization: 'Bearer token' },
    status: 'pending',
    status_reason: null,
    completed_at: null,
    metadata: { result: { alreadyPending: true }, source: 'manual' },
    created_at: '2024-01-01T10:00:01.000Z',
    updated_at: '2024-01-01T10:00:02.000Z',
    provider: 'judit',
    environment: 'sandbox',
    url_api: 'https://example.test',
    active: true,
  } satisfies Record<string, unknown>;

  const client = new RecordingClient((text, values) => {
    if (/FROM public\.process_sync/.test(text)) {
      return {
        rows: [pendingRow],
        rowCount: 1,
      } satisfies QueryResponse;
    }

    throw new Error(`Unexpected query: ${text}`);
  });

  const record = await service.triggerRequestForProcess(101, '0000000-00.0000.0.00.0000', {
    source: 'manual',
    actorUserId: 88,
    skipIfPending: true,
    client: client as unknown as any,
  });

  assert.ok(record);
  assert.equal(record?.processSyncId, pendingRow.id);
  assert.equal(record?.requestId, 'existing-req');
  assert.equal(record?.status, 'pending');
  assert.equal(record?.source, 'manual');
  assert.deepEqual(record?.result, { alreadyPending: true });
  assert.equal(client.calls.length, 1);
  assert.match(client.calls[0].text, /FROM public\.process_sync/i);
  assert.equal(client.calls[0].values?.[0], 101);
  assert.equal(client.calls[0].values?.[1], 'manual');
  assert.equal(resolveMock.mock.calls.length, 0);
});

test('handleJuditWebhook persists data retrievable via list helpers', async (t) => {
  const processSyncRow = {
    id: 501,
    processo_id: 77,
    integration_api_key_id: 12,
    remote_request_id: 'req-judit',
    request_type: 'manual',
    requested_by: null,
    requested_at: new Date('2024-01-01T10:00:00.000Z'),
    request_payload: {},
    request_headers: null,
    status: 'pending',
    status_reason: null,
    completed_at: null,
    metadata: {},
    created_at: new Date('2024-01-01T10:00:00.000Z'),
    updated_at: new Date('2024-01-01T10:00:00.000Z'),
    provider: 'judit',
    environment: 'homologacao',
    url_api: 'https://judit.test',
    active: true,
  } satisfies Record<string, unknown>;

  const processSyncRows = [processSyncRow];
  const processResponseRows: Record<string, unknown>[] = [];
  const auditRows: Record<string, unknown>[] = [];

  const handler: QueryHandler = (text, values) => {
    if (/FROM public\.processos WHERE numero/.test(text)) {
      return { rows: [{ id: 77 }], rowCount: 1 } satisfies QueryResponse;
    }
    if (/UPDATE public\.processos/.test(text)) {
      return { rows: [], rowCount: 1 } satisfies QueryResponse;
    }
    if (/FROM public\.process_sync ps/.test(text) && /remote_request_id/.test(text)) {
      return { rows: [processSyncRow], rowCount: 1 } satisfies QueryResponse;
    }
    if (/UPDATE public\.process_sync/.test(text)) {
      const statusValue = typeof values?.[0] === 'string' ? (values?.[0] as string) : 'completed';
      const completedAtValue = values && values.length > 2 ? values[1] : null;
      const metadataJson =
        values && values.length > 2 && typeof values[2] === 'string'
          ? (values[2] as string)
          : '{}';

      processSyncRow.status = statusValue;
      processSyncRow.completed_at =
        completedAtValue instanceof Date
          ? completedAtValue
          : completedAtValue
            ? new Date(String(completedAtValue))
            : new Date('2024-01-01T10:05:00.000Z');
      processSyncRow.metadata = JSON.parse(metadataJson);
      processSyncRow.updated_at = new Date('2024-01-01T10:05:00.000Z');
      return { rows: [processSyncRow], rowCount: 1 } satisfies QueryResponse;
    }
    if (/INSERT INTO public\.process_response/.test(text)) {
      const row = {
        id: processResponseRows.length + 1,
        processo_id: values?.[0],
        process_sync_id: values?.[1],
        integration_api_key_id: values?.[2],
        delivery_id: values?.[3],
        source: values?.[4] ?? 'webhook',
        status_code: values?.[5] ?? null,
        received_at: new Date('2024-01-01T10:10:00.000Z'),
        payload: JSON.parse((values?.[7] ?? '{}') as string),
        headers: values?.[8] ? JSON.parse(values?.[8] as string) : null,
        error_message: values?.[9] ?? null,
        created_at: new Date('2024-01-01T10:10:00.000Z'),
        provider: 'judit',
        environment: 'homologacao',
        url_api: 'https://judit.test',
        active: true,
      } satisfies Record<string, unknown>;
      processResponseRows.push(row);
      return { rows: [row], rowCount: 1 } satisfies QueryResponse;
    }
    if (/INSERT INTO public\.sync_audit/.test(text)) {
      const row = {
        id: auditRows.length + 1,
        processo_id: values?.[0],
        process_sync_id: values?.[1],
        process_response_id: values?.[2],
        integration_api_key_id: values?.[3],
        event_type: values?.[4],
        event_details: JSON.parse((values?.[5] ?? '{}') as string),
        observed_at: new Date('2024-01-01T10:15:00.000Z'),
        created_at: new Date('2024-01-01T10:15:00.000Z'),
        provider: 'judit',
        environment: 'homologacao',
        url_api: 'https://judit.test',
        active: true,
      } satisfies Record<string, unknown>;
      auditRows.push(row);
      return { rows: [row], rowCount: 1 } satisfies QueryResponse;
    }
    return null;
  };

  const client = new RecordingClient(handler);
  const connectMock = t.mock.method(pool, 'connect', async () => client as unknown as any);

  const req = {
    body: {
      process_number: '0000000-00.0000.0.00.0000',
      tracking_id: 'trk-judit',
      hour_range: '12-16',
      status: 'updated',
      request: {
        id: 'req-judit',
        status: 'completed',
        result: { delivered: true },
      },
      increments: [{ type: 'movement', payload: { id: 1 } }],
    },
    headers: { 'x-judit': 'webhook' },
  } as any;

  const res = new MockResponse();
  await handleJuditWebhook(req, res as any);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.jsonBody, { status: 'ok' });
  assert.equal(connectMock.mock.calls.length, 1);
  assert.ok(client.releaseCalled);

  const reader = {
    async query(text: string) {
      if (/FROM public\.process_sync/.test(text)) {
        return { rows: processSyncRows, rowCount: processSyncRows.length } satisfies QueryResponse;
      }
      if (/FROM public\.process_response/.test(text)) {
        return { rows: processResponseRows, rowCount: processResponseRows.length } satisfies QueryResponse;
      }
      if (/FROM public\.sync_audit/.test(text)) {
        return { rows: auditRows, rowCount: auditRows.length } satisfies QueryResponse;
      }
      throw new Error(`Unexpected read query: ${text}`);
    },
  } as const;

  const syncs = await listProcessSyncs(77, reader as unknown as any);
  const responses = await listProcessResponses(77, reader as unknown as any);
  const audits = await listSyncAudits(77, reader as unknown as any);

  assert.equal(syncs.length, 1);
  assert.equal(syncs[0].remoteRequestId, 'req-judit');
  assert.deepEqual(syncs[0].metadata.result, { delivered: true });
  assert.equal(responses.length, 1);
  assert.equal(responses[0].processSyncId, syncs[0].id);
  assert.equal(audits.length >= 2, true);
  assert.equal(audits[0].processoId, 77);
});

test('requestWithRetry logs status and body before throwing a JuditApiError', async () => {
  const service = new JuditProcessService('api-key', 'https://judit.test');
  const config = {
    apiKey: 'api-key',
    requestsEndpoint: 'https://judit.test/requests',
    trackingEndpoint: 'https://judit.test/tracking',
    integrationId: null,
  };

  const responseBody = { error: 'Falha na requisição' };
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  const capturedCalls: unknown[][] = [];

  globalThis.fetch = (async () => ({
    ok: false,
    status: 400,
    headers: {
      get(name: string) {
        return name.toLowerCase() === 'content-type' ? 'application/json' : null;
      },
    },
    async json() {
      return responseBody;
    },
    async text() {
      return JSON.stringify(responseBody);
    },
  })) as typeof fetch;

  console.error = (...args: unknown[]) => {
    capturedCalls.push(args);
  };

  try {
    await assert.rejects(
      () => (service as any).requestWithRetry(config, 'https://judit.test/requests', { method: 'POST' }),
      JuditApiError,
    );
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
  }

  assert.equal(capturedCalls.length, 1);
  const payload = capturedCalls[0]?.[1] as Record<string, unknown> | undefined;
  assert.ok(payload);
  assert.equal(payload?.status, 400);
  assert.equal(payload?.url, 'https://judit.test/requests');
  assert.equal(payload?.attempt, 0);
  assert.deepEqual(payload?.body, responseBody);
});
