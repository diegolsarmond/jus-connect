import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';
import pool from '../src/services/db';

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
  const poolMock = test.mock.method(
    pool,
    'query',
    async () => {
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
          rowCount: 1,
          rows: [{ total: 2 }],
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
  } finally {
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

