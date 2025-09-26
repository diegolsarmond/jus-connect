import { Request, Response } from 'express';
import pool from '../services/db';
import juditProcessService, {
  JuditApiError,
  JuditConfigurationError,
  type JuditRequestRecord,
} from '../services/juditProcessService';
import { fetchAuthenticatedUserEmpresa } from '../utils/authUser';

const mapRecordToResponse = (record: JuditRequestRecord) => ({
  request_id: record.requestId,
  status: record.status,
  source: record.source,
  result: record.result ?? null,
  criado_em: record.createdAt,
  atualizado_em: record.updatedAt,
});

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

    const requestRecord = await juditProcessService.triggerRequestForProcess(
      processo.id,
      processo.numero,
      {
        source: 'manual',
        actorUserId: req.auth.userId,
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
      if (error.status === 404) {
        return res.status(404).json({ error: 'Processo não encontrado na Judit.' });
      }

      return res.status(502).json({ error: 'Falha ao comunicar com a Judit.' });
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
        { source: stored?.source ?? 'system' }
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
