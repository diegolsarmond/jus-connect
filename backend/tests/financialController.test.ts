import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';
import { Pool } from 'pg';

process.env.DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/testdb';

type QueryCall = { text: string; values?: unknown[] };
type QueryResponse = { rows: any[]; rowCount: number };

let listFlows: typeof import('../src/controllers/financialController')['listFlows'];
let __internal: typeof import('../src/controllers/financialController')['__internal'];

test.before(async () => {
  ({ listFlows, __internal } = await import('../src/controllers/financialController'));
});

test.afterEach(() => {
  __internal.resetOpportunityTablesAvailabilityCache();
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

const setupQueryMock = (responses: (QueryResponse | Error)[]) => {
  const calls: QueryCall[] = [];
  const mock = test.mock.method(
    Pool.prototype,
    'query',
    async function (this: Pool, text: string, values?: unknown[]) {
      calls.push({ text, values });

      if (responses.length === 0) {
        throw new Error('Unexpected query invocation');
      }

      const next = responses.shift()!;
      if (next instanceof Error) {
        throw next;
      }

      return next;
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

  const tablesRow = {
    parcelas: true,
    oportunidades: true,
    clientes: true,
    faturamentos: true,

  };

  const { calls, restore } = setupQueryMock([
    { rows: [tablesRow], rowCount: 1 },
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

  assert.equal(calls.length, 3);
  assert.match(
    calls[0]?.text ?? '',
    /to_regclass\('public\.oportunidade_parcelas'\)/,
  );
  assert.match(
    calls[0]?.text ?? '',
    /has_table_privilege\(parcelas, 'SELECT'\)/,
  );

  assert.equal(calls[0]?.values, undefined);
  assert.match(calls[1]?.text ?? '', /WITH oportunidade_parcelas_enriched AS/);
  assert.match(calls[1]?.text ?? '', /ff\.id::TEXT AS id/);
  assert.match(calls[1]?.text ?? '', /\(-p\.id\)::TEXT AS id/);
  assert.deepEqual(calls[1]?.values, [1, 1]);
  assert.deepEqual(calls[2]?.values, []);
});

test('listFlows preserves textual identifiers returned by the database', async () => {
  const tablesRow = {
    parcelas: false,
    oportunidades: false,
    clientes: false,
    faturamentos: false,
  };

  const textId = '550e8400-e29b-41d4-a716-446655440000';

  const financialRow = {
    id: textId,
    tipo: 'despesa',
    conta_id: 9,
    categoria_id: 4,
    descricao: 'Assinatura de software',
    valor: '199.90',
    vencimento: '2024-05-20',
    pagamento: '2024-05-22',
    status: 'pago',
  };

  const { calls, restore } = setupQueryMock([
    { rows: [tablesRow], rowCount: 1 },
    { rows: [financialRow], rowCount: 1 },
    { rows: [{ total: 1 }], rowCount: 1 },
  ]);

  const req = { query: {} } as unknown as Request;
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
        id: textId,
        tipo: 'despesa',
        conta_id: 9,
        categoria_id: 4,
        descricao: 'Assinatura de software',
        valor: 199.9,
        vencimento: '2024-05-20',
        pagamento: '2024-05-22',
        status: 'pago',
      },
    ],
    total: 1,
    page: 1,
    limit: 10,
  });

  assert.equal(calls.length, 3);
  assert.match(calls[1]?.text ?? '', /WITH combined_flows AS \(/);
  assert.deepEqual(calls[1]?.values, [10, 0]);
  assert.deepEqual(calls[2]?.values, []);
});

test('listFlows applies cliente filter when provided', async () => {
  const tablesRow = {
    parcelas: true,
    oportunidades: true,
    clientes: true,
    faturamentos: true,

  };

  const { calls, restore } = setupQueryMock([
    { rows: [tablesRow], rowCount: 1 },
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

  assert.equal(calls.length, 3);
  assert.match(
    calls[0]?.text ?? '',
    /to_regclass\('public\.oportunidade_parcelas'\)/,
  );
  assert.equal(calls[0]?.values, undefined);
  assert.match(calls[1]?.text ?? '', /WHERE combined_flows\.cliente_id = \$1/);
  assert.deepEqual(calls[1]?.values, ['42', 10, 0]);
  assert.deepEqual(calls[2]?.values, ['42']);
});

test('listFlows returns only financial flows when opportunity tables are absent', async () => {
  const tablesRow = {
    parcelas: false,
    oportunidades: false,
    clientes: false,
    faturamentos: false,

  };

  const financialRow = {
    id: 5,
    tipo: 'despesa',
    conta_id: 1,
    categoria_id: 2,
    descricao: 'Taxa bancária',
    valor: 150.75,
    vencimento: new Date('2024-03-10T00:00:00.000Z'),
    pagamento: null,
    status: 'pendente',
  };

  const { calls, restore } = setupQueryMock([
    { rows: [tablesRow], rowCount: 1 },
    { rows: [financialRow], rowCount: 1 },
    { rows: [{ total: 1 }], rowCount: 1 },
  ]);

  const req = { query: {} } as unknown as Request;
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
        id: 5,
        tipo: 'despesa',
        conta_id: 1,
        categoria_id: 2,
        descricao: 'Taxa bancária',
        valor: 150.75,
        vencimento: '2024-03-10',
        pagamento: null,
        status: 'pendente',
      },
    ],
    total: 1,
    page: 1,
    limit: 10,
  });

  assert.equal(calls.length, 3);
  assert.match(calls[1]?.text ?? '', /WITH combined_flows AS \(/);
  assert.doesNotMatch(calls[1]?.text ?? '', /UNION ALL/);
  assert.deepEqual(calls[1]?.values, [10, 0]);
  assert.deepEqual(calls[2]?.values, []);
});

test('listFlows retries without opportunity tables when union query fails', async () => {
  const tablesRow = {
    parcelas: true,
    oportunidades: true,
    clientes: true,
    faturamentos: true,

  };

  const financialRow = {
    id: 11,
    tipo: 'receita',
    conta_id: null,
    categoria_id: null,
    descricao: 'Mensalidade',
    valor: 80,
    vencimento: '2024-04-01',
    pagamento: '2024-04-05',
    status: 'pago',
  };

  const missingTableError = Object.assign(
    new Error('relation "public.oportunidade_parcelas" does not exist'),
    { code: '42P01' as const },
  );

  const { calls, restore } = setupQueryMock([
    { rows: [tablesRow], rowCount: 1 },
    missingTableError,
    { rows: [financialRow], rowCount: 1 },
    { rows: [{ total: 1 }], rowCount: 1 },
  ]);

  const req = { query: {} } as unknown as Request;
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
        id: 11,
        tipo: 'receita',
        conta_id: null,
        categoria_id: null,
        descricao: 'Mensalidade',
        valor: 80,
        vencimento: '2024-04-01',
        pagamento: '2024-04-05',
        status: 'pago',
      },
    ],
    total: 1,
    page: 1,
    limit: 10,
  });

  assert.equal(calls.length, 4);
  assert.match(calls[1]?.text ?? '', /WITH oportunidade_parcelas_enriched AS/);
  assert.match(calls[2]?.text ?? '', /WITH combined_flows AS \(/);
  assert.doesNotMatch(calls[2]?.text ?? '', /UNION ALL/);
  assert.deepEqual(calls[2]?.values, [10, 0]);
  assert.deepEqual(calls[3]?.values, []);
});

test('listFlows retries without opportunity tables when privileges are missing', async () => {
  const tablesRow = {
    parcelas: true,
    oportunidades: true,
    clientes: true,
    faturamentos: true,
  };

  const financialRow = {
    id: 31,
    tipo: 'receita',
    conta_id: null,
    categoria_id: null,
    descricao: 'Mensalidade',
    valor: 80,
    vencimento: '2024-04-01',
    pagamento: '2024-04-05',
    status: 'pago',
  };

  const insufficientPrivilegeError = Object.assign(
    new Error('permission denied for table oportunidade_parcelas'),
    { code: '42501' as const },
  );

  const { calls, restore } = setupQueryMock([
    { rows: [tablesRow], rowCount: 1 },
    insufficientPrivilegeError,
    { rows: [financialRow], rowCount: 1 },
    { rows: [{ total: 1 }], rowCount: 1 },
  ]);

  const req = { query: {} } as unknown as Request;
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
        id: 31,
        tipo: 'receita',
        conta_id: null,
        categoria_id: null,
        descricao: 'Mensalidade',
        valor: 80,
        vencimento: '2024-04-01',
        pagamento: '2024-04-05',
        status: 'pago',
      },
    ],
    total: 1,
    page: 1,
    limit: 10,
  });

  assert.equal(calls.length, 4);
  assert.match(calls[1]?.text ?? '', /WITH oportunidade_parcelas_enriched AS/);
  assert.match(calls[2]?.text ?? '', /WITH combined_flows AS \(/);
  assert.doesNotMatch(calls[2]?.text ?? '', /UNION ALL/);
  assert.deepEqual(calls[2]?.values, [10, 0]);
  assert.deepEqual(calls[3]?.values, []);

});
