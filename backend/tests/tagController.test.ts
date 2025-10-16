import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';
import pool from '../src/services/db';

process.env.DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/testdb';

type MockResponse = Response & { statusCode: number; body: unknown };

type QueryResult = { rows: unknown[]; rowCount: number };

type QueryMock = ReturnType<typeof test.mock.method<typeof pool, 'query'>>;

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

const mockQuery = (
  implementation: (...args: Parameters<typeof pool.query>) => Promise<QueryResult>
): QueryMock => test.mock.method(pool, 'query', implementation as typeof pool.query);

let listTags: typeof import('../src/controllers/tagController')['listTags'];
let createTag: typeof import('../src/controllers/tagController')['createTag'];
let updateTag: typeof import('../src/controllers/tagController')['updateTag'];
let deleteTag: typeof import('../src/controllers/tagController')['deleteTag'];

test.before(async () => {
  ({ listTags, createTag, updateTag, deleteTag } = await import('../src/controllers/tagController'));
});

test('listTags retorna dados fornecidos pelo serviço', async () => {
  const tags = [
    { id: 1, key: 'foo', label: 'Foo', example: null, group_name: null },
  ];
  const queryMock = mockQuery(async () => ({ rows: tags, rowCount: tags.length }));
  const errorMock = test.mock.method(console, 'error');
  const req = {} as Request;
  const res = createMockResponse();

  try {
    await listTags(req, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, tags);
    assert.equal(queryMock.mock.callCount(), 1);
    assert.equal(errorMock.mock.callCount(), 0);
  } finally {
    queryMock.mock.restore();
    errorMock.mock.restore();
  }
});

test('listTags retorna 500 quando serviço falha', async () => {
  const failure = new Error('falha');
  const queryMock = test.mock.method(pool, 'query', async () => {
    throw failure;
  });
  const errorMock = test.mock.method(console, 'error');
  const req = {} as Request;
  const res = createMockResponse();

  try {
    await listTags(req, res);
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { error: 'Erro interno do servidor.' });
    assert.equal(queryMock.mock.callCount(), 1);
    assert.equal(errorMock.mock.callCount(), 1);
    const call = errorMock.mock.calls[0];
    assert.ok(call?.arguments[0] instanceof Error);
  } finally {
    queryMock.mock.restore();
    errorMock.mock.restore();
  }
});

test('createTag retorna 201 com payload do serviço', async () => {
  const tag = { id: 2, key: 'bar', label: 'Bar', example: 'ex', group_name: 'grupo' };
  const queryMock = mockQuery(async () => ({ rows: [tag], rowCount: 1 }));
  const errorMock = test.mock.method(console, 'error');
  const req = {
    body: { key: 'bar', label: 'Bar', example: 'ex', group_name: 'grupo' },
  } as unknown as Request;
  const res = createMockResponse();

  try {
    await createTag(req, res);
    assert.equal(res.statusCode, 201);
    assert.deepEqual(res.body, tag);
    assert.equal(queryMock.mock.callCount(), 1);
    const call = queryMock.mock.calls[0];
    assert.deepEqual(call?.arguments[1], [tag.key, tag.label, tag.example, tag.group_name]);
    assert.equal(errorMock.mock.callCount(), 0);
  } finally {
    queryMock.mock.restore();
    errorMock.mock.restore();
  }
});

test('createTag retorna 500 quando serviço falha', async () => {
  const queryMock = test.mock.method(pool, 'query', async () => {
    throw new Error('falha');
  });
  const errorMock = test.mock.method(console, 'error');
  const req = {
    body: { key: 'baz', label: 'Baz', example: null, group_name: null },
  } as unknown as Request;
  const res = createMockResponse();

  try {
    await createTag(req, res);
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { error: 'Erro interno do servidor.' });
    assert.equal(queryMock.mock.callCount(), 1);
    assert.equal(errorMock.mock.callCount(), 1);
  } finally {
    queryMock.mock.restore();
    errorMock.mock.restore();
  }
});

test('updateTag retorna 200 quando serviço atualiza tag', async () => {
  const tag = { id: 3, key: 'baz', label: 'Baz', example: null, group_name: null };
  const queryMock = mockQuery(async () => ({ rows: [tag], rowCount: 1 }));
  const errorMock = test.mock.method(console, 'error');
  const req = {
    params: { id: '3' },
    body: { key: 'baz', label: 'Baz', example: null, group_name: null },
  } as unknown as Request;
  const res = createMockResponse();

  try {
    await updateTag(req, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, tag);
    assert.equal(queryMock.mock.callCount(), 1);
    const call = queryMock.mock.calls[0];
    assert.deepEqual(call?.arguments[1], [req.body.key, req.body.label, req.body.example, req.body.group_name, '3']);
    assert.equal(errorMock.mock.callCount(), 0);
  } finally {
    queryMock.mock.restore();
    errorMock.mock.restore();
  }
});

test('updateTag retorna 404 quando serviço não encontra tag', async () => {
  const queryMock = mockQuery(async () => ({ rows: [], rowCount: 0 }));
  const errorMock = test.mock.method(console, 'error');
  const req = {
    params: { id: '9' },
    body: { key: 'q', label: 'Q', example: null, group_name: null },
  } as unknown as Request;
  const res = createMockResponse();

  try {
    await updateTag(req, res);
    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.body, { error: 'Tag not found' });
    assert.equal(queryMock.mock.callCount(), 1);
    assert.equal(errorMock.mock.callCount(), 0);
  } finally {
    queryMock.mock.restore();
    errorMock.mock.restore();
  }
});

test('updateTag retorna 500 quando serviço falha', async () => {
  const queryMock = test.mock.method(pool, 'query', async () => {
    throw new Error('falha');
  });
  const errorMock = test.mock.method(console, 'error');
  const req = {
    params: { id: '11' },
    body: { key: 'w', label: 'W', example: null, group_name: null },
  } as unknown as Request;
  const res = createMockResponse();

  try {
    await updateTag(req, res);
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { error: 'Erro interno do servidor.' });
    assert.equal(queryMock.mock.callCount(), 1);
    assert.equal(errorMock.mock.callCount(), 1);
  } finally {
    queryMock.mock.restore();
    errorMock.mock.restore();
  }
});

test('deleteTag retorna 204 quando serviço confirma exclusão', async () => {
  const queryMock = mockQuery(async () => ({ rows: [], rowCount: 1 }));
  const errorMock = test.mock.method(console, 'error');
  const req = {
    params: { id: '15' },
  } as unknown as Request;
  const res = createMockResponse();

  try {
    await deleteTag(req, res);
    assert.equal(res.statusCode, 204);
    assert.equal(res.body, undefined);
    assert.equal(queryMock.mock.callCount(), 1);
    assert.equal(errorMock.mock.callCount(), 0);
  } finally {
    queryMock.mock.restore();
    errorMock.mock.restore();
  }
});

test('deleteTag retorna 404 quando serviço indica ausência de registro', async () => {
  const queryMock = mockQuery(async () => ({ rows: [], rowCount: 0 }));
  const errorMock = test.mock.method(console, 'error');
  const req = {
    params: { id: '18' },
  } as unknown as Request;
  const res = createMockResponse();

  try {
    await deleteTag(req, res);
    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.body, { error: 'Tag not found' });
    assert.equal(queryMock.mock.callCount(), 1);
    assert.equal(errorMock.mock.callCount(), 0);
  } finally {
    queryMock.mock.restore();
    errorMock.mock.restore();
  }
});

test('deleteTag retorna 500 quando serviço falha', async () => {
  const queryMock = test.mock.method(pool, 'query', async () => {
    throw new Error('falha');
  });
  const errorMock = test.mock.method(console, 'error');
  const req = {
    params: { id: '21' },
  } as unknown as Request;
  const res = createMockResponse();

  try {
    await deleteTag(req, res);
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { error: 'Erro interno do servidor.' });
    assert.equal(queryMock.mock.callCount(), 1);
    assert.equal(errorMock.mock.callCount(), 1);
  } finally {
    queryMock.mock.restore();
    errorMock.mock.restore();
  }
});
