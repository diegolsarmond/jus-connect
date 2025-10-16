import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';
import pool from '../src/services/db';
import AsaasCustomerService from '../src/services/asaasCustomerService';

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
      tipo: 'F',
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

  let callIndex = 0;
  const calls: { text: string; values?: unknown[] }[] = [];
  const poolMock = test.mock.method(
    pool,
    'query',
    async (text: string, values?: unknown[]) => {
      calls.push({ text, values });
      callIndex += 1;
      if (callIndex === 1) {
        return {
          rowCount: 1,
          rows: [{ empresa: 77 }],
        };
      }

      if (callIndex === 2) {
        return {
          rowCount: 1,
          rows: [
            {
              limite_usuarios: null,
              limite_processos: null,
              limite_propostas: null,
              limite_clientes: 2,
              limite_advogados_processos: null,
              limite_advogados_intimacao: null,
              sincronizacao_processos_habilitada: null,
              sincronizacao_processos_cota: null,
            },
          ],
        };
      }

      if (callIndex === 3) {
        return {
          rowCount: 2,
          rows: [{}, {}],
        };
      }

      throw new Error('query should not be executed when limit is reached');
    }
  );

  try {
    await createCliente(req, res);

    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, {
      error: 'Limite de clientes do plano atingido.',
    });
    assert.equal(poolMock.mock.callCount(), 3);
    assert.match(calls[2]?.text ?? '', /LIMIT \$2/);
    assert.deepEqual(calls[2]?.values, [77, 2]);
  } finally {
    poolMock.mock.restore();
  }
});

test('createCliente permite criação quando limite não atingido', async () => {
  const req = {
    auth: { userId: 601 },
    body: {
      nome: 'Cliente Livre',
      tipo: 'F',
      documento: '111.222.333-44',
      email: 'livre@example.com',
      telefone: '(11) 95555-4444',
      cep: '02020-000',
      rua: 'Rua Teste',
      numero: '200',
      complemento: 'Sala 1',
      bairro: 'Centro',
      cidade: 'São Paulo',
      uf: 'SP',
      ativo: true,
    },
  } as unknown as Request;

  const res = createMockResponse();

  let callIndex = 0;
  const calls: { text: string; values?: unknown[] }[] = [];
  const poolMock = test.mock.method(
    pool,
    'query',
    async (text: string, values?: unknown[]) => {
      calls.push({ text, values });
      callIndex += 1;
      if (callIndex === 1) {
        return {
          rowCount: 1,
          rows: [{ empresa: 88 }],
        };
      }

      if (callIndex === 2) {
        return {
          rowCount: 1,
          rows: [
            {
              limite_usuarios: null,
              limite_processos: null,
              limite_propostas: null,
              limite_clientes: 3,
              limite_advogados_processos: null,
              limite_advogados_intimacao: null,
              sincronizacao_processos_habilitada: null,
              sincronizacao_processos_cota: null,
            },
          ],
        };
      }

      if (callIndex === 3) {
        return {
          rowCount: 2,
          rows: [{}, {}],
        };
      }

      if (callIndex === 4) {
        return {
          rowCount: 1,
          rows: [
            {
              id: 123,
              nome: 'Cliente Livre',
              tipo: 1,
              documento: '11122233344',
              email: 'livre@example.com',
              telefone: '11955554444',
              cep: '02020-000',
              rua: 'Rua Teste',
              numero: '200',
              complemento: 'Sala 1',
              bairro: 'Centro',
              cidade: 'São Paulo',
              uf: 'SP',
              ativo: true,
              idempresa: 88,
              datacadastro: '2024-01-01T00:00:00.000Z',
            },
          ],
        };
      }

      throw new Error('Unexpected query execution');
    }
  );

  const ensureCustomerMock = test.mock.method(
    AsaasCustomerService.prototype,
    'ensureCustomer',
    async () => ({
      integrationActive: false,
      integrationApiKeyId: null,
      status: 'inactive',
      customerId: null,
      syncedAt: null,
      lastPayload: null,
      errorMessage: null,
    })
  );

  try {
    await createCliente(req, res);

    assert.equal(res.statusCode, 201);
    assert.deepEqual(res.body, {
      id: 123,
      nome: 'Cliente Livre',
      tipo: 1,
      documento: '11122233344',
      email: 'livre@example.com',
      telefone: '11955554444',
      cep: '02020-000',
      rua: 'Rua Teste',
      numero: '200',
      complemento: 'Sala 1',
      bairro: 'Centro',
      cidade: 'São Paulo',
      uf: 'SP',
      ativo: true,
      idempresa: 88,
      datacadastro: '2024-01-01T00:00:00.000Z',
      asaasIntegration: {
        integrationActive: false,
        integrationApiKeyId: null,
        status: 'inactive',
        customerId: null,
        syncedAt: null,
        lastPayload: null,
        errorMessage: null,
      },
    });
    assert.equal(poolMock.mock.callCount(), 4);
    assert.match(calls[2]?.text ?? '', /LIMIT \$2/);
    assert.deepEqual(calls[2]?.values, [88, 3]);
    assert.equal(ensureCustomerMock.mock.callCount(), 1);
  } finally {
    ensureCustomerMock.mock.restore();
    poolMock.mock.restore();
  }
});

test('createCliente retorna 403 quando usuário não possui empresa', async () => {
  const req = {
    auth: { userId: 502 },
    body: {
      nome: 'Cliente Sem Empresa',
      tipo: 'PF',
    },
  } as unknown as Request;

  const res = createMockResponse();

  let callIndex = 0;
  const poolMock = test.mock.method(
    pool,
    'query',
    async () => {
      callIndex += 1;
      if (callIndex === 1) {
        return {
          rowCount: 1,
          rows: [{ empresa: null }],
        };
      }

      throw new Error('Query não deve ser executada quando empresaId é nulo');
    }
  );

  try {
    await createCliente(req, res);

    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, {
      error: 'Usuário autenticado não possui empresa vinculada.',
    });
    assert.equal(poolMock.mock.callCount(), 1);
  } finally {
    poolMock.mock.restore();
  }
});

