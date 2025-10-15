import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';
import * as authUserModule from '../src/utils/authUser';
import pool from '../src/services/db';

type QueryCall = { text: string; values?: unknown[] };
type QueryResponse = { rows: any[]; rowCount: number };

process.env.DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/testdb';

let listTemplates: typeof import('../src/controllers/templateController')['listTemplates'];

test.before(async () => {
  ({ listTemplates } = await import('../src/controllers/templateController'));
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

const setupQueryMock = (responses: QueryResponse[]) => {
  const calls: QueryCall[] = [];
  const originalQuery = pool.query.bind(pool);

  (pool as unknown as { query: typeof pool.query }).query = async (
    text: string,
    values?: unknown[]
  ) => {
    calls.push({ text, values });

    const normalized = text.trim().toUpperCase();
    if (normalized === 'BEGIN' || normalized === 'COMMIT' || normalized === 'ROLLBACK') {
      return { rows: [], rowCount: 0 } satisfies QueryResponse;
    }

    if (responses.length === 0) {
      throw new Error('Unexpected query invocation');
    }

    return responses.shift()!;
  };

  const restore = () => {
    (pool as unknown as { query: typeof pool.query }).query = originalQuery;
  };

  return { calls, restore };
};

test('listTemplates retorna modelos do usuário quando há empresa vinculada', async () => {
  const authMock = test.mock.method(
    authUserModule,
    'fetchAuthenticatedUserEmpresa',
    async () => ({ success: true, empresaId: 12 })
  );

  const templates = [
    { id: 7, title: 'Petição Inicial', content: '{"ops":[]}' },
  ];

  const { calls, restore } = setupQueryMock([
    { rows: templates, rowCount: templates.length },
  ]);

  const req = {
    auth: {
      userId: 99,
    },
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await listTemplates(req, res);
  } finally {
    authMock.mock.restore();
    restore();
  }

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, templates);
  assert.equal(calls.length, 1);
  const [call] = calls;
  assert.ok(call);
  assert.match(call!.text ?? '', /FROM templates/);
  assert.deepEqual(call!.values, [12, 99]);
});

test('listTemplates retorna 403 quando usuário não possui empresa', async () => {
  const authMock = test.mock.method(
    authUserModule,
    'fetchAuthenticatedUserEmpresa',
    async () => ({ success: true, empresaId: null })
  );

  const { calls, restore } = setupQueryMock([]);

  const req = {
    auth: {
      userId: 101,
    },
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await listTemplates(req, res);
  } finally {
    authMock.mock.restore();
    restore();
  }

  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, {
    error: 'Usuário autenticado não possui empresa vinculada.',
  });
  assert.equal(calls.length, 0);
});
