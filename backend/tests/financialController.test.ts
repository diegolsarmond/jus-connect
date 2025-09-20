import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';
import { Pool } from 'pg';

process.env.DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/testdb';

type QueryCall = { text: string; values?: unknown[] };
type QueryResponse = { rows: any[]; rowCount: number };

let listFlows: typeof import('../src/controllers/financialController')['listFlows'];

test.before(async () => {
  ({ listFlows } = await import('../src/controllers/financialController'));
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

const setupQueryMock = (responses: QueryResponse[]) => {
  const calls: QueryCall[] = [];
  const mock = test.mock.method(
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
    mock.mock.restore();
  };

  return { calls, restore };
};

test('listFlows combines financial and opportunity flows', async () => {
  const financialRow = {
    id: 10,
    tipo: 'despesa',
    conta_id: 7,
    categoria_id: 3,
    descricao: 'Conta de luz',
    valor: 100.5,
    vencimento: new Date('2024-01-10T00:00:00.000Z'),
    pagamento: null,
    status: 'pendente',
  };

  const oportunidadeRow = {
    id: -20,
    tipo: 'receita',
    conta_id: null,
    categoria_id: null,
    descricao: 'Oportunidade 5 - Cliente Teste - Parcela 1/2',
    valor: '250.00',
    vencimento: '2024-02-15',
    pagamento: '2024-02-20',
    status: 'pago',
  };

  const { calls, restore } = setupQueryMock([
    { rows: [financialRow, oportunidadeRow], rowCount: 2 },
    { rows: [{ total: 2 }], rowCount: 1 },
  ]);

  const req = {
    query: {
      page: '2',
      limit: '1',
    },
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await listFlows(req, res);
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    items: [
      {
        id: 10,
        tipo: 'despesa',
        conta_id: 7,
        categoria_id: 3,
        descricao: 'Conta de luz',
        valor: 100.5,
        vencimento: '2024-01-10',
        pagamento: null,
        status: 'pendente',
      },
      {
        id: -20,
        tipo: 'receita',
        conta_id: null,
        categoria_id: null,
        descricao: 'Oportunidade 5 - Cliente Teste - Parcela 1/2',
        valor: 250,
        vencimento: '2024-02-15',
        pagamento: '2024-02-20',
        status: 'pago',
      },
    ],
    total: 2,
    page: 2,
    limit: 1,
  });

  assert.equal(calls.length, 2);
  assert.match(calls[0]?.text ?? '', /WITH oportunidade_parcelas_enriched AS/);
  assert.deepEqual(calls[0]?.values, [1, 1]);
  assert.deepEqual(calls[1]?.values, []);
});

test('listFlows applies cliente filter when provided', async () => {
  const { calls, restore } = setupQueryMock([
    { rows: [], rowCount: 0 },
    { rows: [{ total: 0 }], rowCount: 1 },
  ]);

  const req = {
    query: {
      clienteId: '42',
    },
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await listFlows(req, res);
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    items: [],
    total: 0,
    page: 1,
    limit: 10,
  });

  assert.equal(calls.length, 2);
  assert.match(calls[0]?.text ?? '', /WHERE combined_flows\.cliente_id = \$1/);
  assert.deepEqual(calls[0]?.values, [42, 10, 0]);
  assert.deepEqual(calls[1]?.values, [42]);
});
