import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';
import { Pool } from 'pg';

import AsaasClient from '../src/services/asaas/asaasClient';
import AsaasSubscriptionService from '../src/services/asaas/subscriptionService';
import AsaasChargeService, { CreateAsaasChargeInput } from '../src/services/asaasChargeService';

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

const createAuth = (userId: number) => ({
  userId,
  payload: {
    sub: userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  },
});

test.before(async () => {
  ({ createPlanPayment } = await import('../src/controllers/planPaymentController'));
});

const setupQueryMock = (responses: Array<{ rows: any[]; rowCount: number }>) => {
  const calls: Array<{ text: string; values?: unknown[] }> = [];

  const queryMock = test.mock.method(
    Pool.prototype,
    'query',
    async function (this: Pool, text: string, values?: unknown[]) {
      calls.push({ text, values });

      if (responses.length === 0) {
        throw new Error('Unexpected query invocation');
      }

      return responses.shift()!;
    },
  );

  const restore = () => {
    queryMock.mock.restore();
  };

  return { calls, restore };
};

test('createPlanPayment creates Asaas customer and stores identifier when missing', async () => {
  const financialFlowRow = {
    id: 500,
    descricao: 'Assinatura Plano Jurídico (mensal)',
    valor: '199.90',
    vencimento: '2024-05-10',
    status: 'pendente',
  };
  const defaultAccountId = '123e4567-e89b-12d3-a456-426614174000';

  const empresaStateRow = {
    id: 45,
    nome_empresa: 'Empresa Teste',
    asaas_subscription_id: null,
    trial_started_at: null,
    trial_ends_at: null,
    subscription_trial_ends_at: null,
    current_period_start: null,
    current_period_end: null,
    subscription_current_period_ends_at: null,
    grace_expires_at: null,
    subscription_grace_period_ends_at: null,
    subscription_cadence: 'monthly',
  };

  const subscriptionMock = test.mock.method(
    AsaasSubscriptionService.prototype,
    'createOrUpdateSubscription',
    async () => ({
      subscription: {
        id: 'sub_123',
        status: 'ACTIVE',
        cycle: 'MONTHLY',
        nextDueDate: '2024-05-10',
      },
      timeline: {
        cadence: 'monthly',
        trialStart: null,
        trialEnd: null,
        currentPeriodStart: new Date('2024-05-10T00:00:00.000Z'),
        currentPeriodEnd: new Date('2024-05-10T00:00:00.000Z'),
        gracePeriodEnd: new Date('2024-05-13T00:00:00.000Z'),
      },
    }),
  );

  const { calls, restore } = setupQueryMock([
    { rows: [{ empresa: 45 }], rowCount: 1 },
    { rows: [{ id: 9, nome: 'Plano Jurídico', valor_mensal: '199.90', valor_anual: '1999.90' }], rowCount: 1 },
    { rows: [empresaStateRow], rowCount: 1 },
    {
      rows: [
        {
          id: 1,
          provider: 'asaas',
          url_api: 'https://sandbox.asaas.com/api/v3',
          key_value: 'token',
          environment: 'homologacao',
          active: true,
        },
      ],
      rowCount: 1,
    },
    { rows: [{ asaas_customer_id: null }], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [{ id: defaultAccountId }], rowCount: 1 },
    { rows: [financialFlowRow], rowCount: 1 },
  ]);

  const createCustomerMock = test.mock.method(
    AsaasClient.prototype,
    'createCustomer',
    async () => ({
      id: 'cus_new_123',
      object: 'customer',
      name: 'Empresa Teste',
    }),
  );

  const updateCustomerMock = test.mock.method(
    AsaasClient.prototype,
    'updateCustomer',
    async () => {
      throw new Error('updateCustomer should not be called when mapping is missing');
    },
  );

  const chargeMock = test.mock.method(
    AsaasChargeService.prototype,
    'createCharge',
    async () => ({
      charge: { id: 'ch_123', status: 'PENDING' },
      flow: { ...financialFlowRow, external_provider: 'asaas', external_reference_id: 'ch_123' },
    }),
  );

  const req = {
    body: {
      planId: 9,
      pricingMode: 'mensal',
      paymentMethod: 'PIX',
      billing: {
        companyName: 'Empresa Teste',
        document: '12345678901',
        email: 'contato@empresa.com',
        notes: 'Observações',
      },
    },
    auth: createAuth(20),
    headers: {},
    ip: '127.0.0.1',
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await createPlanPayment(req, res);
  } finally {
    restore();
    createCustomerMock.mock.restore();
    updateCustomerMock.mock.restore();
    chargeMock.mock.restore();
    subscriptionMock.mock.restore();
  }

  assert.equal(res.statusCode, 201);
  assert.ok(res.body && typeof res.body === 'object');
  assert.equal(createCustomerMock.mock.calls.length, 1);
  assert.equal(updateCustomerMock.mock.calls.length, 0);
  assert.equal(chargeMock.mock.calls.length, 1);
  assert.equal(subscriptionMock.mock.calls.length, 1);

  assert.equal(calls.length, 9);
  assert.match(calls[0]?.text ?? '', /FROM public\.usuarios/);
  assert.match(calls[4]?.text ?? '', /SELECT asaas_customer_id FROM public\.empresas/);
  assert.match(calls[5]?.text ?? '', /UPDATE public\.empresas SET asaas_customer_id/);
  assert.deepEqual(calls[5]?.values, ['cus_new_123', 45]);
  assert.match(calls[6]?.text ?? '', /UPDATE public\.empresas/);
  assert.match(calls[7]?.text ?? '', /SELECT id::text AS id FROM public\.accounts/);
  assert.deepEqual(calls[7]?.values, undefined);
  assert.match(calls[8]?.text ?? '', /INSERT INTO financial_flows/);
  assert.ok(Array.isArray(calls[8]?.values));
  const insertValues = calls[8]?.values as unknown[];
  assert.equal(insertValues.length, 4);
  assert.equal(insertValues[0], 'Assinatura Plano Jurídico (mensal)');
  assert.equal(typeof insertValues[1], 'string');
  assert.match(String(insertValues[1]), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(insertValues[2], 199.9);
  assert.equal(insertValues[3], defaultAccountId);

  const payload = res.body as { plan?: { id?: number }; charge?: { id?: string } };
  assert.equal(payload.plan?.id, 9);
  assert.equal(payload.charge?.id, 'ch_123');
});

test('createPlanPayment requests yearly cycle when pricing mode is annual', async () => {
  const financialFlowRow = {
    id: 915,
    descricao: 'Assinatura Plano Premium (anual)',
    valor: '1999.90',
    vencimento: '2024-11-20',
    status: 'pendente',
  };
  const defaultAccountId = '123e4567-e89b-12d3-a456-426614174111';

  const empresaStateRow = {
    id: 78,
    nome_empresa: 'Empresa Premium',
    asaas_subscription_id: null,
    trial_started_at: null,
    trial_ends_at: null,
    subscription_trial_ends_at: null,
    current_period_start: null,
    current_period_end: null,
    subscription_current_period_ends_at: null,
    grace_expires_at: null,
    subscription_grace_period_ends_at: null,
    subscription_cadence: 'monthly',
  };

  const subscriptionCalls: Array<{
    payload: { cycle?: string };
  }> = [];

  const subscriptionMock = test.mock.method(
    AsaasSubscriptionService.prototype,
    'createOrUpdateSubscription',
    async (input) => {
      subscriptionCalls.push({ payload: input.payload });
      return {
        subscription: {
          id: 'sub_yearly',
          status: 'ACTIVE',
          cycle: 'YEARLY',
          nextDueDate: '2024-11-20',
        },
        timeline: {
          cadence: 'annual',
          trialStart: null,
          trialEnd: null,
          currentPeriodStart: new Date('2024-11-20T00:00:00.000Z'),
          currentPeriodEnd: new Date('2025-11-20T00:00:00.000Z'),
          gracePeriodEnd: new Date('2025-11-25T00:00:00.000Z'),
        },
      };
    },
  );

  const { calls, restore } = setupQueryMock([
    { rows: [{ empresa: 78 }], rowCount: 1 },
    { rows: [{ id: 55, nome: 'Plano Premium', valor_mensal: '219.90', valor_anual: '1999.90' }], rowCount: 1 },
    { rows: [empresaStateRow], rowCount: 1 },
    {
      rows: [
        {
          id: 2,
          provider: 'asaas',
          url_api: 'https://sandbox.asaas.com/api/v3',
          key_value: 'token',
          environment: 'homologacao',
          active: true,
        },
      ],
      rowCount: 1,
    },
    { rows: [{ asaas_customer_id: null }], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [{ id: defaultAccountId }], rowCount: 1 },
    { rows: [financialFlowRow], rowCount: 1 },
  ]);

  const createCustomerMock = test.mock.method(
    AsaasClient.prototype,
    'createCustomer',
    async () => ({
      id: 'cus_premium',
      object: 'customer',
      name: 'Empresa Premium',
    }),
  );

  const updateCustomerMock = test.mock.method(
    AsaasClient.prototype,
    'updateCustomer',
    async () => {
      throw new Error('updateCustomer should not be called when mapping is missing');
    },
  );

  const chargeMock = test.mock.method(
    AsaasChargeService.prototype,
    'createCharge',
    async () => ({
      charge: { id: 'ch_yearly', status: 'PENDING' },
      flow: { id: financialFlowRow.id, status: 'pendente' },
    }),
  );

  const req = {
    body: {
      planId: 55,
      pricingMode: 'anual',
      paymentMethod: 'boleto',
      billing: {
        companyName: 'Empresa Premium',
        document: '12345678000199',
        email: 'financeiro@premium.com',
      },
    },
    auth: createAuth(72),
    headers: {},
    ip: '127.0.0.1',
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await createPlanPayment(req, res);
  } finally {
    restore();
    subscriptionMock.mock.restore();
    createCustomerMock.mock.restore();
    updateCustomerMock.mock.restore();
    chargeMock.mock.restore();
  }

  assert.equal(res.statusCode, 201);
  assert.equal(subscriptionMock.mock.calls.length, 1);
  assert.equal(chargeMock.mock.calls.length, 1);
  assert.equal(calls.length, 9);
  const cycle = subscriptionCalls[0]?.payload?.cycle;
  assert.equal(cycle, 'YEARLY');
});

test('createPlanPayment reuses existing Asaas customer and updates information', async () => {
  const financialFlowRow = {
    id: 700,
    descricao: 'Assinatura Plano Premium (mensal)',
    valor: '299.90',
    vencimento: '2024-06-15',
    status: 'pendente',
  };
  const defaultAccountId = '123e4567-e89b-12d3-a456-426614174000';

  const empresaStateRow = {
    id: 88,
    nome_empresa: 'Empresa Atualizada',
    asaas_subscription_id: 'sub_existing',
    trial_started_at: '2024-04-01',
    trial_ends_at: '2024-04-30',
    subscription_trial_ends_at: null,
    current_period_start: '2024-04-01',
    current_period_end: '2024-04-30',
    subscription_current_period_ends_at: null,
    grace_expires_at: '2024-05-05',
    subscription_grace_period_ends_at: null,
    subscription_cadence: 'monthly',
  };

  const subscriptionMock = test.mock.method(
    AsaasSubscriptionService.prototype,
    'createOrUpdateSubscription',
    async () => ({
      subscription: {
        id: 'sub_existing',
        status: 'ACTIVE',
        cycle: 'MONTHLY',
        nextDueDate: '2024-06-15',
      },
      timeline: {
        cadence: 'monthly',
        trialStart: new Date('2024-04-01T00:00:00.000Z'),
        trialEnd: new Date('2024-04-30T00:00:00.000Z'),
        currentPeriodStart: new Date('2024-06-01T00:00:00.000Z'),
        currentPeriodEnd: new Date('2024-06-30T00:00:00.000Z'),
        gracePeriodEnd: new Date('2024-07-05T00:00:00.000Z'),
      },
    }),
  );

  const { calls, restore } = setupQueryMock([
    { rows: [{ empresa: 88 }], rowCount: 1 },
    { rows: [{ id: 5, nome: 'Plano Premium', valor_mensal: '299.90', valor_anual: '2999.90' }], rowCount: 1 },
    { rows: [empresaStateRow], rowCount: 1 },
    {
      rows: [
        {
          id: 2,
          provider: 'asaas',
          url_api: 'https://sandbox.asaas.com/api/v3',
          key_value: 'token',
          environment: 'homologacao',
          active: true,
        },
      ],
      rowCount: 1,
    },
    { rows: [{ asaas_customer_id: '  cus_existing_999  ' }], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [{ id: defaultAccountId }], rowCount: 1 },
    { rows: [financialFlowRow], rowCount: 1 },
  ]);

  const createCustomerMock = test.mock.method(
    AsaasClient.prototype,
    'createCustomer',
    async () => {
      throw new Error('createCustomer should not be called when mapping exists');
    },
  );

  const updateCustomerMock = test.mock.method(
    AsaasClient.prototype,
    'updateCustomer',
    async (_id, payload) => ({
      id: 'cus_existing_999',
      object: 'customer',
      ...payload,
    }),
  );

  const chargeMock = test.mock.method(
    AsaasChargeService.prototype,
    'createCharge',
    async () => ({
      charge: { id: 'ch_999', status: 'PENDING' },
      flow: { ...financialFlowRow, external_provider: 'asaas', external_reference_id: 'ch_999' },
    }),
  );

  const req = {
    body: {
      planId: 5,
      pricingMode: 'mensal',
      paymentMethod: 'BOLETO',
      billing: {
        companyName: 'Empresa Atualizada',
        document: '01234567890',
        email: 'financeiro@empresa.com',
      },
    },
    auth: createAuth(30),
    headers: {},
    ip: '127.0.0.1',
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await createPlanPayment(req, res);
  } finally {
    restore();
    createCustomerMock.mock.restore();
    updateCustomerMock.mock.restore();
    chargeMock.mock.restore();
    subscriptionMock.mock.restore();
  }

  assert.equal(res.statusCode, 201);
  assert.ok(res.body && typeof res.body === 'object');
  assert.equal(createCustomerMock.mock.calls.length, 0);
  assert.equal(updateCustomerMock.mock.calls.length, 1);
  assert.equal(chargeMock.mock.calls.length, 1);
  assert.equal(subscriptionMock.mock.calls.length, 1);

  assert.equal(calls.length, 9);
  assert.match(calls[4]?.text ?? '', /SELECT asaas_customer_id FROM public\.empresas/);
  assert.match(calls[5]?.text ?? '', /UPDATE public\.empresas SET asaas_customer_id/);
  assert.deepEqual(calls[5]?.values, ['cus_existing_999', 88]);
  assert.match(calls[6]?.text ?? '', /UPDATE public\.empresas/);
  assert.match(calls[7]?.text ?? '', /SELECT id::text AS id FROM public\.accounts/);
  assert.deepEqual(calls[7]?.values, undefined);
  assert.match(calls[8]?.text ?? '', /INSERT INTO financial_flows/);
  assert.ok(Array.isArray(calls[8]?.values));
  const insertValues = calls[8]?.values as unknown[];
  assert.equal(insertValues.length, 4);
  assert.equal(insertValues[0], 'Assinatura Plano Premium (mensal)');
  assert.equal(typeof insertValues[1], 'string');
  assert.match(String(insertValues[1]), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(insertValues[2], 299.9);
  assert.equal(insertValues[3], defaultAccountId);

  const payload = res.body as { charge?: { id?: string }; plan?: { id?: number } };
  assert.equal(payload.plan?.id, 5);
  assert.equal(payload.charge?.id, 'ch_999');
});

test('createPlanPayment forwards debit card method to AsaasChargeService', async () => {
  const financialFlowRow = {
    id: 800,
    descricao: 'Assinatura Plano Plus (mensal)',
    valor: '249.90',
    vencimento: '2024-07-05',
    status: 'pendente',
  };
  const defaultAccountId = '123e4567-e89b-12d3-a456-426614174000';

  const empresaStateRow = {
    id: 55,
    nome_empresa: 'Empresa Plus',
    asaas_subscription_id: null,
    trial_started_at: null,
    trial_ends_at: null,
    subscription_trial_ends_at: null,
    current_period_start: null,
    current_period_end: null,
    subscription_current_period_ends_at: null,
    grace_expires_at: null,
    subscription_grace_period_ends_at: null,
    subscription_cadence: 'monthly',
  };

  const subscriptionMock = test.mock.method(
    AsaasSubscriptionService.prototype,
    'createOrUpdateSubscription',
    async () => ({
      subscription: {
        id: 'sub_plus',
        status: 'ACTIVE',
        cycle: 'MONTHLY',
        nextDueDate: '2024-07-05',
      },
      timeline: {
        cadence: 'monthly',
        trialStart: null,
        trialEnd: null,
        currentPeriodStart: new Date('2024-07-01T00:00:00.000Z'),
        currentPeriodEnd: new Date('2024-07-31T00:00:00.000Z'),
        gracePeriodEnd: new Date('2024-08-05T00:00:00.000Z'),
      },
    }),
  );

  const { calls, restore } = setupQueryMock([
    { rows: [{ empresa: 55 }], rowCount: 1 },
    { rows: [{ id: 12, nome: 'Plano Plus', valor_mensal: '249.90', valor_anual: '2499.90' }], rowCount: 1 },
    { rows: [empresaStateRow], rowCount: 1 },
    {
      rows: [
        {
          id: 3,
          provider: 'asaas',
          url_api: 'https://sandbox.asaas.com/api/v3',
          key_value: 'token',
          environment: 'homologacao',
          active: true,
        },
      ],
      rowCount: 1,
    },
    { rows: [{ asaas_customer_id: 'cus_linked_123' }], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [{ id: defaultAccountId }], rowCount: 1 },
    { rows: [financialFlowRow], rowCount: 1 },
  ]);

  const createCustomerMock = test.mock.method(AsaasClient.prototype, 'createCustomer', async () => {
    throw new Error('createCustomer should not be called when customer already linked');
  });

  const updateCustomerMock = test.mock.method(AsaasClient.prototype, 'updateCustomer', async () => ({
    id: 'cus_linked_123',
    object: 'customer',
    name: 'Empresa Atualizada',
  }));

  const chargeInputs: Array<CreateAsaasChargeInput> = [];
  const chargeMock = test.mock.method(AsaasChargeService.prototype, 'createCharge', async (input) => {
    chargeInputs.push(input as CreateAsaasChargeInput);
    return {
      charge: { id: 'ch_debit_001', status: 'PENDING', billingType: 'DEBIT_CARD' },
      flow: { ...financialFlowRow, external_provider: 'asaas', external_reference_id: 'ch_debit_001' },
    };
  });

  const req = {
    body: {
      planId: 12,
      pricingMode: 'mensal',
      paymentMethod: 'debito',
      billing: {
        companyName: 'Empresa Plus',
        document: '11122233344455',
        email: 'contato@empresaplus.com',
      },
    },
    auth: createAuth(40),
    headers: {},
    ip: '127.0.0.1',
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await createPlanPayment(req, res);
  } finally {
    restore();
    createCustomerMock.mock.restore();
    updateCustomerMock.mock.restore();
    chargeMock.mock.restore();
    subscriptionMock.mock.restore();
  }

  assert.equal(res.statusCode, 201);
  assert.equal(chargeMock.mock.calls.length, 1);
  assert.equal(chargeInputs.length, 1);
  assert.equal(chargeInputs[0]?.billingType, 'DEBIT_CARD');
  assert.equal(subscriptionMock.mock.calls.length, 1);

  assert.equal(calls.length, 9);
  assert.match(calls[4]?.text ?? '', /SELECT asaas_customer_id FROM public\.empresas/);
  assert.match(calls[5]?.text ?? '', /UPDATE public\.empresas SET asaas_customer_id/);
  assert.match(calls[7]?.text ?? '', /SELECT id::text AS id FROM public\.accounts/);
  assert.deepEqual(calls[7]?.values, undefined);
  assert.match(calls[8]?.text ?? '', /INSERT INTO financial_flows/);
  assert.ok(Array.isArray(calls[8]?.values));
  const insertValues = calls[8]?.values as unknown[];
  assert.equal(insertValues.length, 4);
  assert.equal(insertValues[0], 'Assinatura Plano Plus (mensal)');
  assert.equal(typeof insertValues[1], 'string');
  assert.match(String(insertValues[1]), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(insertValues[2], 249.9);
  assert.equal(insertValues[3], defaultAccountId);
});

test('createPlanPayment rejects credit card without card token', async () => {
  const { restore } = setupQueryMock([
    { rows: [{ empresa: 70 }], rowCount: 1 },
    { rows: [{ id: 21, nome: 'Plano Jurídico', valor_mensal: '199.90', valor_anual: '1999.90' }], rowCount: 1 },
  ]);

  const req = {
    body: {
      planId: 21,
      pricingMode: 'mensal',
      paymentMethod: 'cartao',
      billing: {
        companyName: 'Empresa Sem Token',
        document: '12345678000199',
        email: 'financeiro@semcartao.com',
      },
    },
    auth: createAuth(60),
    headers: {},
    ip: '127.0.0.1',
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await createPlanPayment(req, res);
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 400);
  assert.ok(res.body && typeof res.body === 'object');
  assert.match(String((res.body as { error?: string }).error ?? ''), /token do cartão/i);
});

test('createPlanPayment forwards credit card token and metadata to AsaasChargeService', async () => {
  const financialFlowRow = {
    id: 910,
    descricao: 'Assinatura Plano Enterprise (mensal)',
    valor: '499.90',
    vencimento: '2024-08-15',
    status: 'pendente',
  };
  const defaultAccountId = '123e4567-e89b-12d3-a456-426614174000';

  const empresaStateRow = {
    id: 95,
    nome_empresa: 'Empresa Enterprise',
    asaas_subscription_id: null,
    trial_started_at: null,
    trial_ends_at: null,
    subscription_trial_ends_at: null,
    current_period_start: null,
    current_period_end: null,
    subscription_current_period_ends_at: null,
    grace_expires_at: null,
    subscription_grace_period_ends_at: null,
    subscription_cadence: 'monthly',
  };

  const subscriptionMock = test.mock.method(
    AsaasSubscriptionService.prototype,
    'createOrUpdateSubscription',
    async () => ({
      subscription: {
        id: 'sub_enterprise',
        status: 'ACTIVE',
        cycle: 'MONTHLY',
        nextDueDate: '2024-08-15',
      },
      timeline: {
        cadence: 'monthly',
        trialStart: null,
        trialEnd: null,
        currentPeriodStart: new Date('2024-08-01T00:00:00.000Z'),
        currentPeriodEnd: new Date('2024-08-31T00:00:00.000Z'),
        gracePeriodEnd: new Date('2024-09-05T00:00:00.000Z'),
      },
    }),
  );

  const { calls, restore } = setupQueryMock([
    { rows: [{ empresa: 95 }], rowCount: 1 },
    { rows: [{ id: 33, nome: 'Plano Enterprise', valor_mensal: '499.90', valor_anual: '4999.90' }], rowCount: 1 },
    { rows: [empresaStateRow], rowCount: 1 },
    {
      rows: [
        {
          id: 6,
          provider: 'asaas',
          url_api: 'https://sandbox.asaas.com/api/v3',
          key_value: 'token',
          environment: 'homologacao',
          active: true,
        },
      ],
      rowCount: 1,
    },
    { rows: [{ asaas_customer_id: null }], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [{ id: defaultAccountId }], rowCount: 1 },
    { rows: [financialFlowRow], rowCount: 1 },
  ]);

  const createCustomerMock = test.mock.method(
    AsaasClient.prototype,
    'createCustomer',
    async () => ({
      id: 'cus_enterprise_001',
      object: 'customer',
      name: 'Empresa Enterprise',
    }),
  );

  const chargeInputs: Array<CreateAsaasChargeInput> = [];
  const chargeMock = test.mock.method(AsaasChargeService.prototype, 'createCharge', async (input) => {
    chargeInputs.push(input as CreateAsaasChargeInput);
    return {
      charge: { id: 'ch_card_123', status: 'PENDING', billingType: 'CREDIT_CARD' },
      flow: { ...financialFlowRow, external_provider: 'asaas', external_reference_id: 'ch_card_123' },
    };
  });

  const req = {
    body: {
      planId: 33,
      pricingMode: 'mensal',
      paymentMethod: 'cartao',
      billing: {
        companyName: 'Empresa Enterprise',
        document: '55443322110088',
        email: 'financeiro@enterprise.com',
      },
      cardToken: 'tok_card_123',
      cardMetadata: {
        brand: 'VISA',
        remoteIp: '198.51.100.10 ',
        last4Digits: '4242',
      },
    },
    auth: createAuth(75),
    headers: {},
    ip: '127.0.0.1',
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await createPlanPayment(req, res);
  } finally {
    restore();
    createCustomerMock.mock.restore();
    chargeMock.mock.restore();
    subscriptionMock.mock.restore();
  }

  assert.equal(res.statusCode, 201);
  assert.equal(chargeInputs.length, 1);
  assert.equal(chargeInputs[0]?.cardToken, 'tok_card_123');
  assert.equal(chargeInputs[0]?.remoteIp, '198.51.100.10');
  assert.ok(chargeInputs[0]?.metadata);
  const metadata = chargeInputs[0]?.metadata as Record<string, unknown>;
  assert.ok(metadata.cardMetadata && typeof metadata.cardMetadata === 'object');
  assert.equal((metadata.cardMetadata as { brand?: string }).brand, 'VISA');
  assert.equal((metadata.cardMetadata as { remoteIp?: string }).remoteIp, '198.51.100.10');
  assert.equal((metadata.cardMetadata as { last4Digits?: string }).last4Digits, '4242');

  assert.equal(calls.length, 9);
  assert.match(calls[0]?.text ?? '', /FROM public\.usuarios/);
  assert.match(calls[1]?.text ?? '', /FROM public\.planos/);
});

