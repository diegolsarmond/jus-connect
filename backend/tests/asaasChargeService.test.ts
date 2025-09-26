import assert from 'node:assert/strict';
import test from 'node:test';
import AsaasChargeService, {
  ChargeConflictError,
  ValidationError,
  CreateAsaasChargeInput,
  AsaasClient,
} from '../src/services/asaasChargeService';

interface QueryCall {
  text: string;
  values?: unknown[];
}

interface QueryResponse {
  rows: any[];
  rowCount: number;
}

class FakeDb {
  public readonly calls: QueryCall[] = [];

  constructor(private readonly responses: QueryResponse[]) {}

  async query(text: string, values?: unknown[]) {
    this.calls.push({ text, values });
    if (this.responses.length === 0) {
      throw new Error('No response configured for query');
    }
    return this.responses.shift()!;
  }
}

class FakeAsaasClient implements AsaasClient {
  constructor(private readonly response: any) {}

  public readonly payloads: unknown[] = [];

  async createCharge(payload: any) {
    this.payloads.push(payload);
    return this.response;
  }
}

function createChargeInput(overrides: Partial<CreateAsaasChargeInput> = {}): CreateAsaasChargeInput {
  return {
    financialFlowId: 10,
    billingType: 'PIX',
    clienteId: 55,
    integrationApiKeyId: 7,
    value: 150.5,
    dueDate: '2024-02-10',
    description: 'Mensalidade',
    ...overrides,
  };
}

test('AsaasChargeService.createCharge persists PIX charge and updates flow', async () => {
  const chargeResponse = {
    id: 'ch_123',
    status: 'PENDING',
    invoiceUrl: 'https://asaas.example/invoice',
    pixCopiaECola: '000201...',
    pixQrCode: 'iVBORw0KGgoAAA',
  };

  const fakeClient = new FakeAsaasClient(chargeResponse);

  const insertedRow = {
    id: 90,
    financial_flow_id: 10,
    cliente_id: 55,
    integration_api_key_id: 7,
    asaas_charge_id: 'ch_123',
    billing_type: 'PIX',
    status: 'PENDING',
    due_date: '2024-02-10',
    value: '150.50',
    invoice_url: 'https://asaas.example/invoice',
    pix_payload: '000201...',
    pix_qr_code: 'iVBORw0KGgoAAA',
    boleto_url: null,
    card_last4: null,
    card_brand: null,
    created_at: '2024-02-01T12:00:00.000Z',
    updated_at: '2024-02-01T12:00:00.000Z',
  };

  const updatedFlow = {
    id: 10,
    tipo: 'receita',
    descricao: 'Mensalidade',
    valor: '150.50',
    vencimento: '2024-02-10',
    status: 'pendente',
    external_provider: 'asaas',
    external_reference_id: 'ch_123',
  };

  const db = new FakeDb([
    { rows: [], rowCount: 0 },
    { rows: [insertedRow], rowCount: 1 },
    { rows: [updatedFlow], rowCount: 1 },
  ]);

  const service = new AsaasChargeService(db as any, async () => fakeClient);

  const result = await service.createCharge(createChargeInput(), {
    asaasClient: fakeClient,
    dbClient: db as any,
  });

  assert.equal(db.calls.length, 3);

  const [existsQuery, insertQuery, updateQuery] = db.calls;
  assert.match(existsQuery.text, /SELECT id FROM asaas_charges/i);
  assert.deepEqual(existsQuery.values, [10]);

  assert.match(insertQuery.text, /INSERT INTO asaas_charges/i);
  assert.equal(insertQuery.values?.[0], 10);
  assert.equal(insertQuery.values?.[1], 55);
  assert.equal(insertQuery.values?.[2], 7);
  assert.equal(insertQuery.values?.[3], 'ch_123');
  assert.equal(insertQuery.values?.[4], 'PIX');
  assert.equal(insertQuery.values?.[5], 'PENDING');
  assert.equal(insertQuery.values?.[6], '2024-02-10');
  assert.equal(insertQuery.values?.[7], 150.5);
  assert.equal(insertQuery.values?.[9], '000201...');
  assert.equal(insertQuery.values?.[10], 'iVBORw0KGgoAAA');

  assert.match(updateQuery.text, /UPDATE financial_flows/);
  assert.deepEqual(updateQuery.values, ['asaas', 'ch_123', 'pendente', 10]);

  assert.equal(fakeClient.payloads.length, 1);
  const sentPayload = fakeClient.payloads[0] as any;
  assert.equal(sentPayload.billingType, 'PIX');
  assert.equal(sentPayload.customer, '55');
  assert.equal(sentPayload.value, 150.5);
  assert.equal(sentPayload.dueDate, '2024-02-10');

  assert.equal(result.flow.external_provider, 'asaas');
  assert.equal(result.charge.pixPayload, '000201...');
  assert.equal(result.charge.pixQrCode, 'iVBORw0KGgoAAA');
});

test('AsaasChargeService.createCharge maps credit card responses to paid status', async () => {
  const chargeResponse = {
    id: 'card_999',
    status: 'CONFIRMED',
    creditCard: {
      creditCardNumber: '****1234',
      creditCardBrand: 'VISA',
    },
  };

  const insertedRow = {
    id: 91,
    financial_flow_id: 11,
    cliente_id: null,
    integration_api_key_id: null,
    asaas_charge_id: 'card_999',
    billing_type: 'CREDIT_CARD',
    status: 'CONFIRMED',
    due_date: '2024-03-15',
    value: '320.00',
    invoice_url: null,
    pix_payload: null,
    pix_qr_code: null,
    boleto_url: null,
    card_last4: '1234',
    card_brand: 'VISA',
    created_at: '2024-03-01T10:00:00.000Z',
    updated_at: '2024-03-01T10:00:00.000Z',
  };

  const updatedFlow = {
    id: 11,
    tipo: 'receita',
    descricao: 'Serviço',
    valor: '320.00',
    vencimento: '2024-03-15',
    status: 'pago',
    external_provider: 'asaas',
    external_reference_id: 'card_999',
  };

  const db = new FakeDb([
    { rows: [], rowCount: 0 },
    { rows: [insertedRow], rowCount: 1 },
    { rows: [updatedFlow], rowCount: 1 },
  ]);

  const fakeClient = new FakeAsaasClient(chargeResponse);
  const service = new AsaasChargeService(db as any, async () => fakeClient);

  const input = createChargeInput({
    financialFlowId: 11,
    billingType: 'CREDIT_CARD',
    clienteId: null,
    integrationApiKeyId: null,
    cardToken: 'tok_abc',
    value: 320,
    dueDate: '2024-03-15',
    asaasCustomerId: 'cus_001',
  });

  const result = await service.createCharge(input, { asaasClient: fakeClient, dbClient: db as any });

  assert.equal(result.flow.status, 'pago');
  assert.equal(result.charge.cardLast4, '1234');
  assert.equal(result.charge.cardBrand, 'VISA');

  const payload = fakeClient.payloads[0] as any;
  assert.equal(payload.creditCardToken, 'tok_abc');
});

test('AsaasChargeService.createCharge sends debit card payloads with token metadata', async () => {
  const chargeResponse = {
    id: 'debit_321',
    status: 'PENDING',
    creditCardData: {
      creditCardNumberLast4: '4321',
      creditCardBrand: 'MASTERCARD',
    },
  };

  const insertedRow = {
    id: 92,
    financial_flow_id: 12,
    cliente_id: 77,
    integration_api_key_id: 3,
    asaas_charge_id: 'debit_321',
    billing_type: 'DEBIT_CARD',
    status: 'PENDING',
    due_date: '2024-04-01',
    value: '510.00',
    invoice_url: null,
    pix_payload: null,
    pix_qr_code: null,
    boleto_url: null,
    card_last4: '4321',
    card_brand: 'MASTERCARD',
    created_at: '2024-03-20T12:00:00.000Z',
    updated_at: '2024-03-20T12:00:00.000Z',
  };

  const updatedFlow = {
    id: 12,
    tipo: 'receita',
    descricao: 'Consultoria',
    valor: '510.00',
    vencimento: '2024-04-01',
    status: 'pendente',
    external_provider: 'asaas',
    external_reference_id: 'debit_321',
  };

  const db = new FakeDb([
    { rows: [], rowCount: 0 },
    { rows: [insertedRow], rowCount: 1 },
    { rows: [updatedFlow], rowCount: 1 },
  ]);

  const fakeClient = new FakeAsaasClient(chargeResponse);
  const service = new AsaasChargeService(db as any, async () => fakeClient);

  const input = createChargeInput({
    financialFlowId: 12,
    billingType: 'DEBIT_CARD',
    cardToken: 'tok_debit_123',
    clienteId: 77,
    integrationApiKeyId: 3,
  });

  const result = await service.createCharge(input, { asaasClient: fakeClient, dbClient: db as any });

  assert.equal(fakeClient.payloads.length, 1);
  const sentPayload = fakeClient.payloads[0] as any;
  assert.equal(sentPayload.billingType, 'DEBIT_CARD');
  assert.equal(sentPayload.creditCardToken, 'tok_debit_123');

  assert.equal(result.charge.billingType, 'DEBIT_CARD');
  assert.equal(result.charge.cardLast4, '4321');
  assert.equal(result.charge.cardBrand, 'MASTERCARD');
});

test('AsaasChargeService.createCharge requires cardToken for debit card charges', async () => {
  const service = new AsaasChargeService(new FakeDb([{ rows: [], rowCount: 0 }]) as any, async () => {
    throw new Error('Client should not be called when validation fails');
  });

  await assert.rejects(
    () =>
      service.createCharge(
        createChargeInput({ billingType: 'DEBIT_CARD', cardToken: undefined }),
        {},
      ),
    (error) => {
      assert.ok(error instanceof ValidationError);
      assert.equal(error.message, 'cardToken é obrigatório para cobranças via cartão');
      return true;
    },
  );
});

test('AsaasChargeService.createCharge fails when charge already exists', async () => {
  const db = new FakeDb([{ rows: [{ id: 1 }], rowCount: 1 }]);
  const fakeClient = new FakeAsaasClient({ id: 'duplicate', status: 'PENDING' });
  const service = new AsaasChargeService(db as any, async () => fakeClient);

  await assert.rejects(
    () => service.createCharge(createChargeInput(), { asaasClient: fakeClient, dbClient: db as any }),
    ChargeConflictError,
  );
});

test('AsaasChargeService.createCharge validates customer identifier', async () => {
  const db = new FakeDb([{ rows: [], rowCount: 0 }]);
  const fakeClient = new FakeAsaasClient({ id: 'new', status: 'PENDING' });
  const service = new AsaasChargeService(db as any, async () => fakeClient);

  await assert.rejects(
    () =>
      service.createCharge(
        {
          financialFlowId: 15,
          billingType: 'PIX',
          value: 100,
          dueDate: '2024-04-01',
        },
        { asaasClient: fakeClient, dbClient: db as any },
      ),
    ValidationError,
  );
});
