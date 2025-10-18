import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';
import { Pool } from 'pg';

process.env.DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/testdb';

type QueryCall = { text: string; values?: unknown[] };
type QueryResponse = { rows: any[]; rowCount: number };

let listFlows: typeof import('../src/controllers/financialController')['listFlows'];
let createFlow: typeof import('../src/controllers/financialController')['createFlow'];
let updateFlow: typeof import('../src/controllers/financialController')['updateFlow'];
let settleFlow: typeof import('../src/controllers/financialController')['settleFlow'];
let refundAsaasCharge: typeof import('../src/controllers/financialController')['refundAsaasCharge'];
let getAsaasChargeForFlow: typeof import('../src/controllers/financialController')['getAsaasChargeForFlow'];
let listAsaasChargeStatus: typeof import('../src/controllers/financialController')['listAsaasChargeStatus'];
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


const financialAccountColumnsResponse: QueryResponse = {
  rows: [
    { column_name: 'id' },
    { column_name: 'empresa' },
  ],
  rowCount: 2,
};


test.before(async () => {

  ({
    listFlows,
    createFlow,
    updateFlow,
    settleFlow,
    getAsaasChargeForFlow,
    listAsaasChargeStatus,
    __internal,
  } = await import('../src/controllers/financialController'));
});

test.afterEach(() => {
  __internal.resetOpportunityTablesAvailabilityCache();
  __internal.resetFinancialFlowEmpresaColumnCache();
  __internal.resetFinancialFlowClienteColumnCache();
  __internal.resetFinancialFlowFornecedorColumnCache();
  __internal.resetFinancialAccountTableCache();
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

const setupClientMock = (responses: (QueryResponse | Error)[]) => {
  const calls: QueryCall[] = [];
  const query = test.mock.fn(async (text: string, values?: unknown[]) => {
    calls.push({ text, values });

    if (responses.length === 0) {
      throw new Error('Unexpected client query invocation');
    }

    const next = responses.shift()!;
    if (next instanceof Error) {
      throw next;
    }

    return next;
  });

  const release = test.mock.fn(() => {});

  return {
    client: { query, release },
    calls,
    release,
  };
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

test('createFlow rejects missing contaId', async () => {
  const { restore } = setupQueryMock([]);

  const connectMock = test.mock.method(Pool.prototype, 'connect', async () => {
    throw new Error('connect should not be invoked when contaId is invalid');
  });

  const req = {
    body: {
      tipo: 'receita',
      descricao: 'Mensalidade',
      valor: 120,
      vencimento: '2024-07-01',
    },
    auth: { userId: 10 },
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await createFlow(req, res);
  } finally {
    restore();
    connectMock.mock.restore();
  }

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, {
    error: 'contaId é obrigatório e deve ser um inteiro positivo.',
  });
  assert.equal(connectMock.mock.callCount(), 0);
});

test('createFlow validates contaId ownership before inserting', async () => {
  const contaId = 5;

  const insertedRow = {
    id: 40,
    tipo: 'receita',
    descricao: 'Mensalidade',
    valor: 120,
    vencimento: '2024-07-01',
    pagamento: null,
    status: 'pendente',
    conta_id: contaId,
    cliente_id: null,
    fornecedor_id: null,
  };

  const { calls, restore } = setupQueryMock([
    empresaLookupResponse,
    financialAccountColumnsResponse,
    { rows: [{ id: contaId }], rowCount: 1 },
  ]);

  const clientSetup = setupClientMock([
    { rows: [], rowCount: 0 },
    { rows: [insertedRow], rowCount: 1 },
    { rows: [], rowCount: 0 },
  ]);

  const connectMock = test.mock.method(Pool.prototype, 'connect', async () => clientSetup.client as unknown as any);

  const req = {
    body: {
      contaId,
      tipo: 'receita',
      descricao: 'Mensalidade',
      valor: 120,
      vencimento: '2024-07-01',
    },
    auth: { userId: 11 },
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await createFlow(req, res);
  } finally {
    restore();
    connectMock.mock.restore();
  }

  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body, { flow: insertedRow, charge: null });

  assert.equal(calls.length, 3);
  assert.match(calls[0]?.text ?? '', /FROM public\.usuarios WHERE id = \$1/);
  assert.match(calls[1]?.text ?? '', /information_schema\.columns/);
  assert.match(calls[2]?.text ?? '', /FROM "public"\."financeiro_contas"/);

  assert.equal(clientSetup.calls.length, 3);
  assert.equal(clientSetup.calls[0]?.text, 'BEGIN');
  assert.match(clientSetup.calls[1]?.text ?? '', /INSERT INTO financial_flows/);
  assert.equal(clientSetup.calls[1]?.values?.[5], contaId);
  assert.equal(clientSetup.calls[2]?.text, 'COMMIT');
  assert.equal(clientSetup.release.mock.callCount(), 1);
});

test('createFlow rejects contaId that does not belong to the company', async () => {
  const contaId = 9;

  const { calls, restore } = setupQueryMock([
    empresaLookupResponse,
    financialAccountColumnsResponse,
    { rows: [], rowCount: 0 },
  ]);

  const connectMock = test.mock.method(Pool.prototype, 'connect', async () => {
    throw new Error('connect should not be invoked when contaId is invalid for the company');
  });

  const req = {
    body: {
      contaId,
      tipo: 'receita',
      descricao: 'Mensalidade',
      valor: 130,
      vencimento: '2024-07-15',
    },
    auth: { userId: 12 },
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await createFlow(req, res);
  } finally {
    restore();
    connectMock.mock.restore();
  }

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: 'Conta inválida para a empresa autenticada.' });
  assert.equal(connectMock.mock.callCount(), 0);
  assert.equal(calls.length, 3);
  assert.match(calls[2]?.text ?? '', /FROM "public"\."financeiro_contas"/);
});

test('updateFlow preserves conta_id returned by the database', async () => {
  const flowId = 42;
  const contaId = 7;

  const updatedRow = {
    id: flowId,
    tipo: 'receita',
    descricao: 'Atualizado',
    valor: 200,
    vencimento: '2024-08-10',
    pagamento: null,
    status: 'pendente',
    conta_id: contaId,
    cliente_id: null,
    fornecedor_id: null,
  };

  const clientSetup = setupClientMock([
    { rows: [], rowCount: 0 },
    { rows: [updatedRow], rowCount: 1 },
    { rows: [], rowCount: 0 },
  ]);

  const connectMock = test.mock.method(Pool.prototype, 'connect', async () => clientSetup.client as unknown as any);

  const { restore } = setupQueryMock([]);

  const req = {
    params: { id: `${flowId}` },
    body: {
      tipo: 'receita',
      descricao: 'Atualizado',
      valor: 200,
      vencimento: '2024-08-10',
      pagamento: null,
      status: 'pendente',
    },
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await updateFlow(req, res);
  } finally {
    restore();
    connectMock.mock.restore();
  }

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { flow: updatedRow, charge: null });
  assert.equal(clientSetup.calls.length, 3);
  assert.match(clientSetup.calls[1]?.text ?? '', /UPDATE financial_flows/);
  assert.equal((res.body as { flow: { conta_id: number } }).flow.conta_id, contaId);
  assert.equal(clientSetup.release.mock.callCount(), 1);
});

test('settleFlow preserves conta_id when settling a manual flow', async () => {
  const flowId = 70;
  const contaId = 4;
  const pagamentoData = '2024-07-20';

  const updatedFlow = {
    id: flowId,
    tipo: 'receita',
    descricao: 'Mensalidade',
    valor: 150,
    vencimento: '2024-07-01',
    pagamento: pagamentoData,
    status: 'pago',
    conta_id: contaId,
    cliente_id: null,
    fornecedor_id: null,
  };

  const { calls, restore } = setupQueryMock([
    { rows: [{ external_provider: null }], rowCount: 1 },
    { rows: [updatedFlow], rowCount: 1 },
  ]);

  const req = {
    params: { id: `${flowId}` },
    body: { pagamentoData },
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await settleFlow(req, res);
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { flow: updatedFlow });
  assert.equal((res.body as { flow: { conta_id: number } }).flow.conta_id, contaId);
  assert.equal(calls.length, 2);
  assert.match(calls[0]?.text ?? '', /SELECT external_provider/);
  assert.match(calls[1]?.text ?? '', /UPDATE financial_flows SET pagamento=/);
  assert.deepEqual(calls[1]?.values, [pagamentoData, flowId]);
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

test('refundAsaasCharge refunds Asaas payment and updates records', async () => {
  const flowRow = {
    id: 55,
    tipo: 'receita',
    descricao: 'Mensalidade',
    valor: 150,
    vencimento: '2024-08-01',
    pagamento: '2024-08-02',
    status: 'pago',
    idempresa: DEFAULT_EMPRESA_ID,
  };

  const chargeRow = {
    id: 77,
    financial_flow_id: flowRow.id,
    asaas_charge_id: 'ch_123',
    status: 'RECEIVED',
    raw_response: null,
  };

  const updatedChargeRow = { ...chargeRow, status: 'REFUNDED' };
  const updatedFlowRow = { ...flowRow, status: 'estornado', pagamento: null };

  const { calls, restore } = setupQueryMock([empresaLookupResponse]);

  const clientSetup = setupClientMock([
    { rows: [], rowCount: 0 },
    { rows: [flowRow], rowCount: 1 },
    { rows: [chargeRow], rowCount: 1 },
    { rows: [updatedChargeRow], rowCount: 1 },
    { rows: [updatedFlowRow], rowCount: 1 },
    { rows: [], rowCount: 0 },
  ]);

  const connectMock = test.mock.method(Pool.prototype, 'connect', async () => clientSetup.client as unknown as any);

  const integrationModule = await import('../src/services/asaas/integrationResolver');
  const refundResponse = { id: 'refund_1', status: 'REFUNDED' };
  const createClientMock = test.mock.method(integrationModule, 'createAsaasClient', async () => ({
    refundCharge: test.mock.fn(async (chargeId: string) => {
      assert.equal(chargeId, chargeRow.asaas_charge_id);
      return refundResponse;
    }),
  }));

  const req = {
    params: { id: String(flowRow.id) },
    auth: { userId: 42 },
    body: { value: 100 },
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await refundAsaasCharge(req, res);
  } finally {
    restore();
    connectMock.mock.restore();
    createClientMock.mock.restore();
  }

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { flow: updatedFlowRow, charge: updatedChargeRow, refund: refundResponse });

  assert.equal(calls.length, 1);
  assert.match(calls[0]?.text ?? '', /FROM public\.usuarios WHERE id = \$1/);

  assert.equal(clientSetup.calls.length, 6);
  assert.equal(clientSetup.calls[0]?.text, 'BEGIN');
  assert.match(clientSetup.calls[1]?.text ?? '', /FROM financial_flows/i);
  assert.match(clientSetup.calls[2]?.text ?? '', /FROM asaas_charges/i);
  assert.match(clientSetup.calls[3]?.text ?? '', /UPDATE asaas_charges/i);
  assert.match(clientSetup.calls[4]?.text ?? '', /UPDATE financial_flows/i);
  assert.equal(clientSetup.calls[5]?.text, 'COMMIT');
  assert.equal(clientSetup.release.mock.callCount(), 1);
  assert.equal(createClientMock.mock.callCount(), 1);
});

test('refundAsaasCharge rejects charges not eligible for refund', async () => {
  const flowRow = {
    id: 66,
    tipo: 'receita',
    descricao: 'Mensalidade',
    valor: 200,
    vencimento: '2024-09-10',
    pagamento: '2024-09-11',
    status: 'pago',
    idempresa: DEFAULT_EMPRESA_ID,
  };

  const chargeRow = {
    id: 88,
    financial_flow_id: flowRow.id,
    asaas_charge_id: 'ch_999',
    status: 'PENDING',
  };

  const { calls, restore } = setupQueryMock([empresaLookupResponse]);

  const clientSetup = setupClientMock([
    { rows: [], rowCount: 0 },
    { rows: [flowRow], rowCount: 1 },
    { rows: [chargeRow], rowCount: 1 },
    { rows: [], rowCount: 0 },
  ]);

  const connectMock = test.mock.method(Pool.prototype, 'connect', async () => clientSetup.client as unknown as any);

  const integrationModule = await import('../src/services/asaas/integrationResolver');
  const createClientMock = test.mock.method(integrationModule, 'createAsaasClient', async () => ({
    refundCharge: test.mock.fn(),
  }));

  const req = {
    params: { id: String(flowRow.id) },
    auth: { userId: 42 },
    body: {},
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await refundAsaasCharge(req, res);
  } finally {
    restore();
    connectMock.mock.restore();
    createClientMock.mock.restore();
  }

  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.body, { error: 'A cobrança não está elegível para estorno no Asaas.' });

  assert.equal(calls.length, 1);
  assert.match(calls[0]?.text ?? '', /FROM public\.usuarios WHERE id = \$1/);
  assert.equal(clientSetup.calls.length, 4);
  assert.equal(clientSetup.calls[0]?.text, 'BEGIN');
  assert.match(clientSetup.calls[1]?.text ?? '', /FROM financial_flows/);
  assert.match(clientSetup.calls[2]?.text ?? '', /FROM asaas_charges/);
  assert.equal(clientSetup.calls[3]?.text, 'ROLLBACK');
  assert.equal(clientSetup.release.mock.callCount(), 1);
  assert.equal(createClientMock.mock.callCount(), 0);
test('getAsaasChargeForFlow returns 404 when there is no charge', async () => {
  const flowId = 88;
  const { restore } = setupQueryMock([{ rows: [], rowCount: 0 }]);

  const req = { params: { id: `${flowId}` } } as unknown as Request;
  const res = createMockResponse();

  try {
    await getAsaasChargeForFlow(req, res);
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { error: 'Charge not found' });
});

test('getAsaasChargeForFlow returns the persisted charge details', async () => {
  const flowId = 101;
  const chargeRow = {
    id: 7,
    financial_flow_id: flowId,
    cliente_id: 55,
    integration_api_key_id: 12,
    asaas_charge_id: 'ch_123',
    billing_type: 'PIX',
    status: 'PENDING',
    due_date: '2024-01-15',
    value: '250.90',
    invoice_url: 'https://asaas.test/invoice',
    pix_payload: 'payload-code',
    pix_qr_code: 'qr-code',
    boleto_url: null,
    card_last4: null,
    card_brand: null,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-02T12:34:56.000Z',
  };

  const { calls, restore } = setupQueryMock([{ rows: [chargeRow], rowCount: 1 }]);

  const req = { params: { id: `${flowId}` } } as unknown as Request;
  const res = createMockResponse();

  try {
    await getAsaasChargeForFlow(req, res);
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.match(calls[0]?.text ?? '', /FROM asaas_charges/i);
  assert.deepEqual(calls[0]?.values, [flowId]);

  const expectedCharge = {
    id: 7,
    financialFlowId: flowId,
    clienteId: 55,
    integrationApiKeyId: 12,
    asaasChargeId: 'ch_123',
    billingType: 'PIX',
    status: 'PENDING',
    dueDate: '2024-01-15',
    value: '250.90',
    invoiceUrl: 'https://asaas.test/invoice',
    pixPayload: 'payload-code',
    pixQrCode: 'qr-code',
    boletoUrl: null,
    cardLast4: null,
    cardBrand: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-02T12:34:56.000Z',
    flowId,
  };

  assert.deepEqual(res.body, { charge: expectedCharge });
});

test('listAsaasChargeStatus returns 404 when the charge is missing', async () => {
  const flowId = 202;
  const { restore } = setupQueryMock([{ rows: [], rowCount: 0 }]);

  const req = { params: { id: `${flowId}` } } as unknown as Request;
  const res = createMockResponse();

  try {
    await listAsaasChargeStatus(req, res);
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { error: 'Charge not found' });
});

test('listAsaasChargeStatus exposes the latest local status information', async () => {
  const flowId = 303;
  const chargeRow = {
    id: 11,
    financial_flow_id: flowId,
    cliente_id: null,
    integration_api_key_id: null,
    asaas_charge_id: 'ch_status',
    billing_type: 'CREDIT_CARD',
    status: 'RECEIVED',
    due_date: '2024-02-10',
    value: '500.00',
    invoice_url: null,
    pix_payload: null,
    pix_qr_code: null,
    boleto_url: null,
    card_last4: '4242',
    card_brand: 'VISA',
    created_at: '2024-02-01T10:00:00.000Z',
    updated_at: '2024-02-05T15:30:00.000Z',
  };

  const { calls, restore } = setupQueryMock([{ rows: [chargeRow], rowCount: 1 }]);

  const req = { params: { id: `${flowId}` } } as unknown as Request;
  const res = createMockResponse();

  try {
    await listAsaasChargeStatus(req, res);
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.match(calls[0]?.text ?? '', /FROM asaas_charges/i);
  assert.deepEqual(calls[0]?.values, [flowId]);

  assert.deepEqual(res.body, {
    statuses: [
      {
        status: 'RECEIVED',
        description: 'Status atual sincronizado localmente.',
        updatedAt: '2024-02-05T15:30:00.000Z',
        metadata: {
          source: 'asaas_charges',
          chargeId: 'ch_status',
          financialFlowId: flowId,
          billingType: 'CREDIT_CARD',
          value: '500.00',
          createdAt: '2024-02-01T10:00:00.000Z',
        },
      },
    ],
  });
});
