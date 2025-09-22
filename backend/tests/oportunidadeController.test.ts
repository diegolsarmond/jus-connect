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
  );

  await createOrReplaceOpportunityInstallments(
    client as any,
    10,
    '600',
    'À vista',
    1,
    '2024-08-01',
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
  assert.deepEqual(firstInsert?.values, [10, 1, 400, '2024-05-10']);

  const secondInsert = insertCalls[1];
  assert.deepEqual(secondInsert?.values, [10, 2, 400, '2024-06-10']);

  const thirdInsert = insertCalls[2];
  assert.deepEqual(thirdInsert?.values, [10, 3, 400, '2024-07-10']);

  const lastInsert = insertCalls[insertCalls.length - 1];
  assert.deepEqual(lastInsert?.values, [10, 1, 600, '2024-08-01']);

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
  );

  const insertCalls = client.calls.filter((call) =>
    call.text.includes('INSERT INTO public.oportunidade_parcelas'),
  );
  assert.equal(insertCalls.length, 2);

  const firstInsert = insertCalls[0];
  assert.deepEqual(firstInsert?.values, [99, 1, 1000, '2024-01-31']);

  const secondInsert = insertCalls[1];
  assert.deepEqual(secondInsert?.values, [99, 2, 1000, '2024-02-29']);
});
