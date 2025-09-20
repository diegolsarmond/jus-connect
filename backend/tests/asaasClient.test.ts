import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import AsaasClient, {
  AsaasApiError,
  ChargeResponse,
  CreateChargePayload,
} from '../src/services/asaas/asaasClient';

const BASE_URL = 'https://sandbox.asaas.com/api/v3';
const TOKEN = 'test-token';

function createResponse(body: unknown, init?: ResponseInit): Response {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  return new Response(payload, {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

test('AsaasClient creates customer with authentication headers', async (t) => {
  const fetchMock = mock.method(global, 'fetch', async (input, init) => {
    assert.equal(input, `${BASE_URL}/customers`);
    const headers = new Headers(init?.headers);
    assert.equal(headers.get('Authorization'), `Bearer ${TOKEN}`);
    assert.equal(headers.get('access_token'), TOKEN);
    assert.equal(headers.get('Content-Type'), 'application/json');
    const body = init?.body ? JSON.parse(init.body as string) : null;
    assert.deepEqual(body, { name: 'Maria da Silva' });
    return createResponse({ id: 'cus_123', object: 'customer', name: 'Maria da Silva' }, { status: 201 });
  });

  const client = new AsaasClient({ baseUrl: BASE_URL, accessToken: TOKEN });

  t.after(() => fetchMock.mock.restore());

  const response = await client.createCustomer({ name: 'Maria da Silva' });
  assert.equal(response.id, 'cus_123');
  assert.equal(fetchMock.mock.calls.length, 1);
});

test('AsaasClient normalizes API errors and exposes metadata', async (t) => {
  const errorBody = {
    errors: [
      {
        code: 'invalid_cpf',
        description: 'CPF inválido',
      },
    ],
  };

  const fetchMock = mock.method(global, 'fetch', async () => {
    return createResponse(errorBody, { status: 400 });
  });

  const client = new AsaasClient({ baseUrl: BASE_URL, accessToken: TOKEN });

  t.after(() => fetchMock.mock.restore());

  await assert.rejects(async () => client.getCharge('pay_123'), (error: unknown) => {
    assert.ok(error instanceof AsaasApiError);
    assert.equal(error.status, 400);
    assert.equal(error.message, 'CPF inválido');
    assert.equal(error.errorCode, 'invalid_cpf');
    assert.deepEqual(error.responseBody, errorBody);
    return true;
  });
});

test('createCreditCardCharge forces billing type credit card', async (t) => {
  const creditCardPayload: Omit<CreateChargePayload, 'billingType'> = {
    customer: 'cus_123',
    value: 100,
    description: 'Plano mensal',
    creditCard: {
      holderName: 'Maria',
      number: '4111111111111111',
      expiryMonth: '12',
      expiryYear: '2030',
      ccv: '123',
    },
    creditCardHolderInfo: {
      name: 'Maria',
      email: 'maria@example.com',
      cpfCnpj: '12345678901',
      postalCode: '88000000',
      addressNumber: '100',
    },
  };

  const fetchMock = mock.method(global, 'fetch', async (_input, init) => {
    const body = JSON.parse(init?.body as string);
    assert.equal(body.billingType, 'CREDIT_CARD');
    return createResponse({
      id: 'pay_789',
      object: 'payment',
      customer: 'cus_123',
      value: 100,
      billingType: 'CREDIT_CARD',
      status: 'PENDING',
    } satisfies ChargeResponse);
  });

  const client = new AsaasClient({ baseUrl: BASE_URL, accessToken: TOKEN });
  t.after(() => fetchMock.mock.restore());

  const result = await client.createCreditCardCharge(creditCardPayload);
  assert.equal(result.id, 'pay_789');
  assert.equal(fetchMock.mock.calls.length, 1);
});

test('validateCredentials performs GET request to accounts endpoint', async (t) => {
  const fetchMock = mock.method(global, 'fetch', async (input, init) => {
    assert.equal(input, `${BASE_URL}/accounts`);
    assert.equal(init?.method ?? 'GET', 'GET');
    return createResponse({
      object: 'account',
      id: 'acc_1',
      name: 'Conta Teste',
      email: 'conta@example.com',
      cpfCnpj: '00000000000',
    });
  });

  const client = new AsaasClient({ baseUrl: BASE_URL, accessToken: TOKEN });
  t.after(() => fetchMock.mock.restore());

  const account = await client.validateCredentials();
  assert.equal(account.object, 'account');
  assert.equal(fetchMock.mock.calls.length, 1);
});

