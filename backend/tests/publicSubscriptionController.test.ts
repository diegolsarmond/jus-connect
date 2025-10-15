import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';
import { Pool } from 'pg';

import AsaasClient from '../src/services/asaas/asaasClient';

process.env.DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/testdb';

let cancelSubscription: typeof import('../src/controllers/publicSubscriptionController')['cancelSubscription'];

test.before(async () => {
  ({ cancelSubscription } = await import('../src/controllers/publicSubscriptionController'));
});

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

const setupQueryMock = (responses: Array<{ rows: any[]; rowCount: number }>) => {
  const calls: Array<{ text: string; values?: unknown[] }> = [];

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

test('cancelSubscription atualiza empresa localmente e retorna snapshot', async () => {
  const previousUrl = process.env.ASAAS_API_URL;
  const previousToken = process.env.ASAAS_ACCESS_TOKEN;
  process.env.ASAAS_API_URL = 'https://asaas.test/api';
  process.env.ASAAS_ACCESS_TOKEN = 'token';

  const cancelMock = test.mock.method(
    AsaasClient.prototype,
    'cancelSubscription',
    async (id: string) => {
      assert.equal(id, 'sub_123');
      return { id: 'sub_123', customer: 'cus_456', cycle: 'monthly' } as any;
    }
  );

  const { calls, restore } = setupQueryMock([
    { rows: [{ id: 99 }], rowCount: 1 },
    {
      rows: [
        {
          id: 99,
          nome_empresa: 'Empresa Teste',
          plano: null,
          ativo: false,
          trial_started_at: null,
          trial_ends_at: null,
          current_period_start: null,
          current_period_end: null,
          grace_expires_at: null,
          subscription_trial_ends_at: null,
          subscription_current_period_ends_at: null,
          subscription_grace_period_ends_at: null,
          subscription_cadence: null,
          asaas_subscription_id: null,
        },
      ],
      rowCount: 1,
    },
  ]);

  const req = { params: { subscriptionId: 'sub_123' } } as unknown as Request;
  const res = createMockResponse();

  try {
    await cancelSubscription(req, res);
  } finally {
    restore();
    cancelMock.mock.restore();
    if (previousUrl === undefined) {
      delete process.env.ASAAS_API_URL;
    } else {
      process.env.ASAAS_API_URL = previousUrl;
    }
    if (previousToken === undefined) {
      delete process.env.ASAAS_ACCESS_TOKEN;
    } else {
      process.env.ASAAS_ACCESS_TOKEN = previousToken;
    }
  }

  assert.equal(res.statusCode, 200);
  assert.ok(res.body && typeof res.body === 'object');

  const payload = res.body as {
    subscription?: { id?: string; cycle?: string };
    company?: Record<string, unknown> | null;
  };

  assert.equal(payload.subscription?.id, 'sub_123');
  assert.equal(payload.subscription?.cycle, 'MONTHLY');
  assert.ok(payload.company);
  assert.deepEqual(payload.company, {
    id: 99,
    nomeEmpresa: 'Empresa Teste',
    plano: null,
    ativo: false,
    trialStartedAt: null,
    trialEndsAt: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    graceExpiresAt: null,
    subscriptionTrialEndsAt: null,
    subscriptionCurrentPeriodEndsAt: null,
    subscriptionGracePeriodEndsAt: null,
    subscriptionCadence: null,
    asaasSubscriptionId: null,
  });

  assert.equal(calls.length, 2);
  assert.match(calls[0]?.text ?? '', /FROM public\.empresas WHERE asaas_subscription_id = \$1/i);
  assert.deepEqual(calls[0]?.values, ['sub_123']);
  assert.match(calls[1]?.text ?? '', /UPDATE public\.empresas/i);
  assert.deepEqual(calls[1]?.values, [99]);
});

test('cancelSubscription permanece idempotente quando assinatura já está cancelada', async () => {
  const previousUrl = process.env.ASAAS_API_URL;
  const previousToken = process.env.ASAAS_ACCESS_TOKEN;
  process.env.ASAAS_API_URL = 'https://asaas.test/api';
  process.env.ASAAS_ACCESS_TOKEN = 'token';

  const cancelMock = test.mock.method(
    AsaasClient.prototype,
    'cancelSubscription',
    async () => ({ id: 'sub_canceled', customer: 'cus_fallback', cycle: 'YEARLY' } as any)
  );

  const { calls, restore } = setupQueryMock([
    { rows: [], rowCount: 0 },
    { rows: [{ id: 77 }], rowCount: 1 },
    {
      rows: [
        {
          id: 77,
          nome_empresa: 'Empresa Cancelada',
          plano: null,
          ativo: false,
          trial_started_at: '2024-01-01T00:00:00.000Z',
          trial_ends_at: '2024-01-15T00:00:00.000Z',
          current_period_start: null,
          current_period_end: null,
          grace_expires_at: null,
          subscription_trial_ends_at: null,
          subscription_current_period_ends_at: null,
          subscription_grace_period_ends_at: null,
          subscription_cadence: null,
          asaas_subscription_id: null,
        },
      ],
      rowCount: 1,
    },
  ]);

  const req = { params: { subscriptionId: 'sub_canceled' } } as unknown as Request;
  const res = createMockResponse();

  try {
    await cancelSubscription(req, res);
  } finally {
    restore();
    cancelMock.mock.restore();
    if (previousUrl === undefined) {
      delete process.env.ASAAS_API_URL;
    } else {
      process.env.ASAAS_API_URL = previousUrl;
    }
    if (previousToken === undefined) {
      delete process.env.ASAAS_ACCESS_TOKEN;
    } else {
      process.env.ASAAS_ACCESS_TOKEN = previousToken;
    }
  }

  assert.equal(res.statusCode, 200);
  assert.ok(res.body && typeof res.body === 'object');

  const payload = res.body as {
    subscription?: { id?: string; cycle?: string };
    company?: Record<string, unknown> | null;
  };

  assert.equal(payload.subscription?.id, 'sub_canceled');
  assert.equal(payload.subscription?.cycle, 'YEARLY');
  assert.ok(payload.company);
  assert.deepEqual(payload.company, {
    id: 77,
    nomeEmpresa: 'Empresa Cancelada',
    plano: null,
    ativo: false,
    trialStartedAt: '2024-01-01T00:00:00.000Z',
    trialEndsAt: '2024-01-15T00:00:00.000Z',
    currentPeriodStart: null,
    currentPeriodEnd: null,
    graceExpiresAt: null,
    subscriptionTrialEndsAt: null,
    subscriptionCurrentPeriodEndsAt: null,
    subscriptionGracePeriodEndsAt: null,
    subscriptionCadence: null,
    asaasSubscriptionId: null,
  });

  assert.equal(calls.length, 3);
  assert.match(calls[0]?.text ?? '', /asaas_subscription_id = \$1/i);
  assert.deepEqual(calls[0]?.values, ['sub_canceled']);
  assert.match(calls[1]?.text ?? '', /asaas_customer_id = \$1/i);
  assert.deepEqual(calls[1]?.values, ['cus_fallback']);
  assert.match(calls[2]?.text ?? '', /UPDATE public\.empresas/i);
  assert.deepEqual(calls[2]?.values, [77]);
});
