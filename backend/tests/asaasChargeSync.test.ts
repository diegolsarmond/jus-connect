import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AsaasChargeSyncService,
  AsaasConfigurationError,
  OPEN_PAYMENT_STATUSES,
  PAID_PAYMENT_STATUSES,
  REFUND_PAYMENT_STATUSES,
  type AsaasPaymentsResponse,
  type AsaasPayment,
} from '../src/services/asaasChargeSync';
import { __resetNotificationState } from '../src/services/notificationService';
import { initNotificationTestDb } from './helpers/notificationDb';

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

test.before(async () => {
  await initNotificationTestDb();
});

test.beforeEach(async () => {
  await __resetNotificationState();
});

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
  assert.deepEqual(
    db.calls[0].values?.[0],
    [...new Set([...OPEN_PAYMENT_STATUSES, ...PAID_PAYMENT_STATUSES, ...REFUND_PAYMENT_STATUSES])],
  );
  assert.equal(client.calls.length, 0);
});

test('syncPendingCharges propagates status changes to asaas_charges and financial_flows', async () => {
  const storedCharges = [
    { id: 1, asaas_id: 'pay_1', financial_flow_id: 10, status: 'PENDING' },
    { id: 2, asaas_id: 'pay_2', financial_flow_id: 20, status: 'PENDING' },
    { id: 3, asaas_id: 'pay_3', financial_flow_id: 30, status: 'RECEIVED' },
  ];

  const db = new FakeDb([
    { rows: storedCharges, rowCount: storedCharges.length },
  ]);

  const remotePayments: AsaasPayment[] = [
    { id: 'pay_1', status: 'OVERDUE', dueDate: '2024-04-15' },
    { id: 'pay_2', status: 'RECEIVED', paymentDate: '2024-04-01' },
    { id: 'pay_3', status: 'REFUNDED' },
    { id: 'other', status: 'PENDING' },
  ];

  const client = new FakeClient([
    { data: remotePayments, hasMore: false, limit: 100, offset: 0 },
  ]);

  const subscriptionUpdates: Array<{
    flowId: number;
    status: string;
    paymentDate: Date | null;
    dueDate: string | null | undefined;
  }> = [];

  const service = new AsaasChargeSyncService(db as any, client as any, 50);
  (service as unknown as { updateSubscriptionForCharge: (...args: any[]) => Promise<void> }).updateSubscriptionForCharge = async (
    flowId: number,
    status: string,
    paymentDate: Date | null,
    dueDate: string | null | undefined,
  ) => {
    subscriptionUpdates.push({ flowId, status, paymentDate, dueDate });
  };

  const result = await service.syncPendingCharges();

  assert.equal(result.totalCharges, 3);
  assert.equal(result.paymentsRetrieved, remotePayments.length);
  assert.equal(result.chargesUpdated, 3);
  assert.equal(result.flowsUpdated, 3);
  assert.deepEqual(
    result.fetchedStatuses,
    [...new Set([...OPEN_PAYMENT_STATUSES, ...PAID_PAYMENT_STATUSES, ...REFUND_PAYMENT_STATUSES])],
  );

  assert.equal(client.calls.length, 1);
  assert.deepEqual(
    client.calls[0].status,
    [...new Set([...OPEN_PAYMENT_STATUSES, ...PAID_PAYMENT_STATUSES, ...REFUND_PAYMENT_STATUSES])],
  );
  assert.equal(client.calls[0].limit, 50);
  assert.equal(client.calls[0].offset, 0);


  const updateCalls = db.calls.slice(1);
  assert.equal(updateCalls.length, 6);

  const [updateCharge1, updateFlow1, updateCharge2, updateFlow2, updateCharge3, updateFlow3] = updateCalls;

  assert.match(updateCharge1.text, /UPDATE\s+asaas_charges/i);
  assert.deepEqual(updateCharge1.values, ['OVERDUE', 1]);

  assert.match(updateFlow1.text, /UPDATE\s+financial_flows/i);
  assert.deepEqual(updateFlow1.values, ['pendente', null, 10]);

  assert.deepEqual(updateCharge2.values, ['RECEIVED', 2]);

  assert.equal(updateFlow2.values?.[0], 'pago');
  assert.ok(updateFlow2.values?.[1] instanceof Date);
  assert.equal(updateFlow2.values?.[2], 20);

  assert.deepEqual(updateCharge3.values, ['REFUNDED', 3]);
  assert.deepEqual(updateFlow3.values, ['estornado', null, 30]);

  assert.equal(subscriptionUpdates.length, 3);
  assert.deepEqual(
    subscriptionUpdates.map((entry) => entry.flowId).sort(),
    [10, 20, 30],
  );
  const paymentEntry = subscriptionUpdates.find((entry) => entry.flowId === 20);
  assert.ok(paymentEntry?.paymentDate instanceof Date);
  const overdueEntry = subscriptionUpdates.find((entry) => entry.flowId === 10);
  assert.equal(overdueEntry?.status, 'OVERDUE');
  assert.equal(overdueEntry?.dueDate, '2024-04-15');
  const refundedEntry = subscriptionUpdates.find((entry) => entry.flowId === 30);
  assert.equal(refundedEntry?.status, 'REFUNDED');
  assert.equal(refundedEntry?.paymentDate, null);
});

test('syncPendingCharges fails fast when credentials are not configured', async () => {
  const db = new FakeDb();
  const client = new FakeClient([], false);
  const service = new AsaasChargeSyncService(db as any, client as any);

  await assert.rejects(() => service.syncPendingCharges(), AsaasConfigurationError);
  assert.equal(db.calls.length, 0);
});
