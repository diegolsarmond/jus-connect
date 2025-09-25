import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';
import { Pool } from 'pg';

process.env.DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/testdb';

type QueryCall = { text: string; values?: unknown[] };
type QueryResponse = { rows: any[]; rowCount: number };

let listFlows: typeof import('../src/controllers/financialController')['listFlows'];
let settleFlow: typeof import('../src/controllers/financialController')['settleFlow'];
let __internal: typeof import('../src/controllers/financialController')['__internal'];

const financialFlowColumnsResponse: QueryResponse = {
  rows: [
    { column_name: 'id' },
    { column_name: 'tipo' },
    { column_name: 'descricao' },
    { column_name: 'valor' },
    { column_name: 'idempresa' },
    { column_name: 'fornecedor_id' },
  ],
  rowCount: 6,
};

const financialFlowColumnsWithoutEmpresaResponse: QueryResponse = {
  rows: [
    { column_name: 'id' },
    { column_name: 'tipo' },
    { column_name: 'descricao' },
    { column_name: 'valor' },
  ],
  rowCount: 4,
};


const DEFAULT_EMPRESA_ID = 123;
const empresaLookupResponse: QueryResponse = {
  rows: [{ empresa: DEFAULT_EMPRESA_ID }],
  rowCount: 1,
};

const financialFlowEmpresaColumnOnlyEmpresaResponse: QueryResponse = {
  rows: [
    { column_name: 'id' },
    { column_name: 'tipo' },
    { column_name: 'descricao' },
    { column_name: 'valor' },
    { column_name: 'empresa' },
  ],
  rowCount: 5,
};

const financialFlowColumnsWithoutFornecedorResponse: QueryResponse = {
  rows: [
    { column_name: 'id' },
    { column_name: 'tipo' },
    { column_name: 'descricao' },
    { column_name: 'valor' },
    { column_name: 'idempresa' },
  ],
  rowCount: 5,
};


test.before(async () => {
  ({ listFlows, settleFlow, __internal } = await import('../src/controllers/financialController'));
});

test.afterEach(() => {
  __internal.resetOpportunityTablesAvailabilityCache();
  __internal.resetFinancialFlowEmpresaColumnCache();
  __internal.resetFinancialFlowClienteColumnCache();
  __internal.resetFinancialFlowFornecedorColumnCache();
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
    conta_id: '7',
    categoria_id: '3',
    cliente_id: null,
    fornecedor_id: '55',
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
    cliente_id: '77',
    fornecedor_id: null,
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
    empresaLookupResponse,
    financialFlowColumnsResponse,

    { rows: [tablesRow], rowCount: 1 },
    { rows: [financialRow, oportunidadeRow], rowCount: 2 },
    { rows: [{ total: 2 }], rowCount: 1 },
  ]);

  const req = {
    query: {
      page: '2',
      limit: '1',
    },
    auth: { userId: 10 },
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
        cliente_id: null,
        fornecedor_id: '55',
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
        cliente_id: '77',
        fornecedor_id: null,
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

  assert.equal(calls.length, 5);
  assert.match(calls[0]?.text ?? '', /FROM public\.usuarios WHERE id = \$1/);
  assert.deepEqual(calls[0]?.values, [10]);
  assert.match(calls[1]?.text ?? '', /information_schema\.columns/);
  assert.equal(calls[1]?.values, undefined);
  assert.match(
    calls[2]?.text ?? '',
    /to_regclass\('public\.oportunidade_parcelas'\)/,
  );
  assert.match(
    calls[2]?.text ?? '',
    /has_table_privilege\(parcelas, 'SELECT'\)/,
  );

  assert.equal(calls[2]?.values, undefined);
  assert.match(calls[3]?.text ?? '', /WITH oportunidade_parcelas_enriched AS/);
  assert.match(calls[3]?.text ?? '', /ff\.id::TEXT AS id/);
  assert.match(calls[3]?.text ?? '', /ff\.conta_id::TEXT AS conta_id/);
  assert.match(calls[3]?.text ?? '', /ff\.categoria_id::TEXT AS categoria_id/);
  assert.match(calls[3]?.text ?? '', /ff\."idempresa" AS empresa_id/);
  assert.match(calls[3]?.text ?? '', /\(-p\.id\)::TEXT AS id/);
  assert.match(calls[3]?.text ?? '', /NULL::TEXT AS conta_id/);
  assert.match(calls[3]?.text ?? '', /NULL::TEXT AS categoria_id/);
  assert.match(calls[3]?.text ?? '', /p\.idempresa AS empresa_id/);
  assert.match(calls[3]?.text ?? '', /WHERE combined_flows\.empresa_id = \$1/);
  assert.deepEqual(calls[3]?.values, [DEFAULT_EMPRESA_ID, 1, 1]);
  assert.deepEqual(calls[4]?.values, [DEFAULT_EMPRESA_ID]);
});

test('listFlows falls back to authenticated empresa when column is missing', async () => {
  const tablesRow = {
    parcelas: false,
    oportunidades: false,
    clientes: false,
    faturamentos: false,
  };

  const financialRow = {
    id: 1,
    tipo: 'receita',
    conta_id: null,
    categoria_id: null,
    descricao: 'Mensalidade',
    valor: 100,
    vencimento: '2024-01-01',
    pagamento: null,
    status: 'pendente',
  };

  const { calls, restore } = setupQueryMock([
    empresaLookupResponse,
    financialFlowColumnsWithoutEmpresaResponse,
    { rows: [tablesRow], rowCount: 1 },
    { rows: [financialRow], rowCount: 1 },
    { rows: [{ total: 1 }], rowCount: 1 },
  ]);

  const req = { query: {}, auth: { userId: 99 } } as unknown as Request;
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
        id: 1,
        tipo: 'receita',
        conta_id: null,
        categoria_id: null,
        descricao: 'Mensalidade',
        valor: 100,
        vencimento: '2024-01-01',
        pagamento: null,
        status: 'pendente',
      },
    ],
    total: 1,
    page: 1,
    limit: 10,
  });

  assert.match(calls[3]?.text ?? '', /\$1::INTEGER AS empresa_id/);
  assert.deepEqual(calls[3]?.values, [DEFAULT_EMPRESA_ID, 10, 0]);
  assert.deepEqual(calls[4]?.values, [DEFAULT_EMPRESA_ID]);
});

test('listFlows tolerates legacy empresa column names', async () => {
  const tablesRow = {
    parcelas: false,
    oportunidades: false,
    clientes: false,
    faturamentos: false,
  };

  const financialRow = {
    id: 1,
    tipo: 'receita',
    conta_id: null,
    categoria_id: null,
    descricao: 'Mensalidade',
    valor: 100,
    vencimento: '2024-01-01',
    pagamento: null,
    status: 'pendente',
  };

  const { calls, restore } = setupQueryMock([
    empresaLookupResponse,
    financialFlowEmpresaColumnOnlyEmpresaResponse,
    { rows: [tablesRow], rowCount: 1 },
    { rows: [financialRow], rowCount: 1 },
    { rows: [{ total: 1 }], rowCount: 1 },
  ]);

  const req = { query: {}, auth: { userId: 3 } } as unknown as Request;
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
        id: 1,
        tipo: 'receita',
        conta_id: null,
        categoria_id: null,
        descricao: 'Mensalidade',
        valor: 100,
        vencimento: '2024-01-01',
        pagamento: null,
        status: 'pendente',
      },
    ],
    total: 1,
    page: 1,
    limit: 10,
  });

  assert.equal(calls.length, 5);
  assert.match(calls[0]?.text ?? '', /FROM public\.usuarios WHERE id = \$1/);
  assert.deepEqual(calls[0]?.values, [3]);
  assert.match(calls[1]?.text ?? '', /information_schema\.columns/);
  assert.equal(calls[1]?.values, undefined);
  assert.match(calls[2]?.text ?? '', /WITH tables AS/);
  assert.equal(calls[2]?.values, undefined);
  assert.match(calls[3]?.text ?? '', /ff\.id::TEXT AS id/);
  assert.match(calls[3]?.text ?? '', /ff\.conta_id::TEXT AS conta_id/);
  assert.match(calls[3]?.text ?? '', /ff\.categoria_id::TEXT AS categoria_id/);
  assert.match(calls[3]?.text ?? '', /NULL::TEXT AS cliente_id/);
  assert.match(calls[3]?.text ?? '', /NULL::TEXT AS fornecedor_id/);
  assert.match(calls[3]?.text ?? '', /ff\."empresa" AS empresa_id/);
  assert.deepEqual(calls[3]?.values, [DEFAULT_EMPRESA_ID, 10, 0]);
  assert.deepEqual(calls[4]?.values, [DEFAULT_EMPRESA_ID]);

});

test('listFlows tolerates missing fornecedor column', async () => {
  const tablesRow = {
    parcelas: false,
    oportunidades: false,
    clientes: false,
    faturamentos: false,
  };

  const financialRow = {
    id: 2,
    tipo: 'despesa',
    conta_id: '5',
    categoria_id: '6',
    cliente_id: null,
    fornecedor_id: null,
    descricao: 'Servico terceirizado',
    valor: 200,
    vencimento: new Date('2024-02-01T00:00:00.000Z'),
    pagamento: null,
    status: 'pendente',
  };


  const { calls, restore } = setupQueryMock([
    empresaLookupResponse,
    financialFlowColumnsWithoutFornecedorResponse,
    { rows: [tablesRow], rowCount: 1 },
    { rows: [financialRow], rowCount: 1 },
    { rows: [{ total: 1 }], rowCount: 1 },
  ]);

  const req = { query: {}, auth: { userId: 7 } } as unknown as Request;
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
        id: 2,
        tipo: 'despesa',
        conta_id: 5,
        categoria_id: 6,
        cliente_id: null,
        fornecedor_id: null,
        descricao: 'Servico terceirizado',
        valor: 200,
        vencimento: '2024-02-01',
        pagamento: null,
        status: 'pendente',
      },
    ],
    total: 1,
    page: 1,
    limit: 10,
  });

  assert.match(calls[3]?.text ?? '', /NULL::TEXT AS fornecedor_id/);
  assert.deepEqual(calls[3]?.values, [DEFAULT_EMPRESA_ID, 10, 0]);
  assert.deepEqual(calls[4]?.values, [DEFAULT_EMPRESA_ID]);
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
    conta_id: '9',
    categoria_id: '4',
    cliente_id: '15',
    fornecedor_id: null,
    descricao: 'Assinatura de software',
    valor: '199.90',
    vencimento: '2024-05-20',
    pagamento: '2024-05-22',
    status: 'pago',
  };

  const { calls, restore } = setupQueryMock([
    empresaLookupResponse,
    financialFlowColumnsResponse,

    { rows: [tablesRow], rowCount: 1 },
    { rows: [financialRow], rowCount: 1 },
    { rows: [{ total: 1 }], rowCount: 1 },
  ]);

  const req = { query: {}, auth: { userId: 5 } } as unknown as Request;
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
        cliente_id: '15',
        fornecedor_id: null,
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

  assert.equal(calls.length, 5);
  assert.match(calls[0]?.text ?? '', /FROM public\.usuarios WHERE id = \$1/);
  assert.deepEqual(calls[0]?.values, [5]);
  assert.match(calls[1]?.text ?? '', /information_schema\.columns/);
  assert.deepEqual(calls[1]?.values, undefined);
  assert.match(calls[2]?.text ?? '', /to_regclass\('public\.oportunidade_parcelas'\)/);
  assert.deepEqual(calls[2]?.values, undefined);
  assert.match(calls[3]?.text ?? '', /WITH combined_flows AS \(/);
  assert.deepEqual(calls[3]?.values, [DEFAULT_EMPRESA_ID, 10, 0]);
  assert.deepEqual(calls[4]?.values, [DEFAULT_EMPRESA_ID]);

});

test('listFlows applies cliente filter when provided', async () => {
  const tablesRow = {
    parcelas: true,
    oportunidades: true,
    clientes: true,
    faturamentos: true,

  };

  const { calls, restore } = setupQueryMock([
    empresaLookupResponse,
    financialFlowColumnsResponse,

    { rows: [tablesRow], rowCount: 1 },
    { rows: [], rowCount: 0 },
    { rows: [{ total: 0 }], rowCount: 1 },
  ]);

  const req = {
    query: {
      clienteId: '42',
    },
    auth: { userId: 8 },
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

  assert.equal(calls.length, 5);

  assert.match(calls[0]?.text ?? '', /FROM public\.usuarios WHERE id = \$1/);
  assert.deepEqual(calls[0]?.values, [8]);
  assert.match(
    calls[1]?.text ?? '',
    /information_schema\.columns/,
  );
  assert.equal(calls[1]?.values, undefined);
  assert.match(
    calls[2]?.text ?? '',
    /to_regclass\('public\.oportunidade_parcelas'\)/,
  );
  assert.equal(calls[2]?.values, undefined);
  assert.match(
    calls[3]?.text ?? '',
    /WHERE combined_flows\.empresa_id = \$1 AND combined_flows\.cliente_id = \$2/,
  );
  assert.deepEqual(calls[3]?.values, [DEFAULT_EMPRESA_ID, '42', 10, 0]);
  assert.deepEqual(calls[4]?.values, [DEFAULT_EMPRESA_ID, '42']);

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
    conta_id: '1',
    categoria_id: '2',
    cliente_id: null,
    fornecedor_id: '88',
    descricao: 'Taxa bancária',
    valor: 150.75,
    vencimento: new Date('2024-03-10T00:00:00.000Z'),
    pagamento: null,
    status: 'pendente',
  };

  const { calls, restore } = setupQueryMock([
    empresaLookupResponse,
    financialFlowColumnsResponse,

    { rows: [tablesRow], rowCount: 1 },
    { rows: [financialRow], rowCount: 1 },
    { rows: [{ total: 1 }], rowCount: 1 },
  ]);

  const req = { query: {}, auth: { userId: 4 } } as unknown as Request;
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
        cliente_id: null,
        fornecedor_id: '88',
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

  assert.equal(calls.length, 5);
  assert.match(calls[0]?.text ?? '', /FROM public\.usuarios WHERE id = \$1/);
  assert.deepEqual(calls[0]?.values, [4]);
  assert.match(calls[1]?.text ?? '', /information_schema\.columns/);
  assert.deepEqual(calls[1]?.values, undefined);
  assert.match(calls[2]?.text ?? '', /to_regclass\('public\.oportunidade_parcelas'\)/);
  assert.deepEqual(calls[2]?.values, undefined);
  assert.match(calls[3]?.text ?? '', /WITH combined_flows AS \(/);
  assert.doesNotMatch(calls[3]?.text ?? '', /UNION ALL/);
  assert.deepEqual(calls[3]?.values, [DEFAULT_EMPRESA_ID, 10, 0]);
  assert.deepEqual(calls[4]?.values, [DEFAULT_EMPRESA_ID]);

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
    cliente_id: '91',
    fornecedor_id: null,
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
    empresaLookupResponse,
    financialFlowColumnsResponse,

    { rows: [tablesRow], rowCount: 1 },
    missingTableError,
    { rows: [financialRow], rowCount: 1 },
    { rows: [{ total: 1 }], rowCount: 1 },
  ]);

  const req = { query: {}, auth: { userId: 6 } } as unknown as Request;
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
        cliente_id: '91',
        fornecedor_id: null,
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

  assert.equal(calls.length, 6);
  assert.match(calls[0]?.text ?? '', /FROM public\.usuarios WHERE id = \$1/);
  assert.deepEqual(calls[0]?.values, [6]);
  assert.match(calls[1]?.text ?? '', /information_schema\.columns/);
  assert.deepEqual(calls[1]?.values, undefined);
  assert.match(calls[2]?.text ?? '', /to_regclass\('public\.oportunidade_parcelas'\)/);
  assert.deepEqual(calls[2]?.values, undefined);
  assert.match(calls[3]?.text ?? '', /WITH oportunidade_parcelas_enriched AS/);
  assert.deepEqual(calls[3]?.values, [DEFAULT_EMPRESA_ID, 10, 0]);
  assert.match(calls[4]?.text ?? '', /WITH combined_flows AS \(/);
  assert.doesNotMatch(calls[4]?.text ?? '', /UNION ALL/);
  assert.deepEqual(calls[4]?.values, [DEFAULT_EMPRESA_ID, 10, 0]);
  assert.deepEqual(calls[5]?.values, [DEFAULT_EMPRESA_ID]);

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
    cliente_id: '44',
    fornecedor_id: null,
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
    empresaLookupResponse,
    financialFlowColumnsResponse,

    { rows: [tablesRow], rowCount: 1 },
    insufficientPrivilegeError,
    { rows: [financialRow], rowCount: 1 },
    { rows: [{ total: 1 }], rowCount: 1 },
  ]);

  const req = { query: {}, auth: { userId: 7 } } as unknown as Request;
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
        cliente_id: '44',
        fornecedor_id: null,
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

  assert.equal(calls.length, 6);
  assert.match(calls[0]?.text ?? '', /FROM public\.usuarios WHERE id = \$1/);
  assert.deepEqual(calls[0]?.values, [7]);
  assert.match(calls[1]?.text ?? '', /information_schema\.columns/);
  assert.deepEqual(calls[1]?.values, undefined);
  assert.match(calls[2]?.text ?? '', /to_regclass\('public\.oportunidade_parcelas'\)/);
  assert.deepEqual(calls[2]?.values, undefined);
  assert.match(calls[3]?.text ?? '', /WITH oportunidade_parcelas_enriched AS/);
  assert.deepEqual(calls[3]?.values, [DEFAULT_EMPRESA_ID, 10, 0]);
  assert.match(calls[4]?.text ?? '', /WITH combined_flows AS \(/);
  assert.doesNotMatch(calls[4]?.text ?? '', /UNION ALL/);
  assert.deepEqual(calls[4]?.values, [DEFAULT_EMPRESA_ID, 10, 0]);
  assert.deepEqual(calls[5]?.values, [DEFAULT_EMPRESA_ID]);


});

test('settleFlow marks opportunity installment as paid', async () => {
  const installmentId = 45;
  const paymentDate = '2024-05-15';
  const updatedRow = {
    id: installmentId,
    oportunidade_id: 90,
    numero_parcela: 2,
    valor: 150,
    valor_pago: 150,
    status: 'quitado',
    data_prevista: '2024-05-10',
    quitado_em: new Date('2024-05-15T00:00:00.000Z'),
    faturamento_id: null,
    criado_em: new Date('2024-01-01T00:00:00.000Z'),
    atualizado_em: new Date('2024-05-15T12:00:00.000Z'),
    idempresa: DEFAULT_EMPRESA_ID,
  };

  const { calls, restore } = setupQueryMock([
    empresaLookupResponse,
    {
      rows: [
        {
          id: installmentId,
          valor: '150.00',
          status: 'pendente',
          idempresa: DEFAULT_EMPRESA_ID,
        },
      ],
      rowCount: 1,
    },
    { rows: [updatedRow], rowCount: 1 },
  ]);

  const req = {
    params: { id: `-${installmentId}` },
    body: { pagamentoData: paymentDate },
    auth: { userId: 7 },
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await settleFlow(req, res);
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { parcela: updatedRow });

  assert.equal(calls.length, 3);
  assert.match(calls[0]?.text ?? '', /FROM public\.usuarios WHERE id = \$1/);
  assert.deepEqual(calls[0]?.values, [7]);
  assert.match(calls[1]?.text ?? '', /FROM public\.oportunidade_parcelas/);
  assert.deepEqual(calls[1]?.values, [installmentId]);
  assert.match(calls[2]?.text ?? '', /UPDATE public\.oportunidade_parcelas/);
  assert.equal(calls[2]?.values?.[0], installmentId);
  assert.equal(calls[2]?.values?.[1], 150);
  assert.ok(calls[2]?.values?.[2] instanceof Date);
  assert.equal((calls[2]?.values?.[2] as Date).toISOString().slice(0, 10), paymentDate);
});

test('settleFlow rejects already paid opportunity installments', async () => {
  const installmentId = 51;

  const { calls, restore } = setupQueryMock([
    empresaLookupResponse,
    {
      rows: [
        {
          id: installmentId,
          valor: 80,
          status: 'quitado',
          idempresa: DEFAULT_EMPRESA_ID,
        },
      ],
      rowCount: 1,
    },
  ]);

  const req = {
    params: { id: `-${installmentId}` },
    body: { pagamentoData: '2024-03-01' },
    auth: { userId: 9 },
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await settleFlow(req, res);
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.body, { error: 'A parcela já está quitada.' });
  assert.equal(calls.length, 2);
  assert.match(calls[0]?.text ?? '', /FROM public\.usuarios WHERE id = \$1/);
  assert.match(calls[1]?.text ?? '', /FROM public\.oportunidade_parcelas/);
});

test('settleFlow enforces company ownership for opportunity installments', async () => {
  const installmentId = 61;

  const { calls, restore } = setupQueryMock([
    empresaLookupResponse,
    {
      rows: [
        {
          id: installmentId,
          valor: 120,
          status: 'pendente',
          idempresa: 999,
        },
      ],
      rowCount: 1,
    },
  ]);

  const req = {
    params: { id: `-${installmentId}` },
    body: { pagamentoData: '2024-02-10' },
    auth: { userId: 4 },
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await settleFlow(req, res);
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, { error: 'Parcela indisponível para este usuário.' });
  assert.equal(calls.length, 2);
  assert.match(calls[0]?.text ?? '', /FROM public\.usuarios WHERE id = \$1/);
  assert.match(calls[1]?.text ?? '', /FROM public\.oportunidade_parcelas/);
});
