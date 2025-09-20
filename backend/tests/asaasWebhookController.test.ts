import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import type { Request, Response } from 'express';
import { Pool } from 'pg';

process.env.DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/testdb';

type QueryCall = { text: string; values?: unknown[] };
type QueryResponse = { rows: any[]; rowCount: number };

const createMockResponse = () => {
  const response: Partial<Response> & { statusCode: number; body: unknown } = {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this as Response;
    },
    json(payload: unknown) {
      this.body = payload;
      return this as Response;
    },
  };

  return response as Response & { statusCode: number; body: unknown };
};

const setupQueryMock = (responses: QueryResponse[]) => {
  const calls: QueryCall[] = [];
  const mock = test.mock.method(
    Pool.prototype,
    'query',
    async function (this: Pool, text: string, values?: unknown[]) {
      calls.push({ text, values });

      if (responses.length === 0) {
        throw new Error('Unexpected query invocation');
      }

      return responses.shift()!;
    }
  );

  const restore = () => {
    mock.mock.restore();
  };

  return { calls, restore };
};

let handleAsaasWebhook: typeof import('../src/controllers/asaasIntegrationController')['handleAsaasWebhook'];
let getAsaasWebhookSecret: typeof import('../src/controllers/asaasIntegrationController')['getAsaasWebhookSecret'];

test.before(async () => {
  ({ handleAsaasWebhook, getAsaasWebhookSecret } = await import(
    '../src/controllers/asaasIntegrationController'
  ));
});

test('handleAsaasWebhook processes PAYMENT_RECEIVED and updates financial flow', async () => {
  const secret = 'top-secret';
  const webhookBody = {
    event: 'PAYMENT_RECEIVED',
    payment: {
      id: 'pay_123',
      status: 'RECEIVED',
      paymentDate: '2024-05-05T10:20:30-03:00',
    },
  };
  const rawBody = JSON.stringify(webhookBody);
  const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  const { calls, restore } = setupQueryMock([
    { rows: [{ id: 1, credential_id: 55, financial_flow_id: 90 }], rowCount: 1 },
    { rows: [{ webhook_secret: secret }], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
  ]);

  const req = {
    body: webhookBody,
    rawBody,
    headers: {
      'asaas-signature': `sha256=${signature}`,
      host: 'example.com',
    },
  } as unknown as Request & { rawBody?: string };

  const res = createMockResponse();

  try {
    await handleAsaasWebhook(req, res);
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 202);
  assert.deepEqual(res.body, { received: true });
  assert.equal(calls.length, 4);

  assert.match(calls[0]?.text ?? '', /FROM asaas_charges/i);
  assert.deepEqual(calls[0]?.values, ['pay_123']);

  assert.match(calls[1]?.text ?? '', /FROM asaas_credentials/i);
  assert.deepEqual(calls[1]?.values, [55]);

  assert.match(calls[2]?.text ?? '', /UPDATE asaas_charges/i);
  assert.equal(calls[2]?.values?.[0], 'RECEIVED');
  assert.equal(calls[2]?.values?.[1], 'PAYMENT_RECEIVED');
  assert.deepEqual(JSON.parse(String(calls[2]?.values?.[2])), webhookBody);
  assert.ok(calls[2]?.values?.[3]);
  assert.equal(calls[2]?.values?.[4], 'pay_123');

  assert.match(calls[3]?.text ?? '', /UPDATE financial_flows/i);
  assert.equal(calls[3]?.values?.[1], 90);
});

test('handleAsaasWebhook logs error and skips updates when signature is invalid', async () => {
  const secret = 'invalid-test';
  const webhookBody = {
    event: 'PAYMENT_CONFIRMED',
    payment: {
      id: 'pay_999',
      status: 'CONFIRMED',
      confirmedDate: '2024-05-10T09:00:00Z',
    },
  };
  const rawBody = JSON.stringify(webhookBody);
  const wrongSignature = crypto.createHmac('sha256', 'other-secret').update(rawBody).digest('hex');

  const { calls, restore } = setupQueryMock([
    { rows: [{ id: 10, credential_id: 42, financial_flow_id: 77 }], rowCount: 1 },
    { rows: [{ webhook_secret: secret }], rowCount: 1 },
  ]);

  const errorMock = test.mock.method(console, 'error');

  const req = {
    body: webhookBody,
    rawBody,
    headers: {
      'asaas-signature': `sha256=${wrongSignature}`,
    },
  } as unknown as Request & { rawBody?: string };

  const res = createMockResponse();

  try {
    await handleAsaasWebhook(req, res);
  } finally {
    restore();
    errorMock.mock.restore();
  }

  assert.equal(res.statusCode, 202);
  assert.deepEqual(res.body, { received: true });
  assert.equal(calls.length, 2);
  assert.equal(errorMock.mock.callCount(), 1);
  assert.match(String(errorMock.mock.calls[0]?.arguments?.[0] ?? ''), /Invalid signature/i);
});

test('getAsaasWebhookSecret returns secret and setup instructions', async () => {
  const { calls, restore } = setupQueryMock([
    { rows: [{ webhook_secret: 'shared-secret' }], rowCount: 1 },
  ]);

  const req = {
    params: { credentialId: '15' },
    headers: { host: 'app.example.com' },
    protocol: 'https',
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await getAsaasWebhookSecret(req, res);
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 200);
  const responseBody = res.body as Record<string, unknown>;
  assert.equal(responseBody.credentialId, 15);
  assert.equal(responseBody.webhookSecret, 'shared-secret');
  assert.equal(typeof responseBody.webhookUrl, 'string');
  assert.ok(Array.isArray(responseBody.instructions));
  assert.equal(calls.length, 1);
  assert.match(calls[0]?.text ?? '', /FROM asaas_credentials/i);
  assert.deepEqual(calls[0]?.values, [15]);
});

