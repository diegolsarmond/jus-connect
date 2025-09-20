import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';
import { Pool } from 'pg';

process.env.DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/testdb';


type QueryCall = { text: string; values?: unknown[] };
type QueryResponse = { rows: any[]; rowCount: number };

let getUsuarioById: typeof import('../src/controllers/usuarioController')['getUsuarioById'];

test.before(async () => {
  ({ getUsuarioById } = await import('../src/controllers/usuarioController'));
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
  const mock = test.mock.method(
    Pool.prototype,
    'query',
    async function (this: Pool, text: string, values?: unknown[]) {
      calls.push({ text, values });

      if (responses.length === 0) {
        throw new Error('Unexpected query invocation');
      }

      return responses.shift()!;
    }
  );

  const restore = () => {
    mock.mock.restore();
  };

  return { calls, restore };
};

const createAuth = (userId: number) => ({
  userId,
  payload: {
    sub: userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  },
});

test('getUsuarioById returns user when it belongs to the same company', async () => {
  const userRow = {
    id: 123,
    nome_completo: 'Maria Silva',
    cpf: '12345678901',
    email: 'maria@example.com',
    perfil: 'admin',
    empresa: 42,
    setor: 7,
    oab: '12345',
    status: true,
    senha: '$hashed',
    telefone: '(11) 99999-0000',
    ultimo_login: '2024-01-01T12:00:00.000Z',
    observacoes: null,
    datacriacao: '2023-01-01T12:00:00.000Z',
  };

  const { calls, restore } = setupQueryMock([
    { rows: [{ empresa: 42 }], rowCount: 1 },
    { rows: [userRow], rowCount: 1 },
  ]);

  const req = {
    params: { id: '123' },
    auth: createAuth(10),
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await getUsuarioById(req, res);
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, userRow);
  assert.equal(calls.length, 2);
  assert.match(calls[0]?.text ?? '', /SELECT empresa FROM public\.usuarios/);
  assert.match(calls[1]?.text ?? '', /FROM public\.usuarios u/);
  assert.match(calls[1]?.text ?? '', /u\.empresa IS NOT DISTINCT FROM \$2::INT/);
  assert.deepEqual(calls[1]?.values, ['123', 42]);
});

test('getUsuarioById returns 404 when user belongs to another company', async () => {
  const { calls, restore } = setupQueryMock([
    { rows: [{ empresa: 42 }], rowCount: 1 },
    { rows: [], rowCount: 0 },
  ]);

  const req = {
    params: { id: '999' },
    auth: createAuth(10),
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await getUsuarioById(req, res);
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { error: 'Usuário não encontrado' });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1]?.values, ['999', 42]);
});


