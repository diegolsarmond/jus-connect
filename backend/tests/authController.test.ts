import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';
import { Pool } from 'pg';

let register: typeof import('../src/controllers/authController')['register'];

const planModules = ['configuracoes', 'clientes', 'dashboard'];

test.before(async () => {
  ({ register } = await import('../src/controllers/authController'));
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

type QueryResponse = { rows: unknown[]; rowCount: number };

type QueryCall = { text: string; values?: unknown[] };

const setupPoolQueryMock = (responses: QueryResponse[]) => {
  const calls: QueryCall[] = [];

  const mock = test.mock.method(
    Pool.prototype,
    'query',
    async function (this: Pool, text: string, values?: unknown[]) {
      calls.push({ text, values });

      if (responses.length === 0) {
        throw new Error('Unexpected pool query invocation');
      }

      return responses.shift()!;
    }
  );

  return {
    calls,
    restore: () => mock.mock.restore(),
  };
};

const setupPoolConnectMock = (responses: QueryResponse[]) => {
  const calls: QueryCall[] = [];
  let released = false;

  const client = {
    async query(text: string, values?: unknown[]) {
      calls.push({ text, values });
      const normalized = text.trim().toUpperCase();

      if (normalized === 'BEGIN' || normalized === 'COMMIT' || normalized === 'ROLLBACK') {
        return { rows: [], rowCount: 0 } satisfies QueryResponse;
      }

      if (responses.length === 0) {
        throw new Error('Unexpected client query invocation');
      }

      return responses.shift()!;
    },
    release() {
      released = true;
    },
  };

  const mock = test.mock.method(Pool.prototype, 'connect', async () => client);

  return {
    calls,
    restore: () => mock.mock.restore(),
    wasReleased: () => released,
  };
};

test('register creates company, profile and user atomically', async () => {
  const duplicateCheckResponses: QueryResponse[] = [{ rows: [], rowCount: 0 }];
  const { calls: poolCalls, restore: restorePoolQuery } = setupPoolQueryMock(
    duplicateCheckResponses
  );

  const clientResponses: QueryResponse[] = [
    { rows: [], rowCount: 0 },
    { rows: [{ id: 7, modulos: planModules }], rowCount: 1 },
    { rows: [], rowCount: 0 },
    { rows: [{ id: 42, nome_empresa: 'Acme Corp', plano: 7 }], rowCount: 1 },
    { rows: [], rowCount: 0 },
    { rows: [{ id: 99, nome: 'Administrador' }], rowCount: 1 },
    { rows: [], rowCount: planModules.length },
    {
      rows: [
        {
          id: 123,
          nome_completo: 'Alice Doe',
          email: 'alice@example.com',
          perfil: 99,
          empresa: 42,
          status: true,
          telefone: '(11) 99999-0000',
          datacriacao: '2024-01-02T00:00:00.000Z',
        },
      ],
      rowCount: 1,
    },
  ];

  const { calls: clientCalls, restore: restoreConnect, wasReleased } = setupPoolConnectMock(
    clientResponses
  );

  const req = {
    body: {
      name: 'Alice Doe',
      email: 'alice@example.com',
      company: 'Acme Corp',
      password: 'SenhaSegura123',
      phone: '(11) 99999-0000',
    },
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await register(req, res);
  } finally {
    restoreConnect();
    restorePoolQuery();
  }

  assert.equal(res.statusCode, 201);

  const responseBody = res.body as {
    user: { id: number; perfil: number; empresa: number };
    empresa: { id: number; nome: string; plano: number | null };
    perfil: { id: number; nome: string; modulos: string[] };
  };

  assert.equal(responseBody.user.id, 123);
  assert.equal(responseBody.user.perfil, 99);
  assert.equal(responseBody.user.empresa, 42);
  assert.deepEqual(responseBody.empresa, { id: 42, nome: 'Acme Corp', plano: 7 });
  assert.deepEqual(responseBody.perfil, {
    id: 99,
    nome: 'Administrador',
    modulos: ['dashboard', 'clientes', 'configuracoes'],
  });

  const beginCall = clientCalls[0];
  assert.equal(beginCall?.text.trim().toUpperCase(), 'BEGIN');

  const commitCall = clientCalls.find((call) => call.text.trim().toUpperCase() === 'COMMIT');
  assert.ok(commitCall, 'expected COMMIT to be called');

  const userInsertCall = clientCalls.find((call) =>
    call.text.includes('INSERT INTO public.usuarios')
  );
  assert.ok(userInsertCall, 'expected user insert to be executed');
  assert.equal(typeof userInsertCall?.values?.[8], 'string');
  assert.ok((userInsertCall?.values?.[8] as string).startsWith('sha256:'));
  assert.notEqual(userInsertCall?.values?.[8], 'SenhaSegura123');

  const perfilModuloCall = clientCalls.find((call) =>
    call.text.includes('INSERT INTO public.perfil_modulos')
  );
  assert.deepEqual(perfilModuloCall?.values?.[1], ['dashboard', 'clientes', 'configuracoes']);

  assert.equal(poolCalls.length, 1);
  assert.equal(poolCalls[0]?.text.includes('SELECT 1 FROM public.usuarios'), true);
  assert.equal(wasReleased(), true);
});

test('register returns 409 when email already exists', async () => {
  const { restore: restorePoolQuery } = setupPoolQueryMock([
    { rows: [{ id: 1 }], rowCount: 1 },
  ]);

  const connectMock = test.mock.method(Pool.prototype, 'connect', async () => {
    throw new Error('connect should not be invoked when email already exists');
  });

  const req = {
    body: {
      name: 'Alice Doe',
      email: 'alice@example.com',
      company: 'Acme Corp',
      password: 'SenhaSegura123',
    },
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await register(req, res);
  } finally {
    restorePoolQuery();
    connectMock.mock.restore();
  }

  assert.equal(res.statusCode, 409);
  assert.equal(connectMock.mock.callCount(), 0);
  assert.ok(res.body && typeof res.body === 'object');
});
