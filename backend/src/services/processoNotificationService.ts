import * as notificationService from './notificationService';
import type { Processo } from '../models/processo';

let createNotificationHandler = notificationService.createNotification;

export function __setCreateNotificationHandler(
  handler: typeof notificationService.createNotification,
) {
  createNotificationHandler = handler;
}

export function __resetCreateNotificationHandler() {
  createNotificationHandler = notificationService.createNotification;
}

type AdvogadoSelecionado = { id: number | string | null | undefined } & Record<string, unknown>;

type NotificacaoBaseInput = {
  processo: Processo;
  advogadosSelecionados: AdvogadoSelecionado[];
};

export type NotificarCriacaoInput = NotificacaoBaseInput & {
  criadorId: number | string | null | undefined;
};

export type NotificarAtualizacaoInput = NotificacaoBaseInput & {
  usuarioAtualizadorId: number | string | null | undefined;
};

function coletarDestinatarios(ids: Array<number | string | null | undefined>) {
  const recipientIds = new Set<string>();
  for (const id of ids) {
    if (id === undefined || id === null) {
      continue;
    }
    const parsed = String(id).trim();
    if (parsed) {
      recipientIds.add(parsed);
    }
  }
  return Array.from(recipientIds);
}

function extrairAdvogados(advogadosSelecionados: AdvogadoSelecionado[]) {
  return advogadosSelecionados.map((advogado) => advogado?.id ?? null);
}

function montarMetadata(processo: Processo, advogadosSelecionados: AdvogadoSelecionado[]) {
  return {
    processId: processo.id,
    clientId: processo.cliente_id,
    status: processo.status,
    opportunityId: processo.oportunidade_id,
    jurisdiction: processo.jurisdicao,
    lawyers: extrairAdvogados(advogadosSelecionados).filter(
      (id): id is number | string => id !== null && id !== undefined,
    ),
  };
}

async function notificar(
  destinatarios: string[],
  notificacao: {
    titulo: string;
    mensagem: string;
    metadata: Record<string, unknown>;
    erroLog: string;
  },
) {
  await Promise.all(
    destinatarios.map(async (userId) => {
      try {
        await createNotificationHandler({
          userId,
          title: notificacao.titulo,
          message: notificacao.mensagem,
          category: 'process',
          type: 'info',
          metadata: notificacao.metadata,
        });
      } catch (notifyError) {
        console.error(notificacao.erroLog, notifyError);
      }
    }),
  );
}

export async function notificarCriacao({
  processo,
  advogadosSelecionados,
  criadorId,
}: NotificarCriacaoInput) {
  const destinatarios = coletarDestinatarios([
    criadorId,
    ...extrairAdvogados(advogadosSelecionados),
  ]);

  if (destinatarios.length === 0) {
    return;
  }

  await notificar(destinatarios, {
    titulo: `Novo processo cadastrado: ${processo.numero}`,
    mensagem: processo.data_distribuicao
      ? `Processo ${processo.numero} distribuído em ${processo.data_distribuicao}.`
      : `Processo ${processo.numero} foi cadastrado.`,
    metadata: montarMetadata(processo, advogadosSelecionados),
    erroLog: 'Falha ao enviar notificação de criação de processo',
  });
}

export async function notificarAtualizacao({
  processo,
  advogadosSelecionados,
  usuarioAtualizadorId,
}: NotificarAtualizacaoInput) {
  const destinatarios = coletarDestinatarios([
    usuarioAtualizadorId,
    ...extrairAdvogados(advogadosSelecionados),
  ]);

  if (destinatarios.length === 0) {
    return;
  }

  await notificar(destinatarios, {
    titulo: `Processo atualizado: ${processo.numero}`,
    mensagem: processo.data_distribuicao
      ? `Atualizações no processo ${processo.numero} distribuído em ${processo.data_distribuicao}.`
      : `O processo ${processo.numero} foi atualizado.`,
    metadata: montarMetadata(processo, advogadosSelecionados),
    erroLog: 'Falha ao enviar notificação de atualização de processo',
  });
}
