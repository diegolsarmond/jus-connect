import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ASAAS_DEFAULT_BASE_URLS,
  AsaasIntegrationNotConfiguredError,
  createAsaasClient,
  resolveAsaasIntegration,
} from '../src/services/asaas/integrationResolver';

class FakePool {
  public calls: { text: string; params?: unknown[] }[] = [];

  constructor(private readonly responses: { rows: any[]; rowCount: number }[]) {}

  async query(text: string, params?: unknown[]) {
    this.calls.push({ text, params });
    const response = this.responses.shift();
    if (response) {
      return response;
    }
    if (/asaas_credentials/i.test(text)) {
      return { rows: [], rowCount: 0 };
    }
    throw new Error('No response configured');
  }
}

const EMPRESA_ID = 42;

test('resolveAsaasIntegration returns sandbox base URL when environment is homologacao', async () => {
  const pool = new FakePool([
    {
      rowCount: 1,
      rows: [
        {
          id: 1,
          provider: 'asaas',
          url_api: null,
          key_value: '   sandbox-token   ',
          environment: 'homologacao',
          active: true,
        },
      ],
    },
  ]);

  const integration = await resolveAsaasIntegration(EMPRESA_ID, pool as any);

  assert.equal(integration.accessToken, 'sandbox-token');
  assert.equal(integration.baseUrl, ASAAS_DEFAULT_BASE_URLS.homologacao);
  assert.equal(integration.environment, 'homologacao');
  assert.match(pool.calls[0].text, /FROM integration_api_keys/);
  assert.deepEqual(pool.calls[0].params, ['asaas', EMPRESA_ID]);
});

test('resolveAsaasIntegration prioritizes custom API URL for production', async () => {
  const pool = new FakePool([
    {
      rowCount: 1,
      rows: [
        {
          id: 2,
          provider: 'asaas',
          url_api: ' https://custom.asaas.com/api/v3/ ',
          key_value: 'live-token',
          environment: 'producao',
          active: true,
        },
      ],
    },
  ]);

  const integration = await resolveAsaasIntegration(EMPRESA_ID, pool as any);

  assert.equal(integration.accessToken, 'live-token');
  assert.equal(integration.baseUrl, 'https://custom.asaas.com/api/v3');
  assert.equal(integration.environment, 'producao');
});

test('resolveAsaasIntegration appends API path when missing for known Asaas hosts', async () => {
  const pool = new FakePool([
    {
      rowCount: 1,
      rows: [
        {
          id: 4,
          provider: 'asaas',
          url_api: 'https://sandbox.asaas.com',
          key_value: 'sandbox-token',
          environment: 'homologacao',
          active: true,
        },
      ],
    },
  ]);

  const integration = await resolveAsaasIntegration(EMPRESA_ID, pool as any);

  assert.equal(integration.baseUrl, 'https://sandbox.asaas.com/api/v3');
});

test('resolveAsaasIntegration completes API version when only /api is provided', async () => {
  const pool = new FakePool([
    {
      rowCount: 1,
      rows: [
        {
          id: 5,
          provider: 'asaas',
          url_api: 'https://sandbox.asaas.com/api/',
          key_value: 'sandbox-token',
          environment: 'homologacao',
          active: true,
        },
      ],
    },
  ]);

  const integration = await resolveAsaasIntegration(EMPRESA_ID, pool as any);

  assert.equal(integration.baseUrl, 'https://sandbox.asaas.com/api/v3');
});

test('resolveAsaasIntegration selects credential matching requested environment when available', async () => {
  const pool = new FakePool([
    {
      rowCount: 1,
      rows: [
        {
          id: 6,
          provider: 'asaas',
          url_api: null,
          key_value: 'live-token',
          environment: 'producao',
          active: true,
        },
      ],
    },
  ]);

  const integration = await resolveAsaasIntegration(EMPRESA_ID, pool as any, 'producao');

  assert.equal(integration.environment, 'producao');
  assert.equal(integration.accessToken, 'live-token');
  assert.equal(pool.calls.length, 1);
  assert.deepEqual(pool.calls[0].params, ['asaas', EMPRESA_ID, 'producao']);
  assert.match(pool.calls[0].text, /environment = \$3/);
});

test('resolveAsaasIntegration falls back to other environments when requested one is unavailable', async () => {
  const pool = new FakePool([
    { rowCount: 0, rows: [] },
    {
      rowCount: 1,
      rows: [
        {
          id: 7,
          provider: 'asaas',
          url_api: null,
          key_value: 'sandbox-token',
          environment: 'homologacao',
          active: true,
        },
      ],
    },
  ]);

  const integration = await resolveAsaasIntegration(EMPRESA_ID, pool as any, 'producao');

  assert.equal(integration.environment, 'homologacao');
  assert.equal(integration.accessToken, 'sandbox-token');
  assert.equal(pool.calls.length, 2);
  assert.deepEqual(pool.calls[0].params, ['asaas', EMPRESA_ID, 'producao']);
  assert.deepEqual(pool.calls[1].params, ['asaas', EMPRESA_ID]);
});

test('resolveAsaasIntegration throws a specific error when no active credential exists', async () => {
  const pool = new FakePool([
    {
      rowCount: 0,
      rows: [],
    },
    {
      rowCount: 0,
      rows: [],
    },
  ]);

  await assert.rejects(
    () => resolveAsaasIntegration(EMPRESA_ID, pool as any),
    AsaasIntegrationNotConfiguredError,
  );
  assert.equal(pool.calls.length, 2);
  assert.match(pool.calls[0].text, /global IS TRUE/);
});

test('resolveAsaasIntegration falls back to legacy credential when no global exists', async () => {
  const originalEnv = process.env.ASAAS_ALLOW_LEGACY_CREDENTIAL_FALLBACK;
  process.env.ASAAS_ALLOW_LEGACY_CREDENTIAL_FALLBACK = 'true';

  const pool = new FakePool([
    { rowCount: 0, rows: [] },
    {
      rowCount: 1,
      rows: [
        {
          id: 9,
          provider: 'asaas',
          url_api: 'https://fallback.asaas.com/api/v3',
          key_value: 'legacy-token',
          environment: 'producao',
          active: true,
        },
      ],
    },
  ]);

  const warnMock = test.mock.method(console, 'warn');

  const integration = await resolveAsaasIntegration(EMPRESA_ID, pool as any);

  assert.equal(integration.accessToken, 'legacy-token');
  assert.equal(integration.baseUrl, 'https://fallback.asaas.com/api/v3');
  assert.equal(pool.calls.length, 2);
  assert.match(pool.calls[0].text, /global IS TRUE/);
  assert.ok(
    warnMock.mock.calls.some((call) =>
      String(call.arguments[0]).includes('Nenhuma credencial global encontrada'),
    ),
  );

  warnMock.mock.restore();
  if (originalEnv === undefined) {
    delete process.env.ASAAS_ALLOW_LEGACY_CREDENTIAL_FALLBACK;
  } else {
    process.env.ASAAS_ALLOW_LEGACY_CREDENTIAL_FALLBACK = originalEnv;
  }
});

test('resolveAsaasIntegration prioritizes matching environment during legacy fallback when available', async () => {
  const originalEnv = process.env.ASAAS_ALLOW_LEGACY_CREDENTIAL_FALLBACK;
  process.env.ASAAS_ALLOW_LEGACY_CREDENTIAL_FALLBACK = 'true';

  const pool = new FakePool([
    { rowCount: 0, rows: [] },
    { rowCount: 0, rows: [] },
    {
      rowCount: 1,
      rows: [
        {
          id: 11,
          provider: 'asaas',
          url_api: 'https://legacy.asaas.com/api/v3',
          key_value: 'legacy-production-token',
          environment: 'producao',
          active: true,
        },
      ],
    },
  ]);

  const integration = await resolveAsaasIntegration(EMPRESA_ID, pool as any, 'producao');

  assert.equal(integration.environment, 'producao');
  assert.equal(integration.accessToken, 'legacy-production-token');
  assert.equal(pool.calls.length, 3);
  assert.deepEqual(pool.calls[0].params, ['asaas', EMPRESA_ID, 'producao']);
  assert.deepEqual(pool.calls[1].params, ['asaas', EMPRESA_ID]);
  assert.deepEqual(pool.calls[2].params, ['asaas', 'producao']);
  assert.match(pool.calls[2].text, /environment = \$2/);

  if (originalEnv === undefined) {
    delete process.env.ASAAS_ALLOW_LEGACY_CREDENTIAL_FALLBACK;
  } else {
    process.env.ASAAS_ALLOW_LEGACY_CREDENTIAL_FALLBACK = originalEnv;
  }
});

test('resolveAsaasIntegration does not fallback when disabled', async () => {
  const originalEnv = process.env.ASAAS_ALLOW_LEGACY_CREDENTIAL_FALLBACK;
  process.env.ASAAS_ALLOW_LEGACY_CREDENTIAL_FALLBACK = 'false';

  const pool = new FakePool([
    {
      rowCount: 0,
      rows: [],
    },
  ]);

  const warnMock = test.mock.method(console, 'warn');

  await assert.rejects(
    () => resolveAsaasIntegration(EMPRESA_ID, pool as any),
    AsaasIntegrationNotConfiguredError,
  );
  assert.equal(pool.calls.length, 1);
  assert.match(pool.calls[0].text, /global IS TRUE/);
  assert.ok(
    warnMock.mock.calls.some((call) =>
      String(call.arguments[0]).includes('Nenhuma credencial global encontrada'),
    ),
  );

  warnMock.mock.restore();
  if (originalEnv === undefined) {
    delete process.env.ASAAS_ALLOW_LEGACY_CREDENTIAL_FALLBACK;
  } else {
    process.env.ASAAS_ALLOW_LEGACY_CREDENTIAL_FALLBACK = originalEnv;
  }
});

test('createAsaasClient builds client instance with resolved credentials', async () => {
  const pool = new FakePool([
    {
      rowCount: 1,
      rows: [
        {
          id: 3,
          provider: 'asaas',
          url_api: null,
          key_value: 'sandbox-token',
          environment: 'homologacao',
          active: true,
        },
      ],
    },
  ]);

  const client = await createAsaasClient(EMPRESA_ID, pool as any, {
    fetchImpl: async () => new Response(null, { status: 204 }),
  });
  assert.equal(typeof client, 'object');
  assert.equal(pool.calls.length, 1);
});
