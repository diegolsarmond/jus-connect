import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import type { Request, Response } from 'express';
import { Pool } from 'pg';
import { __internal as subscriptionInternal } from '../src/services/subscriptionService';

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

test.beforeEach(() => {
  subscriptionInternal.resetCaches();
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
    {
      rows: [
        { id: 1, credential_id: 55, financial_flow_id: 90, cliente_id: null, company_id: null },
      ],
      rowCount: 1,
    },
    { rows: [{ webhook_secret: secret }], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [{ column_name: 'empresa' }], rowCount: 1 },
    { rows: [{ empresa_id: 123 }], rowCount: 1 },
    {
      rows: [
        {
          plano: 7,
          subscription_cadence: 'monthly',
          current_period_start: '2024-04-01T00:00:00.000Z',
          current_period_end: '2024-04-30T00:00:00.000Z',
          grace_expires_at: '2024-05-07T00:00:00.000Z',
        },
      ],
      rowCount: 1,
    },
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
  assert.equal(calls.length, 8);

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

  assert.match(calls[4]?.text ?? '', /information_schema\.columns/i);
  assert.match(calls[5]?.text ?? '', /FROM financial_flows/i);
  assert.deepEqual(calls[5]?.values, [90]);

  assert.match(calls[6]?.text ?? '', /FROM public\.empresas/i);
  assert.deepEqual(calls[6]?.values, [123]);

  assert.match(calls[7]?.text ?? '', /UPDATE public\.empresas/i);
  assert.ok(calls[7]?.values?.[0] instanceof Date);
  assert.ok(calls[7]?.values?.[1] instanceof Date);
  assert.equal(calls[7]?.values?.[3], 'monthly');
  assert.equal(calls[7]?.values?.[4], 123);
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
    {
      rows: [
        { id: 10, credential_id: 42, financial_flow_id: 77, cliente_id: null, company_id: null },
      ],
      rowCount: 1,
    },
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

test('handleAsaasWebhook only updates subscription for plan charges', async () => {
  const secret = 'plan-secret';

  const planWebhookBody = {
    event: 'PAYMENT_RECEIVED',
    payment: {
      id: 'plan_charge',
      status: 'RECEIVED',
      paymentDate: '2024-06-01T12:00:00Z',
      metadata: { origin: 'plan-payment' },
    },
  };
  const planRawBody = JSON.stringify(planWebhookBody);
  const planSignature = crypto.createHmac('sha256', secret).update(planRawBody).digest('hex');

  const planQueryMock = setupQueryMock([
    {
      rows: [
        { id: 20, credential_id: 77, financial_flow_id: null, cliente_id: null, company_id: 456 },
      ],
      rowCount: 1,
    },
    { rows: [{ webhook_secret: secret }], rowCount: 1 },
    { rows: [], rowCount: 1 },
    {
      rows: [
        {
          plano: 3,
          subscription_cadence: 'monthly',
          current_period_start: '2024-05-01T00:00:00.000Z',
          current_period_end: '2024-05-31T00:00:00.000Z',
          grace_expires_at: '2024-06-07T00:00:00.000Z',
        },
      ],
      rowCount: 1,
    },
    { rows: [], rowCount: 1 },
  ]);

  const planReq = {
    body: planWebhookBody,
    rawBody: planRawBody,
    headers: {
      'asaas-signature': `sha256=${planSignature}`,
    },
  } as unknown as Request & { rawBody?: string };

  const planRes = createMockResponse();

  try {
    await handleAsaasWebhook(planReq, planRes);
  } finally {
    planQueryMock.restore();
  }

  assert.equal(planRes.statusCode, 202);
  assert.deepEqual(planRes.body, { received: true });
  assert.ok(
    planQueryMock.calls.some((call) => /UPDATE public\.empresas/i.test(String(call.text ?? ''))),
  );

  const nonPlanWebhookBody = {
    event: 'PAYMENT_RECEIVED',
    payment: {
      id: 'customer_charge',
      status: 'RECEIVED',
      paymentDate: '2024-06-02T12:00:00Z',
      metadata: { origin: 'customer-payment' },
    },
  };
  const nonPlanRawBody = JSON.stringify(nonPlanWebhookBody);
  const nonPlanSignature = crypto
    .createHmac('sha256', secret)
    .update(nonPlanRawBody)
    .digest('hex');

  const nonPlanQueryMock = setupQueryMock([
    {
      rows: [
        { id: 21, credential_id: 77, financial_flow_id: null, cliente_id: 999, company_id: 456 },
      ],
      rowCount: 1,
    },
    { rows: [{ webhook_secret: secret }], rowCount: 1 },
    { rows: [], rowCount: 1 },
  ]);

  const nonPlanReq = {
    body: nonPlanWebhookBody,
    rawBody: nonPlanRawBody,
    headers: {
      'asaas-signature': `sha256=${nonPlanSignature}`,
    },
  } as unknown as Request & { rawBody?: string };

  const nonPlanRes = createMockResponse();

  try {
    await handleAsaasWebhook(nonPlanReq, nonPlanRes);
  } finally {
    nonPlanQueryMock.restore();
  }

  assert.equal(nonPlanRes.statusCode, 202);
  assert.deepEqual(nonPlanRes.body, { received: true });
  assert.ok(
    nonPlanQueryMock.calls.every(
      (call) => !/UPDATE public\.empresas/i.test(String(call.text ?? '')),
    ),
  );
});

test('handleAsaasWebhook uses ASAAS_WEBHOOK_SECRET when credential is missing', async () => {
  const previousSecret = process.env.ASAAS_WEBHOOK_SECRET;
  process.env.ASAAS_WEBHOOK_SECRET = '  env-fallback-secret  ';

  const webhookBody = {
    event: 'PAYMENT_CONFIRMED',
    payment: {
      id: 'pay_fallback_env',
      status: 'CONFIRMED',
    },
  };

  const rawBody = JSON.stringify(webhookBody);
  const signature = crypto
    .createHmac('sha256', 'env-fallback-secret')
    .update(rawBody)
    .digest('hex');

  const { calls, restore } = setupQueryMock([
    {
      rows: [
        { id: 1, credential_id: null, financial_flow_id: null, cliente_id: null, company_id: null },
      ],
      rowCount: 1,
    },
    { rows: [], rowCount: 1 },
  ]);

  const req = {
    body: webhookBody,
    rawBody,
    headers: {
      'asaas-signature': `sha256=${signature}`,
    },
  } as unknown as Request & { rawBody?: string };

  const res = createMockResponse();

  try {
    await handleAsaasWebhook(req, res);
  } finally {
    restore();
    if (previousSecret === undefined) {
      delete process.env.ASAAS_WEBHOOK_SECRET;
    } else {
      process.env.ASAAS_WEBHOOK_SECRET = previousSecret;
    }
  }

  assert.equal(res.statusCode, 202);
  assert.deepEqual(res.body, { received: true });
  assert.equal(calls.length, 2);
  assert.match(calls[0]?.text ?? '', /FROM asaas_charges/i);
  assert.match(calls[1]?.text ?? '', /UPDATE asaas_charges/i);
});

test('handleAsaasWebhook falls back to ASAAS_WEBHOOK_SECRET when credential secret is missing', async () => {
  const previousSecret = process.env.ASAAS_WEBHOOK_SECRET;
  process.env.ASAAS_WEBHOOK_SECRET = 'fallback-with-credential';

  const webhookBody = {
    event: 'PAYMENT_RECEIVED',
    payment: {
      id: 'pay_fallback_credential',
      status: 'RECEIVED',
    },
  };

  const rawBody = JSON.stringify(webhookBody);
  const signature = crypto
    .createHmac('sha256', 'fallback-with-credential')
    .update(rawBody)
    .digest('hex');

  const { calls, restore } = setupQueryMock([
    {
      rows: [
        { id: 2, credential_id: 99, financial_flow_id: null, cliente_id: null, company_id: null },
      ],
      rowCount: 1,
    },
    { rows: [{ webhook_secret: null }], rowCount: 1 },
    { rows: [], rowCount: 1 },
  ]);

  const req = {
    body: webhookBody,
    rawBody,
    headers: {
      'asaas-signature': `sha256=${signature}`,
    },
  } as unknown as Request & { rawBody?: string };

  const res = createMockResponse();

  try {
    await handleAsaasWebhook(req, res);
  } finally {
    restore();
    if (previousSecret === undefined) {
      delete process.env.ASAAS_WEBHOOK_SECRET;
    } else {
      process.env.ASAAS_WEBHOOK_SECRET = previousSecret;
    }
  }

  assert.equal(res.statusCode, 202);
  assert.deepEqual(res.body, { received: true });
  assert.equal(calls.length, 3);
  assert.match(calls[0]?.text ?? '', /FROM asaas_charges/i);
  assert.match(calls[1]?.text ?? '', /FROM asaas_credentials/i);
  assert.match(calls[2]?.text ?? '', /UPDATE asaas_charges/i);
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

