import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';
import { Pool } from 'pg';
import { SUBSCRIPTION_TRIAL_DAYS } from '../src/constants/subscription';

process.env.DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/testdb';

let createSubscription: typeof import('../src/controllers/subscriptionController')['createSubscription'];

test.before(async () => {
  ({ createSubscription } = await import('../src/controllers/subscriptionController'));
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

test('createSubscription records a trial subscription and returns trial end date', async () => {
  const startDate = new Date('2024-03-01T12:00:00.000Z');
  const expectedTrialEnd = new Date(startDate);
  expectedTrialEnd.setDate(expectedTrialEnd.getDate() + SUBSCRIPTION_TRIAL_DAYS);

  const { calls, restore } = setupQueryMock([
    {
      rows: [{ valor_mensal: '199.90', valor_anual: '1999.90' }],
      rowCount: 1,
    },
    {
      rows: [
        {
          plano: null,
          subscription_cadence: null,
          current_period_start: null,
          current_period_end: null,
          grace_expires_at: null,
          ativo: false,
        },
      ],
      rowCount: 1,
    },
    {
      rows: [
        {
          id: 42,
          plano: 7,
          ativo: true,
          datacadastro: startDate.toISOString(),
          trial_started_at: startDate.toISOString(),
          trial_ends_at: expectedTrialEnd.toISOString(),
          current_period_start: startDate.toISOString(),
          current_period_end: expectedTrialEnd.toISOString(),
          grace_expires_at: expectedTrialEnd.toISOString(),
          subscription_cadence: 'monthly',
        },
      ],
      rowCount: 1,
    },
  ]);

  const req = {
    body: {
      companyId: 42,
      planId: 7,
      status: 'trialing',
      startDate: startDate.toISOString(),
    },
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await createSubscription(req, res);
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 201);
  assert.ok(res.body && typeof res.body === 'object');

  const payload = res.body as {
    status?: string;
    trialEndsAt?: string | null;
    isActive?: boolean;
    cadence?: string;
    currentPeriodStart?: string | null;
    currentPeriodEnd?: string | null;
    graceExpiresAt?: string | null;
  };

  assert.equal(payload.status, 'trialing');
  assert.equal(payload.isActive, true);
  assert.equal(payload.trialEndsAt, expectedTrialEnd.toISOString());
  assert.equal(payload.cadence, 'monthly');
  assert.equal(payload.currentPeriodStart, startDate.toISOString());
  assert.equal(payload.currentPeriodEnd, expectedTrialEnd.toISOString());
  assert.equal(payload.graceExpiresAt, expectedTrialEnd.toISOString());

  assert.equal(calls.length, 3);
  assert.match(calls[0]?.text ?? '', /FROM public\.planos/i);
  assert.deepEqual(calls[0]?.values, [7]);

  assert.match(calls[1]?.text ?? '', /FROM public\.empresas/i);
  assert.deepEqual(calls[1]?.values, [42]);

  assert.match(calls[2]?.text ?? '', /UPDATE public\.empresas/);
  assert.deepEqual(calls[2]?.values, [
    7,
    true,
    startDate,
    startDate,
    expectedTrialEnd,
    startDate,
    expectedTrialEnd,
    expectedTrialEnd,
    'monthly',
    42,
  ]);
});

test('createSubscription returns 409 if company already has an active subscription', async () => {
  const startDate = new Date('2024-05-01T12:00:00.000Z');

  const { calls, restore } = setupQueryMock([
    {
      rows: [{ valor_mensal: '199.90', valor_anual: '1999.90' }],
      rowCount: 1,
    },
    {
      rows: [
        {
          plano: 5,
          subscription_cadence: 'monthly',
          current_period_start: startDate.toISOString(),
          current_period_end: new Date('2024-05-31T12:00:00.000Z').toISOString(),
          grace_expires_at: new Date('2024-06-07T12:00:00.000Z').toISOString(),
          ativo: true,
        },
      ],
      rowCount: 1,
    },
  ]);

  const req = {
    body: {
      companyId: 99,
      planId: 8,
      status: 'active',
      startDate: startDate.toISOString(),
    },
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await createSubscription(req, res);
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.body, {
    error: 'A empresa já possui assinatura ativa. Cancele ou atualize a assinatura existente.',
  });

  assert.equal(calls.length, 2);
  assert.match(calls[0]?.text ?? '', /FROM public\.planos/i);
  assert.deepEqual(calls[0]?.values, [8]);

  assert.match(calls[1]?.text ?? '', /FROM public\.empresas/i);
  assert.deepEqual(calls[1]?.values, [99]);

  assert.ok(!calls.some((call) => /UPDATE public\.empresas/.test(call.text)));
});
