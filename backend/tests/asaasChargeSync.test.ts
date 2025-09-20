import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AsaasChargeSyncService,
  AsaasConfigurationError,
  OPEN_PAYMENT_STATUSES,
  PAID_PAYMENT_STATUSES,
  type AsaasPaymentsResponse,
  type AsaasPayment,
} from '../src/services/asaasChargeSync';

type QueryCall = { text: string; values?: unknown[] };

type QueryResponse = { rows: any[]; rowCount: number };

class FakeDb {
  public readonly calls: QueryCall[] = [];

  constructor(private readonly responses: QueryResponse[] = []) {}

  async query(text: string, values?: unknown[]) {
    this.calls.push({ text, values });
    if (this.responses.length > 0) {
      return this.responses.shift()!;
    }
    return { rows: [], rowCount: 0 };
  }
}

class FakeClient {
  public readonly calls: Array<{ status: string[]; limit?: number; offset?: number }> = [];

  constructor(
    private readonly responses: AsaasPaymentsResponse[] = [],
    private readonly configured = true
  ) {}

  hasValidConfiguration(): boolean {
    return this.configured;
  }

  async listPayments(params: { status: string[]; limit?: number; offset?: number }): Promise<AsaasPaymentsResponse> {
    this.calls.push(params);
    if (this.responses.length > 0) {
      return this.responses.shift()!;
    }
    return { data: [], hasMore: false, totalCount: 0, limit: params.limit, offset: params.offset };
  }
}

test('syncPendingCharges consults only pending charges when querying storage', async () => {
  const db = new FakeDb([
    { rows: [], rowCount: 0 },
  ]);
  const client = new FakeClient([]);
  const service = new AsaasChargeSyncService(db as any, client as any);

  const result = await service.syncPendingCharges();

  assert.equal(result.totalCharges, 0);
  assert.equal(db.calls.length, 1);
  assert.ok(/FROM\s+asaas_charges/i.test(db.calls[0].text));
  assert.deepEqual(db.calls[0].values?.[0], OPEN_PAYMENT_STATUSES);
  assert.equal(client.calls.length, 0);
});

test('syncPendingCharges propagates status changes to asaas_charges and financial_flows', async () => {
  const storedCharges = [
    { id: 1, asaas_id: 'pay_1', financial_flow_id: 10, status: 'PENDING' },
    { id: 2, asaas_id: 'pay_2', financial_flow_id: 20, status: 'PENDING' },
  ];

  const db = new FakeDb([
    { rows: storedCharges, rowCount: storedCharges.length },
  ]);

  const remotePayments: AsaasPayment[] = [
    { id: 'pay_1', status: 'OVERDUE' },
    { id: 'pay_2', status: 'RECEIVED', paymentDate: '2024-04-01' },
    { id: 'other', status: 'PENDING' },
  ];

  const client = new FakeClient([
    { data: remotePayments, hasMore: false, limit: 100, offset: 0 },
  ]);

  const service = new AsaasChargeSyncService(db as any, client as any, 50);

  const result = await service.syncPendingCharges();

  assert.equal(result.totalCharges, 2);
  assert.equal(result.paymentsRetrieved, remotePayments.length);
  assert.equal(result.chargesUpdated, 2);
  assert.equal(result.flowsUpdated, 2);
  assert.deepEqual(result.fetchedStatuses, [...OPEN_PAYMENT_STATUSES, ...PAID_PAYMENT_STATUSES]);

  assert.equal(client.calls.length, 1);
  assert.deepEqual(client.calls[0].status, [...OPEN_PAYMENT_STATUSES, ...PAID_PAYMENT_STATUSES]);
  assert.equal(client.calls[0].limit, 50);
  assert.equal(client.calls[0].offset, 0);

  // First call is the SELECT used to load the pending charges
  const updateCalls = db.calls.slice(1);
  assert.equal(updateCalls.length, 4);

  const [updateCharge1, updateFlow1, updateCharge2, updateFlow2] = updateCalls;

  assert.match(updateCharge1.text, /UPDATE\s+asaas_charges/i);
  assert.deepEqual(updateCharge1.values, ['OVERDUE', 1]);

  assert.match(updateFlow1.text, /UPDATE\s+financial_flows/i);
  assert.deepEqual(updateFlow1.values, ['pendente', null, 10]);

  assert.deepEqual(updateCharge2.values, ['RECEIVED', 2]);

  assert.equal(updateFlow2.values?.[0], 'pago');
  assert.ok(updateFlow2.values?.[1] instanceof Date);
  assert.equal(updateFlow2.values?.[2], 20);
});

test('syncPendingCharges fails fast when credentials are not configured', async () => {
  const db = new FakeDb();
  const client = new FakeClient([], false);
  const service = new AsaasChargeSyncService(db as any, client as any);

  await assert.rejects(() => service.syncPendingCharges(), AsaasConfigurationError);
  assert.equal(db.calls.length, 0);
});
