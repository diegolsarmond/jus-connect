import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';
import { Pool } from 'pg';

import IntegrationApiKeyService from '../src/services/integrationApiKeyService';

process.env.DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/testdb';

let listProcessoDocumentosPublicos: typeof import('../src/controllers/processoController')['listProcessoDocumentosPublicos'];
let syncProcessoMovimentacoes: typeof import('../src/controllers/processoController')['syncProcessoMovimentacoes'];

test.before(async () => {
  ({ listProcessoDocumentosPublicos, syncProcessoMovimentacoes } = await import('../src/controllers/processoController'));
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

type QueryCall = { text: string; values?: unknown[] };
type QueryResponse = { rows: any[]; rowCount: number };

const setupQueryMock = (responses: (QueryResponse | Error)[]) => {
  const calls: QueryCall[] = [];
  const mock = test.mock.method(
    Pool.prototype,
    'query',
    async function (this: Pool, text: string, values?: unknown[]) {
      calls.push({ text, values });

      if (responses.length === 0) {
        throw new Error('Unexpected query invocation');
      }

      const next = responses.shift()!;
      if (next instanceof Error) {
        throw next;
      }

      return next;
    },
  );

  const restore = () => {
    mock.mock.restore();
  };

  return { calls, restore };
};

test('listProcessoDocumentosPublicos retorna documentos normalizados', async () => {
  const { calls, restore } = setupQueryMock([
    { rows: [{ empresa: 9 }], rowCount: 1 },
    { rows: [{ numero: ' 12345678901234567890 ' }], rowCount: 1 },
  ]);

    const integration = {
    id: 4,
    provider: 'escavador',
    key: '  token-123  ',
    active: true,
    apiUrl: 'https://api.escavador.com/v1/',
  } as const;

  const findIntegrationMock = test.mock.method(
    IntegrationApiKeyService.prototype,
    'findById',
    async () => integration,
  );

  const updateIntegrationMock = test.mock.method(
    IntegrationApiKeyService.prototype,
    'update',
    async () => undefined,
  );

  const payload = {
    items: [
      {
        id: 10,
        titulo: ' Documento 1 ',
        descricao: '  Conteúdo reduzido ',
        data: '2024-01-10',
        tipo: 'Sentença',
        extensao: ' pdf ',
        paginas: '12',
        key: '  doc-key  ',
        links: {
          arquivo: ' https://arquivos/doc-1.pdf ',
          API: 'https://api/doc-1',
        },
      },
      {
        chave: 'segundo-doc',
        titulo: ' ',
        data_publicacao: '2024-02-02T12:00:00Z',
        numero_paginas: 3,
        links: [
          { rel: 'download', href: ' https://arquivos/doc-2.pdf ' },
          { rel: 'visualizar', url: 'https://arquivos/doc-2/visualizar' },
        ],
        link: 'https://fallback/doc-2',
      },
    ],
  };

  const fetchMock = test.mock.method(globalThis, 'fetch', async (input, init) => {
    assert.equal(
      input,
      'https://api.escavador.com/v1/processos/numero_cnj/12345678901234567890/documentos-publicos',
    );
    assert.equal((init?.headers as Record<string, string>)?.Authorization, 'Bearer token-123');

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  const req = {
    params: { id: '7' },
    auth: { userId: 42 } as Request['auth'],
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await listProcessoDocumentosPublicos(req, res);
  } finally {
    fetchMock.mock.restore();
    updateIntegrationMock.mock.restore();
    findIntegrationMock.mock.restore();
    restore();
  }

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    documentos: [
      {
        id: '10',
        titulo: 'Documento 1',
        descricao: 'Conteúdo reduzido',
        data: '2024-01-10',
        tipo: 'Sentença',
        extensao: 'PDF',
        paginas: 12,
        key: 'doc-key',
        links: {
          arquivo: 'https://arquivos/doc-1.pdf',
          api: 'https://api/doc-1',
        },
      },
      {
        id: 'segundo-doc',
        titulo: 'Documento 2',
        descricao: null,
        data: '2024-02-02',
        tipo: null,
        extensao: null,
        paginas: 3,
        key: 'segundo-doc',
        links: {
          download: 'https://arquivos/doc-2.pdf',
          visualizar: 'https://arquivos/doc-2/visualizar',
          fallback_1: 'https://fallback/doc-2',
        },
      },
    ],
  });

  assert.equal(calls.length, 2);
  assert.match(calls[0]?.text ?? '', /FROM public\.usuarios/i);
  assert.deepEqual(calls[0]?.values, [42]);
  assert.match(calls[1]?.text ?? '', /SELECT numero FROM public\.processos/i);
  assert.deepEqual(calls[1]?.values, [7, 9]);
  assert.equal(updateIntegrationMock.mock.calls.length, 1);
});

test('listProcessoDocumentosPublicos trata erros específicos da API do Escavador', async () => {
  const { restore } = setupQueryMock([
    { rows: [{ empresa: 3 }], rowCount: 1 },
    { rows: [{ numero: ' 00000000000000000000 ' }], rowCount: 1 },
  ]);

  const integration = {
    id: 4,
    provider: 'escavador',
    key: ' token-xyz ',
    active: true,
    apiUrl: 'https://api.escavador.com/v1',
  } as const;

  const findIntegrationMock = test.mock.method(
    IntegrationApiKeyService.prototype,
    'findById',
    async () => integration,
  );

  const updateIntegrationMock = test.mock.method(
    IntegrationApiKeyService.prototype,
    'update',
    async () => undefined,
  );

  const fetchMock = test.mock.method(globalThis, 'fetch', async () =>
    new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    }),
  );

  const req = {
    params: { id: '11' },
    auth: { userId: 55 } as Request['auth'],
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await listProcessoDocumentosPublicos(req, res);
  } finally {
    fetchMock.mock.restore();
    updateIntegrationMock.mock.restore();
    findIntegrationMock.mock.restore();
    restore();
  }

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, {
    error: 'Documentos públicos não encontrados para este processo.',
  });
  assert.equal(updateIntegrationMock.mock.calls.length, 1);
});

test('syncProcessoMovimentacoes retorna 403 quando plano não permite sincronização', async () => {
  const { calls, restore } = setupQueryMock([
    { rows: [{ empresa: 7 }], rowCount: 1 },
    {
      rows: [
        {
          numero: ' 12345678901234567890 ',
          consultas_api_count: 1,
          sincronizacao_processos_habilitada: false,
          sincronizacao_processos_limite: 10,
        },
      ],
      rowCount: 1,
    },
    { rows: [], rowCount: 1 },
  ]);

  const findIntegrationMock = test.mock.method(
    IntegrationApiKeyService.prototype,
    'findById',
    async () => {
      throw new Error('should not fetch integration when plano bloqueia');
    },
  );

  const fetchMock = test.mock.method(globalThis, 'fetch', async () => {
    throw new Error('should not call external API when plano bloqueia');
  });

  const req = {
    params: { id: '5' },
    auth: { userId: 91 } as Request['auth'],
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await syncProcessoMovimentacoes(req, res);
  } finally {
    fetchMock.mock.restore();
    findIntegrationMock.mock.restore();
    restore();
  }

  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, {
    error: 'Seu plano atual não permite sincronizar processos com o Escavador.',
  });
  assert.equal(findIntegrationMock.mock.calls.length, 0);
  assert.equal(fetchMock.mock.calls.length, 0);
  assert.equal(calls.length, 3);
  assert.match(calls[1]?.text ?? '', /FROM public\.processos/i);
  assert.match(calls[2]?.text ?? '', /INSERT INTO public\.processo_consultas_api/i);
});

test('syncProcessoMovimentacoes retorna 429 quando limite do plano é atingido', async () => {
  const { calls, restore } = setupQueryMock([
    { rows: [{ empresa: 11 }], rowCount: 1 },
    {
      rows: [
        {
          numero: ' 22222222222222222222 ',
          consultas_api_count: 3,
          sincronizacao_processos_habilitada: true,
          sincronizacao_processos_limite: 3,
        },
      ],
      rowCount: 1,
    },
    { rows: [], rowCount: 1 },
  ]);

  const findIntegrationMock = test.mock.method(
    IntegrationApiKeyService.prototype,
    'findById',
    async () => {
      throw new Error('should not fetch integration when limite atingido');
    },
  );

  const fetchMock = test.mock.method(globalThis, 'fetch', async () => {
    throw new Error('should not call external API when limite atingido');
  });

  const req = {
    params: { id: '8' },
    auth: { userId: 37 } as Request['auth'],
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await syncProcessoMovimentacoes(req, res);
  } finally {
    fetchMock.mock.restore();
    findIntegrationMock.mock.restore();
    restore();
  }

  assert.equal(res.statusCode, 429);
  assert.deepEqual(res.body, {
    error: 'Limite de sincronizações do plano atingido para este processo.',
  });
  assert.equal(findIntegrationMock.mock.calls.length, 0);
  assert.equal(fetchMock.mock.calls.length, 0);
  assert.equal(calls.length, 3);
  assert.match(calls[1]?.text ?? '', /FROM public\.processos/i);
  assert.match(calls[2]?.text ?? '', /INSERT INTO public\.processo_consultas_api/i);
  assert.match(String(calls[2]?.values?.[2] ?? ''), /Limite de sincronizações do plano atingido/);
});
