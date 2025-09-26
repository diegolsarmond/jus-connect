import assert from 'node:assert/strict';
import test from 'node:test';
import type { ClienteLocalData } from '../src/services/asaasCustomerService';

process.env.DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/testdb';

let AsaasCustomerService: typeof import('../src/services/asaasCustomerService').default;
let AsaasApiError: typeof import('../src/services/asaasCustomerService').AsaasApiError;

test.before(async () => {
  const module = await import('../src/services/asaasCustomerService');
  AsaasCustomerService = module.default;
  AsaasApiError = module.AsaasApiError;
});

const EMPRESA_ID = 77;

type QueryResponse = { rows: any[]; rowCount: number };

type QueryCall = { text: string; values?: unknown[] };

class FakePool {
  public readonly calls: QueryCall[] = [];

  constructor(private readonly responses: QueryResponse[]) {}

  async query(text: string, values?: unknown[]) {
    this.calls.push({ text, values });
    if (this.responses.length === 0) {
      throw new Error('Unexpected query invocation');
    }
    return this.responses.shift()!;
  }
}

test('ensureCustomer returns inactive state when Asaas integration is disabled', async () => {
  const pool = new FakePool([
    { rows: [], rowCount: 0 },
  ]);

  const service = new AsaasCustomerService(pool as any, () => {
    throw new Error('HTTP client should not be instantiated');
  });

  const state = await service.ensureCustomer(10, EMPRESA_ID);
  assert.deepEqual(state, {
    integrationActive: false,
    integrationApiKeyId: null,
    status: 'inactive',
    customerId: null,
    syncedAt: null,
    lastPayload: null,
    errorMessage: null,
  });
  assert.equal(pool.calls.length, 1);
  assert.match(pool.calls[0]?.text ?? '', /FROM public\.integration_api_keys/);
  assert.deepEqual(pool.calls[0]?.values, ['asaas', EMPRESA_ID]);
});

test('updateFromLocal creates remote customer when mapping does not exist', async () => {
  const integrationRow = {
    id: 3,
    provider: 'asaas',
    url_api: null,
    key_value: 'asaas-key',
    environment: 'homologacao',
    active: true,
  };

  const insertedRow = {
    cliente_id: 25,
    integration_api_key_id: 3,
    asaas_customer_id: null,
    status: 'pending',
    synced_at: null,
    last_payload: null,
  };

  const updatedRow = {
    cliente_id: 25,
    integration_api_key_id: 3,
    asaas_customer_id: 'cus_123',
    status: 'synced',
    synced_at: '2024-03-01T12:00:00.000Z',
    last_payload: JSON.stringify({ request: { name: 'Cliente Teste' }, response: { id: 'cus_123' } }),
  };

  const pool = new FakePool([
    { rows: [integrationRow], rowCount: 1 },
    { rows: [], rowCount: 0 },
    { rows: [insertedRow], rowCount: 1 },
    { rows: [updatedRow], rowCount: 1 },
  ]);

  let createCalled = false;
  const httpFactory = test.mock.fn(() => ({
    async createCustomer(payload: Record<string, unknown>) {
      createCalled = true;
      assert.equal(payload.name, 'Cliente Teste');
      assert.equal(payload.cpfCnpj, '12345678909');
      assert.equal(payload.externalReference, '25');
      return { id: 'cus_123' };
    },
    async updateCustomer() {
      throw new Error('updateCustomer should not be called in creation flow');
    },
  }));

  const service = new AsaasCustomerService(pool as any, httpFactory as any);

  const localData: ClienteLocalData = {
    nome: 'Cliente Teste',
    tipo: '1',
    documento: '123.456.789-09',
    email: 'cliente@example.com',
    telefone: '(11) 99999-0000',
    cep: '01001-000',
    rua: 'Rua Um',
    numero: '123',
    complemento: null,
    bairro: 'Centro',
    cidade: 'São Paulo',
    uf: 'SP',
  };

  const state = await service.updateFromLocal(25, EMPRESA_ID, localData);

  assert.ok(createCalled);
  assert.equal(state.integrationActive, true);
  assert.equal(state.integrationApiKeyId, 3);
  assert.equal(state.status, 'synced');
  assert.equal(state.customerId, 'cus_123');
  assert.equal(state.syncedAt, '2024-03-01T12:00:00.000Z');
  assert.equal(state.errorMessage, null);
  assert.deepEqual(httpFactory.mock.calls[0]?.arguments[0], {
    apiKey: 'asaas-key',
    baseUrl: 'https://sandbox.asaas.com/api/v3',
  });
  assert.equal(pool.calls.length, 4);
});

test('updateFromLocal updates existing remote customer and records responses', async () => {
  const integrationRow = {
    id: 4,
    provider: 'asaas',
    url_api: 'https://custom.asaas.com/v3',
    key_value: 'asaas-key',
    environment: 'producao',
    active: true,
  };

  const existingRow = {
    cliente_id: 40,
    integration_api_key_id: 4,
    asaas_customer_id: 'cus_existing',
    status: 'synced',
    synced_at: '2024-01-01T00:00:00.000Z',
    last_payload: null,
  };

  const updatedRow = {
    ...existingRow,
    status: 'synced',
    synced_at: '2024-04-10T08:30:00.000Z',
    last_payload: JSON.stringify({ request: { name: 'Cliente Atualizado' }, response: { id: 'cus_existing' } }),
  };

  const pool = new FakePool([
    { rows: [integrationRow], rowCount: 1 },
    { rows: [existingRow], rowCount: 1 },
    { rows: [updatedRow], rowCount: 1 },
  ]);

  let updateCalled = false;
  const httpFactory = test.mock.fn(() => ({
    async createCustomer() {
      throw new Error('createCustomer should not be called on update flow');
    },
    async updateCustomer(customerId: string, payload: Record<string, unknown>) {
      updateCalled = true;
      assert.equal(customerId, 'cus_existing');
      assert.equal(payload.name, 'Cliente Atualizado');
      assert.equal(payload.externalReference, '40');
      return { id: 'cus_existing' };
    },
  }));

  const service = new AsaasCustomerService(pool as any, httpFactory as any);

  const localData: ClienteLocalData = {
    nome: '  Cliente Atualizado  ',
    tipo: 2,
    documento: '12.345.678/0001-00',
    email: 'cliente@empresa.com',
    telefone: '11987654321',
    cep: null,
    rua: 'Avenida Dois',
    numero: '500',
    complemento: 'Conjunto 101',
    bairro: 'Centro',
    cidade: 'Rio de Janeiro',
    uf: 'RJ',
  };

  const state = await service.updateFromLocal(40, EMPRESA_ID, localData);

  assert.ok(updateCalled);
  assert.equal(state.status, 'synced');
  assert.equal(state.customerId, 'cus_existing');
  assert.equal(state.syncedAt, '2024-04-10T08:30:00.000Z');
  assert.equal(state.integrationApiKeyId, 4);
  assert.equal(state.errorMessage, null);
  assert.equal(state.integrationActive, true);
  assert.equal(httpFactory.mock.calls[0]?.arguments[0]?.baseUrl, 'https://custom.asaas.com/v3');
  assert.equal(pool.calls.length, 3);
});

test('updateFromLocal stores error information when Asaas API rejects request', async () => {
  const integrationRow = {
    id: 5,
    provider: 'asaas',
    url_api: null,
    key_value: 'asaas-key',
    environment: 'producao',
    active: true,
  };

  const mappingRow = {
    cliente_id: 55,
    integration_api_key_id: 5,
    asaas_customer_id: null,
    status: 'pending',
    synced_at: null,
    last_payload: null,
  };

  const errorRow = {
    ...mappingRow,
    status: 'error',
    synced_at: null,
    last_payload: JSON.stringify({ request: { name: 'Cliente Inválido' }, error: { message: 'CPF inválido' } }),
  };

  const pool = new FakePool([
    { rows: [integrationRow], rowCount: 1 },
    { rows: [mappingRow], rowCount: 1 },
    { rows: [errorRow], rowCount: 1 },
  ]);

  const httpFactory = test.mock.fn(() => ({
    async createCustomer() {
      throw new AsaasApiError(400, 'CPF inválido', { errors: [{ description: 'CPF inválido' }] });
    },
    async updateCustomer() {
      throw new Error('updateCustomer should not be called when create fails');
    },
  }));

  const service = new AsaasCustomerService(pool as any, httpFactory as any);

  const localData: ClienteLocalData = {
    nome: 'Cliente Inválido',
    tipo: '1',
    documento: '000.000.000-00',
    email: null,
    telefone: null,
    cep: null,
    rua: null,
    numero: null,
    complemento: null,
    bairro: null,
    cidade: null,
    uf: null,
  };

  const state = await service.updateFromLocal(55, EMPRESA_ID, localData);

  assert.equal(state.status, 'error');
  assert.equal(state.integrationApiKeyId, 5);
  assert.equal(state.integrationActive, true);
  assert.equal(state.errorMessage, 'CPF inválido');
  assert.equal(state.syncedAt, null);
  assert.ok(state.lastPayload);
  assert.deepEqual(httpFactory.mock.calls[0]?.arguments[0], {
    apiKey: 'asaas-key',
    baseUrl: 'https://www.asaas.com/api/v3',
  });
  assert.equal(pool.calls.length, 3);
});
