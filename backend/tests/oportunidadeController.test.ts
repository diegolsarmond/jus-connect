import assert from 'node:assert/strict';
import test from 'node:test';

type QueryCall = { text: string; values?: unknown[] };

class RecordingClient {
  public readonly calls: QueryCall[] = [];

  async query(text: string, values?: unknown[]) {
    this.calls.push({ text, values });
    return { rows: [], rowCount: 0 };
  }
}

test('createOrReplaceOpportunityInstallments replaces installments when editing', async () => {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/test';
  }

  const controller = await import('../src/controllers/oportunidadeController');
  const { createOrReplaceOpportunityInstallments } = controller.__test__;

  const client = new RecordingClient();

  await createOrReplaceOpportunityInstallments(
    client as any,
    10,
    '1.200,00',
    'Pagamento Parcelado',
    3,
    '2024-05-10',
    123,
    null,
  );

  await createOrReplaceOpportunityInstallments(
    client as any,
    10,
    '600',
    'À vista',
    1,
    '2024-08-01',
    123,
    undefined,
  );

  const deleteCalls = client.calls.filter((call) =>
    call.text.startsWith('DELETE FROM public.oportunidade_parcelas'),
  );
  assert.equal(deleteCalls.length, 2);

  const insertCalls = client.calls.filter((call) =>
    call.text.includes('INSERT INTO public.oportunidade_parcelas'),
  );
  assert.equal(insertCalls.length, 4);

  const firstInsert = insertCalls[0];
  assert.deepEqual(firstInsert?.values, [10, 1, 400, '2024-05-10', 123]);

  const secondInsert = insertCalls[1];
  assert.deepEqual(secondInsert?.values, [10, 2, 400, '2024-06-10', 123]);

  const thirdInsert = insertCalls[2];
  assert.deepEqual(thirdInsert?.values, [10, 3, 400, '2024-07-10', 123]);

  const lastInsert = insertCalls[insertCalls.length - 1];
  assert.deepEqual(lastInsert?.values, [10, 1, 600, '2024-08-01', 123]);

  const deleteIndexes = deleteCalls.map((call) => client.calls.indexOf(call));
  assert.equal(deleteIndexes[0], 0);
  assert.equal(deleteIndexes[1], 4);
});

test('createOrReplaceOpportunityInstallments keeps day when month is shorter', async () => {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/test';
  }

  const controller = await import('../src/controllers/oportunidadeController');
  const { createOrReplaceOpportunityInstallments } = controller.__test__;

  const client = new RecordingClient();

  await createOrReplaceOpportunityInstallments(
    client as any,
    99,
    2000,
    'Pagamento Parcelado',
    2,
    '2024-01-31',
    null,
    undefined,
  );

  const insertCalls = client.calls.filter((call) =>
    call.text.includes('INSERT INTO public.oportunidade_parcelas'),
  );
  assert.equal(insertCalls.length, 2);

  const firstInsert = insertCalls[0];
  assert.deepEqual(firstInsert?.values, [99, 1, 1000, '2024-01-31', null]);

  const secondInsert = insertCalls[1];
  assert.deepEqual(secondInsert?.values, [99, 2, 1000, '2024-02-29', null]);
});

test('createOrReplaceOpportunityInstallments stores entry installment with numero 0', async () => {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/test';
  }

  const controller = await import('../src/controllers/oportunidadeController');
  const { createOrReplaceOpportunityInstallments } = controller.__test__;

  const client = new RecordingClient();

  await createOrReplaceOpportunityInstallments(
    client as any,
    77,
    '1.000,00',
    'Pagamento Parcelado',
    3,
    '2024-03-15',
    45,
    '100,00',
  );

  const insertCalls = client.calls.filter((call) =>
    call.text.includes('INSERT INTO public.oportunidade_parcelas'),
  );
  assert.equal(insertCalls.length, 4);

  const [entryCall, ...parcelCalls] = insertCalls;
  assert.deepEqual(entryCall?.values, [77, 0, 100, '2024-03-15', 45]);
  assert.deepEqual(parcelCalls[0]?.values, [77, 1, 300, '2024-03-15', 45]);
  assert.deepEqual(parcelCalls[1]?.values, [77, 2, 300, '2024-04-15', 45]);
  assert.deepEqual(parcelCalls[2]?.values, [77, 3, 300, '2024-05-15', 45]);
});
