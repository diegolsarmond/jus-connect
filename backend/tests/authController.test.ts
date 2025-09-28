import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import type { Request, Response } from 'express';
import { Pool } from 'pg';
import { hashPassword } from '../src/utils/passwordUtils';

process.env.AUTH_TOKEN_SECRET ??= 'test-secret';

let register: typeof import('../src/controllers/authController')['register'];
let login: typeof import('../src/controllers/authController')['login'];
let changePassword: typeof import('../src/controllers/authController')['changePassword'];

const planModules = ['configuracoes', 'clientes', 'dashboard'];

test.before(async () => {
  ({ register, login, changePassword } = await import('../src/controllers/authController'));
});

const normalizeSql = (query: string): string => query.replace(/\s+/g, ' ').trim();

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

type QueryResult = QueryResponse | Error;

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

const setupPoolConnectMock = (responses: QueryResult[]) => {
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

      const result = responses.shift()!;

      if (result instanceof Error) {
        throw result;
      }

      return result;
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

test('register requires plan selection before proceeding', async () => {
  const { calls, restore: restorePoolQuery } = setupPoolQueryMock([]);

  const connectMock = test.mock.method(Pool.prototype, 'connect', async () => {
    throw new Error('connect should not be invoked when plan selection is missing');
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

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: 'Selecione um plano para iniciar o teste gratuito.' });
  assert.equal(calls.length, 0);
  assert.equal(connectMock.mock.callCount(), 0);
});

test('register rejects unparseable plan selection', async () => {
  const { calls, restore: restorePoolQuery } = setupPoolQueryMock([]);

  const connectMock = test.mock.method(Pool.prototype, 'connect', async () => {
    throw new Error('connect should not be invoked when plan selection is invalid');
  });

  const req = {
    body: {
      name: 'Alice Doe',
      email: 'alice@example.com',
      company: 'Acme Corp',
      password: 'SenhaSegura123',
      planId: 'not-a-number',
    },
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await register(req, res);
  } finally {
    restorePoolQuery();
    connectMock.mock.restore();
  }

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: 'Plano selecionado inválido.' });
  assert.equal(calls.length, 0);
  assert.equal(connectMock.mock.callCount(), 0);
});

test('register creates company, profile and user atomically', async () => {
const duplicateCheckResponses: QueryResponse[] = [
  { rows: [], rowCount: 0 },
  { rows: [{ valor_mensal: '199.90', valor_anual: '999.90' }], rowCount: 1 },
];
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
    { rows: [], rowCount: 1 },
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
      planId: 7,
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
  assert.ok((userInsertCall?.values?.[8] as string).startsWith('argon2:'));
  assert.notEqual(userInsertCall?.values?.[8], 'SenhaSegura123');

  const companyInsertCall = clientCalls.find((call) =>
    call.text.includes('INSERT INTO public.empresas')
  );
  assert.ok(companyInsertCall, 'expected company insert to be executed');
  assert.equal(companyInsertCall?.values?.[5], null);

  const updateResponsavelCall = clientCalls.find((call) =>
    call.text.includes('UPDATE public.empresas SET responsavel')
  );
  assert.ok(updateResponsavelCall, 'expected company responsavel update to be executed');
  assert.deepEqual(updateResponsavelCall?.values, [123, 42]);

  const perfilModuloCall = clientCalls.find((call) =>
    call.text.includes('INSERT INTO public.perfil_modulos')
  );
  assert.deepEqual(perfilModuloCall?.values?.[1], ['dashboard', 'clientes', 'configuracoes']);

  assert.equal(poolCalls.length, 2);
  assert.equal(poolCalls[0]?.text.includes('SELECT 1 FROM public.usuarios'), true);
  assert.match(poolCalls[1]?.text ?? '', /FROM public\.planos/i);
  assert.deepEqual(poolCalls[1]?.values, [7]);
  assert.equal(wasReleased(), true);
});

test('register utiliza módulos padrão quando tabela de planos está ausente', async () => {
  const { calls: poolCalls, restore: restorePoolQuery } = setupPoolQueryMock([
    { rows: [], rowCount: 0 },
  ]);

  const missingPlanosError = Object.assign(
    new Error('relation "public.planos" does not exist'),
    { code: '42P01' }
  );

  const clientResponses: QueryResult[] = [
    { rows: [], rowCount: 0 },
    missingPlanosError,
    { rows: [], rowCount: 0 },
    {
      rows: [
        {
          id: 777,
          nome_empresa: 'Acme Corp',
          plano: null,
          trial_started_at: '2024-01-01T00:00:00.000Z',
          trial_ends_at: '2024-01-15T00:00:00.000Z',
        },
      ],
      rowCount: 1,
    },
    { rows: [], rowCount: 0 },
    { rows: [{ id: 99, nome: 'Administrador' }], rowCount: 1 },
    { rows: [], rowCount: 0 },
    {
      rows: [
        {
          id: 1234,
          nome_completo: 'Alice Doe',
          email: 'alice@example.com',
          perfil: 99,
          empresa: 777,
          status: true,
          telefone: null,
          datacriacao: '2024-01-02T00:00:00.000Z',
        },
      ],
      rowCount: 1,
    },
    { rows: [], rowCount: 1 },

  ];

  const { calls: clientCalls, restore: restoreConnect } = setupPoolConnectMock(clientResponses);

  const req = {
    body: {
      name: 'Alice Doe',
      email: 'alice@example.com',
      company: 'Acme Corp',
      password: 'SenhaSegura123',
      planId: 7,
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
    empresa: { plano: number | null };
    perfil: { modulos: unknown };
  };

  assert.equal(responseBody.empresa.plano, null);
  assert.ok(Array.isArray(responseBody.perfil.modulos));
  assert.ok((responseBody.perfil.modulos as unknown[]).length > 0);

  const perfilModuloCall = clientCalls.find((call) =>
    call.text.includes('INSERT INTO public.perfil_modulos')
  );
  assert.ok(perfilModuloCall, 'expected perfil_modulos insert to be executed');
  assert.ok(Array.isArray(perfilModuloCall?.values?.[1]));
  assert.ok(((perfilModuloCall?.values?.[1] as unknown[]) ?? []).length > 0);

  const updateResponsavelCall = clientCalls.find((call) =>
    call.text.includes('UPDATE public.empresas SET responsavel')
  );
  assert.ok(updateResponsavelCall, 'expected company responsavel update to be executed');
  assert.deepEqual(updateResponsavelCall?.values, [1234, 777]);


  assert.equal(poolCalls.length, 1);
  assert.equal(poolCalls[0]?.text.includes('SELECT 1 FROM public.usuarios'), true);
});

test('register tolerates trailing spaces when matching existing company and profile', async () => {
  const { restore: restorePoolQuery } = setupPoolQueryMock([
    { rows: [], rowCount: 0 },
    { rows: [{ valor_mensal: '199.90', valor_anual: '999.90' }], rowCount: 1 },
  ]);

  const clientResponses: QueryResponse[] = [
    { rows: [], rowCount: 0 },
    { rows: [{ id: 7, modulos: planModules }], rowCount: 1 },
    { rows: [{ id: 42, nome_empresa: 'Acme Corp   ', plano: '7' }], rowCount: 1 },
    { rows: [{ id: 99, nome: 'Administrador   ' }], rowCount: 1 },
    { rows: [], rowCount: 0 },
    { rows: [], rowCount: 0 },
    {
      rows: [
        {
          id: 555,
          nome_completo: 'Alice Doe',
          email: 'alice@example.com',
          perfil: 99,
          empresa: 42,
          status: true,
          telefone: null,
          datacriacao: '2024-01-02T00:00:00.000Z',
        },
      ],
      rowCount: 1,
    },
  ];

  const { calls: clientCalls, restore: restoreConnect } = setupPoolConnectMock(clientResponses);

  const req = {
    body: {
      name: 'Alice Doe',
      email: 'alice@example.com',
      company: 'Acme Corp',
      password: 'SenhaSegura123',
      planId: 7,
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
    empresa: { nome: string };
    perfil: { nome: string };
  };

  assert.equal(responseBody.empresa.nome, 'Acme Corp');
  assert.equal(responseBody.perfil.nome, 'Administrador');

  const companyQuery = clientCalls.find((call) => call.text.includes('FROM public.empresas'));
  assert.ok(companyQuery, 'expected company lookup query to be executed');
  assert.match(
    normalizeSql(companyQuery!.text),
    /LOWER\(TRIM\(nome_empresa\)\)\s*=\s*LOWER\(TRIM\(\$1\)\)/i,
  );

  const perfilQuery = clientCalls.find((call) => call.text.includes('FROM public.perfis'));
  assert.ok(perfilQuery, 'expected profile lookup query to be executed');
  assert.match(normalizeSql(perfilQuery!.text), /LOWER\(TRIM\(nome\)\)\s*=\s*LOWER\(TRIM\(\$2\)\)/i);

  const perfilInsertCall = clientCalls.find((call) => call.text.includes('INSERT INTO public.perfis'));
  assert.equal(perfilInsertCall, undefined);
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
      planId: 7,
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

test('login succeeds when subscription is active', async () => {
  const password = 'SenhaSegura123';
  const hashedPassword = await hashPassword(password);
  const now = Date.now();
  const trialEndsAt = new Date(now + 3 * 24 * 60 * 60 * 1000);
  const currentPeriodEndsAt = new Date(now + 30 * 24 * 60 * 60 * 1000);
  const gracePeriodEndsAt = new Date(currentPeriodEndsAt.getTime() + 10 * 24 * 60 * 60 * 1000);

  const { restore: restorePoolQuery } = setupPoolQueryMock([
    {
      rows: [
        {
          id: 77,
          nome_completo: 'Alice Doe',
          email: 'alice@example.com',
          senha: hashedPassword,
          must_change_password: false,
          status: true,
          perfil: 15,
          empresa_id: 20,
          empresa_nome: 'Acme Corp',
          setor_id: 9,
          setor_nome: 'Jurídico',
          empresa_plano: 5,
          empresa_ativo: true,
          empresa_datacadastro: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
          empresa_trial_ends_at: trialEndsAt.toISOString(),
          empresa_current_period_ends_at: currentPeriodEndsAt.toISOString(),
          empresa_grace_period_ends_at: gracePeriodEndsAt.toISOString(),
        },
      ],
      rowCount: 1,
    },
    {
      rows: [],
      rowCount: 0,
    },
    {
      rows: planModules.map((modulo) => ({ modulo })),
      rowCount: planModules.length,
    },
  ]);

  const req = {
    body: {
      email: 'alice@example.com',
      senha: password,
    },
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await login(req, res);
  } finally {
    restorePoolQuery();
  }

  assert.equal(res.statusCode, 200);
  assert.ok(res.body && typeof res.body === 'object');

  const payload = res.body as {
    token?: string;
    user?: {
      modulos?: string[];
      subscription?: {
        status?: string;
        trialEndsAt?: string | null;
        currentPeriodEndsAt?: string | null;
        gracePeriodEndsAt?: string | null;
        isInGoodStanding?: boolean;
      };
      mustChangePassword?: boolean;
    };
  };

  assert.equal(typeof payload.token, 'string');
  assert.ok(payload.token && payload.token.includes('.'));
  const returnedModules = payload.user?.modulos ?? [];
  assert.deepEqual([...returnedModules].sort(), [...planModules].sort());
  assert.equal(payload.user?.subscription?.status, 'trialing');
  assert.equal(payload.user?.subscription?.trialEndsAt, trialEndsAt.toISOString());
  assert.equal(
    payload.user?.subscription?.currentPeriodEndsAt,
    currentPeriodEndsAt.toISOString()
  );
  assert.equal(payload.user?.subscription?.gracePeriodEndsAt, gracePeriodEndsAt.toISOString());
  assert.equal(payload.user?.subscription?.isInGoodStanding, true);
  assert.equal(payload.user?.mustChangePassword, false);
});

test('login rejects when user is inactive', async () => {
  const password = 'SenhaSegura123';
  const hashedPassword = await hashPassword(password);

  const { restore: restorePoolQuery } = setupPoolQueryMock([
    {
      rows: [
        {
          id: 77,
          nome_completo: 'Alice Doe',
          email: 'alice@example.com',
          senha: hashedPassword,
          must_change_password: false,
          status: 'inactive',
          perfil: 15,
          empresa_id: 20,
          empresa_nome: 'Acme Corp',
          setor_id: 9,
          setor_nome: 'Jurídico',
        },
      ],
      rowCount: 1,
    },
  ]);

  const req = {
    body: {
      email: 'alice@example.com',
      senha: password,
    },
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await login(req, res);
  } finally {
    restorePoolQuery();
  }

  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, { error: 'Usuário inativo.' });
});

test('login rejects when trial period has expired without payment', async () => {
  const password = 'SenhaSegura123';
  const hashedPassword = await hashPassword(password);
  const now = Date.now();
  const trialEndsAt = new Date(now - 2 * 24 * 60 * 60 * 1000);

  const { restore: restorePoolQuery } = setupPoolQueryMock([
    {
      rows: [
        {
          id: 88,
          nome_completo: 'Alice Doe',
          email: 'alice@example.com',
          senha: hashedPassword,
          must_change_password: false,
          status: true,
          perfil: 22,
          empresa_id: 30,
          empresa_nome: 'Acme Corp',
          setor_id: 11,
          setor_nome: 'Financeiro',
          empresa_plano: 8,
          empresa_ativo: true,
          empresa_datacadastro: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(),
          empresa_trial_ends_at: trialEndsAt.toISOString(),
          empresa_current_period_ends_at: null,
          empresa_grace_period_ends_at: null,
        },
      ],
      rowCount: 1,
    },
  ]);

  const req = {
    body: {
      email: 'alice@example.com',
      senha: password,
    },
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await login(req, res);
  } finally {
    restorePoolQuery();
  }

  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, {
    error: 'Período de teste encerrado. Realize uma assinatura para continuar acessando o sistema.',
  });
  assert.equal('token' in (res.body as Record<string, unknown>), false);
});

test('login rejects with payment required once grace period expires', async () => {
  const password = 'SenhaSegura123';
  const hashedPassword = await hashPassword(password);
  const now = Date.now();
  const currentPeriodEndsAt = new Date(now - 12 * 24 * 60 * 60 * 1000);
  const gracePeriodEndsAt = new Date(currentPeriodEndsAt.getTime() + 10 * 24 * 60 * 60 * 1000);

  const { restore: restorePoolQuery } = setupPoolQueryMock([
    {
      rows: [
        {
          id: 99,
          nome_completo: 'Alice Doe',
          email: 'alice@example.com',
          senha: hashedPassword,
          must_change_password: false,
          status: true,
          perfil: 33,
          empresa_id: 40,
          empresa_nome: 'Acme Corp',
          setor_id: 12,
          setor_nome: 'Financeiro',
          empresa_plano: 9,
          empresa_ativo: true,
          empresa_datacadastro: new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString(),
          empresa_trial_ends_at: new Date(now - 80 * 24 * 60 * 60 * 1000).toISOString(),
          empresa_current_period_ends_at: currentPeriodEndsAt.toISOString(),
          empresa_grace_period_ends_at: gracePeriodEndsAt.toISOString(),
        },
      ],
      rowCount: 1,
    },
  ]);

  const req = {
    body: {
      email: 'alice@example.com',
      senha: password,
    },
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await login(req, res);
  } finally {
    restorePoolQuery();
  }

  assert.equal(res.statusCode, 402);
  assert.deepEqual(res.body, {
    error:
      'Assinatura expirada após o período de tolerância de 10 dias. Regularize o pagamento para continuar.',
  });
  assert.equal('token' in (res.body as Record<string, unknown>), false);
});

test('login migrates legacy sha256 hashes to argon2 format', async () => {
  const password = 'SenhaSegura123';
  const salt = 'f00dbabe1234abcd';
  const legacyDigest = crypto.createHash('sha256').update(`${salt}:${password}`).digest('hex');
  const legacyHash = `sha256:${salt}:${legacyDigest}`;
  const now = Date.now();
  const trialEndsAt = new Date(now + 3 * 24 * 60 * 60 * 1000);
  const currentPeriodEndsAt = new Date(now + 30 * 24 * 60 * 60 * 1000);
  const gracePeriodEndsAt = new Date(currentPeriodEndsAt.getTime() + 10 * 24 * 60 * 60 * 1000);

  const { calls, restore: restorePoolQuery } = setupPoolQueryMock([
    {
      rows: [
        {
          id: 171,
          nome_completo: 'Alice Doe',
          email: 'alice@example.com',
          senha: legacyHash,
          must_change_password: false,
          status: true,
          perfil: 15,
          empresa_id: 20,
          empresa_nome: 'Acme Corp',
          setor_id: 9,
          setor_nome: 'Jurídico',
          empresa_plano: 5,
          empresa_ativo: true,
          empresa_datacadastro: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
          empresa_trial_ends_at: trialEndsAt.toISOString(),
          empresa_current_period_ends_at: currentPeriodEndsAt.toISOString(),
          empresa_grace_period_ends_at: gracePeriodEndsAt.toISOString(),
        },
      ],
      rowCount: 1,
    },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 0 },
    { rows: planModules.map((modulo) => ({ modulo })), rowCount: planModules.length },
  ]);

  const req = {
    body: {
      email: 'alice@example.com',
      senha: password,
    },
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await login(req, res);
  } finally {
    restorePoolQuery();
  }

  assert.equal(res.statusCode, 200);

  const passwordUpdateIndex = calls.findIndex((call) =>
    /UPDATE public\.usuarios/.test(call.text ?? '') && /SET senha = \$1/.test(call.text ?? '')
  );
  assert.ok(passwordUpdateIndex >= 1, 'expected legacy hash update before finishing login');

  const passwordUpdateCall = calls[passwordUpdateIndex];
  const updatedHash = passwordUpdateCall?.values?.[0];
  assert.equal(typeof updatedHash, 'string');
  assert.ok(String(updatedHash).startsWith('argon2:'));
  assert.notEqual(updatedHash, legacyHash);

  const lastLoginIndex = calls.findIndex((call) =>
    /UPDATE public\.usuarios/.test(call.text ?? '') && /SET ultimo_login/.test(call.text ?? '')
  );
  assert.ok(lastLoginIndex > passwordUpdateIndex, 'expected last login update after password migration');

  const modulesCall = calls.find((call) => /perfil_modulos/.test(call.text ?? ''));
  assert.ok(modulesCall, 'expected module fetch to occur');
});

test('login migrates plain text passwords to argon2 format', async () => {
  const password = 'SenhaSegura123';
  const now = Date.now();
  const trialEndsAt = new Date(now + 5 * 24 * 60 * 60 * 1000);
  const currentPeriodEndsAt = new Date(now + 35 * 24 * 60 * 60 * 1000);
  const gracePeriodEndsAt = new Date(currentPeriodEndsAt.getTime() + 10 * 24 * 60 * 60 * 1000);

  const { calls, restore: restorePoolQuery } = setupPoolQueryMock([
    {
      rows: [
        {
          id: 172,
          nome_completo: 'Alice Doe',
          email: 'alice@example.com',
          senha: password,
          must_change_password: false,
          status: true,
          perfil: 15,
          empresa_id: 20,
          empresa_nome: 'Acme Corp',
          setor_id: 9,
          setor_nome: 'Jurídico',
          empresa_plano: 5,
          empresa_ativo: true,
          empresa_datacadastro: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
          empresa_trial_ends_at: trialEndsAt.toISOString(),
          empresa_current_period_ends_at: currentPeriodEndsAt.toISOString(),
          empresa_grace_period_ends_at: gracePeriodEndsAt.toISOString(),
        },
      ],
      rowCount: 1,
    },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 0 },
    { rows: planModules.map((modulo) => ({ modulo })), rowCount: planModules.length },
  ]);

  const req = {
    body: {
      email: 'alice@example.com',
      senha: password,
    },
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await login(req, res);
  } finally {
    restorePoolQuery();
  }

  assert.equal(res.statusCode, 200);

  const passwordUpdateCall = calls.find((call) =>
    /UPDATE public\.usuarios/.test(call.text ?? '') && /SET senha = \$1/.test(call.text ?? '')
  );
  assert.ok(passwordUpdateCall, 'expected plain text password migration');

  const updatedHash = passwordUpdateCall?.values?.[0];
  assert.equal(typeof updatedHash, 'string');
  assert.ok(String(updatedHash).startsWith('argon2:'));
  assert.notEqual(updatedHash, password);

  const modulesCall = calls.find((call) => /perfil_modulos/.test(call.text ?? ''));
  assert.ok(modulesCall, 'expected module fetch to occur');
});

test('changePassword updates the stored hash and clears the must-change flag', async () => {
  const temporaryPassword = 'Temp#Senha123';
  const hashedTemporaryPassword = await hashPassword(temporaryPassword);
  const newPassword = 'NovaSenhaSegura!45';

  const { calls, restore, wasReleased } = setupPoolConnectMock([
    {
      rows: [{ senha: hashedTemporaryPassword, must_change_password: true }],
      rowCount: 1,
    },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
  ]);

  const req = {
    auth: { userId: 321, payload: {} },
    body: {
      temporaryPassword,
      newPassword,
      confirmPassword: newPassword,
    },
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await changePassword(req, res);
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { message: 'Senha atualizada com sucesso.' });
  assert.equal(wasReleased(), true);

  const updateCall = calls.find((call) => call.text.includes('UPDATE public.usuarios'));
  assert.ok(updateCall, 'expected user update to be executed');
  assert.equal(updateCall?.values?.[1], 321);
  const storedHash = updateCall?.values?.[0];
  assert.equal(typeof storedHash, 'string');
  assert.ok(typeof storedHash === 'string' && storedHash.startsWith('argon2:'));

  const tokenUpdateCall = calls.find((call) =>
    call.text.includes('UPDATE public.password_reset_tokens')
  );
  assert.ok(tokenUpdateCall, 'expected reset token update to be executed');
  assert.equal(tokenUpdateCall?.values?.[0], 321);
});

test('changePassword rejects invalid provisional passwords', async () => {
  const correctTemporaryPassword = 'Temp#Senha123';
  const hashedTemporaryPassword = await hashPassword(correctTemporaryPassword);

  const { calls, restore } = setupPoolConnectMock([
    {
      rows: [{ senha: hashedTemporaryPassword, must_change_password: true }],
      rowCount: 1,
    },
  ]);

  const req = {
    auth: { userId: 555, payload: {} },
    body: {
      temporaryPassword: 'OutraSenha123',
      newPassword: 'NovaSenha!789',
      confirmPassword: 'NovaSenha!789',
    },
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await changePassword(req, res);
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: 'Senha provisória inválida.' });
  const updateCall = calls.find((call) => call.text.includes('UPDATE public.usuarios'));
  assert.equal(updateCall, undefined);
});
