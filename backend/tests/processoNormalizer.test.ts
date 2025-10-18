import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeString,
  normalizeUppercase,
  parseBooleanFlag,
  parseAdvogados,
  parseMovimentacoes,
  parseAttachments,
  mergeMovimentacoesWithAttachments,
  prepareMovimentacaoRecord,
  mapProcessoRow,
} from '../src/services/processoNormalizer';

import type { Processo, ProcessoAttachment, ProcessoMovimentacao } from '../src/models/processo';

test('normalizeString remove espaços e retorna null para vazio', () => {
  assert.equal(normalizeString('  Olá  '), 'Olá');
  assert.equal(normalizeString('   '), null);
  assert.equal(normalizeString(undefined), null);
});

test('normalizeUppercase converte texto para maiúsculas', () => {
  assert.equal(normalizeUppercase('  sp '), 'SP');
  assert.equal(normalizeUppercase(null), null);
});

test('parseBooleanFlag interpreta vários formatos', () => {
  assert.equal(parseBooleanFlag(' Sim '), true);
  assert.equal(parseBooleanFlag('0'), false);
  assert.equal(parseBooleanFlag('talvez'), null);
});

test('parseAdvogados extrai somente registros válidos', () => {
  const advogados = parseAdvogados([
    { id: '1', nome: 'Ana', oab: '123' },
    { id: 'abc', nome: 'Inválido' },
  ]);

  assert.deepEqual(advogados, [{ id: 1, nome: 'Ana', oab: '123' }]);
});

test('parseMovimentacoes normaliza campos de datas e tipos', () => {
  const movimentacoes = parseMovimentacoes([
    {
      id: 10,
      data_movimentacao: '2024-01-05T10:30:00Z',
      tipo: 'Andamento',
      descricao: 'Texto',
    },
  ]);

  assert.equal(movimentacoes.length, 1);
  assert.equal(movimentacoes[0].id, '10');
  assert.equal(movimentacoes[0].data, '2024-01-05T10:30:00.000Z');
  assert.equal(movimentacoes[0].conteudo, 'Texto');
});

test('parseAttachments converte identificadores e datas', () => {
  const attachments = parseAttachments([
    {
      id: 5,
      id_andamento: '10',
      nome: 'Documento',
      data_cadastro: '2024-02-01',
      data_andamento: '01/02/2024',
    },
  ]);

  assert.equal(attachments.length, 1);
  assert.equal(attachments[0].id, '5');
  assert.equal(attachments[0].id_andamento, '10');
  assert.equal(attachments[0].data_cadastro, '2024-02-01T00:00:00.000Z');
  assert.equal(attachments[0].data_andamento, '2024-01-02T00:00:00.000Z');
});

test('mergeMovimentacoesWithAttachments associa anexos ao andamento correto', () => {
  const movimentacoes: ProcessoMovimentacao[] = [
    {
      id: '1',
      data: '2024-01-10T00:00:00.000Z',
      tipo: 'Tipo',
      tipo_andamento: null,
      tipo_publicacao: null,
      classificacao_predita: null,
      conteudo: null,
      texto_categoria: null,
      fonte: null,
      attachments: [],
    },
  ];

  const attachments: ProcessoAttachment[] = [
    {
      id: 'att-1',
      id_andamento: '1',
      id_anexo: 'att-1',
      nome: 'Arquivo',
      tipo: null,
      data_cadastro: '2024-01-11T00:00:00.000Z',
      instancia_processo: null,
      crawl_id: null,
      data_andamento: '2024-01-10T00:00:00.000Z',
    },
  ];

  const resultado = mergeMovimentacoesWithAttachments(movimentacoes, attachments);
  assert.equal(resultado[0].attachments?.length, 1);
  assert.equal(resultado[0].attachments?.[0].id, 'att-1');
});

test('prepareMovimentacaoRecord sanitiza dados de entrada', () => {
  const record = prepareMovimentacaoRecord({
    data: '05/03/2024',
    tipo: '  Publicação  ',
    tipo_publicacao: '   ',
    classificacao_predita: { score: 0.8 },
    conteudo: ' Texto ',
    texto_categoria: null,
    fonte: { origem: 'sistema' },
  });

  assert.deepEqual(record, {
    data: '2024-05-03',
    tipo: 'Publicação',
    tipo_publicacao: null,
    classificacao_predita: JSON.stringify({ score: 0.8 }),
    conteudo: 'Texto',
    texto_categoria: null,
    fonte: JSON.stringify({ origem: 'sistema' }),
  });
});

test('mapProcessoRow agrega campos principais e normaliza indicadores', () => {
  const row = {
    id: 1,
    cliente_id: 0,
    idempresa: 2,
    numero: '000123',
    grau: '1',
    uf: 'sp',
    municipio: 'São Paulo',
    orgao_julgador: 'Orgão',
    tipo: 'Tipo',
    status: 'Ativo',
    classe_judicial: 'Classe',
    assunto: 'Assunto',
    jurisdicao: 'Jurisdicao',
    advogado_responsavel: 'Dr. A',
    data_distribuicao: '2024-01-01',
    criado_em: '2024-01-01T00:00:00.000Z',
    atualizado_em: '2024-01-02T00:00:00.000Z',
    ultima_movimentacao: '2024-01-03T00:00:00.000Z',
    ultima_sincronizacao: '2024-01-04T00:00:00.000Z',
    consultas_api_count: '3',
    situacao_processo_id: '5',
    situacao_processo_nome: 'Nome',
    tipo_processo_id: '6',
    tipo_processo_nome: 'Tipo Processo',
    area_atuacao_id: '7',
    area_atuacao_nome: 'Área',
    instancia: '2',
    sistema_cnj_id: '8',
    monitorar_processo: 'true',
    justica_gratuita: '1',
    liminar: '0',
    nivel_sigilo: '2',
    tramitacaoatual: '  Em andamento  ',
    permite_peticionar: null,
    envolvidos_id: '9',
    descricao: ' Descrição ',
    setor_id: '10',
    setor_nome: 'Setor',
    data_citacao: '2024-02-01',
    data_recebimento: '01/03/2024',
    data_arquivamento: null,
    data_encerramento: null,
    movimentacoes_count: '4',
    cliente_nome: null,
    cliente_documento: null,
    cliente_tipo: null,
    oportunidade_id: '11',
    oportunidade_sequencial_empresa: '12',
    oportunidade_solicitante_id: '13',
    oportunidade_solicitante_nome: ' Solicitante ',
    oportunidade_data_criacao: '2024-01-05T00:00:00.000Z',
    oportunidade_numero_processo_cnj: 'CNJ',
    oportunidade_numero_protocolo: 'PROTO',
    advogados: [
      { id: 1, nome: 'Ana', oab: '123' },
    ],
    movimentacoes: [
      {
        id: 'mov-1',
        data_movimentacao: '2024-01-10T00:00:00.000Z',
        tipo: 'Publicação',
        descricao: 'Texto',
      },
    ],
    attachments: [
      {
        id: 'att-1',
        id_andamento: 'mov-1',
        nome: 'Documento',
      },
    ],
    trigger_dados_processo: JSON.stringify({
      tribunal_sigla: 'TJSP',
      tribunal_nome: 'Tribunal SP',
      justice_description: 'Justiça Estadual',
      county: 'São Paulo',
      amount: 1500,
      distribution_date: '2024-01-01',
      subjects: ['Assunto X'],
      classifications: ['Classe Y'],
      tags: ['Urgente'],
      indicadores: {
        precatory: true,
        free_justice: true,
        secrecy_level: 'ALTO',
      },
    }),
  } as Record<string, unknown>;

  const processo = mapProcessoRow(row) as Processo;

  assert.equal(processo.numero, '000123');
  assert.equal(processo.uf, 'sp');
  assert.equal(processo.tramitacao_atual, 'Em andamento');
  assert.equal(processo.permite_peticionar, true);
  assert.equal(processo.justica_gratuita, true);
  assert.equal(processo.liminar, false);
  assert.equal(processo.consultas_api_count, 3);
  assert.equal(processo.oportunidade?.id, 11);
  assert.deepEqual(processo.tags, ['Urgente']);
  assert.equal(processo.precatory, true);
  assert.equal(processo.free_justice, true);
  assert.equal(processo.secrecy_level, 'ALTO');
  assert.equal(processo.data_recebimento, '2024-01-03');
  assert.equal(processo.advogados.length, 1);
});

