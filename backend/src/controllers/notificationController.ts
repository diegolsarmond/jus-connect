import { Request, Response } from 'express';
import {
  listNotifications,
  getNotification,
  createNotification,
  markNotificationAsRead,
  markNotificationAsUnread,
  markAllNotificationsAsRead,
  deleteNotification,
  getUnreadCount,
  getUnreadCountByCategory,
  getNotificationPreferences,
  updateNotificationPreferences,
  NotificationNotFoundError,
  NotificationPreferenceUpdates,
  NotificationType,
} from '../services/notificationService';
import pjeNotificationService, {
  PjeConfigurationError,
  PjeWebhookSignatureError,
} from '../services/pjeNotificationService';
import cronJobs from '../services/cronJobs';
import { ProjudiConfigurationError } from '../services/projudiNotificationService';
import { buildErrorResponse } from '../utils/errorResponse';
import pool from '../services/db';
import { fetchAuthenticatedUserEmpresa } from '../utils/authUser';

function resolveUserId(req: Request): string {
  const queryUserId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
  const body = req.body ?? {};
  const bodyUserId = typeof body.userId === 'string' ? body.userId : undefined;
  return queryUserId || bodyUserId || 'default';
}

function parseBoolean(value: unknown): boolean | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (['true', '1', 'yes', 'y'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'no', 'n'].includes(normalized)) {
    return false;
  }

  return undefined;
}

function parsePositiveInteger(value: unknown): number | undefined {
  if (typeof value !== 'string' || value.trim() === '') {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? undefined : parsed;
}

export const listNotificationsHandler = async (req: Request, res: Response) => {
  try {
    const userId = resolveUserId(req);
    const onlyUnread = parseBoolean(req.query.onlyUnread);
    const limit = parsePositiveInteger(req.query.limit) ?? parsePositiveInteger(req.query.pageSize);
    const offsetParam = parsePositiveInteger(req.query.offset);
    const page = parsePositiveInteger(req.query.page);
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;

    const offset = (() => {
      if (typeof offsetParam === 'number') {
        return offsetParam;
      }
      if (typeof page === 'number' && typeof limit === 'number') {
        return (page - 1) * limit;
      }
      return undefined;
    })();

    const notifications = await listNotifications(userId, {
      onlyUnread: onlyUnread === undefined ? undefined : onlyUnread,
      category,
      limit,
      offset,
    });

    res.json(notifications);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getNotificationHandler = async (req: Request, res: Response) => {
  try {
    const userId = resolveUserId(req);
    const { id } = req.params;
    const notification = await getNotification(userId, id);
    res.json(notification);
  } catch (error) {
    if (error instanceof NotificationNotFoundError) {
      return res
        .status(404)
        .json(
          buildErrorResponse(
            error,
            'Notificação não encontrada.',
            { expose: true }
          )
        );
    }

    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createNotificationHandler = async (req: Request, res: Response) => {
  try {
    const { userId, title, message, category, type, metadata, actionUrl } = req.body ?? {};

    if (typeof userId !== 'string' || userId.trim() === '') {
      return res.status(400).json({ error: 'userId is required' });
    }

    if (!title || !message || !category) {
      return res.status(400).json({ error: 'title, message and category are required' });
    }

    const notification = await createNotification({
      userId,
      title,
      message,
      category,
      type: type as NotificationType | undefined,
      metadata,
      actionUrl,
    });

    res.status(201).json(notification);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const markNotificationAsReadHandler = async (req: Request, res: Response) => {
  try {
    const userId = resolveUserId(req);
    const { id } = req.params;
    const notification = await markNotificationAsRead(userId, id);
    res.json(notification);
  } catch (error) {
    if (error instanceof NotificationNotFoundError) {
      return res
        .status(404)
        .json(
          buildErrorResponse(
            error,
            'Notificação não encontrada.',
            { expose: true }
          )
        );
    }

    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const markNotificationAsUnreadHandler = async (req: Request, res: Response) => {
  try {
    const userId = resolveUserId(req);
    const { id } = req.params;
    const notification = await markNotificationAsUnread(userId, id);
    res.json(notification);
  } catch (error) {
    if (error instanceof NotificationNotFoundError) {
      return res
        .status(404)
        .json(
          buildErrorResponse(
            error,
            'Notificação não encontrada.',
            { expose: true }
          )
        );
    }

    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const markAllNotificationsAsReadHandler = async (req: Request, res: Response) => {
  try {
    const userId = resolveUserId(req);
    const notifications = await markAllNotificationsAsRead(userId);
    res.json({ updated: notifications.length, notifications });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteNotificationHandler = async (req: Request, res: Response) => {
  try {
    const userId = resolveUserId(req);
    const { id } = req.params;
    await deleteNotification(userId, id);
    res.status(204).send();
  } catch (error) {
    if (error instanceof NotificationNotFoundError) {
      return res
        .status(404)
        .json(
          buildErrorResponse(
            error,
            'Notificação não encontrada.',
            { expose: true }
          )
        );
    }

    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getUnreadCountHandler = async (req: Request, res: Response) => {
  try {
    const userId = resolveUserId(req);
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const groupBy = typeof req.query.groupBy === 'string' ? req.query.groupBy.toLowerCase() : undefined;

    if (groupBy === 'category') {
      const counts = await getUnreadCountByCategory(userId);
      return res.json({ counts });
    }

    const unread = await getUnreadCount(userId, { category });
    res.json({ unread, category: category ?? null });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getNotificationPreferencesHandler = async (req: Request, res: Response) => {
  try {
    const userId = resolveUserId(req);
    const preferences = await getNotificationPreferences(userId);
    res.json(preferences);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateNotificationPreferencesHandler = async (req: Request, res: Response) => {
  try {
    const { userId, ...updates } = req.body ?? {};

    if (typeof userId !== 'string' || userId.trim() === '') {
      return res.status(400).json({ error: 'userId is required' });
    }

    if (updates === null || typeof updates !== 'object') {
      return res.status(400).json({ error: 'Request body must contain preference updates' });
    }

    const updated = await updateNotificationPreferences(userId, updates as NotificationPreferenceUpdates);
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

function pickHeaderValue(header: string | string[] | undefined): string | undefined {
  if (typeof header === 'string') {
    return header;
  }
  if (Array.isArray(header) && header.length > 0) {
    return header[0];
  }
  return undefined;
}

export const receivePjeNotificationHandler = async (req: Request, res: Response) => {
  const signatureHeaderNames = [
    'x-pje-signature',
    'x-hub-signature-256',
    'x-hub-signature',
    'x-signature',
  ] as const;

  let signature: string | undefined;
  for (const headerName of signatureHeaderNames) {
    const value = pickHeaderValue(req.headers[headerName]);
    if (value && value.trim()) {
      signature = value;
      break;
    }
  }

  const deliveryId = pickHeaderValue(req.headers['x-delivery-id'])
    ?? pickHeaderValue(req.headers['x-request-id'])
    ?? pickHeaderValue(req.headers['x-correlation-id']);

  try {
    const record = await pjeNotificationService.processIncomingNotification({
      payload: req.body,
      signature,
      deliveryId,
      headers: req.headers,
    });

    res.status(202).json({ received: true, id: record.id });
  } catch (error) {
    if (error instanceof PjeWebhookSignatureError) {
      return res
        .status(401)
        .json(
          buildErrorResponse(
            error,
            'Assinatura da requisição inválida.',
            { expose: true }
          )
        );
    }

    if (error instanceof PjeConfigurationError) {
      return res
        .status(500)
        .json(
          buildErrorResponse(
            error,
            'Configuração do PJE indisponível.'
          )
        );
    }

    console.error('Failed to process PJE notification', error);
    res.status(500).json({ error: 'Falha ao processar notificação do PJE' });
  }
};

export const triggerProjudiSyncHandler = async (req: Request, res: Response) => {
  try {
    const previewRequested = typeof req.query.preview === 'string'
      && ['true', '1', 'yes'].includes(req.query.preview.toLowerCase());

    if (previewRequested) {
      const status = cronJobs.getProjudiSyncStatus();
      return res.json({ triggered: false, status });
    }

    const result = await cronJobs.triggerProjudiSyncNow();
    res.json({ triggered: result.triggered, status: result.status });
  } catch (error) {
    if (error instanceof ProjudiConfigurationError) {
      return res
        .status(400)
        .json(
          buildErrorResponse(
            error,
            'Configuração do Projudi inválida.',
            { expose: true }
          )
        );
    }

    console.error('Failed to trigger Projudi sync job', error);
    res.status(500).json({ error: 'Falha ao sincronizar intimações do Projudi' });
  }
};

type DbIntimacaoRow = {
  id: number;
  origem: string | null;
  external_id: string | null;
  numero_processo: string | null;
  orgao: string | null;
  assunto: string | null;
  status: string | null;
  prazo: Date | string | null;
  recebida_em: Date | string | null;
  fonte_criada_em: Date | string | null;
  fonte_atualizada_em: Date | string | null;
  payload: unknown;
  created_at: Date | string | null;
  updated_at: Date | string | null;
};

type AnyRecord = Record<string, unknown>;

type IntimacaoResponse = {
  id: number;
  siglaTribunal: string | null;
  external_id: string | null;
  numero_processo: string | null;
  nomeOrgao: string | null;
  tipoComunicacao: string | null;
  texto: string | null;
  prazo: string | null;
  data_disponibilizacao: string | null;
  created_at: string | null;
  updated_at: string | null;
  meio: string | null;
  link: string | null;
  tipodocumento: string | null;
  nomeclasse: string | null;
  codigoclasse: string | null;
  numerocomunicacao: string | null;
  ativo: boolean | null;
  hash: string | null;
  status: string | null;
  motivo_cancelamento: string | null;
  data_cancelamento: string | null;
  destinatarios: unknown;
  destinatarios_advogados: unknown;
  idusuario: number | null;
  idempresa: number | null;
  nao_lida: boolean | null;
};

function asRecord(value: unknown): AnyRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as AnyRecord;
}

function pickFromPayload<T>(
  payload: AnyRecord | null,
  keys: readonly string[],
  picker: (value: unknown) => T | null,
): T | null {
  if (!payload) {
    return null;
  }

  for (const key of keys) {
    const candidate = picker(payload[key]);
    if (candidate !== null) {
      return candidate;
    }
  }

  return null;
}

function pickString(payload: AnyRecord | null, keys: readonly string[]): string | null {
  return pickFromPayload(payload, keys, (value) => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed ? trimmed : null;
    }
    return null;
  });
}

function pickNumber(payload: AnyRecord | null, keys: readonly string[]): number | null {
  return pickFromPayload(payload, keys, (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  });
}

function pickBoolean(payload: AnyRecord | null, keys: readonly string[]): boolean | null {
  return pickFromPayload(payload, keys, (value) => {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'y', 'sim'].includes(normalized)) {
        return true;
      }
      if (['false', '0', 'no', 'n', 'nao', 'não'].includes(normalized)) {
        return false;
      }
    }

    return null;
  });
}

function pickUnknown(payload: AnyRecord | null, keys: readonly string[]): unknown {
  if (!payload) {
    return null;
  }

  for (const key of keys) {
    if (key in payload) {
      return payload[key];
    }
  }

  return null;
}

function normalizeDateValue(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const millis = value > 9_999_999_999 ? value : value * 1000;
    const fromNumber = new Date(millis);
    return Number.isNaN(fromNumber.getTime()) ? null : fromNumber.toISOString();
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }

    return trimmed;
  }

  return null;
}

function mapDbIntimacaoRow(row: DbIntimacaoRow): IntimacaoResponse {
  const payload = asRecord(row.payload);

  const prazo = normalizeDateValue(row.prazo)
    ?? normalizeDateValue(pickUnknown(payload, ['prazo', 'dataPrazo', 'deadline']));

  const recebidaEm = normalizeDateValue(row.recebida_em)
    ?? normalizeDateValue(pickUnknown(payload, ['recebida_em', 'recebidaEm', 'dataDisponibilizacao']));

  const fonteCriadaEm = normalizeDateValue(row.fonte_criada_em)
    ?? normalizeDateValue(pickUnknown(payload, ['fonte_criada_em', 'fonteCriadaEm', 'createdAt']));

  const fonteAtualizadaEm = normalizeDateValue(row.fonte_atualizada_em)
    ?? normalizeDateValue(pickUnknown(payload, ['fonte_atualizada_em', 'fonteAtualizadaEm', 'updatedAt']));

  return {
    id: row.id,
    siglaTribunal: pickString(payload, ['siglaTribunal', 'sigla_tribunal', 'tribunalSigla', 'tribunal']) ?? null,
    external_id: row.external_id ?? null,
    numero_processo:
      row.numero_processo
      ?? pickString(payload, ['numero_processo', 'numeroProcesso', 'processo'])
      ?? null,
    nomeOrgao:
      row.orgao
      ?? pickString(payload, ['nomeOrgao', 'orgao', 'orgaoJulgador', 'comarca'])
      ?? null,
    tipoComunicacao: pickString(payload, ['tipoComunicacao', 'tipo_comunicacao', 'tipo']) ?? null,
    texto:
      pickString(payload, ['texto', 'descricao', 'detalhes'])
      ?? row.assunto
      ?? null,
    prazo,
    data_disponibilizacao:
      recebidaEm
      ?? normalizeDateValue(pickUnknown(payload, ['data_disponibilizacao', 'dataDisponibilizacao']))
      ?? null,
    created_at: normalizeDateValue(row.created_at) ?? fonteCriadaEm,
    updated_at: normalizeDateValue(row.updated_at) ?? fonteAtualizadaEm,
    meio: pickString(payload, ['meio', 'canal']) ?? null,
    link: pickString(payload, ['link', 'url', 'urlDocumento']) ?? null,
    tipodocumento: pickString(payload, ['tipodocumento', 'tipoDocumento']) ?? null,
    nomeclasse: pickString(payload, ['nomeclasse', 'nomeClasse', 'classe']) ?? null,
    codigoclasse: pickString(payload, ['codigoclasse', 'codigoClasse']) ?? null,
    numerocomunicacao: pickString(payload, ['numerocomunicacao', 'numeroComunicacao', 'numero']) ?? null,
    ativo: pickBoolean(payload, ['ativo', 'ativa']) ?? null,
    hash: pickString(payload, ['hash', 'hashIntimacao']) ?? null,
    status:
      row.status
      ?? pickString(payload, ['status', 'situacao', 'situacaoIntimacao'])
      ?? null,
    motivo_cancelamento: pickString(payload, ['motivo_cancelamento', 'motivoCancelamento']) ?? null,
    data_cancelamento: normalizeDateValue(pickUnknown(payload, ['data_cancelamento', 'dataCancelamento'])),
    destinatarios: pickUnknown(payload, ['destinatarios', 'destinatariosList']),
    destinatarios_advogados: pickUnknown(payload, ['destinatarios_advogados', 'destinatariosAdvogados']),
    idusuario: pickNumber(payload, ['idusuario', 'usuarioId']),
    idempresa: pickNumber(payload, ['idempresa', 'empresaId']),
    nao_lida: pickBoolean(payload, ['nao_lida', 'naoLida', 'naoLido']),
  };
}

export const listIntimacoesHandler = async (req: Request, res: Response) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    const empresaLookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);

    if (!empresaLookup.success) {
      return res.status(empresaLookup.status).json({ error: empresaLookup.message });
    }

    const { empresaId } = empresaLookup;

    if (empresaId === null) {
      return res.json([]);
    }

    const result = await pool.query<DbIntimacaoRow>(
      `WITH intimacoes_enriched AS (
         SELECT id,
                origem,
                external_id,
                numero_processo,
                orgao,
                assunto,
                status,
                prazo,
                recebida_em,
                fonte_criada_em,
                fonte_atualizada_em,
                payload,
                created_at,
                updated_at,
                CASE
                  WHEN (payload ->> 'idempresa') ~ '^-?\\d+$' THEN (payload ->> 'idempresa')::bigint
                  WHEN (payload ->> 'empresaId') ~ '^-?\\d+$' THEN (payload ->> 'empresaId')::bigint
                  ELSE NULL
                END AS payload_empresa_id
           FROM public.intimacoes
       )
       SELECT id,
              origem,
              external_id,
              numero_processo,
              orgao,
              assunto,
              status,
              prazo,
              recebida_em,
              fonte_criada_em,
              fonte_atualizada_em,
              payload,
              created_at,
              updated_at
         FROM intimacoes_enriched
        WHERE payload_empresa_id = $1
           OR payload_empresa_id IS NULL
        ORDER BY recebida_em DESC NULLS LAST,
                 fonte_atualizada_em DESC NULLS LAST,
                 created_at DESC NULLS LAST,
                 id DESC`,
      [empresaId]
    );

    const intimacoes = result.rows
      .map(mapDbIntimacaoRow)
      .filter(
        (intimacao: IntimacaoResponse) =>
          intimacao.idempresa === null || intimacao.idempresa === empresaId,
      );

    res.json(intimacoes);
  } catch (error) {
    console.error('Failed to list intimações', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

