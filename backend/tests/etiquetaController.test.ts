import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';
import pool from '../src/services/db';

process.env.DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/testdb';

let listEtiquetas: typeof import('../src/controllers/etiquetaController')['listEtiquetas'];
let listEtiquetasByFluxoTrabalho: typeof import('../src/controllers/etiquetaController')['listEtiquetasByFluxoTrabalho'];
let createEtiqueta: typeof import('../src/controllers/etiquetaController')['createEtiqueta'];
let updateEtiqueta: typeof import('../src/controllers/etiquetaController')['updateEtiqueta'];
let deleteEtiqueta: typeof import('../src/controllers/etiquetaController')['deleteEtiqueta'];

test.before(async () => {
  ({
    listEtiquetas,
    listEtiquetasByFluxoTrabalho,
    createEtiqueta,
    updateEtiqueta,
    deleteEtiqueta,
  } = await import('../src/controllers/etiquetaController'));
});

type MockResponse = Response & { statusCode: number; body: unknown };

type QueryCall = { text: string; values?: unknown[] };
type QueryResult = { rows: any[]; rowCount: number };

const createMockResponse = (): MockResponse => {
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

  return response as MockResponse;
};

const setupQueryMock = (results: QueryResult[]) => {
  const calls: QueryCall[] = [];
  const original = pool.query.bind(pool);

  (pool as unknown as { query: typeof pool.query }).query = async (
    text: string,
    values?: unknown[]
  ) => {
    calls.push({ text, values });
    if (results.length === 0) {
      throw new Error('Unexpected query invocation');
    }
    return results.shift()!;
  };

  const restore = () => {
    (pool as unknown as { query: typeof pool.query }).query = original;
  };

  return { calls, restore };
};

test('listEtiquetas retorna etiquetas da empresa autenticada', async () => {
  const etiquetas = [
    {
      id: 1,
      nome: 'Em andamento',
      ativo: true,
      datacriacao: new Date(),
      exibe_pipeline: true,
      ordem: 1,
      id_fluxo_trabalho: 10,
      idempresa: 3,
    },
  ];

  const { calls, restore } = setupQueryMock([
    { rows: [{ empresa: 3 }], rowCount: 1 },
    { rows: etiquetas, rowCount: etiquetas.length },
  ]);

  const req = {
    auth: {
      userId: 42,
    },
  } as unknown as Request;
  const res = createMockResponse();

  try {
    await listEtiquetas(req, res);
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, etiquetas);
  assert.equal(calls.length, 2);
  assert.match(calls[0]?.text ?? '', /FROM public\.usuarios/i);
  assert.match(calls[1]?.text ?? '', /FROM public\.etiquetas/i);
});

test('listEtiquetas retorna erro 500 quando serviço falha', async () => {
  const { restore } = setupQueryMock([
    { rows: [{ empresa: 7 }], rowCount: 1 },
  ]);
  const consoleMock = test.mock.method(console, 'error', () => undefined);

  const req = {
    auth: {
      userId: 55,
    },
  } as unknown as Request;
  const res = createMockResponse();

  try {
    await listEtiquetas(req, res);
  } catch (error) {
    restore();
    consoleMock.mock.restore();
    throw error;
  }

  restore();
  consoleMock.mock.restore();

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { error: 'Erro interno do servidor.' });
});

test('listEtiquetasByFluxoTrabalho retorna etiquetas do fluxo', async () => {
  const etiquetas = [
    {
      id: 5,
      nome: 'Aguardando cliente',
    },
  ];
  const { calls, restore } = setupQueryMock([
    { rows: etiquetas, rowCount: etiquetas.length },
  ]);

  const req = {
    params: {
      id: '12',
    },
  } as unknown as Request;
  const res = createMockResponse();

  try {
    await listEtiquetasByFluxoTrabalho(req, res);
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, etiquetas);
  assert.equal(calls.length, 1);
  assert.match(calls[0]?.text ?? '', /FROM public\.etiquetas/i);
});

test('listEtiquetasByFluxoTrabalho retorna erro 500 quando serviço falha', async () => {
  const { restore } = setupQueryMock([]);
  const consoleMock = test.mock.method(console, 'error', () => undefined);

  const req = {
    params: {
      id: '44',
    },
  } as unknown as Request;
  const res = createMockResponse();

  try {
    await listEtiquetasByFluxoTrabalho(req, res);
  } finally {
    restore();
    consoleMock.mock.restore();
  }

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { error: 'Erro interno do servidor.' });
});

test('createEtiqueta cria etiqueta quando empresa é válida', async () => {
  const etiqueta = {
    id: 9,
    nome: 'Nova',
    ativo: true,
    datacriacao: new Date(),
    exibe_pipeline: true,
    ordem: 2,
    id_fluxo_trabalho: 1,
    idempresa: 8,
  };

  const { calls, restore } = setupQueryMock([
    { rows: [{ empresa: 8 }], rowCount: 1 },
    { rows: [etiqueta], rowCount: 1 },
  ]);

  const req = {
    auth: {
      userId: 17,
    },
    body: {
      nome: 'Nova',
      ativo: true,
      exibe_pipeline: true,
      ordem: 2,
      id_fluxo_trabalho: 1,
    },
  } as unknown as Request;
  const res = createMockResponse();

  try {
    await createEtiqueta(req, res);
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body, etiqueta);
  assert.equal(calls.length, 2);
  assert.match(calls[1]?.text ?? '', /INSERT INTO public\.etiquetas/i);
});

test('createEtiqueta retorna erro 500 quando serviço falha', async () => {
  const { restore } = setupQueryMock([
    { rows: [{ empresa: 6 }], rowCount: 1 },
  ]);
  const consoleMock = test.mock.method(console, 'error', () => undefined);

  const req = {
    auth: {
      userId: 22,
    },
    body: {
      nome: 'Erro',
      ativo: false,
      exibe_pipeline: false,
      ordem: null,
      id_fluxo_trabalho: null,
    },
  } as unknown as Request;
  const res = createMockResponse();

  try {
    await createEtiqueta(req, res);
  } finally {
    restore();
    consoleMock.mock.restore();
  }

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { error: 'Erro interno do servidor.' });
});

test('updateEtiqueta atualiza etiqueta existente', async () => {
  const etiqueta = {
    id: 3,
    nome: 'Atualizada',
    ativo: true,
    datacriacao: new Date(),
    exibe_pipeline: false,
    ordem: null,
    id_fluxo_trabalho: 2,
  };

  const { calls, restore } = setupQueryMock([
    { rows: [etiqueta], rowCount: 1 },
  ]);

  const req = {
    params: {
      id: '3',
    },
    body: {
      nome: 'Atualizada',
      ativo: true,
      exibe_pipeline: false,
      ordem: null,
      id_fluxo_trabalho: 2,
    },
  } as unknown as Request;
  const res = createMockResponse();

  try {
    await updateEtiqueta(req, res);
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, etiqueta);
  assert.equal(calls.length, 1);
  assert.match(calls[0]?.text ?? '', /UPDATE public\.etiquetas/i);
});

test('updateEtiqueta retorna 404 quando etiqueta não é encontrada', async () => {
  const { restore } = setupQueryMock([
    { rows: [], rowCount: 0 },
  ]);

  const req = {
    params: {
      id: '11',
    },
    body: {
      nome: 'Sem retorno',
      ativo: false,
      exibe_pipeline: true,
      ordem: 5,
      id_fluxo_trabalho: 4,
    },
  } as unknown as Request;
  const res = createMockResponse();

  try {
    await updateEtiqueta(req, res);
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { error: 'Etiqueta não encontrada' });
});

test('updateEtiqueta retorna erro 500 quando serviço falha', async () => {
  const { restore } = setupQueryMock([]);
  const consoleMock = test.mock.method(console, 'error', () => undefined);

  const req = {
    params: {
      id: '15',
    },
    body: {
      nome: 'Erro',
      ativo: true,
      exibe_pipeline: true,
      ordem: 1,
      id_fluxo_trabalho: 7,
    },
  } as unknown as Request;
  const res = createMockResponse();

  try {
    await updateEtiqueta(req, res);
  } finally {
    restore();
    consoleMock.mock.restore();
  }

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { error: 'Erro interno do servidor.' });
});

test('deleteEtiqueta remove etiqueta existente', async () => {
  const { calls, restore } = setupQueryMock([
    { rows: [], rowCount: 1 },
  ]);

  const req = {
    params: {
      id: '21',
    },
  } as unknown as Request;
  const res = createMockResponse();

  try {
    await deleteEtiqueta(req, res);
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 204);
  assert.equal(res.body, undefined);
  assert.equal(calls.length, 1);
  assert.match(calls[0]?.text ?? '', /DELETE FROM public\.etiquetas/i);
});

test('deleteEtiqueta retorna 404 quando etiqueta não é encontrada', async () => {
  const { restore } = setupQueryMock([
    { rows: [], rowCount: 0 },
  ]);

  const req = {
    params: {
      id: '18',
    },
  } as unknown as Request;
  const res = createMockResponse();

  try {
    await deleteEtiqueta(req, res);
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { error: 'Etiqueta não encontrada' });
});

test('deleteEtiqueta retorna erro 500 quando serviço falha', async () => {
  const { restore } = setupQueryMock([]);
  const consoleMock = test.mock.method(console, 'error', () => undefined);

  const req = {
    params: {
      id: '30',
    },
  } as unknown as Request;
  const res = createMockResponse();

  try {
    await deleteEtiqueta(req, res);
  } finally {
    restore();
    consoleMock.mock.restore();
  }

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { error: 'Erro interno do servidor.' });
});
