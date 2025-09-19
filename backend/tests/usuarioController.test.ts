import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';

import { listUsuarios } from '../src/controllers/usuarioController';
import pool from '../src/services/db';

type QueryCall = { text: string; values?: unknown[] };
type QueryResponse = { rows: any[]; rowCount: number };

type MockResponse = {
  statusCode: number;
  payload: unknown;
  status(code: number): MockResponse;
  json(data: unknown): MockResponse;
};

const createMockResponse = (): MockResponse => ({
  statusCode: 200,
  payload: undefined,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(data) {
    this.payload = data;
    return this;
  },
});

test('listUsuarios limita os resultados à empresa do usuário autenticado', async (t) => {
  const responses: QueryResponse[] = [
    { rows: [{ empresa: 7 }], rowCount: 1 },
    { rows: [{ id: 1 }, { id: 2 }], rowCount: 2 },
  ];
  const queries: QueryCall[] = [];

  t.mock.method(pool, 'query', async (text: string, values?: unknown[]) => {
    queries.push({ text, values });
    const response = responses.shift();
    if (!response) {
      throw new Error('Unexpected query execution');
    }
    return response;
  });

  const req = { auth: { userId: 42 } } as unknown as Request;
  const res = createMockResponse();

  await listUsuarios(req, res as unknown as Response);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.payload, [{ id: 1 }, { id: 2 }]);
  assert.equal(queries.length, 2);
  assert.match(queries[1]?.text ?? '', /WHERE u\.empresa = \$1/);
  assert.deepEqual(queries[1]?.values, [7]);
});

test('listUsuarios retorna lista vazia quando usuário autenticado não possui empresa', async (t) => {
  const responses: QueryResponse[] = [{ rows: [{ empresa: null }], rowCount: 1 }];
  const queries: QueryCall[] = [];

  t.mock.method(pool, 'query', async (text: string, values?: unknown[]) => {
    queries.push({ text, values });
    const response = responses.shift();
    if (!response) {
      throw new Error('Unexpected query execution');
    }
    return response;
  });

  const req = { auth: { userId: 84 } } as unknown as Request;
  const res = createMockResponse();

  await listUsuarios(req, res as unknown as Response);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.payload, []);
  assert.equal(queries.length, 1, 'should not query usuarios view without empresa vinculada');
});
