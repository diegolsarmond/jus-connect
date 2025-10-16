import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';
import pool from '../src/services/db';

type QueryCall = { text: string; values?: unknown[] };

process.env.DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/testdb';

class RecordingClient {
  public readonly calls: QueryCall[] = [];

  async query(text: string, values?: unknown[]) {
    this.calls.push({ text, values });
    return { rows: [], rowCount: 0 };
  }
}

type MockResponse = Response & { statusCode: number; body: unknown };

const createMockResponse = (): MockResponse => {
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

  return response as MockResponse;
};

let createOportunidade: typeof import('../src/controllers/oportunidadeController')['createOportunidade'];

test.before(async () => {
  ({ createOportunidade } = await import('../src/controllers/oportunidadeController'));
});

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

test('createOportunidade retorna 403 quando limite de propostas é atingido', async () => {
  const calls: QueryCall[] = [];

  const poolQueryMock = test.mock.method(
    pool,
    'query',
    async (text: string, values?: unknown[]) => {
      calls.push({ text, values });

      if (text.includes('FROM public.usuarios')) {
        return { rowCount: 1, rows: [{ empresa: 55 }] };
      }

      if (text.includes('FROM public.empresas emp')) {
        return {
          rowCount: 1,
          rows: [
            {
              limite_usuarios: null,
              limite_processos: null,
              limite_propostas: 1,
              limite_clientes: null,
              limite_advogados_processos: null,
              limite_advogados_intimacao: null,
              sincronizacao_processos_habilitada: null,
              sincronizacao_processos_cota: null,
            },
          ],
        };
      }

      if (text.includes('FROM public.oportunidades')) {
        return { rowCount: 1, rows: [{}] };
      }

      throw new Error('Consulta inesperada: ' + text);
    }
  );

  const clientCalls: QueryCall[] = [];
  const poolConnectMock = test.mock.method(pool, 'connect', async () => ({
    async query(text: string, values?: unknown[]) {
      clientCalls.push({ text, values });
      throw new Error('query do cliente não deve ocorrer quando limite é atingido');
    },
    release() {
      // noop
    },
  }));

  const req = {
    auth: { userId: 123 },
    body: {},
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await createOportunidade(req, res);

    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, { error: 'Limite de propostas do plano atingido.' });
    assert.equal(calls.length, 3);
    const limitCall = calls[2];
    assert.ok(limitCall);
    assert.match(limitCall?.text ?? '', /LIMIT \$2/);
    assert.deepEqual(limitCall?.values, [55, 1]);
    assert.equal(poolConnectMock.mock.callCount(), 1);
    assert.equal(clientCalls.length, 0);
  } finally {
    poolConnectMock.mock.restore();
    poolQueryMock.mock.restore();
  }
});

test('createOportunidade continua fluxo quando limite não é atingido', async () => {
  const calls: QueryCall[] = [];

  const poolQueryMock = test.mock.method(
    pool,
    'query',
    async (text: string, values?: unknown[]) => {
      calls.push({ text, values });

      if (text.includes('FROM public.usuarios')) {
        return { rowCount: 1, rows: [{ empresa: 88 }] };
      }

      if (text.includes('FROM public.empresas emp')) {
        return {
          rowCount: 1,
          rows: [
            {
              limite_usuarios: null,
              limite_processos: null,
              limite_propostas: 5,
              limite_clientes: null,
              limite_advogados_processos: null,
              limite_advogados_intimacao: null,
              sincronizacao_processos_habilitada: null,
              sincronizacao_processos_cota: null,
            },
          ],
        };
      }

      if (text.includes('FROM public.oportunidades')) {
        return { rowCount: 3, rows: [{}, {}, {}] };
      }

      throw new Error('Consulta inesperada: ' + text);
    }
  );

  const clientCalls: QueryCall[] = [];
  const poolConnectMock = test.mock.method(pool, 'connect', async () => ({
    async query(text: string, values?: unknown[]) {
      clientCalls.push({ text, values });
      throw new Error('Falha intencional após validar limites');
    },
    release() {
      // noop
    },
  }));

  const req = {
    auth: { userId: 456 },
    body: {},
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await createOportunidade(req, res);
  } catch (error) {
    // Falha esperada devido ao mock de connect.
  } finally {
    poolConnectMock.mock.restore();
    poolQueryMock.mock.restore();
  }

  assert.equal(poolConnectMock.mock.callCount(), 1);
  assert.ok(clientCalls.length > 0);
  assert.equal(calls.length, 3);
  const limitCall = calls[2];
  assert.ok(limitCall);
  assert.deepEqual(limitCall?.values, [88, 5]);
  assert.equal(res.statusCode, 500);
  assert.ok(clientCalls.some((call) => /BEGIN/i.test(call.text ?? '')));
});
