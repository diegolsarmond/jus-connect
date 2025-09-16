import assert from 'node:assert/strict';
import test from 'node:test';
import WahaConfigService, {
  UpsertWahaConfigInput,
  ValidationError,
} from '../src/services/wahaConfigService';

type QueryCall = { text: string; values?: unknown[] };
type QueryResponse = { rows: any[]; rowCount: number };

class FakePool {
  public readonly calls: QueryCall[] = [];

  constructor(private readonly responses: QueryResponse[]) {}

  async query(text: string, values?: unknown[]) {
    this.calls.push({ text, values });
    if (this.responses.length === 0) {
      throw new Error('No response configured for query');
    }
    return this.responses.shift()!;
  }
}

test('WahaConfigService.saveConfig upserts configuration', async () => {
  const insertedRow = {
    id: 1,
    base_url: 'https://api.example.com',
    api_key: 'secret-key',
    webhook_secret: 'wh-secret',
    is_active: true,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  };

  const pool = new FakePool([
    { rows: [insertedRow], rowCount: 1 },
  ]);

  const service = new WahaConfigService(pool as any);

  const payload: UpsertWahaConfigInput = {
    baseUrl: 'https://api.example.com/',
    apiKey: '  secret-key  ',
    webhookSecret: 'wh-secret',
    isActive: true,
  };

  const config = await service.saveConfig(payload);

  assert.equal(pool.calls.length, 1);
  assert.match(pool.calls[0]!.text, /INSERT INTO waha_settings/i);
  assert.equal(pool.calls[0]!.values?.[0], 'https://api.example.com');
  assert.equal(pool.calls[0]!.values?.[1], 'secret-key');

  assert.equal(config.baseUrl, 'https://api.example.com');
  assert.equal(config.apiKey, 'secret-key');
  assert.equal(config.webhookSecret, 'wh-secret');
  assert.equal(config.isActive, true);
});

test('WahaConfigService.requireConfig validates presence and active flag', async () => {
  const pool = new FakePool([
    { rows: [], rowCount: 0 },
  ]);

  const service = new WahaConfigService(pool as any);

  await assert.rejects(() => service.requireConfig(), ValidationError);
});
