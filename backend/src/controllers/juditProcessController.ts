import { Request, Response } from 'express';
import pool from '../services/db';
import juditProcessService, {
  JuditApiError,
  JuditConfigurationError,
  type JuditRequestRecord,
  type JuditRequestSource,
} from '../services/juditProcessService';
import { fetchPlanLimitsForCompany } from '../services/planLimitsService';
import { evaluateProcessSyncAvailability } from '../services/processSyncQuotaService';
import { fetchAuthenticatedUserEmpresa } from '../utils/authUser';

const mapRecordToResponse = (record: JuditRequestRecord) => ({
  request_id: record.requestId,
  status: record.status,
  source: record.source,
  result: record.result ?? null,
  criado_em: record.createdAt,
  atualizado_em: record.updatedAt,
});

const parseOptionalBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') {
      return true;
    }
    if (normalized === 'false' || normalized === '0') {
      return false;
    }
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value !== 0;
  }

  return undefined;
};

const VALID_REQUEST_SOURCES: ReadonlyArray<JuditRequestSource> = [
  'details',
  'manual',
  'cron',
  'webhook',
  'system',
];

const resolveRequestSource = (
  source: JuditRequestRecord['source'] | undefined,
): JuditRequestSource => {
  if (typeof source === 'string') {
    const normalized = source.trim().toLowerCase();
    if (VALID_REQUEST_SOURCES.includes(normalized as JuditRequestSource)) {
      return normalized as JuditRequestSource;
    }
  }

  return 'system';
};

const GENERIC_ERROR_MESSAGES = new Set([
  'bad_request',
  'bad request',
  'badrequest',
  'erro',
  'error',
]);

const extractJuditErrorMessage = (payload: unknown): string | null => {
  const fallbacks: string[] = [];
  const visited = new Set<object>();

  const search = (value: unknown): string | null => {
    if (value == null) {
      return null;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }

      const normalized = trimmed.toLowerCase();
      if (GENERIC_ERROR_MESSAGES.has(normalized)) {
        fallbacks.push(trimmed);
        return null;
      }

      return trimmed;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const result = search(item);
        if (result) {
          return result;
        }
      }
      return null;
    }

    if (typeof value === 'object') {
      if (visited.has(value as object)) {
        return null;
      }
      visited.add(value as object);

      const record = value as Record<string, unknown>;
      const candidateKeys = ['detail', 'description', 'message', 'title', 'error'] as const;

      for (const key of candidateKeys) {
        if (key in record) {
          const result = search(record[key]);
          if (result) {
            return result;
          }
        }
      }

      const nestedCollectionKeys = ['errors', 'data', 'details'] as const;
      for (const key of nestedCollectionKeys) {
        if (key in record) {
          const result = search(record[key]);
          if (result) {
            return result;
          }
        }
      }

    }

    return null;
  };

  const result = search(payload);
  if (result) {
    return result;
  }

  return fallbacks.length > 0 ? fallbacks[0] : null;
};

const mapJuditStatusToHttp = (status: number): number => {
  if (status === 404) {
    return 404;
  }

  if (status === 401 || status === 403) {
    return 401;
  }

  if (status === 429) {
    return 429;
  }

  if (status >= 500) {
    return 502;
  }

  if (status >= 400) {
    return 400;
  }

  return 502;
};

export const respondToJuditApiError = (error: JuditApiError, res: Response) => {
  if (error.status === 404) {
    const message = 'Processo não encontrado na Judit.';
    console.error('[Processos] Falha ao acionar sincronização manual com a Judit.', {
      status: error.status,
      message,
    });
    return res.status(404).json({ error: message });
  }

  const message = extractJuditErrorMessage(error.body);
  const normalizedMessage =
    message && message.trim() ? message.trim() : 'Falha ao comunicar com a Judit.';
  const httpStatus = mapJuditStatusToHttp(error.status);

  console.error('[Processos] Falha ao acionar sincronização manual com a Judit.', {
    status: error.status,
    message: normalizedMessage,
  });

  return res.status(httpStatus).json({ error: normalizedMessage });
};

export const triggerManualJuditSync = async (req: Request, res: Response) => {
  const { id } = req.params;
  const processoId = Number(id);

  if (!Number.isInteger(processoId) || processoId <= 0) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  if (!req.auth) {
    return res.status(401).json({ error: 'Token inválido.' });
  }

  if (!(await juditProcessService.isEnabled())) {
    return res.status(503).json({ error: 'Integração com a Judit não está configurada.' });
  }

  try {
    const empresaLookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);

    if (!empresaLookup.success) {
      return res.status(empresaLookup.status).json({ error: empresaLookup.message });
    }

    const { empresaId } = empresaLookup;

    if (empresaId === null) {
      return res.status(404).json({ error: 'Processo não encontrado' });
    }

    const planLimits = await fetchPlanLimitsForCompany(empresaId);
    const availability = await evaluateProcessSyncAvailability(empresaId, planLimits);

    if (!availability.allowed) {
      const message =
        availability.reason === 'quota_exceeded'
          ? 'Cota de sincronização de processos esgotada para o plano atual.'
          : 'Sincronização de processos não disponível para o plano atual.';

      return res.status(403).json({ error: message });
    }

    const processoResult = await pool.query(
      `SELECT id, numero, judit_tracking_id, judit_tracking_hour_range
         FROM public.processos
        WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2
        LIMIT 1`,
      [processoId, empresaId]
    );

    if (processoResult.rowCount === 0) {
      return res.status(404).json({ error: 'Processo não encontrado' });
    }

    const processo = processoResult.rows[0] as {
      id: number;
      numero: string;
      judit_tracking_id: string | null;
      judit_tracking_hour_range: string | null;
    };

    const tracking = await juditProcessService.ensureTrackingForProcess(
      processo.id,
      processo.numero,
      {
        trackingId: processo.judit_tracking_id,
        hourRange: processo.judit_tracking_hour_range,
      }
    );

    const body =
      req.body && typeof req.body === 'object'
        ? (req.body as Record<string, unknown>)
        : {};
    const withAttachmentsValue =
      'withAttachments' in body
        ? body.withAttachments
        : 'with_attachments' in body
          ? (body as Record<string, unknown>).with_attachments
          : undefined;
    const withAttachmentsFlag = parseOptionalBoolean(withAttachmentsValue);

    const onDemandFlag = parseOptionalBoolean(body.onDemand ?? body.on_demand);

    const requestRecord = await juditProcessService.triggerRequestForProcess(
      processo.id,
      processo.numero,
      {
        source: 'manual',
        actorUserId: req.auth.userId,
        skipIfPending: true,
        onDemand: onDemandFlag,
        withAttachments: withAttachmentsFlag,
      }
    );

    return res.json({
      tracking: tracking
        ? {
            tracking_id: tracking.tracking_id,
            hour_range: tracking.hour_range ?? null,
            status: tracking.status ?? null,
          }
        : null,
      request: requestRecord ? mapRecordToResponse(requestRecord) : null,
    });
  } catch (error) {
    if (error instanceof JuditConfigurationError) {
      return res.status(503).json({ error: error.message });
    }

    if (error instanceof JuditApiError) {
      return respondToJuditApiError(error, res);
    }

    console.error('[Processos] Falha ao acionar sincronização manual com a Judit.', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getJuditRequestStatus = async (req: Request, res: Response) => {
  const { id, requestId } = req.params as { id?: string; requestId?: string };
  const processoId = Number(id);
  const normalizedRequestId = typeof requestId === 'string' ? requestId.trim() : '';

  if (!Number.isInteger(processoId) || processoId <= 0) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  if (!normalizedRequestId) {
    return res.status(400).json({ error: 'requestId é obrigatório' });
  }

  if (!req.auth) {
    return res.status(401).json({ error: 'Token inválido.' });
  }

  try {
    const empresaLookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);

    if (!empresaLookup.success) {
      return res.status(empresaLookup.status).json({ error: empresaLookup.message });
    }

    const { empresaId } = empresaLookup;

    if (empresaId === null) {
      return res.status(404).json({ error: 'Processo não encontrado' });
    }

    const processoResult = await pool.query(
      `SELECT id, numero
         FROM public.processos
        WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2
        LIMIT 1`,
      [processoId, empresaId]
    );

    if (processoResult.rowCount === 0) {
      return res.status(404).json({ error: 'Processo não encontrado' });
    }

    const processo = processoResult.rows[0] as { id: number; numero: string };

    let stored = await juditProcessService.getStoredRequest(processo.id, normalizedRequestId);

    if (stored?.status === 'completed') {
      return res.json(mapRecordToResponse(stored));
    }

    let latest = stored;
    try {
      const apiResponse = await juditProcessService.getRequestStatusFromApi(normalizedRequestId);
      latest = await juditProcessService.updateRequestStatus(
        processo.id,
        apiResponse.request_id,
        apiResponse.status ?? 'pending',
        apiResponse.result ?? null,
        { source: resolveRequestSource(stored?.source) }
      );
    } catch (error) {
      if (error instanceof JuditConfigurationError) {
        return res.status(503).json({ error: error.message });
      }

      console.error('[Processos] Falha ao consultar status da request Judit.', error);

      if (!stored) {
        return res.status(500).json({ error: 'Não foi possível consultar status da request.' });
      }
    }

    const responseRecord = latest ?? stored;

    if (!responseRecord) {
      return res.status(404).json({ error: 'Request não encontrada' });
    }

    return res.json(mapRecordToResponse(responseRecord));
  } catch (error) {
    if (error instanceof JuditConfigurationError) {
      return res.status(503).json({ error: error.message });
    }

    console.error('[Processos] Falha ao recuperar status de request da Judit.', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
