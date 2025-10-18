import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';

import pool from '../src/services/db';
import { listPlanos } from '../src/controllers/planoController';

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

test('listPlanos retorna 503 quando banco está indisponível', async () => {
  const poolMock = test.mock.method(pool, 'query', async () => {
    throw Object.assign(new Error('connect ECONNREFUSED 49.13.81.169:5432'), {
      code: 'ECONNREFUSED',
    });
  });

  const res = createMockResponse();

  try {
    await listPlanos({} as Request, res);

    assert.equal(res.statusCode, 503);
    assert.deepEqual(res.body, { error: 'Banco de dados indisponível.' });
  } finally {
    poolMock.mock.restore();
  }
});
