import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';

import pool from '../src/services/db';
import * as authUserModule from '../src/utils/authUser';

let createAgenda: typeof import('../src/controllers/agendaController')['createAgenda'];

test.before(async () => {
  ({ createAgenda } = await import('../src/controllers/agendaController'));
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

test('createAgenda retorna 403 quando usuário não possui empresa', async () => {
  const poolMock = test.mock.method(pool, 'query', async () => ({
    rowCount: 1,
    rows: [{ empresa: null }],
  }));

  const req = {
    auth: { userId: 77 },
    body: { titulo: 'Evento' },
  } as unknown as Request;
  const res = createMockResponse();

  try {
    await createAgenda(req, res);

    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, {
      error: 'Usuário autenticado não possui empresa vinculada.',
    });
    assert.equal(poolMock.mock.callCount(), 1);
  } finally {
    poolMock.mock.restore();
  }
});
