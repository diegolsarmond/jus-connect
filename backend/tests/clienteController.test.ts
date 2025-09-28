import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';
import pool from '../src/services/db';
import * as authUserModule from '../src/utils/authUser';
import * as planLimitsServiceModule from '../src/services/planLimitsService';

process.env.DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/testdb';

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

let createCliente: typeof import('../src/controllers/clienteController')['createCliente'];

test.before(async () => {
  ({ createCliente } = await import('../src/controllers/clienteController'));
});

test('createCliente enforces plan customer limits before insertion', async () => {
  const req = {
    auth: { userId: 501 },
    body: {
      nome: 'Empresa Teste',
      tipo: 'PF',
      documento: '123.456.789-00',
      email: 'cliente@example.com',
      telefone: '(11) 91234-5678',
      cep: '01001-000',
      rua: 'Rua Exemplo',
      numero: '100',
      complemento: null,
      bairro: 'Centro',
      cidade: 'São Paulo',
      uf: 'SP',
      ativo: true,
    },
  } as unknown as Request;

  const res = createMockResponse();

  const authMock = test.mock.method(
    authUserModule,
    'fetchAuthenticatedUserEmpresa',
    async () => ({ success: true, empresaId: 77 })
  );
  const planLimitsMock = test.mock.method(
    planLimitsServiceModule,
    'fetchPlanLimitsForCompany',
    async () => ({
      limiteUsuarios: null,
      limiteProcessos: null,
      limitePropostas: null,
      limiteClientes: 2,
      sincronizacaoProcessosHabilitada: null,
      sincronizacaoProcessosCota: null,
    })
  );
  const countMock = test.mock.method(
    planLimitsServiceModule,
    'countCompanyResource',
    async () => 2
  );
  const poolMock = test.mock.method(pool, 'query', async () => {
    throw new Error('query should not be executed when limit is reached');
  });

  try {
    await createCliente(req, res);

    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, {
      error: 'Limite de clientes do plano atingido.',
    });
    assert.equal(planLimitsMock.mock.callCount(), 1);
    assert.equal(countMock.mock.callCount(), 1);
    const countCall = countMock.mock.calls[0];
    assert.equal(countCall?.arguments[0], 77);
    assert.equal(countCall?.arguments[1], 'clientes');
    assert.equal(poolMock.mock.callCount(), 0);
  } finally {
    authMock.mock.restore();
    planLimitsMock.mock.restore();
    countMock.mock.restore();
    poolMock.mock.restore();
  }
});

