import test from 'node:test';
import assert from 'node:assert';
import type { QueryResult } from 'pg';
import pool from '../src/services/db';
import { replaceVariables } from '../src/services/templateService';
import { __test__ } from '../src/controllers/oportunidadeDocumentoController';

const makeQueryResult = <T>(rows: T[], command = ''): QueryResult<T> => ({
  command,
  rowCount: rows.length,
  oid: 0,
  rows,
  fields: [],
});

const buildOpportunity = (overrides: Record<string, unknown> = {}) => ({
  id: 123,
  tipo_processo_id: 10,
  area_atuacao_id: null,
  responsavel_id: null,
  idempresa: 42,
  numero_processo_cnj: '0001234-56.2024.8.26.0100',
  numero_protocolo: null,
  vara_ou_orgao: '1ª Vara Cível',
  comarca: 'São Paulo',
  fase_id: null,
  etapa_id: null,
  prazo_proximo: null,
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
  sequencial_empresa: 789,
  data_criacao: '2024-01-01T00:00:00Z',
  ultima_atualizacao: '2024-01-02T00:00:00Z',
  tipo_processo_nome: 'Processo Civil',
  area_atuacao_nome: null,
  fase_nome: null,
  etapa_nome: null,
  status_nome: null,
  ...overrides,
});

test('buildVariables preenche campos de audiência quando disponíveis', () => {
  const variables = __test__.buildVariables({
    opportunity: buildOpportunity(),
    solicitante: null,
    envolvidos: [],
    responsavel: null,
    empresa: null,
    audiencia: {
      data: '2025-01-20',
      hora: '14:30:00',
      local: 'Fórum Central',
    },
  });

  const template =
    'Audiência em {{processo.audiencia.data}} às {{processo.audiencia.horario}} no {{processo.audiencia.local}}';
  const filled = replaceVariables(template, variables);

  assert.strictEqual(filled, 'Audiência em 20/01/2025 às 14:30 no Fórum Central');
});

test('buildVariables mantém placeholders sem audiência', () => {
  const variables = __test__.buildVariables({
    opportunity: buildOpportunity(),
    solicitante: null,
    envolvidos: [],
    responsavel: null,
    empresa: null,
    audiencia: null,
  });

  const template = 'Próxima audiência: {{processo.audiencia.data}}';
  const filled = replaceVariables(template, variables);

  assert.strictEqual(filled, 'Próxima audiência: <processo.audiencia.data>');
});

test('fetchOpportunityData usa empresa vinculada e recupera audiência', async (t) => {
  const opportunityRow = {
    id: 777,
    tipo_processo_id: 33,
    area_atuacao_id: null,
    responsavel_id: null,
    idempresa: 88,
    numero_processo_cnj: '0012345-67.2024.8.26.0100',
    numero_protocolo: null,
    vara_ou_orgao: null,
    comarca: null,
    fase_id: null,
    etapa_id: null,
    prazo_proximo: null,
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
    data_criacao: '2024-01-10T10:00:00Z',
    ultima_atualizacao: '2024-01-11T10:00:00Z',
  };

  let empresaSelectSql: string | null = null;
  let empresaSelectParams: unknown[] | null = null;

  const queryMock = t.mock.method(pool, 'query', async (sql: string, params: unknown[]) => {
    if (sql.includes('FROM public.oportunidades')) {
      return makeQueryResult([opportunityRow]);
    }

    if (sql.includes('public.tipo_processo')) {
      return makeQueryResult([{ nome: 'Ação Trabalhista' }]);
    }

    if (sql.includes('public.fluxo_trabalho') || sql.includes('public.etiquetas') || sql.includes('public.situacao_proposta')) {
      return makeQueryResult([]);
    }

    if (sql.includes('FROM public.oportunidade_envolvidos')) {
      return makeQueryResult([]);
    }

    if (sql.includes('information_schema.columns')) {
      const table = Array.isArray(params) ? params[1] : undefined;
      if (table === 'vw.empresas') {
        return makeQueryResult([]);
      }
      return makeQueryResult([
        { column_name: 'cep' },
        { column_name: 'rua' },
        { column_name: 'numero' },
        { column_name: 'complemento' },
        { column_name: 'bairro' },
        { column_name: 'cidade' },
        { column_name: 'estado' },
      ]);
    }

    if (sql.includes('FROM public."vw.empresas"')) {
      if (!empresaSelectSql) {
        empresaSelectSql = sql;
        empresaSelectParams = Array.isArray(params) ? [...params] : null;
      }
      return makeQueryResult([
        {
          id: 88,
          nome_empresa: 'Escritório Central',
          cnpj: '12345678000100',
          telefone: '11999999999',
          email: 'contato@central.test',
          plano: null,
          responsavel: null,
          ativo: true,
          datacadastro: null,
          atualizacao: null,
        },
      ]);
    }

    if (sql.includes('FROM public."empresas"')) {
      if (!empresaSelectSql) {
        empresaSelectSql = sql;
        empresaSelectParams = Array.isArray(params) ? [...params] : null;
      }
      return makeQueryResult([
        {
          cep: '01000000',
          rua: 'Av. Central',
          numero: '1000',
          complemento: null,
          bairro: 'Centro',
          cidade: 'São Paulo',
          estado: 'SP',
        },
      ]);
    }

    if (sql.includes('FROM public.agenda')) {
      return makeQueryResult([
        {
          data: '2025-02-01',
          hora: '15:00:00',
          local: 'Fórum da Barra Funda',
        },
      ]);
    }

    if (sql.includes('FROM public.processos')) {
      return makeQueryResult([]);
    }

    if (sql.includes('FROM public.tarefas')) {
      return makeQueryResult([]);
    }

    throw new Error(`Unexpected query: ${sql}`);
  });

  const data = await __test__.fetchOpportunityData(opportunityRow.id);

  assert.ok(data);
  assert.strictEqual(data?.empresa?.id, 88);
  assert.strictEqual(data?.audiencia?.local, 'Fórum da Barra Funda');
  assert.strictEqual(data?.audiencia?.hora, '15:00:00');
  assert.ok(empresaSelectSql);
  assert.ok(empresaSelectSql?.includes('WHERE id = $1'));
  assert.ok(!empresaSelectSql?.toUpperCase().includes('ORDER BY'));
  assert.deepStrictEqual(empresaSelectParams, [88]);

  assert.strictEqual(queryMock.mock.calls.length > 0, true);
});
