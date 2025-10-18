import test, { type TestContext } from 'node:test';
import assert from 'node:assert';
import type { Processo } from '../src/models/processo';
import {
  __resetCreateNotificationHandler,
  __setCreateNotificationHandler,
  notificarAtualizacao,
  notificarCriacao,
} from '../src/services/processoNotificationService';
import * as notificationService from '../src/services/notificationService';

type CreateNotificationInput = Parameters<
  typeof notificationService.createNotification
>[0];

function mockCreateNotification(
  t: TestContext,
  implementation: (input: CreateNotificationInput) => Promise<unknown>,
) {
  const calls: CreateNotificationInput[] = [];

  __setCreateNotificationHandler(async (input) => {
    calls.push(input);
    return implementation(input);
  });

  t.after(() => {
    __resetCreateNotificationHandler();
  });

  return { calls };
}

const processoBase: Processo = {
  id: 1,
  cliente_id: 2,
  idempresa: null,
  numero: 'PROC-001',
  uf: null,
  municipio: null,
  orgao_julgador: null,
  tipo: null,
  status: 'em andamento',
  classe_judicial: null,
  assunto: null,
  jurisdicao: 'Estadual',
  grau: '1',
  justica_gratuita: null,
  liminar: null,
  nivel_sigilo: null,
  tramitacao_atual: null,
  permite_peticionar: true,
  tribunal_acronym: null,
  tribunal: null,
  tribunal_name: null,
  justice_description: null,
  county: null,
  amount: null,
  distribution_date: null,
  subjects: null,
  classifications: null,
  tags: null,
  precatory: null,
  free_justice: null,
  secrecy_level: null,
  oportunidade_id: null,
  advogado_responsavel: null,
  data_distribuicao: null,
  criado_em: new Date().toISOString(),
  atualizado_em: new Date().toISOString(),
  ultima_sincronizacao: null,
  ultima_movimentacao: null,
  consultas_api_count: 0,
  situacao_processo_id: null,
  situacao_processo_nome: null,
  tipo_processo_id: null,
  tipo_processo_nome: null,
  area_atuacao_id: null,
  area_atuacao_nome: null,
  instancia: null,
  sistema_cnj_id: null,
  monitorar_processo: false,
  envolvidos_id: null,
  descricao: null,
  setor_id: null,
  setor_nome: null,
  data_citacao: null,
  data_recebimento: null,
  data_arquivamento: null,
  data_encerramento: null,
  movimentacoes_count: 0,
  cliente: null,
  oportunidade: null,
  advogados: [],
  movimentacoes: [],
  attachments: [],
  participants: null,
};

test('notificarCriacao envia notificações únicas para criador e advogados', async (t) => {
  const { calls } = mockCreateNotification(t, async (input) => ({
    id: 'ntf-1',
    userId: input.userId,
    category: input.category,
    type: input.type ?? 'info',
    title: input.title,
    message: input.message,
    metadata: input.metadata,
    read: false,
    createdAt: new Date().toISOString(),
  }));

  await notificarCriacao({
    processo: processoBase,
    criadorId: 42,
    advogadosSelecionados: [{ id: 10 }, { id: 11 }, { id: 10 }],
  });

  assert.strictEqual(calls.length, 3);
  const calledIds = calls.map((call) => call.userId);
  assert.deepStrictEqual(new Set(calledIds), new Set(['42', '10', '11']));

  const [firstCall] = calls;
  const metadata = firstCall?.metadata;
  assert.deepStrictEqual(metadata, {
    processId: processoBase.id,
    clientId: processoBase.cliente_id,
    status: processoBase.status,
    opportunityId: processoBase.oportunidade_id,
    jurisdiction: processoBase.jurisdicao,
    lawyers: [10, 11, 10],
  });
});

test('notificarAtualizacao respeita combinação de destinatários e mensagens com distribuição', async (t) => {
  const processoAtualizado: Processo = {
    ...processoBase,
    numero: 'PROC-002',
    data_distribuicao: '2024-01-01',
  };

  const { calls } = mockCreateNotification(t, async (input) => ({
    id: 'ntf-2',
    userId: input.userId,
    category: input.category,
    type: input.type ?? 'info',
    title: input.title,
    message: input.message,
    metadata: input.metadata,
    read: false,
    createdAt: new Date().toISOString(),
  }));

  await notificarAtualizacao({
    processo: processoAtualizado,
    usuarioAtualizadorId: null,
    advogadosSelecionados: [{ id: 'adv-1' }],
  });

  assert.strictEqual(calls.length, 1);
  const [call] = calls;
  assert.strictEqual(call?.userId, 'adv-1');
  assert.strictEqual(call?.title, 'Processo atualizado: PROC-002');
  assert.strictEqual(
    call?.message,
    'Atualizações no processo PROC-002 distribuído em 2024-01-01.',
  );
  assert.deepStrictEqual(call?.metadata?.lawyers, ['adv-1']);
});

test('notificarCriacao captura erros de envio de notificação', async (t) => {
  const errorMock = test.mock.method(console, 'error', () => undefined);
  const { calls } = mockCreateNotification(t, async () => {
    throw new Error('erro ao notificar');
  });

  t.after(() => {
    errorMock.mock.restore();
  });

  await notificarCriacao({
    processo: processoBase,
    criadorId: 7,
    advogadosSelecionados: [],
  });

  assert.strictEqual(calls.length, 1);
  assert.strictEqual(errorMock.mock.callCount(), 1);
});
