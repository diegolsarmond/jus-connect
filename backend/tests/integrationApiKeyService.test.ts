import assert from 'node:assert/strict';
import test from 'node:test';
import IntegrationApiKeyService, {
  CreateIntegrationApiKeyInput,
  IntegrationApiKey,
  UpdateIntegrationApiKeyInput,
  ValidationError,
} from '../src/services/integrationApiKeyService';

type QueryCall = { text: string; values?: unknown[] };
type QueryResponse = { rows: any[]; rowCount: number };

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

test('IntegrationApiKeyService.create normalizes payload and persists values', async () => {
  const insertedRow = {
    id: 1,
    provider: 'openai',
    url_api: 'https://api.openai.com/v1',
    key_value: 'sk_live_abc123',
    environment: 'producao',
    active: true,
    last_used: null,
    idempresa: 123,
    global: true,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  };

  const pool = new FakePool([
    { rows: [insertedRow], rowCount: 1 },
    { rows: [], rowCount: 0 },
    { rows: [], rowCount: 1 },
  ]);

  const service = new IntegrationApiKeyService(pool as any);

  const payload: CreateIntegrationApiKeyInput = {
    provider: '  OPENAI  ',
    apiUrl: ' https://api.openai.com/v1 ',
    key: '  sk_live_abc123  ',
    environment: ' Producao ',
    empresaId: 123,
    global: true,
  };

  const result = await service.create(payload);

  assert.equal(pool.calls.length, 1);
  const call = pool.calls[0];
  assert.match(call.text, /INSERT INTO integration_api_keys/i);
  assert.deepEqual(call.values, [
    'openai',
    'https://api.openai.com/v1',
    'sk_live_abc123',
    'producao',
    true,
    null,
    123,
    true,
  ]);

  const expected: IntegrationApiKey = {
    id: 1,
    provider: 'openai',
    apiUrl: 'https://api.openai.com/v1',
    key: 'sk_live_abc123',
    environment: 'producao',
    active: true,
    lastUsed: null,
    empresaId: 123,
    global: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  assert.deepEqual(result, expected);
});

test('IntegrationApiKeyService.create normalizes Judit provider and omits default URL', async () => {
  const insertedRow = {
    id: 5,
    provider: 'judit',
    url_api: null,
    key_value: 'judit_token_value',
    environment: 'homologacao',
    active: true,
    last_used: null,
    idempresa: null,
    global: false,
    created_at: '2024-01-05T00:00:00.000Z',
    updated_at: '2024-01-05T00:00:00.000Z',
  };

  const pool = new FakePool([
    { rows: [insertedRow], rowCount: 1 },
    { rows: [], rowCount: 0 },
    { rows: [], rowCount: 1 },
  ]);

  const service = new IntegrationApiKeyService(pool as any);

  const payload: CreateIntegrationApiKeyInput = {
    provider: '  JuDiT  ',
    key: '  judit_token_value  ',
    environment: ' Homologacao ',
  };

  const result = await service.create(payload);

  assert.deepEqual(pool.calls[0].values, [
    'judit',
    null,
    'judit_token_value',
    'homologacao',
    true,
    null,
    null,
    false,
  ]);

  assert.equal(result.provider, 'judit');
  assert.equal(result.apiUrl, null);
  assert.equal(result.environment, 'homologacao');
  assert.equal(result.empresaId, null);
  assert.equal(result.global, false);
});

test('IntegrationApiKeyService.create assigns default API URL for Asaas in produção', async () => {
  const insertedRow = {
    id: 2,
    provider: 'asaas',
    url_api: 'https://api.asaas.com/api/v3',
    key_value: 'asaas_prod_token',
    environment: 'producao',
    active: true,
    last_used: null,
    idempresa: null,
    global: false,
    created_at: '2024-01-02T00:00:00.000Z',
    updated_at: '2024-01-02T00:00:00.000Z',
  };

  const pool = new FakePool([
    { rows: [insertedRow], rowCount: 1 },
  ]);

  const service = new IntegrationApiKeyService(pool as any);

  const payload: CreateIntegrationApiKeyInput = {
    provider: 'Asaas',
    apiUrl: '   ',
    key: '  asaas_prod_token  ',
    environment: 'producao',
  };

  const result = await service.create(payload);

  assert.equal(pool.calls.length, 3);

  const [insertCall, selectCredentialCall, insertCredentialCall] = pool.calls;

  assert.deepEqual(insertCall.values, [
    'asaas',
    'https://api.asaas.com/api/v3',
    'asaas_prod_token',
    'producao',
    true,
    null,
    null,
    false,
  ]);

  assert.match(selectCredentialCall.text, /FROM asaas_credentials/i);
  assert.deepEqual(selectCredentialCall.values, [insertedRow.id]);

  assert.match(insertCredentialCall.text, /INTO asaas_credentials/i);
  assert.equal(insertCredentialCall.values?.[0], insertedRow.id);

  assert.equal(result.provider, 'asaas');
  assert.equal(result.apiUrl, 'https://api.asaas.com/api/v3');
  assert.equal(result.environment, 'producao');
  assert.equal(result.global, false);
});

test('IntegrationApiKeyService.create assigns sandbox URL for Asaas in homologação when apiUrl omitted', async () => {
  const insertedRow = {
    id: 3,
    provider: 'asaas',
    url_api: 'https://sandbox.asaas.com/api/v3',
    key_value: 'asaas_sbx_token',
    environment: 'homologacao',
    active: false,
    last_used: null,
    idempresa: null,
    global: false,
    created_at: '2024-01-03T00:00:00.000Z',
    updated_at: '2024-01-03T00:00:00.000Z',
  };

  const pool = new FakePool([
    { rows: [insertedRow], rowCount: 1 },
  ]);

  const service = new IntegrationApiKeyService(pool as any);

  const payload: CreateIntegrationApiKeyInput = {
    provider: 'asaas',
    key: 'asaas_sbx_token',
    environment: 'homologacao',
    active: false,
  };

  const result = await service.create(payload);

  assert.equal(pool.calls.length, 3);
  const [insertCall, selectCredentialCall, insertCredentialCall] = pool.calls;

  assert.deepEqual(insertCall.values, [
    'asaas',
    'https://sandbox.asaas.com/api/v3',
    'asaas_sbx_token',
    'homologacao',
    false,
    null,
    null,
    false,
  ]);

  assert.match(selectCredentialCall.text, /FROM asaas_credentials/i);
  assert.deepEqual(selectCredentialCall.values, [insertedRow.id]);

  assert.match(insertCredentialCall.text, /INTO asaas_credentials/i);
  assert.equal(insertCredentialCall.values?.[0], insertedRow.id);

  assert.equal(result.provider, 'asaas');
  assert.equal(result.apiUrl, 'https://sandbox.asaas.com/api/v3');
  assert.equal(result.active, false);
  assert.equal(result.global, false);
});

test('IntegrationApiKeyService.create validates provider and key', async () => {
  const pool = new FakePool([]);
  const service = new IntegrationApiKeyService(pool as any);

  await assert.rejects(
    () => service.create({ provider: 'invalid', key: 'value', environment: 'producao' }),
    ValidationError,
  );

  await assert.rejects(
    () => service.create({ provider: 'gemini', key: '   ', environment: 'producao' }),
    ValidationError,
  );
});

test('IntegrationApiKeyService.list retrieves keys ordered by creation date', async () => {
  const rows = [
    {
      id: 10,
      provider: 'openai',
      url_api: 'https://sandbox.openai.com',
      key_value: 'sk_test_123',
      environment: 'homologacao',
      active: false,
      last_used: '2024-02-10T12:00:00.000Z',
      idempresa: 99,
      global: false,
      created_at: '2024-02-11T12:00:00.000Z',
      updated_at: '2024-02-11T12:30:00.000Z',
    },
  ];

  const pool = new FakePool([
    { rows, rowCount: rows.length },
  ]);

  const service = new IntegrationApiKeyService(pool as any);

  const result = await service.list({ empresaId: 42 });

  assert.equal(pool.calls.length, 1);
  assert.match(pool.calls[0].text, /ORDER BY created_at DESC/);
  assert.match(pool.calls[0].text, /global IS TRUE OR idempresa = \$1/);
  assert.deepEqual(pool.calls[0].values, [42]);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 10);
  assert.equal(result[0].provider, 'openai');
  assert.equal(result[0].apiUrl, 'https://sandbox.openai.com');
  assert.equal(result[0].lastUsed, '2024-02-10T12:00:00.000Z');
  assert.equal(result[0].empresaId, 99);
  assert.equal(result[0].global, false);
});

test('IntegrationApiKeyService.list includes Asaas entries with inactive status', async () => {
  const rows = [
    {
      id: 11,
      provider: 'asaas',
      url_api: 'https://sandbox.asaas.com/api/v3',
      key_value: 'asaas_key_value',
      environment: 'homologacao',
      active: false,
      last_used: null,
      idempresa: null,
      global: true,
      created_at: '2024-02-12T10:00:00.000Z',
      updated_at: '2024-02-12T11:00:00.000Z',
    },
  ];

  const pool = new FakePool([
    { rows, rowCount: rows.length },
  ]);

  const service = new IntegrationApiKeyService(pool as any);

  const result = await service.list({ empresaId: 55 });

  assert.equal(result.length, 1);
  assert.equal(result[0].provider, 'asaas');
  assert.equal(result[0].apiUrl, 'https://sandbox.asaas.com/api/v3');
  assert.equal(result[0].environment, 'homologacao');
  assert.equal(result[0].active, false);
  assert.equal(result[0].global, true);
  assert.deepEqual(pool.calls[0].values, [55]);
});

test('IntegrationApiKeyService.list tolerates unexpected provider and environment values', async () => {
  const rows = [
    {
      id: 42,
      provider: 'Zoho',
      url_api: null,
      key_value: 'secret-value',
      environment: 'custom-env',
      active: true,
      last_used: null,
      idempresa: '  ',
      global: false,
      created_at: '2024-02-15T10:00:00.000Z',
      updated_at: '2024-02-16T11:00:00.000Z',
    },
  ];

  const pool = new FakePool([
    { rows, rowCount: rows.length },
  ]);

  const service = new IntegrationApiKeyService(pool as any);

  const result = await service.list({ empresaId: 77 });

  assert.equal(result.length, 1);
  assert.equal(result[0].provider, 'Zoho');
  assert.equal(result[0].environment, 'custom-env');
  assert.equal(result[0].empresaId, null);
  assert.deepEqual(pool.calls[0].values, [77]);
});

test('IntegrationApiKeyService.update builds dynamic query and handles not found', async () => {
  const updatedRow = {
    id: 7,
    provider: 'openai',
    url_api: 'https://new.api.openai.com',
    key_value: 'sk_new_value',
    environment: 'homologacao',
    active: false,
    last_used: '2024-03-01T08:30:00.000Z',
    idempresa: 55,
    global: true,
    created_at: '2024-02-01T10:00:00.000Z',
    updated_at: '2024-03-01T08:30:00.000Z',
  };

  const pool = new FakePool([
    { rows: [updatedRow], rowCount: 1 },
    { rows: [], rowCount: 0 },
  ]);

  const service = new IntegrationApiKeyService(pool as any);

  const updates: UpdateIntegrationApiKeyInput = {
    provider: 'OpenAI',
    apiUrl: 'https://new.api.openai.com',
    key: ' sk_new_value ',
    environment: ' Homologacao ',
    active: false,
    lastUsed: '2024-03-01T08:30:00Z',
    empresaId: 55,
    global: true,
  };

  const result = await service.update(7, updates, { empresaId: 55 });

  assert.ok(pool.calls[0].text.startsWith('UPDATE integration_api_keys'));
  assert.deepEqual(pool.calls[0].values?.slice(0, 5), [
    'openai',
    'homologacao',
    'https://new.api.openai.com',
    'sk_new_value',
    false,
  ]);
  const lastUsedValue = pool.calls[0].values?.[5];
  assert.ok(lastUsedValue instanceof Date);
  assert.equal((lastUsedValue as Date).toISOString(), '2024-03-01T08:30:00.000Z');
  assert.equal(pool.calls[0].values?.[6], 55);
  assert.equal(pool.calls[0].values?.[7], true);
  assert.equal(pool.calls[0].values?.[8], 7);
  assert.equal(pool.calls[0].values?.[9], 55);

  assert.equal(result?.id, 7);
  assert.equal(result?.provider, 'openai');
  assert.equal(result?.active, false);
  assert.equal(result?.environment, 'homologacao');
  assert.equal(result?.apiUrl, 'https://new.api.openai.com');
  assert.equal(result?.empresaId, 55);
  assert.equal(result?.global, true);

  const notFound = await service.update(99, { active: true }, { empresaId: 55 });
  assert.equal(pool.calls.length, 2);
  assert.deepEqual(pool.calls[1].values, [true, 99, 55]);
  assert.equal(notFound, null);
});

test('IntegrationApiKeyService.update requires at least one field', async () => {
  const pool = new FakePool([]);
  const service = new IntegrationApiKeyService(pool as any);

  await assert.rejects(() => service.update(1, {}, { empresaId: 1 }), ValidationError);
});

test('IntegrationApiKeyService.delete returns operation status', async () => {
  const pool = new FakePool([
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 0 },
  ]);

  const service = new IntegrationApiKeyService(pool as any);

  const deleted = await service.delete(3, { empresaId: 12 });
  assert.equal(deleted, true);
  assert.deepEqual(pool.calls[0].values, [3, 12]);

  const notDeleted = await service.delete(4, { empresaId: 12 });
  assert.equal(notDeleted, false);
  assert.deepEqual(pool.calls[1].values, [4, 12]);
});

test('IntegrationApiKeyService.findById applies empresa scope filters', async () => {
  const row = {
    id: 25,
    provider: 'asaas',
    url_api: 'https://sandbox.asaas.com/api/v3',
    key_value: 'asaas_key',
    environment: 'homologacao',
    active: true,
    last_used: null,
    idempresa: 12,
    global: false,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-02T00:00:00.000Z',
  };

  const poolSuccess = new FakePool([
    { rows: [row], rowCount: 1 },
  ]);

  const serviceSuccess = new IntegrationApiKeyService(poolSuccess as any);

  const integration = await serviceSuccess.findById(25, { empresaId: 12 });
  assert.equal(poolSuccess.calls[0].values?.[0], 25);
  assert.equal(poolSuccess.calls[0].values?.[1], 12);
  assert.ok(integration);
  assert.equal(integration?.id, 25);

  const poolNotFound = new FakePool([
    { rows: [], rowCount: 0 },
  ]);

  const serviceNotFound = new IntegrationApiKeyService(poolNotFound as any);

  const notFound = await serviceNotFound.findById(25, { empresaId: 99 });
  assert.equal(poolNotFound.calls[0].values?.[0], 25);
  assert.equal(poolNotFound.calls[0].values?.[1], 99);
  assert.equal(notFound, null);
});
