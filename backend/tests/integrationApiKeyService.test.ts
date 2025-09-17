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
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  };

  const pool = new FakePool([
    { rows: [insertedRow], rowCount: 1 },
  ]);

  const service = new IntegrationApiKeyService(pool as any);

  const payload: CreateIntegrationApiKeyInput = {
    provider: '  OPENAI  ',
    apiUrl: ' https://api.openai.com/v1 ',
    key: '  sk_live_abc123  ',
    environment: ' Producao ',
  };

  const result = await service.create(payload);

  assert.equal(pool.calls.length, 1);
  const call = pool.calls[0];
  assert.match(call.text, /INSERT INTO integration_api_keys/i);
  assert.deepEqual(call.values, ['openai', 'https://api.openai.com/v1', 'sk_live_abc123', 'producao', true, null]);

  const expected: IntegrationApiKey = {
    id: 1,
    provider: 'openai',
    apiUrl: 'https://api.openai.com/v1',
    key: 'sk_live_abc123',
    environment: 'producao',
    active: true,
    lastUsed: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  assert.deepEqual(result, expected);
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
      created_at: '2024-02-11T12:00:00.000Z',
      updated_at: '2024-02-11T12:30:00.000Z',
    },
  ];

  const pool = new FakePool([
    { rows, rowCount: rows.length },
  ]);

  const service = new IntegrationApiKeyService(pool as any);

  const result = await service.list();

  assert.equal(pool.calls.length, 1);
  assert.match(pool.calls[0].text, /ORDER BY created_at DESC/);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 10);
  assert.equal(result[0].provider, 'openai');
  assert.equal(result[0].apiUrl, 'https://sandbox.openai.com');
  assert.equal(result[0].lastUsed, '2024-02-10T12:00:00.000Z');
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
  };

  const result = await service.update(7, updates);

  assert.ok(pool.calls[0].text.startsWith('UPDATE integration_api_keys'));
  assert.deepEqual(pool.calls[0].values?.slice(0, 5), [
    'openai',
    'https://new.api.openai.com',
    'sk_new_value',
    'homologacao',
    false,
  ]);
  const lastUsedValue = pool.calls[0].values?.[5];
  assert.ok(lastUsedValue instanceof Date);
  assert.equal((lastUsedValue as Date).toISOString(), '2024-03-01T08:30:00.000Z');
  assert.equal(pool.calls[0].values?.[6], 7);

  assert.equal(result?.id, 7);
  assert.equal(result?.provider, 'openai');
  assert.equal(result?.active, false);
  assert.equal(result?.environment, 'homologacao');
  assert.equal(result?.apiUrl, 'https://new.api.openai.com');

  const notFound = await service.update(99, { active: true });
  assert.equal(pool.calls.length, 2);
  assert.equal(pool.calls[1].values?.[1], 99);
  assert.equal(notFound, null);
});

test('IntegrationApiKeyService.update requires at least one field', async () => {
  const pool = new FakePool([]);
  const service = new IntegrationApiKeyService(pool as any);

  await assert.rejects(() => service.update(1, {}), ValidationError);
});

test('IntegrationApiKeyService.delete returns operation status', async () => {
  const pool = new FakePool([
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 0 },
  ]);

  const service = new IntegrationApiKeyService(pool as any);

  const deleted = await service.delete(3);
  assert.equal(deleted, true);
  assert.deepEqual(pool.calls[0].values, [3]);

  const notDeleted = await service.delete(4);
  assert.equal(notDeleted, false);
  assert.deepEqual(pool.calls[1].values, [4]);
});
