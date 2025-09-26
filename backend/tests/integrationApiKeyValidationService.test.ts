import assert from 'node:assert/strict';
import test from 'node:test';
import IntegrationApiKeyValidationService, {
  ValidateAsaasIntegrationResult,
} from '../src/services/integrationApiKeyValidationService';
import { IntegrationApiKey, ValidationError, ASAAS_DEFAULT_API_URLS } from '../src/services/integrationApiKeyService';

class FakeIntegrationApiKeyService {
  constructor(private readonly items: Map<number, IntegrationApiKey> = new Map()) {}

  async findById(id: number): Promise<IntegrationApiKey | null> {
    return this.items.get(id) ?? null;
  }
}

type FetchCall = { input: Parameters<typeof fetch>[0]; init?: Parameters<typeof fetch>[1] };

test('validateAsaas rejects invalid identifiers', async () => {
  const service = new IntegrationApiKeyValidationService(new FakeIntegrationApiKeyService(), async () => {
    throw new Error('fetch should not be called');
  });

  await assert.rejects(() => service.validateAsaas(0), ValidationError);
  await assert.rejects(() => service.validateAsaas(-1), ValidationError);
  await assert.rejects(() => service.validateAsaas(Number.NaN), ValidationError);
});

function createApiKey(overrides: Partial<IntegrationApiKey> = {}): IntegrationApiKey {
  return {
    id: 1,
    provider: 'asaas',
    apiUrl: 'https://api.asaas.com/api/v3',
    key: 'asaas_token',
    environment: 'producao',
    active: true,
    lastUsed: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

test('validateAsaas rejects when API key does not exist', async () => {
  const fakeService = new FakeIntegrationApiKeyService(new Map());
  const validator = new IntegrationApiKeyValidationService(fakeService, async () => {
    throw new Error('fetch should not be called');
  });

  await assert.rejects(() => validator.validateAsaas(42), ValidationError);
});

test('validateAsaas rejects when provider is not Asaas', async () => {
  const apiKey = createApiKey({ provider: 'openai' });
  const fakeService = new FakeIntegrationApiKeyService(new Map([[apiKey.id, apiKey]]));
  const validator = new IntegrationApiKeyValidationService(fakeService, async () => {
    throw new Error('fetch should not be called');
  });

  await assert.rejects(() => validator.validateAsaas(apiKey.id), ValidationError);
});

test('validateAsaas uses stored URL when present and returns success on OK response', async () => {
  const apiKey = createApiKey();
  const fakeService = new FakeIntegrationApiKeyService(new Map([[apiKey.id, apiKey]]));
  const calls: FetchCall[] = [];
  const validator = new IntegrationApiKeyValidationService(fakeService, async (input, init) => {
    calls.push({ input, init });
    return {
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('JSON body should not be read on success');
      },
    };
  });

  const result = await validator.validateAsaas(apiKey.id);
  assert.deepEqual(result, { success: true } satisfies ValidateAsaasIntegrationResult);
  assert.equal(calls.length, 1);
  const call = calls[0];
  const url = typeof call.input === 'string' ? call.input : call.input.toString();
  assert.equal(url, 'https://api.asaas.com/api/v3/customers?limit=1');
  assert.ok(call.init);
  assert.equal(call.init?.method, 'GET');
  assert.equal((call.init?.headers as Record<string, string>).access_token, 'asaas_token');
});

test('validateAsaas falls back to default URL when apiUrl is null', async () => {
  const apiKey = createApiKey({ apiUrl: null, environment: 'homologacao' });
  const fakeService = new FakeIntegrationApiKeyService(new Map([[apiKey.id, apiKey]]));
  const calls: FetchCall[] = [];
  const validator = new IntegrationApiKeyValidationService(fakeService, async (input, init) => {
    calls.push({ input, init });
    return {
      ok: true,
      status: 200,
      json: async () => ({}),
    };
  });

  const result = await validator.validateAsaas(apiKey.id);
  assert.equal(result.success, true);
  const expectedBase = ASAAS_DEFAULT_API_URLS.homologacao;
  const call = calls[0];
  const url = typeof call.input === 'string' ? call.input : call.input.toString();
  assert.equal(url, `${expectedBase}/customers?limit=1`);
});

test('validateAsaas normalizes sandbox base URLs without API path', async () => {
  const apiKey = createApiKey({ apiUrl: 'https://sandbox.asaas.com', environment: 'homologacao' });
  const fakeService = new FakeIntegrationApiKeyService(new Map([[apiKey.id, apiKey]]));
  const calls: FetchCall[] = [];
  const validator = new IntegrationApiKeyValidationService(fakeService, async (input, init) => {
    calls.push({ input, init });
    return {
      ok: true,
      status: 200,
      json: async () => ({}),
    };
  });

  await validator.validateAsaas(apiKey.id);
  assert.equal(calls.length, 1);
  const call = calls[0];
  const url = typeof call.input === 'string' ? call.input : call.input.toString();
  assert.equal(url, 'https://sandbox.asaas.com/api/v3/customers?limit=1');
});

test('validateAsaas normalizes sandbox API base without version suffix', async () => {
  const apiKey = createApiKey({ apiUrl: 'https://sandbox.asaas.com/api', environment: 'homologacao' });
  const fakeService = new FakeIntegrationApiKeyService(new Map([[apiKey.id, apiKey]]));
  const calls: FetchCall[] = [];
  const validator = new IntegrationApiKeyValidationService(fakeService, async (input, init) => {
    calls.push({ input, init });
    return {
      ok: true,
      status: 200,
      json: async () => ({}),
    };
  });

  await validator.validateAsaas(apiKey.id);
  assert.equal(calls.length, 1);
  const call = calls[0];
  const url = typeof call.input === 'string' ? call.input : call.input.toString();
  assert.equal(url, 'https://sandbox.asaas.com/api/v3/customers?limit=1');
});

test('validateAsaas returns failure with message from API payload', async () => {
  const apiKey = createApiKey();
  const fakeService = new FakeIntegrationApiKeyService(new Map([[apiKey.id, apiKey]]));
  const validator = new IntegrationApiKeyValidationService(fakeService, async () => ({
    ok: false,
    status: 401,
    json: async () => ({ message: 'Token inválido' }),
  }));

  const result = await validator.validateAsaas(apiKey.id);
  assert.deepEqual(result, { success: false, message: 'Token inválido' });
});

test('validateAsaas extracts first validation error when response contains an array', async () => {
  const apiKey = createApiKey();
  const fakeService = new FakeIntegrationApiKeyService(new Map([[apiKey.id, apiKey]]));
  const validator = new IntegrationApiKeyValidationService(fakeService, async () => ({
    ok: false,
    status: 400,
    json: async () => ({
      errors: [
        { description: 'Primeiro erro' },
        { message: 'Segundo erro' },
      ],
    }),
  }));

  const result = await validator.validateAsaas(apiKey.id);
  assert.deepEqual(result, { success: false, message: 'Primeiro erro' });
});

test('validateAsaas returns default message when API payload is empty', async () => {
  const apiKey = createApiKey();
  const fakeService = new FakeIntegrationApiKeyService(new Map([[apiKey.id, apiKey]]));
  const validator = new IntegrationApiKeyValidationService(fakeService, async () => ({
    ok: false,
    status: 502,
    json: async () => ({}),
  }));

  const result = await validator.validateAsaas(apiKey.id);
  assert.deepEqual(result, { success: false, message: 'Asaas API request failed with status 502' });
});

test('validateAsaas returns connection failure when fetch rejects', async () => {
  const apiKey = createApiKey();
  const fakeService = new FakeIntegrationApiKeyService(new Map([[apiKey.id, apiKey]]));
  const validator = new IntegrationApiKeyValidationService(fakeService, async () => {
    throw new Error('timeout');
  });

  const result = await validator.validateAsaas(apiKey.id);
  assert.equal(result.success, false);
  assert.ok(result.message?.includes('timeout'));
});

test('validateAsaas throws when API URL is invalid', async () => {
  const apiKey = createApiKey({ apiUrl: 'notaurl' });
  const fakeService = new FakeIntegrationApiKeyService(new Map([[apiKey.id, apiKey]]));
  const validator = new IntegrationApiKeyValidationService(fakeService, async () => {
    throw new Error('fetch should not be reached');
  });

  await assert.rejects(() => validator.validateAsaas(apiKey.id), ValidationError);
});
