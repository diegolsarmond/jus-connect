import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';
import { Pool } from 'pg';

import AsaasClient from '../src/services/asaas/asaasClient';
import AsaasSubscriptionService from '../src/services/asaas/subscriptionService';
import AsaasChargeService from '../src/services/asaasChargeService';

process.env.DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/testdb';

let createPlanPayment: typeof import('../src/controllers/planPaymentController')['createPlanPayment'];

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

test.before(async () => {
  ({ createPlanPayment } = await import('../src/controllers/planPaymentController'));
});

test('createPlanPayment creates a subscription, stores the remote id and aligns trial dates', async () => {

  const createCustomerMock = test.mock.method(
    AsaasClient.prototype,
    'createCustomer',
    async () => ({ id: 'cus_123' })
  );

  const subscriptionTimeline = {
    trialStart: new Date('2024-12-01T00:00:00.000Z'),
    trialEnd: new Date('2030-01-15T00:00:00.000Z'),
    currentPeriodStart: new Date('2024-12-01T00:00:00.000Z'),
    currentPeriodEnd: new Date('2030-01-15T00:00:00.000Z'),
    gracePeriodEnd: null,
    cadence: 'monthly' as const,
  };

  const subscriptionMock = test.mock.method(
    AsaasSubscriptionService.prototype,
    'createOrUpdateSubscription',
    async () => ({
      subscription: {
        id: 'sub_999',
        status: 'ACTIVE',
        cycle: 'MONTHLY',
        nextDueDate: '2030-01-15',
      },
      timeline: subscriptionTimeline,
    })
  );

  const chargeMock = test.mock.method(
    AsaasChargeService.prototype,
    'createCharge',
    async () => ({
      charge: {
        id: 7,
        financialFlowId: 42,
        clienteId: 10,
        integrationApiKeyId: 3,
        asaasChargeId: 'pay_123',
        billingType: 'PIX',
        status: 'PENDING',
        dueDate: '2030-01-15',
        value: '199.90',
        invoiceUrl: null,
        pixPayload: 'payload',
        pixQrCode: 'qr',
        boletoUrl: null,
        cardLast4: null,
        cardBrand: null,
        createdAt: '2024-12-01T00:00:00.000Z',
        updatedAt: '2024-12-01T00:00:00.000Z',
      },
      flow: {
        id: 42,
        descricao: 'Assinatura Plano Pro (mensal)',
        valor: '199.90',
        vencimento: '2030-01-15',
        status: 'pendente',
      },
    })
  );

  const { calls, restore } = setupQueryMock([
    { rows: [{ empresa: 10 }], rowCount: 1 },
    {
      rows: [
        {
          id: 5,
          nome: 'Plano Pro',
          valor_mensal: '199.90',
          valor_anual: '2199.90',
        },
      ],
      rowCount: 1,
    },
    {
      rows: [
        {
          id: 10,
          nome_empresa: 'Empresa Teste',
          asaas_subscription_id: null,
          trial_started_at: '2024-12-01T00:00:00.000Z',
          trial_ends_at: '2030-01-15T00:00:00.000Z',
          subscription_trial_ends_at: null,
          current_period_start: '2024-12-01T00:00:00.000Z',
          current_period_end: '2030-01-15T00:00:00.000Z',
          subscription_current_period_ends_at: null,
          grace_expires_at: null,
          subscription_grace_period_ends_at: null,
          subscription_cadence: 'monthly',
        },
      ],
      rowCount: 1,
    },
    {
      rows: [
        {
          id: 1,
          provider: 'asaas',
          url_api: null,
          key_value: 'asaas-token',
          environment: 'homologacao',
          active: true,
        },
      ],
      rowCount: 1,
    },
    {
      rows: [
        {
          id: 10,
          nome_empresa: 'Empresa Teste',
          plano: 5,
          ativo: true,
          trial_started_at: '2024-12-01T00:00:00.000Z',
          trial_ends_at: '2030-01-15T00:00:00.000Z',
          current_period_start: '2024-12-01T00:00:00.000Z',
          current_period_end: '2030-01-15T00:00:00.000Z',
          grace_expires_at: '2030-01-22T00:00:00.000Z',
          subscription_cadence: 'monthly',
          asaas_subscription_id: 'sub_999',
        },
      ],
      rowCount: 1,
    },
    {
      rows: [
        {
          id: 42,
          descricao: 'Assinatura Plano Pro (mensal)',
          valor: '199.90',
          vencimento: '2030-01-15',
          status: 'pendente',
        },
      ],
      rowCount: 1,
    },
  ]);

  const req = {
    auth: { userId: 99 },
    body: {
      planId: 5,
      pricingMode: 'mensal',
      paymentMethod: 'pix',
      billing: {
        companyName: 'Empresa Teste',
        document: '12.345.678/0001-99',
        email: 'faturamento@example.com',
        notes: 'Observação',
      },
    },
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await createPlanPayment(req, res);
  } finally {
    restore();
    createCustomerMock.mock.restore();
    subscriptionMock.mock.restore();
    chargeMock.mock.restore();
  }

  assert.equal(res.statusCode, 201);
  assert.ok(res.body && typeof res.body === 'object');

  const payload = res.body as {
    subscription?: Record<string, unknown>;
  };

  assert.ok(payload.subscription);
  assert.equal(payload.subscription?.id, 'sub_999');
  assert.equal(payload.subscription?.cadence, 'monthly');
  assert.equal(payload.subscription?.trialEnd, '2030-01-15T00:00:00.000Z');
  assert.equal(payload.subscription?.gracePeriodEnd, '2030-01-22T00:00:00.000Z');

  assert.equal(subscriptionMock.mock.calls.length, 1);
  const subscriptionCall = subscriptionMock.mock.calls[0]?.arguments[0];
  assert.ok(subscriptionCall);
  assert.equal(subscriptionCall.payload.nextDueDate, '2030-01-15');
  assert.equal(subscriptionCall.payload.cycle, 'MONTHLY');
  assert.equal(subscriptionCall.payload.subscriptionId, undefined);

  assert.equal(chargeMock.mock.calls.length, 1);
  const chargeCall = chargeMock.mock.calls[0]?.arguments[0];
  assert.ok(chargeCall);
  assert.equal(chargeCall.metadata?.subscriptionId, 'sub_999');
  assert.equal(chargeCall.dueDate, '2030-01-15');

  assert.equal(calls.length, 6);
  assert.match(calls[4]?.text ?? '', /UPDATE public\.empresas/i);
  const updateValues = calls[4]?.values ?? [];
  assert.equal(updateValues[1], 'sub_999');
  assert.ok(updateValues[2] instanceof Date);
  assert.equal((updateValues[3] as Date).toISOString(), '2030-01-15T00:00:00.000Z');
  assert.equal((updateValues[5] as Date).toISOString(), '2030-01-15T00:00:00.000Z');
  assert.equal((updateValues[6] as Date).toISOString(), '2030-01-22T00:00:00.000Z');
  assert.equal(updateValues[7], 'monthly');

  assert.match(calls[5]?.text ?? '', /INSERT INTO financial_flows/i);
  assert.equal(calls[5]?.values?.[1], '2030-01-15');
});

test('createPlanPayment updates an existing subscription using the annual cycle', async () => {

  const createCustomerMock = test.mock.method(
    AsaasClient.prototype,
    'createCustomer',
    async () => ({ id: 'cus_existing' })
  );

  const subscriptionMock = test.mock.method(
    AsaasSubscriptionService.prototype,
    'createOrUpdateSubscription',
    async () => ({
      subscription: {
        id: 'sub_existing',
        status: 'ACTIVE',
        cycle: 'ANNUAL',
        nextDueDate: '2031-05-20',
      },
      timeline: {
        trialStart: null,
        trialEnd: new Date('2031-05-20T00:00:00.000Z'),
        currentPeriodStart: new Date('2030-05-20T00:00:00.000Z'),
        currentPeriodEnd: new Date('2031-05-20T00:00:00.000Z'),
        gracePeriodEnd: new Date('2031-06-19T00:00:00.000Z'),
        cadence: 'annual',
      },
    })
  );

  const chargeMock = test.mock.method(
    AsaasChargeService.prototype,
    'createCharge',
    async () => ({
      charge: {
        id: 9,
        financialFlowId: 88,
        clienteId: 10,
        integrationApiKeyId: 3,
        asaasChargeId: 'pay_existing',
        billingType: 'BOLETO',
        status: 'PENDING',
        dueDate: '2031-05-20',
        value: '2999.90',
        invoiceUrl: null,
        pixPayload: null,
        pixQrCode: null,
        boletoUrl: 'https://asaas.test/boleto',
        cardLast4: null,
        cardBrand: null,
        createdAt: '2030-05-20T00:00:00.000Z',
        updatedAt: '2030-05-20T00:00:00.000Z',
      },
      flow: {
        id: 88,
        descricao: 'Assinatura Plano Premium (anual)',
        valor: '2999.90',
        vencimento: '2031-05-20',
        status: 'pendente',
      },
    })
  );

  const { calls, restore } = setupQueryMock([
    { rows: [{ empresa: 20 }], rowCount: 1 },
    {
      rows: [
        {
          id: 9,
          nome: 'Plano Premium',
          valor_mensal: '399.90',
          valor_anual: '2999.90',
        },
      ],
      rowCount: 1,
    },
    {
      rows: [
        {
          id: 20,
          nome_empresa: 'Empresa Premium',
          asaas_subscription_id: 'sub_existing',
          trial_started_at: null,
          trial_ends_at: null,
          subscription_trial_ends_at: '2031-05-20T00:00:00.000Z',
          current_period_start: null,
          current_period_end: null,
          subscription_current_period_ends_at: '2031-05-20T00:00:00.000Z',
          grace_expires_at: null,
          subscription_grace_period_ends_at: null,
          subscription_cadence: 'annual',
        },
      ],
      rowCount: 1,
    },
    {
      rows: [
        {
          id: 2,
          provider: 'asaas',
          url_api: null,
          key_value: 'asaas-token',
          environment: 'homologacao',
          active: true,
        },
      ],
      rowCount: 1,
    },
    {
      rows: [
        {
          id: 20,
          nome_empresa: 'Empresa Premium',
          plano: 9,
          ativo: true,
          trial_started_at: null,
          trial_ends_at: '2031-05-20T00:00:00.000Z',
          current_period_start: '2030-05-20T00:00:00.000Z',
          current_period_end: '2031-05-20T00:00:00.000Z',
          grace_expires_at: '2031-06-19T00:00:00.000Z',
          subscription_cadence: 'annual',
          asaas_subscription_id: 'sub_existing',
        },
      ],
      rowCount: 1,
    },
    {
      rows: [
        {
          id: 88,
          descricao: 'Assinatura Plano Premium (anual)',
          valor: '2999.90',
          vencimento: '2031-05-20',
          status: 'pendente',
        },
      ],
      rowCount: 1,
    },
  ]);

  const req = {
    auth: { userId: 101 },
    body: {
      planId: 9,
      pricingMode: 'anual',
      paymentMethod: 'boleto',
      billing: {
        companyName: 'Empresa Premium',
        document: '98.765.432/0001-55',
        email: 'financeiro@example.com',
      },
    },
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await createPlanPayment(req, res);
  } finally {
    restore();
    createCustomerMock.mock.restore();
    subscriptionMock.mock.restore();
    chargeMock.mock.restore();
  }

  assert.equal(res.statusCode, 201);
  const payload = res.body as { subscription?: Record<string, unknown> };
  assert.ok(payload.subscription);
  assert.equal(payload.subscription?.id, 'sub_existing');
  assert.equal(payload.subscription?.cadence, 'annual');

  const subscriptionCall = subscriptionMock.mock.calls[0]?.arguments[0];
  assert.ok(subscriptionCall);
  assert.equal(subscriptionCall.payload.subscriptionId, 'sub_existing');
  assert.equal(subscriptionCall.payload.cycle, 'ANNUAL');
  assert.equal(subscriptionCall.payload.nextDueDate, '2031-05-20');

  const updateValues = calls[4]?.values ?? [];
  assert.equal(updateValues[1], 'sub_existing');
  assert.equal(updateValues[7], 'annual');
  assert.equal((updateValues[5] as Date).toISOString(), '2031-05-20T00:00:00.000Z');
  assert.equal((updateValues[6] as Date).toISOString(), '2031-06-19T00:00:00.000Z');
});
