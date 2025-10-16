import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';

import pool from '../src/services/db';

process.env.DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/testdb';

type MockResponse = Response & { statusCode: number; body: unknown };

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
  };

  return response as MockResponse;
};

let createProcesso: typeof import('../src/controllers/processoController')['createProcesso'];

test.before(async () => {
  ({ createProcesso } = await import('../src/controllers/processoController'));
});

const createRequestBody = () => ({
  cliente_id: 10,
  numero: '0001234-56.2024.8.26.0100',
  uf: 'SP',
  municipio: 'São Paulo',
  orgao_julgador: 'TJSP',
  tipo: 'Cível',
  status: 'Ativo',
  classe_judicial: 'Classe',
  assunto: 'Assunto',
  jurisdicao: 'Estadual',
  advogado_responsavel: 'Dra. Maria',
  data_distribuicao: '2024-01-10',
  advogados: [],
  situacao_processo_id: 2,
  tipo_processo_id: 3,
  area_atuacao_id: 4,
  instancia: '1ª instância',
  sistema_cnj_id: null,
  monitorar_processo: false,
  envolvidos_id: null,
  descricao: 'Descrição teste',
  setor_id: null,
  data_citacao: null,
  data_recebimento: null,
  data_arquivamento: null,
  data_encerramento: null,
  grau: 'Primeiro Grau',
});

test('createProcesso retorna 403 quando limite de processos é atingido', async () => {
  const calls: { text: string; values?: unknown[] }[] = [];

  const poolQueryMock = test.mock.method(
    pool,
    'query',
    async (text: string, values?: unknown[]) => {
      calls.push({ text, values });

      if (text.includes('FROM public.usuarios')) {
        return { rowCount: 1, rows: [{ empresa: 55 }] };
      }

      if (text.includes('FROM public.empresas emp')) {
        return {
          rowCount: 1,
          rows: [
            {
              limite_usuarios: null,
              limite_processos: 1,
              limite_propostas: null,
              limite_clientes: null,
              limite_advogados_processos: null,
              limite_advogados_intimacao: null,
              sincronizacao_processos_habilitada: null,
              sincronizacao_processos_cota: null,
            },
          ],
        };
      }

      if (text.includes('FROM public.processos')) {
        return { rowCount: 1, rows: [{}] };
      }

      throw new Error('Consulta inesperada: ' + text);
    }
  );

  const poolConnectMock = test.mock.method(pool, 'connect', async () => {
    throw new Error('connect não deve ser executado quando limite é atingido');
  });

  const req = {
    auth: { userId: 999 },
    body: createRequestBody(),
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await createProcesso(req, res);

    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, { error: 'Limite de processos do plano atingido.' });
    assert.equal(calls.length, 3);
    const limitCall = calls[2];
    assert.ok(limitCall);
    assert.match(limitCall?.text ?? '', /LIMIT \$2/);
    assert.deepEqual(limitCall?.values, [55, 1]);
    assert.equal(poolConnectMock.mock.callCount(), 0);
  } finally {
    poolConnectMock.mock.restore();
    poolQueryMock.mock.restore();
  }
});

test('createProcesso continua fluxo quando limite não é atingido', async () => {
  const calls: { text: string; values?: unknown[] }[] = [];

  const poolQueryMock = test.mock.method(
    pool,
    'query',
    async (text: string, values?: unknown[]) => {
      calls.push({ text, values });

      if (text.includes('FROM public.usuarios')) {
        return { rowCount: 1, rows: [{ empresa: 77 }] };
      }

      if (text.includes('FROM public.empresas emp')) {
        return {
          rowCount: 1,
          rows: [
            {
              limite_usuarios: null,
              limite_processos: 3,
              limite_propostas: null,
              limite_clientes: null,
              limite_advogados_processos: null,
              limite_advogados_intimacao: null,
              sincronizacao_processos_habilitada: null,
              sincronizacao_processos_cota: null,
            },
          ],
        };
      }

      if (text.includes('FROM public.processos')) {
        return { rowCount: 2, rows: [{}, {}] };
      }

      if (text.includes('FROM public.clientes')) {
        return { rowCount: 1, rows: [{}] };
      }

      throw new Error('Consulta inesperada: ' + text);
    }
  );

  const poolConnectMock = test.mock.method(pool, 'connect', async () => {
    throw new Error('Falha intencional após validar limites');
  });

  const req = {
    auth: { userId: 321 },
    body: createRequestBody(),
  } as unknown as Request;

  const res = createMockResponse();

  try {
    await createProcesso(req, res);
  } catch (error) {
    // A exceção é esperada por conta do mock de connect.
  } finally {
    poolConnectMock.mock.restore();
    poolQueryMock.mock.restore();
  }

  assert.equal(poolConnectMock.mock.callCount(), 1);
  assert.equal(calls.length, 4);
  const limitCall = calls[2];
  assert.ok(limitCall);
  assert.deepEqual(limitCall?.values, [77, 3]);
});
