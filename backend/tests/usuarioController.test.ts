import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';
import { Pool } from 'pg';

process.env.DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/testdb';


type QueryCall = { text: string; values?: unknown[] };
type QueryResponse = { rows: any[]; rowCount: number };
type QueryMockResponse = QueryResponse | Error;

let listUsuarios: typeof import('../src/controllers/usuarioController')['listUsuarios'];
let listUsuariosByEmpresa: typeof import('../src/controllers/usuarioController')['listUsuariosByEmpresa'];
let getUsuarioById: typeof import('../src/controllers/usuarioController')['getUsuarioById'];
let createUsuario: typeof import('../src/controllers/usuarioController')['createUsuario'];
let updateUsuario: typeof import('../src/controllers/usuarioController')['updateUsuario'];
let deleteUsuario: typeof import('../src/controllers/usuarioController')['deleteUsuario'];
let setWelcomeEmailServiceForTests: typeof import('../src/controllers/usuarioController')['__setWelcomeEmailServiceForTests'];
let resetWelcomeEmailServiceForTests: typeof import('../src/controllers/usuarioController')['__resetWelcomeEmailServiceForTests'];

test.before(async () => {
  ({
    listUsuarios,
    listUsuariosByEmpresa,
    getUsuarioById,
    createUsuario,
    updateUsuario,
    deleteUsuario,
    __setWelcomeEmailServiceForTests: setWelcomeEmailServiceForTests,
    __resetWelcomeEmailServiceForTests: resetWelcomeEmailServiceForTests,
  } = await import('../src/controllers/usuarioController'));
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
    send(payload?: unknown) {
      this.body = payload;
      return this as Response;
    },
  };

  return response as Response & { statusCode: number; body: unknown };
};

const setupQueryMock = (responses: (QueryResponse | Error)[]) => {
  const calls: QueryCall[] = [];

  const queryImpl = async (text: string, values?: unknown[]) => {
    calls.push({ text, values });

    const normalized = text.trim().toUpperCase();

    if (normalized === 'BEGIN' || normalized === 'COMMIT' || normalized === 'ROLLBACK') {
      return { rows: [], rowCount: 0 } satisfies QueryResponse;
    }

    if (normalized.includes('UPDATE PUBLIC.EMAIL_CONFIRMATION_TOKENS')) {
      return { rows: [], rowCount: 0 } satisfies QueryResponse;
    }

    if (normalized.includes('INSERT INTO PUBLIC.EMAIL_CONFIRMATION_TOKENS')) {
      return { rows: [], rowCount: 1 } satisfies QueryResponse;
    }

    if (responses.length === 0) {
      throw new Error('Unexpected query invocation');
    }

    const next = responses.shift()!;

    if (next instanceof Error) {
      throw next;
    }

    return next;
  };

  const queryMock = test.mock.method(Pool.prototype, 'query', queryImpl as unknown as Pool['query']);

  const connectMock = test.mock.method(Pool.prototype, 'connect', async () => ({
    query: queryImpl,
    release() {
      // noop
    },
  }));

  const restore = () => {
    queryMock.mock.restore();
    connectMock.mock.restore();
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

test('listUsuarios retorna usuários da empresa do autenticado', async () => {
  const userRows = [
    {
      id: 1,
      nome_completo: 'Maria Silva',
      cpf: '12345678901',
      email: 'maria@example.com',
      perfil: 'admin',
      empresa: 55,
      setor: 7,
      oab: '12345',
      oab_number: null,
      oab_uf: null,
      status: true,
      senha: '$hashed',
      telefone: '(11) 99999-0000',
      ultimo_login: '2024-01-01T12:00:00.000Z',
      observacoes: null,
      welcome_email_pending: false,
      datacriacao: '2023-01-01T12:00:00.000Z',
    },
  ];

  const { calls, restore } = setupQueryMock([
    { rows: [{ empresa: 55 }], rowCount: 1 },
    { rows: userRows, rowCount: userRows.length },
  ]);

  const req = {
    auth: createAuth(10),
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await listUsuarios(req, res);
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 200);
  const expectedRows = userRows.map(({ cpf: _cpf, senha: _senha, ...rest }) => rest);
  assert.deepEqual(res.body, expectedRows);
  assert.equal(calls.length, 2);
  assert.match(calls[0]?.text ?? '', /SELECT empresa FROM public\.usuarios/);
  assert.match(calls[1]?.text ?? '', /WHERE u\.empresa = \$1/);
  assert.deepEqual(calls[1]?.values, [55]);
});

test('listUsuarios retorna 403 quando usuário não possui empresa', async () => {
  const { calls, restore } = setupQueryMock([
    { rows: [{ empresa: null }], rowCount: 1 },
  ]);

  const req = {
    auth: createAuth(10),
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await listUsuarios(req, res);
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, {
    error: 'Usuário autenticado não possui empresa vinculada.',
  });
  assert.equal(calls.length, 1);
});

test('listUsuariosByEmpresa returns users filtered by authenticated company', async () => {
  const userRows = [
    {
      id: 2,
      nome_completo: 'João Souza',
      cpf: '98765432100',
      email: 'joao@example.com',
      perfil: 'user',
      empresa: 55,
      setor: 9,
      oab: '54321',
      oab_number: null,
      oab_uf: null,
      status: true,
      senha: '$hashed',
      telefone: '(21) 98888-1111',
      ultimo_login: '2024-02-02T15:00:00.000Z',
      observacoes: null,
      welcome_email_pending: false,
      datacriacao: '2023-02-02T15:00:00.000Z',
    },
  ];

  const { calls, restore } = setupQueryMock([
    { rows: [{ empresa: 55 }], rowCount: 1 },
    { rows: userRows, rowCount: userRows.length },
  ]);

  const req = {
    auth: createAuth(20),
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await listUsuariosByEmpresa(req, res);
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 200);
  const expectedRows = userRows.map(({ cpf: _cpf, senha: _senha, ...rest }) => rest);
  assert.deepEqual(res.body, expectedRows);
  assert.equal(calls.length, 2);
  assert.match(calls[0]?.text ?? '', /SELECT empresa FROM public\.usuarios/);
  assert.match(calls[1]?.text ?? '', /WHERE u\.empresa = \$1/);
  assert.deepEqual(calls[1]?.values, [55]);
});

test('listUsuariosByEmpresa retorna 403 quando usuário não possui empresa', async () => {
  const { calls, restore } = setupQueryMock([
    { rows: [{ empresa: null }], rowCount: 1 },
  ]);

  const req = {
    auth: createAuth(20),
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await listUsuariosByEmpresa(req, res);
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, {
    error: 'Usuário autenticado não possui empresa vinculada.',
  });
  assert.equal(calls.length, 1);
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
    welcome_email_pending: false,
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
  const expectedResponse = { ...userRow };
  delete (expectedResponse as { cpf?: unknown }).cpf;
  delete (expectedResponse as { senha?: unknown }).senha;
  if (!('oab_number' in expectedResponse)) {
    (expectedResponse as Record<string, unknown>).oab_number = undefined;
  }
  if (!('oab_uf' in expectedResponse)) {
    (expectedResponse as Record<string, unknown>).oab_uf = undefined;
  }
  assert.deepEqual(res.body, expectedResponse);
  assert.equal(calls.length, 2);
  assert.match(calls[0]?.text ?? '', /SELECT empresa FROM public\.usuarios/);
  assert.match(calls[1]?.text ?? '', /FROM public\.usuarios u/);
  assert.match(calls[1]?.text ?? '', /u\.empresa IS NOT DISTINCT FROM \$2::INT/);
  assert.deepEqual(calls[1]?.values, ['123', 42]);
});

test('getUsuarioById allows global administrators to access any user', async () => {
  const userRow = {
    id: 456,
    nome_completo: 'Administrador Global',
    cpf: '00000000000',
    email: 'admin@example.com',
    perfil: 'admin',
    empresa: 99,
    setor: null,
    oab: null,
    status: true,
    senha: '$hashed',
    telefone: '(11) 98888-7777',
    ultimo_login: '2024-04-01T12:00:00.000Z',
    observacoes: null,
    welcome_email_pending: false,
    datacriacao: '2023-04-01T12:00:00.000Z',
  };

  const { calls, restore } = setupQueryMock([
    { rows: [{ empresa: null }], rowCount: 1 },
    { rows: [userRow], rowCount: 1 },
  ]);

  const req = {
    params: { id: '456' },
    auth: createAuth(30),
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await getUsuarioById(req, res);
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 200);
  const expectedResponse = { ...userRow };
  delete (expectedResponse as { cpf?: unknown }).cpf;
  delete (expectedResponse as { senha?: unknown }).senha;
  if (!('oab_number' in expectedResponse)) {
    (expectedResponse as Record<string, unknown>).oab_number = undefined;
  }
  if (!('oab_uf' in expectedResponse)) {
    (expectedResponse as Record<string, unknown>).oab_uf = undefined;
  }
  assert.deepEqual(res.body, expectedResponse);
  assert.equal(calls.length, 2);
  assert.match(calls[1]?.text ?? '', /WHERE u\.id = \$1(?:\s|$)/);
  assert.ok(!/IS NOT DISTINCT/.test(calls[1]?.text ?? ''));
  assert.deepEqual(calls[1]?.values, ['456']);
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

test('createUsuario generates a temporary password, stores its hash and sends a welcome email', async () => {
  const welcomeModule = await import('../src/services/newUserWelcomeEmailService');
  const capturedCalls: Parameters<
    (typeof welcomeModule.newUserWelcomeEmailService)['sendWelcomeEmail']
  >[] = [];

  setWelcomeEmailServiceForTests({
    async sendWelcomeEmail(params) {
      capturedCalls.push(params);
    },
  });

  const createdRow = {
    id: 101,
    nome_completo: 'Novo Usuário',
    cpf: '00000000000',
    email: 'novo@example.com',
    perfil: 'admin',
    empresa: 5,
    setor: null,
    oab: null,
    status: true,
    senha: 'argon2:placeholder',
    telefone: '(11) 90000-0000',
    ultimo_login: null,
    observacoes: null,
    welcome_email_pending: true,
    datacriacao: '2024-03-01T12:00:00.000Z',
  };

  const { calls, restore } = setupQueryMock([
    { rows: [{ empresa: 5 }], rowCount: 1 },
    { rows: [{}], rowCount: 1 },
    {
      rows: [
        {
          limite_usuarios: null,
          limite_processos: null,
          limite_propostas: null,
          sincronizacao_processos_habilitada: null,
          sincronizacao_processos_cota: null,
        },
      ],
      rowCount: 1,
    },
    { rows: [createdRow], rowCount: 1 },
    { rows: [], rowCount: 0 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
  ]);

  const req = {
    body: {
      nome_completo: 'Novo Usuário',
      cpf: '00000000000',
      email: 'novo@example.com',
      perfil: 'admin',
      empresa: 5,
      setor: null,
      oab: null,
      status: true,
      telefone: '(11) 90000-0000',
      ultimo_login: null,
      observacoes: null,
    },
    auth: createAuth(50),
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await createUsuario(req, res);
  } finally {
    resetWelcomeEmailServiceForTests();
    restore();
  }

  assert.equal(res.statusCode, 201);
  const { cpf: _cpf, senha: _senha, ...expectedCreatedResponse } = createdRow;
  if (!('oab_number' in expectedCreatedResponse)) {
    (expectedCreatedResponse as Record<string, unknown>).oab_number = undefined;
  }
  if (!('oab_uf' in expectedCreatedResponse)) {
    (expectedCreatedResponse as Record<string, unknown>).oab_uf = undefined;
  }
  (expectedCreatedResponse as Record<string, unknown>).welcome_email_pending = false;
  assert.deepEqual(res.body, expectedCreatedResponse);
  assert.equal(calls.length, 9);

  const planLimitsCall = calls.find((call) =>
    /FROM public\.empresas emp\s+LEFT JOIN public\.planos/.test(call.text ?? ''),
  );
  assert.ok(planLimitsCall);

  const insertCall = calls.find((call) => /INSERT INTO public\.usuarios/.test(call.text ?? ''));
  assert.ok(insertCall);
  assert.equal(typeof insertCall.values?.[8], 'string');
  assert.ok(String(insertCall.values?.[8]).startsWith('argon2:'));
  assert.equal(insertCall.values?.[1], '00000000000');
  assert.equal(insertCall.values?.[9], '11900000000');

  const welcomeResetCall = calls.find((call) =>
    /UPDATE public\.usuarios SET welcome_email_pending = FALSE/.test(call.text ?? ''),
  );
  assert.ok(welcomeResetCall);
  assert.deepEqual(welcomeResetCall?.values, [101]);

  assert.equal(capturedCalls.length, 1);
  const [welcomeArgs] = capturedCalls;
  assert.equal(welcomeArgs?.to, 'novo@example.com');
  assert.equal(welcomeArgs?.userName, 'Novo Usuário');
  assert.equal(typeof welcomeArgs?.temporaryPassword, 'string');
  assert.ok((welcomeArgs?.temporaryPassword ?? '').length > 0);
  assert.equal(typeof welcomeArgs?.confirmationLink, 'string');
  assert.ok((welcomeArgs?.confirmationLink ?? '').includes('token='));
});

test('createUsuario retorna 409 quando e-mail já cadastrado', async () => {
  const duplicateError = Object.assign(new Error('duplicate key value violates unique constraint'), {
    code: '23505',
  });

  const { calls, restore } = setupQueryMock([
    { rows: [{ empresa: 3 }], rowCount: 1 },
    { rows: [{}], rowCount: 1 },
    {
      rows: [
        {
          limite_usuarios: null,
          limite_processos: null,
          limite_propostas: null,
          sincronizacao_processos_habilitada: null,
          sincronizacao_processos_cota: null,
        },
      ],
      rowCount: 1,
    },
    duplicateError,
  ]);

  const req = {
    body: {
      nome_completo: 'Usuário Existente',
      cpf: '00000000000',
      email: 'existente@example.com',
      perfil: 'admin',
      empresa: 3,
      setor: null,
      oab: null,
      status: true,
      telefone: '(11) 91111-0000',
      ultimo_login: null,
      observacoes: null,
    },
    auth: createAuth(60),
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await createUsuario(req, res);
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.body, { error: 'E-mail já cadastrado.' });
  assert.equal(calls.length, 4);
  const insertCall = calls.find((call) => /INSERT INTO public\.usuarios/.test(call.text ?? ''));
  assert.ok(insertCall);
  const deleteCall = calls.find((call) => /DELETE FROM public\.usuarios/.test(call.text ?? ''));
  assert.equal(deleteCall, undefined);
});

test('createUsuario cleans up created user when welcome email fails', async () => {
  let invocationCount = 0;

  setWelcomeEmailServiceForTests({
    async sendWelcomeEmail() {
      invocationCount += 1;
      throw new Error('SMTP indisponível');
    },
  });

  const createdRow = {
    id: 321,
    nome_completo: 'Novo Usuário',
    cpf: '00000000000',
    email: 'falha@example.com',
    perfil: 'user',
    empresa: 7,
    setor: null,
    oab: null,
    status: true,
    senha: 'argon2:placeholder',
    telefone: '(11) 95555-0000',
    ultimo_login: null,
    observacoes: null,
    welcome_email_pending: true,
    datacriacao: '2024-03-01T12:00:00.000Z',
  };

  const { calls, restore } = setupQueryMock([
    { rows: [{ empresa: 7 }], rowCount: 1 },
    { rows: [{}], rowCount: 1 },
    {
      rows: [
        {
          limite_usuarios: null,
          limite_processos: null,
          limite_propostas: null,
          sincronizacao_processos_habilitada: null,
          sincronizacao_processos_cota: null,
        },
      ],
      rowCount: 1,
    },
    { rows: [createdRow], rowCount: 1 },
    { rows: [], rowCount: 0 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
    { rows: [], rowCount: 1 },
  ]);

  const req = {
    body: {
      nome_completo: 'Novo Usuário',
      cpf: '00000000000',
      email: 'falha@example.com',
      perfil: 'user',
      empresa: 7,
      setor: null,
      oab: null,
      status: true,
      telefone: '(11) 95555-0000',
      ultimo_login: null,
      observacoes: null,
    },
    auth: createAuth(70),
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await createUsuario(req, res);
  } finally {
    resetWelcomeEmailServiceForTests();
    restore();
  }

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, {
    error: 'Não foi possível enviar a senha provisória para o novo usuário.',
  });

  assert.equal(invocationCount, 1);
  assert.equal(calls.length, 9);
  const planLimitsCall = calls.find((call) =>
    /FROM public\.empresas emp\s+LEFT JOIN public\.planos/.test(call.text ?? ''),
  );
  assert.ok(planLimitsCall);
  const welcomePendingCall = calls.find((call) =>
    /UPDATE public\.usuarios SET welcome_email_pending = TRUE/.test(call.text ?? ''),
  );
  assert.ok(welcomePendingCall);
  assert.deepEqual(welcomePendingCall?.values, [321]);
  assert.match(calls[4]?.text ?? '', /BEGIN/);
});

test('createUsuario retorna 409 quando e-mail já está cadastrado', async () => {
  const duplicateError = Object.assign(new Error('duplicate key value'), { code: '23505' });
  const { calls, restore } = setupQueryMock([
    { rows: [{ empresa: 5 }], rowCount: 1 },
    { rows: [{}], rowCount: 1 },
    {
      rows: [
        {
          limite_usuarios: 10,
          limite_processos: null,
          limite_propostas: null,
          limite_clientes: null,
          limite_advogados_processos: null,
          limite_advogados_intimacoes_monitoradas: null,
          sincronizacao_processos_habilitada: null,
          sincronizacao_processos_cota: null,
        },
      ],
      rowCount: 1,
    },
    { rows: [{ total: '0' }], rowCount: 1 },
    duplicateError,
  ]);

  const req = {
    body: {
      nome_completo: 'Novo Usuário',
      cpf: '00000000000',
      email: 'duplicado@example.com',
      perfil: 'admin',
      empresa: 5,
      setor: null,
      oab: null,
      status: true,
      telefone: '(11) 95555-1111',
      ultimo_login: null,
      observacoes: null,
    },
    auth: createAuth(123),
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await createUsuario(req, res);
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.body, { error: 'E-mail já cadastrado.' });
  assert.ok(calls.some((call) => /INSERT INTO public\.usuarios/i.test(call.text ?? '')));
});

test('createUsuario retorna 400 quando há vínculos inválidos', async () => {
  const invalidRelationError = Object.assign(new Error('invalid foreign key value'), {
    code: '23503',
  });
  const { calls, restore } = setupQueryMock([
    { rows: [{ empresa: 9 }], rowCount: 1 },
    { rows: [{}], rowCount: 1 },
    {
      rows: [
        {
          limite_usuarios: 10,
          limite_processos: null,
          limite_propostas: null,
          limite_clientes: null,
          limite_advogados_processos: null,
          limite_advogados_intimacoes_monitoradas: null,
          sincronizacao_processos_habilitada: null,
          sincronizacao_processos_cota: null,
        },
      ],
      rowCount: 1,
    },
    { rows: [{ total: '0' }], rowCount: 1 },
    invalidRelationError,
  ]);

  const req = {
    body: {
      nome_completo: 'Novo Usuário',
      cpf: '00000000000',
      email: 'vinculo@example.com',
      perfil: 'user',
      empresa: 9,
      setor: null,
      oab: null,
      status: true,
      telefone: '(11) 96666-2222',
      ultimo_login: null,
      observacoes: null,
    },
    auth: createAuth(456),
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await createUsuario(req, res);
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, {
    error: 'Não foi possível criar o usuário com os vínculos informados.',
  });
  assert.ok(calls.some((call) => /INSERT INTO public\.usuarios/i.test(call.text ?? '')));
});

test('createUsuario retorna 503 quando o banco está indisponível', async () => {
  const unavailableError = Object.assign(
    new Error('the database system is not accepting connections'),
    { code: '57P03' }
  );
  const { calls, restore } = setupQueryMock([
    { rows: [{ empresa: 3 }], rowCount: 1 },
    { rows: [{}], rowCount: 1 },
    {
      rows: [
        {
          limite_usuarios: 10,
          limite_processos: null,
          limite_propostas: null,
          limite_clientes: null,
          limite_advogados_processos: null,
          limite_advogados_intimacoes_monitoradas: null,
          sincronizacao_processos_habilitada: null,
          sincronizacao_processos_cota: null,
        },
      ],
      rowCount: 1,
    },
    { rows: [{ total: '0' }], rowCount: 1 },
    unavailableError,
  ]);

  const req = {
    body: {
      nome_completo: 'Novo Usuário',
      cpf: '00000000000',
      email: 'indisponivel@example.com',
      perfil: 'user',
      empresa: 3,
      setor: null,
      oab: null,
      status: true,
      telefone: '(11) 97777-3333',
      ultimo_login: null,
      observacoes: null,
    },
    auth: createAuth(789),
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await createUsuario(req, res);
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.body, {
    error: 'Serviço temporariamente indisponível. Tente novamente mais tarde.',
  });
  assert.ok(calls.some((call) => /INSERT INTO public\.usuarios/i.test(call.text ?? '')));
});

test('updateUsuario blocks updates to collaborators from another company', async () => {
  const { calls, restore } = setupQueryMock([
    { rows: [{ empresa: 5 }], rowCount: 1 },
    { rows: [{ empresa: 8 }], rowCount: 1 },
  ]);

  const req = {
    params: { id: '200' },
    body: {
      nome_completo: 'Colaborador',
      cpf: '12345678901',
      email: 'colaborador@example.com',
      perfil: null,
      empresa: 8,
      setor: null,
      oab: null,
      status: true,
      senha: 'argon2:hash',
      telefone: null,
      ultimo_login: null,
      observacoes: null,
    },
    auth: createAuth(900),
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await updateUsuario(req, res);
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, {
    error: 'Usuário não possui permissão para atualizar este colaborador.',
  });
  assert.equal(calls.length, 2);
});

test('updateUsuario allows global administrators to update collaborators from other companies', async () => {
  const updatedRow = {
    id: 200,
    nome_completo: 'Colaborador Atualizado',
    cpf: '12345678901',
    email: 'colaborador@example.com',
    perfil: null,
    empresa: 8,
    setor: null,
    oab: null,
    status: true,
    telefone: null,
    ultimo_login: null,
    observacoes: null,
    welcome_email_pending: false,
    datacriacao: '2024-01-01T00:00:00.000Z',
  };

  const { calls, restore } = setupQueryMock([
    { rows: [{ empresa: null }], rowCount: 1 },
    { rows: [{ empresa: 8 }], rowCount: 1 },
    { rows: [{}], rowCount: 1 },
    { rows: [updatedRow], rowCount: 1 },
  ]);

  const req = {
    params: { id: '200' },
    body: {
      nome_completo: 'Colaborador Atualizado',
      cpf: '12345678901',
      email: 'colaborador@example.com',
      perfil: null,
      empresa: 8,
      setor: null,
      oab: null,
      status: true,
      senha: 'argon2:hash',
      telefone: null,
      ultimo_login: null,
      observacoes: null,
    },
    auth: createAuth(901),
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await updateUsuario(req, res);
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 200);
  const { cpf: _cpf, ...expectedResponse } = updatedRow;
  (expectedResponse as Record<string, unknown>).oab_number = undefined;
  (expectedResponse as Record<string, unknown>).oab_uf = undefined;
  assert.deepEqual(res.body, expectedResponse);
  assert.equal(calls.length, 4);
  assert.match(calls[2]?.text ?? '', /SELECT 1 FROM public\.empresas/);
  assert.match(calls[3]?.text ?? '', /UPDATE public\.usuarios/);
});

test('deleteUsuario blocks deletions of collaborators from another company', async () => {
  const { calls, restore } = setupQueryMock([
    { rows: [{ empresa: 5 }], rowCount: 1 },
    { rows: [{ empresa: 8 }], rowCount: 1 },
  ]);

  const req = {
    params: { id: '300' },
    auth: createAuth(902),
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await deleteUsuario(req, res);
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, {
    error: 'Usuário não possui permissão para remover este colaborador.',
  });
  assert.equal(calls.length, 2);
});

test('deleteUsuario allows global administrators to remove collaborators from other companies', async () => {
  const { calls, restore } = setupQueryMock([
    { rows: [{ empresa: null }], rowCount: 1 },
    { rows: [{ empresa: 8 }], rowCount: 1 },
    { rows: [], rowCount: 1 },
  ]);

  const req = {
    params: { id: '300' },
    auth: createAuth(903),
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await deleteUsuario(req, res);
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 204);
  assert.equal(res.body, undefined);
  assert.equal(calls.length, 3);
  assert.match(calls[2]?.text ?? '', /DELETE FROM public\.usuarios/);
});


