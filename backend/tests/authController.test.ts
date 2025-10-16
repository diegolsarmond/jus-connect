import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import type { Request, Response } from 'express';
import { Pool } from 'pg';
import { hashPassword } from '../src/utils/passwordUtils';
import {
  SUBSCRIPTION_DEFAULT_GRACE_DAYS,
  SUBSCRIPTION_GRACE_DAYS_ANNUAL,
} from '../src/constants/subscription';

process.env.AUTH_TOKEN_SECRET ??= 'test-secret';

let register: typeof import('../src/controllers/authController')['register'];
let login: typeof import('../src/controllers/authController')['login'];
let changePassword: typeof import('../src/controllers/authController')['changePassword'];
let confirmEmail: typeof import('../src/controllers/authController')['confirmEmail'];
let setSendEmailConfirmationTokenForTests: typeof import('../src/controllers/authController')['__setSendEmailConfirmationTokenForTests'];
let resetSendEmailConfirmationTokenForTests: typeof import('../src/controllers/authController')['__resetSendEmailConfirmationTokenForTests'];
let setConfirmEmailWithTokenForTests: typeof import('../src/controllers/authController')['__setConfirmEmailWithTokenForTests'];
let resetConfirmEmailWithTokenForTests: typeof import('../src/controllers/authController')['__resetConfirmEmailWithTokenForTests'];
let emailConfirmationService: typeof import('../src/services/emailConfirmationService');

const planModules = ['configuracoes', 'clientes', 'dashboard'];

test.before(async () => {
  ({
    register,
    login,
    changePassword,
    confirmEmail,
    __setSendEmailConfirmationTokenForTests: setSendEmailConfirmationTokenForTests,
    __resetSendEmailConfirmationTokenForTests: resetSendEmailConfirmationTokenForTests,
    __setConfirmEmailWithTokenForTests: setConfirmEmailWithTokenForTests,
    __resetConfirmEmailWithTokenForTests: resetConfirmEmailWithTokenForTests,
  } = await import('../src/controllers/authController'));
  emailConfirmationService = await import('../src/services/emailConfirmationService');
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

const setupPoolQueryMock = (responses: QueryResult[]) => {
  const calls: QueryCall[] = [];

  const mock = test.mock.method(
    Pool.prototype,
    'query',
    async function (this: Pool, text: string, values?: unknown[]) {
      calls.push({ text, values });

      if (responses.length === 0) {
        throw new Error('Unexpected pool query invocation');
      }

      const result = responses.shift()!;

      if (result instanceof Error) {
        throw result;
      }

      return result;
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
  { rows: [], rowCount: 1 },
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
          welcome_email_pending: true,
          datacriacao: '2024-01-02T00:00:00.000Z',
        },
      ],
      rowCount: 1,
    },
    { rows: [], rowCount: 1 },
    { rows: [{ id: 201 }], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [{ id: 202 }], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [{ id: 203 }], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
  ];

  const { calls: clientCalls, restore: restoreConnect, wasReleased } = setupPoolConnectMock(
    clientResponses
  );

  const sendEmailCalls: Parameters<
    typeof emailConfirmationService.sendEmailConfirmationToken
  >[0][] = [];

  setSendEmailConfirmationTokenForTests(async (target) => {
    sendEmailCalls.push(target);
  });

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
    resetSendEmailConfirmationTokenForTests();
  }

  assert.equal(res.statusCode, 201);

  const responseBody = res.body as {
    message: string;
    requiresEmailConfirmation: boolean;
    user: { id: number; perfil: number; empresa: number };
    empresa: { id: number; nome: string; plano: number | null };
    perfil: { id: number; nome: string; modulos: string[] };
  };

  assert.equal(responseBody.requiresEmailConfirmation, true);
  assert.match(responseBody.message, /confirme o e-mail/i);
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

  assert.equal(poolCalls.length, 3);
  assert.equal(poolCalls[0]?.text.includes('SELECT 1 FROM public.usuarios'), true);
  assert.match(poolCalls[1]?.text ?? '', /FROM public\.planos/i);
  assert.deepEqual(poolCalls[1]?.values, [7]);
  assert.match(poolCalls[2]?.text ?? '', /UPDATE public\.usuarios SET welcome_email_pending = FALSE/);
  assert.deepEqual(poolCalls[2]?.values, [123]);
  assert.equal(wasReleased(), true);
  assert.equal(sendEmailCalls.length, 1);
  const [confirmationArg] = sendEmailCalls;
  assert.deepEqual(confirmationArg, {
    id: 123,
    nome_completo: 'Alice Doe',
    email: 'alice@example.com',
  });
});

test('register retorna erro 500 quando envio do e-mail de confirmação falha', async () => {
  const duplicateCheckResponses: QueryResponse[] = [
    { rows: [], rowCount: 0 },
    { rows: [{ valor_mensal: '199.90', valor_anual: '999.90' }], rowCount: 1 },
    { rows: [], rowCount: 1 },
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
          welcome_email_pending: true,
          datacriacao: '2024-01-02T00:00:00.000Z',
        },
      ],
      rowCount: 1,
    },
    { rows: [], rowCount: 1 },
    { rows: [{ id: 201 }], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [{ id: 202 }], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [{ id: 203 }], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
  ];

  const { calls: clientCalls, restore: restoreConnect, wasReleased } = setupPoolConnectMock(
    clientResponses
  );

  let sendEmailCalls = 0;

  setSendEmailConfirmationTokenForTests(async () => {
    sendEmailCalls += 1;
    throw new Error('Falha ao enviar e-mail');
  });

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
    resetSendEmailConfirmationTokenForTests();
  }

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, {
    error: 'Não foi possível enviar o e-mail de confirmação. Tente novamente.',
  });

  const beginCall = clientCalls[0];
  assert.equal(beginCall?.text.trim().toUpperCase(), 'BEGIN');

  const commitCall = clientCalls.find((call) => call.text.trim().toUpperCase() === 'COMMIT');
  assert.ok(commitCall, 'expected COMMIT to be called');

  assert.equal(poolCalls.length, 3);
  assert.equal(poolCalls[0]?.text.includes('SELECT 1 FROM public.usuarios'), true);
  assert.match(poolCalls[1]?.text ?? '', /FROM public\.planos/i);
  assert.match(
    poolCalls[2]?.text ?? '',
    /UPDATE public\.usuarios SET welcome_email_pending = TRUE WHERE id = \$1/
  );
  assert.deepEqual(poolCalls[2]?.values, [123]);
  assert.equal(wasReleased(), true);
  assert.equal(sendEmailCalls, 1);
});

test('register mantém resposta de erro quando restauração do welcome_email_pending falha após erro no envio do e-mail', async () => {
  const duplicateCheckResponses: QueryResult[] = [
    { rows: [], rowCount: 0 },
    { rows: [{ valor_mensal: '199.90', valor_anual: '999.90' }], rowCount: 1 },
    new Error('Falha ao atualizar welcome_email_pending'),
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
          welcome_email_pending: true,
          datacriacao: '2024-01-02T00:00:00.000Z',
        },
      ],
      rowCount: 1,
    },
    { rows: [], rowCount: 1 },
    { rows: [{ id: 201 }], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [{ id: 202 }], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [{ id: 203 }], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
  ];

  const { calls: clientCalls, restore: restoreConnect, wasReleased } = setupPoolConnectMock(
    clientResponses
  );

  let sendEmailCalls = 0;

  setSendEmailConfirmationTokenForTests(async () => {
    sendEmailCalls += 1;
    throw new Error('Falha ao enviar e-mail');
  });

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
    resetSendEmailConfirmationTokenForTests();
  }

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, {
    error: 'Não foi possível enviar o e-mail de confirmação. Tente novamente.',
  });

  const beginCall = clientCalls[0];
  assert.equal(beginCall?.text.trim().toUpperCase(), 'BEGIN');

  const commitCall = clientCalls.find((call) => call.text.trim().toUpperCase() === 'COMMIT');
  assert.ok(commitCall, 'expected COMMIT to be called');

  const welcomePendingUpdate = poolCalls.find((call) =>
    call.text.includes('UPDATE public.usuarios SET welcome_email_pending = TRUE')
  );
  assert.ok(welcomePendingUpdate, 'expected welcome_email_pending revert query to be executed');

  assert.equal(poolCalls.length, 3);
  assert.equal(poolCalls[0]?.text.includes('SELECT 1 FROM public.usuarios'), true);
  assert.match(poolCalls[1]?.text ?? '', /FROM public\.planos/i);
  assert.equal(wasReleased(), true);
  assert.equal(sendEmailCalls, 1);
});

test('register utiliza módulos padrão quando tabela de planos está ausente', async () => {
  const { calls: poolCalls, restore: restorePoolQuery } = setupPoolQueryMock([
    { rows: [], rowCount: 0 },
    { rows: [], rowCount: 1 },
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
          welcome_email_pending: true,
          datacriacao: '2024-01-02T00:00:00.000Z',
        },
      ],
      rowCount: 1,
    },
    { rows: [], rowCount: 1 },

    { rows: [{ id: 301 }], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [{ id: 302 }], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [{ id: 303 }], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },

  ];

  const { calls: clientCalls, restore: restoreConnect } = setupPoolConnectMock(clientResponses);

  const sendEmailCalls: Parameters<
    typeof emailConfirmationService.sendEmailConfirmationToken
  >[0][] = [];

  setSendEmailConfirmationTokenForTests(async (target) => {
    sendEmailCalls.push(target);
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
    restoreConnect();
    restorePoolQuery();
    resetSendEmailConfirmationTokenForTests();
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


  assert.equal(poolCalls.length, 2);
  assert.equal(poolCalls[0]?.text.includes('SELECT 1 FROM public.usuarios'), true);
  assert.match(poolCalls[1]?.text ?? '', /UPDATE public\.usuarios SET welcome_email_pending = FALSE/);
  assert.deepEqual(poolCalls[1]?.values, [1234]);
  assert.equal(sendEmailCalls.length, 1);
});

test('register tolerates trailing spaces when matching existing company and profile', async () => {
  const { calls: poolCalls, restore: restorePoolQuery } = setupPoolQueryMock([
    { rows: [], rowCount: 0 },
    { rows: [{ valor_mensal: '199.90', valor_anual: '999.90' }], rowCount: 1 },
    { rows: [], rowCount: 1 },
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
          welcome_email_pending: true,
          datacriacao: '2024-01-02T00:00:00.000Z',
        },
      ],
      rowCount: 1,
    },
  ];

  const { calls: clientCalls, restore: restoreConnect } = setupPoolConnectMock(clientResponses);

  const sendEmailCalls: Parameters<
    typeof emailConfirmationService.sendEmailConfirmationToken
  >[0][] = [];

  setSendEmailConfirmationTokenForTests(async (target) => {
    sendEmailCalls.push(target);
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
    restoreConnect();
    restorePoolQuery();
    resetSendEmailConfirmationTokenForTests();
  }

  assert.equal(res.statusCode, 201);

  const responseBody = res.body as {
    message: string;
    requiresEmailConfirmation: boolean;
    empresa: { nome: string };
    perfil: { nome: string };
  };

  assert.equal(responseBody.requiresEmailConfirmation, true);
  assert.match(responseBody.message, /confirme o e-mail/i);
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
  assert.equal(sendEmailCalls.length, 1);
  assert.equal(poolCalls.length, 3);
  assert.match(poolCalls[2]?.text ?? '', /UPDATE public\.usuarios SET welcome_email_pending = FALSE/);
  assert.deepEqual(poolCalls[2]?.values, [555]);
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
  const gracePeriodEndsAt = new Date(
    currentPeriodEndsAt.getTime() + SUBSCRIPTION_DEFAULT_GRACE_DAYS * 24 * 60 * 60 * 1000,
  );

  const { restore: restorePoolQuery } = setupPoolQueryMock([
    {
      rows: [
        {
          id: 77,
          nome_completo: 'Alice Doe',
          email: 'alice@example.com',
          senha: hashedPassword,
          must_change_password: false,
          email_confirmed_at: new Date(now - 60 * 60 * 1000).toISOString(),
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

test('login synthesizes annual grace period when not persisted', async () => {
  const password = 'SenhaSegura123';
  const hashedPassword = await hashPassword(password);
  const now = Date.now();
  const currentPeriodEndsAt = new Date(now + 15 * 24 * 60 * 60 * 1000);
  const expectedGracePeriodEndsAt = new Date(
    currentPeriodEndsAt.getTime() + SUBSCRIPTION_GRACE_DAYS_ANNUAL * 24 * 60 * 60 * 1000,
  );

  const { restore: restorePoolQuery } = setupPoolQueryMock([
    {
      rows: [
        {
          id: 88,
          nome_completo: 'Alice Doe',
          email: 'alice@example.com',
          senha: hashedPassword,
          must_change_password: false,
          email_confirmed_at: new Date(now - 60 * 60 * 1000).toISOString(),
          status: true,
          perfil: 22,
          empresa_id: 30,
          empresa_nome: 'Acme Corp',
          setor_id: 11,
          setor_nome: 'Financeiro',
          empresa_plano: 8,
          empresa_ativo: true,
          empresa_datacadastro: new Date(now - 45 * 24 * 60 * 60 * 1000).toISOString(),
          empresa_trial_ends_at: null,
          empresa_current_period_ends_at: currentPeriodEndsAt.toISOString(),
          empresa_grace_period_ends_at: null,
          empresa_subscription_cadence: 'annual',
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
    user?: {
      subscription?: {
        gracePeriodEndsAt?: string | null;
      };
    };
  };

  assert.equal(
    payload.user?.subscription?.gracePeriodEndsAt,
    expectedGracePeriodEndsAt.toISOString(),
  );
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
          email_confirmed_at: new Date().toISOString(),
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

test('login rejects when e-mail confirmation is pending', async () => {
  const password = 'SenhaSegura123';
  const hashedPassword = await hashPassword(password);

  const { restore: restorePoolQuery } = setupPoolQueryMock([
    {
      rows: [
        {
          id: 78,
          nome_completo: 'Alice Doe',
          email: 'alice@example.com',
          senha: hashedPassword,
          must_change_password: false,
          email_confirmed_at: null,
          status: true,
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
  assert.deepEqual(res.body, { error: 'Confirme seu e-mail antes de acessar.' });
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
          email_confirmed_at: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
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
  const gracePeriodEndsAt = new Date(
    currentPeriodEndsAt.getTime() + SUBSCRIPTION_DEFAULT_GRACE_DAYS * 24 * 60 * 60 * 1000,
  );

  const { restore: restorePoolQuery } = setupPoolQueryMock([
    {
      rows: [
        {
          id: 99,
          nome_completo: 'Alice Doe',
          email: 'alice@example.com',
          senha: hashedPassword,
          must_change_password: false,
          email_confirmed_at: new Date(now - 15 * 24 * 60 * 60 * 1000).toISOString(),
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
    error: `Assinatura expirada após o período de tolerância de ${SUBSCRIPTION_DEFAULT_GRACE_DAYS} dias. Regularize o pagamento para continuar.`,
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
  const gracePeriodEndsAt = new Date(
    currentPeriodEndsAt.getTime() + SUBSCRIPTION_DEFAULT_GRACE_DAYS * 24 * 60 * 60 * 1000,
  );

  const { calls, restore: restorePoolQuery } = setupPoolQueryMock([
    {
      rows: [
        {
          id: 171,
          nome_completo: 'Alice Doe',
          email: 'alice@example.com',
          senha: legacyHash,
          must_change_password: false,
          email_confirmed_at: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
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
  const gracePeriodEndsAt = new Date(
    currentPeriodEndsAt.getTime() + SUBSCRIPTION_DEFAULT_GRACE_DAYS * 24 * 60 * 60 * 1000,
  );

  const { calls, restore: restorePoolQuery } = setupPoolQueryMock([
    {
      rows: [
        {
          id: 172,
          nome_completo: 'Alice Doe',
          email: 'alice@example.com',
          senha: password,
          must_change_password: false,
          email_confirmed_at: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
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

test('confirmEmail returns success when token is valid', async () => {
  setConfirmEmailWithTokenForTests(async () => ({
    userId: 99,
    confirmedAt: new Date('2024-01-02T10:00:00.000Z'),
  }));

  const req = { body: { token: 'abc123' } } as unknown as Request;
  const res = createMockResponse();

  try {
    await confirmEmail(req, res);
  } finally {
    resetConfirmEmailWithTokenForTests();
  }

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    message: 'E-mail confirmado com sucesso.',
    confirmedAt: new Date('2024-01-02T10:00:00.000Z').toISOString(),
  });
});

test('confirmEmail handles expired tokens', async () => {
  setConfirmEmailWithTokenForTests(async () => {
    throw new emailConfirmationService.EmailConfirmationTokenError(
      'Token expirado',
      'TOKEN_EXPIRED'
    );
  });

  const req = { body: { token: 'expired-token' } } as unknown as Request;
  const res = createMockResponse();

  try {
    await confirmEmail(req, res);
  } finally {
    resetConfirmEmailWithTokenForTests();
  }

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, {
    error: 'Token de confirmação expirado. Solicite um novo link.',
  });
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
