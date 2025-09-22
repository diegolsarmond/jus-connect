import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';
import { Pool } from 'pg';

process.env.DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/testdb';

type QueryCall = { text: string; values?: unknown[] };
type QueryResponse = { rows: any[]; rowCount: number };

let createOpportunityDocumentFromTemplate: typeof import('../src/controllers/oportunidadeDocumentoController')['createOpportunityDocumentFromTemplate'];
let listOpportunityDocuments: typeof import('../src/controllers/oportunidadeDocumentoController')['listOpportunityDocuments'];
let getOpportunityDocument: typeof import('../src/controllers/oportunidadeDocumentoController')['getOpportunityDocument'];
let deleteOpportunityDocument: typeof import('../src/controllers/oportunidadeDocumentoController')['deleteOpportunityDocument'];

test.before(async () => {
  ({
    createOpportunityDocumentFromTemplate,
    listOpportunityDocuments,
    getOpportunityDocument,
    deleteOpportunityDocument,
  } = await import('../src/controllers/oportunidadeDocumentoController'));
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

const setupQueryMock = (
  responses: (QueryResponse | ((text: string, values?: unknown[]) => QueryResponse))[],
) => {
  const calls: QueryCall[] = [];
  const mock = test.mock.method(
    Pool.prototype,
    'query',
    async function (this: Pool, text: string, values?: unknown[]) {
      calls.push({ text, values });

      if (responses.length === 0) {
        throw new Error(`Unexpected query: ${text}`);
      }

      const next = responses.shift()!;
      if (typeof next === 'function') {
        return next(text, values);
      }

      return next;
    },
  );

  const restore = () => {
    mock.mock.restore();
  };

  return { calls, restore };
};

test('createOpportunityDocumentFromTemplate uses the opportunity empresa when filling variables', async () => {
  const templateContent =
    '{"content_html":"<p>{{escritorio.nome}}</p><p>{{processo.audiencia.data}}</p><p>{{processo.audiencia.horario}}</p><p>{{processo.audiencia.local}}</p>"}';

  const insertedPayload: { content?: string; variables?: string } = {};

  const { calls, restore } = setupQueryMock([
    { rows: [{ empresa: 55 }], rowCount: 1 },
    {
      rows: [
        {
          id: 123,
          tipo_processo_id: null,
          area_atuacao_id: null,
          responsavel_id: null,
          numero_processo_cnj: '0000000-00.0000.0.00.0000',
          numero_protocolo: null,
          vara_ou_orgao: '1ª Vara Cível',
          comarca: 'São Paulo',
          fase_id: null,
          etapa_id: null,
          prazo_proximo: '2024-06-01',
          status_id: null,
          solicitante_id: null,
          valor_causa: null,
          valor_honorarios: null,
          percentual_honorarios: null,
          forma_pagamento: null,
          qtde_parcelas: null,
          contingenciamento: null,
          detalhes: null,
          documentos_anexados: null,
          criado_por: null,
          sequencial_empresa: 999,
          idempresa: 55,
          audiencia_data: '2024-06-10T13:45:00.000Z',
          audiencia_horario: '13:45',
          audiencia_local: 'Fórum Central',
          data_criacao: '2024-01-01T00:00:00.000Z',
          ultima_atualizacao: '2024-01-02T00:00:00.000Z',
        },
      ],
      rowCount: 1,
    },
    { rows: [], rowCount: 0 },
    {
      rows: [
        {
          id: 55,
          nome_empresa: 'Empresa Correta',
          cnpj: '12.345.678/0001-99',
          telefone: '(11) 1234-5678',
          email: 'contato@empresa.com',
          plano: 'Premium',
          responsavel: 'João',
          ativo: true,
          datacadastro: '2024-01-01T00:00:00.000Z',
          atualizacao: null,
        },
      ],
      rowCount: 1,
    },
    {
      rows: [
        { column_name: 'id' },
        { column_name: 'cep' },
        { column_name: 'rua' },
        { column_name: 'numero' },
        { column_name: 'complemento' },
        { column_name: 'bairro' },
        { column_name: 'cidade' },
        { column_name: 'estado' },
        { column_name: 'municipio' },
        { column_name: 'uf' },
        { column_name: 'logradouro' },
        { column_name: 'endereco' },
      ],
      rowCount: 12,
    },
    {
      rows: [
        {
          cep: '12345678',
          rua: 'Rua Principal',
          numero: '100',
          complemento: 'Sala 1',
          bairro: 'Centro',
          cidade: 'São Paulo',
          estado: 'SP',
          municipio: 'São Paulo',
          uf: 'SP',
          logradouro: null,
          endereco: null,
        },
      ],
      rowCount: 1,
    },
    { rows: [], rowCount: 0 },
    { rows: [], rowCount: 0 },
    { rows: [], rowCount: 0 },
    { rows: [], rowCount: 0 },
    { rows: [], rowCount: 0 },
    { rows: [{ id: 7, title: 'Modelo', content: templateContent }], rowCount: 1 },
    (text: string, values?: unknown[]) => {
      assert.match(text, /INSERT INTO public\.oportunidade_documentos/);
      insertedPayload.content = values?.[3] as string;
      insertedPayload.variables = values?.[4] as string;
      return {
        rows: [
          {
            id: 987,
            oportunidade_id: values?.[0],
            template_id: values?.[1],
            title: values?.[2],
            content: values?.[3],
            variables: values?.[4],
            created_at: '2024-06-01T12:00:00.000Z',
          },
        ],
        rowCount: 1,
      };
    },
  ]);

  const req = {
    params: { id: '123' },
    body: { templateId: 7 },
    auth: { userId: 99 },
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await createOpportunityDocumentFromTemplate(req, res);
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 201);
  assert.ok(res.body && typeof res.body === 'object');

  const responseBody = res.body as {
    content_html?: string;
    variables?: unknown;
  };

  assert.match(responseBody.content_html ?? '', /Empresa Correta/);
  assert.match(responseBody.content_html ?? '', /10\/06\/2024/);
  assert.match(responseBody.content_html ?? '', /13:45/);
  assert.match(responseBody.content_html ?? '', /Fórum Central/);

  const storedContent = insertedPayload.content;
  assert.ok(storedContent);
  const storedVariables = insertedPayload.variables;
  assert.ok(storedVariables);

  const parsedStored = JSON.parse(storedContent!);
  assert.equal(
    parsedStored.content_html,
    '<p>Empresa Correta</p><p>10/06/2024</p><p>13:45</p><p>Fórum Central</p>',
  );

  const parsedVariables = JSON.parse(storedVariables!);
  assert.equal(parsedVariables['escritorio.nome'], 'Empresa Correta');
  assert.equal(parsedVariables['processo.audiencia.data'], '10/06/2024');
  assert.equal(parsedVariables['processo.audiencia.horario'], '13:45');
  assert.equal(parsedVariables['processo.audiencia.local'], 'Fórum Central');

  const empresaQuery = calls.find((call) =>
    call.text.includes('FROM public."vw.empresas"') && call.text.includes('nome_empresa'),
  );
  assert.ok(empresaQuery, 'expected empresa query to be executed');
  assert.match(empresaQuery!.text, /WHERE id = \$1/);
  assert.deepEqual(empresaQuery!.values, [55]);

  const opportunityQuery = calls.find((call) =>
    call.text.includes('FROM public.oportunidades') && call.text.includes('idempresa = $2'),
  );
  assert.ok(opportunityQuery, 'expected opportunity lookup to include empresa filter');
  assert.deepEqual(opportunityQuery!.values, [123, 55]);

  const templateQuery = calls.find((call) => call.text.includes('FROM templates'));
  assert.ok(templateQuery, 'expected template query to be executed');
  assert.match(templateQuery!.text, /idusuario = \$3/);
  assert.deepEqual(templateQuery!.values, [7, 55, 99]);
});

test('createOpportunityDocumentFromTemplate returns 401 when auth is missing', async () => {
  const { restore } = setupQueryMock([]);

  const req = {
    params: { id: '5' },
    body: { templateId: 2 },
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await createOpportunityDocumentFromTemplate(req, res);
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: 'Token inválido.' });
});

test('createOpportunityDocumentFromTemplate returns 403 when user lacks empresa', async () => {
  const { restore } = setupQueryMock([{ rows: [{ empresa: null }], rowCount: 1 }]);

  const req = {
    params: { id: '7' },
    body: { templateId: 3 },
    auth: { userId: 42 },
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await createOpportunityDocumentFromTemplate(req, res);
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, {
    error: 'Usuário autenticado não possui empresa vinculada.',
  });
});

test('createOpportunityDocumentFromTemplate returns 404 when opportunity does not belong to empresa', async () => {
  const { calls, restore } = setupQueryMock([
    { rows: [{ empresa: 99 }], rowCount: 1 },
    { rows: [], rowCount: 0 },
  ]);

  const req = {
    params: { id: '88' },
    body: { templateId: 5 },
    auth: { userId: 77 },
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await createOpportunityDocumentFromTemplate(req, res);
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { error: 'Oportunidade não encontrada' });
  assert.equal(calls.length, 2);
});

test('listOpportunityDocuments returns 404 when opportunity is inaccessible', async () => {
  const { calls, restore } = setupQueryMock([
    { rows: [{ empresa: 12 }], rowCount: 1 },
    { rows: [], rowCount: 0 },
  ]);

  const req = {
    params: { id: '900' },
    auth: { userId: 321 },
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await listOpportunityDocuments(req, res);
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { error: 'Oportunidade não encontrada' });
  assert.equal(calls.length, 2);
});

test('getOpportunityDocument returns 404 when opportunity is inaccessible', async () => {
  const { calls, restore } = setupQueryMock([
    { rows: [{ empresa: 87 }], rowCount: 1 },
    { rows: [], rowCount: 0 },
  ]);

  const req = {
    params: { id: '10', documentId: '555' },
    auth: { userId: 9 },
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await getOpportunityDocument(req, res);
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { error: 'Oportunidade não encontrada' });
  assert.equal(calls.length, 2);
});

test('deleteOpportunityDocument returns 404 when opportunity is inaccessible', async () => {
  const { calls, restore } = setupQueryMock([
    { rows: [{ empresa: 101 }], rowCount: 1 },
    { rows: [], rowCount: 0 },
  ]);

  const req = {
    params: { id: '55', documentId: '3' },
    auth: { userId: 42 },
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await deleteOpportunityDocument(req, res);
  } finally {
    restore();
  }

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { error: 'Oportunidade não encontrada' });
  assert.equal(calls.length, 2);
});
