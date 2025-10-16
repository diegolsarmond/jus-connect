import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';

import pool from '../src/services/db';

let createFornecedor: typeof import('../src/controllers/fornecedorController')['createFornecedor'];

test.before(async () => {
  ({ createFornecedor } = await import('../src/controllers/fornecedorController'));
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

test('createFornecedor retorna 403 quando usuário não possui empresa', async () => {
  const poolMock = test.mock.method(pool, 'query', async () => ({
    rowCount: 1,
    rows: [{ empresa: null }],
  }));

  const req = {
    auth: { userId: 99 },
    body: { nome: 'Fornecedor Teste' },
  } as unknown as Request;
  const res = createMockResponse();

  try {
    await createFornecedor(req, res);

    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, {
      error: 'Usuário autenticado não possui empresa vinculada.',
    });
    assert.equal(poolMock.mock.callCount(), 1);
  } finally {
    poolMock.mock.restore();
  }
});
