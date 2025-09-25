import { Request, Response } from 'express';
import pool from '../services/db';
import juditProcessService from '../services/juditProcessService';

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
};

const ensureArray = <T>(value: unknown): T[] => {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (value === null || value === undefined) {
    return [];
  }

  return [value as T];
};

export const handleJuditWebhook = async (req: Request, res: Response) => {
  const payload = req.body;

  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'Payload inválido' });
  }

  const trackingId = normalizeString((payload as Record<string, unknown>).tracking_id);
  const processNumber = normalizeString((payload as Record<string, unknown>).process_number);

  if (!trackingId && !processNumber) {
    return res.status(400).json({ error: 'tracking_id ou process_number são obrigatórios' });
  }

  const hourRange = normalizeString((payload as Record<string, unknown>).hour_range);
  const status =
    normalizeString((payload as Record<string, unknown>).status) ||
    normalizeString((payload as Record<string, unknown>).event_status) ||
    'updated';

  const increments = ensureArray<unknown>((payload as Record<string, unknown>).increments);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let processoLookup = null;

    if (processNumber) {
      processoLookup = await client.query(
        `SELECT id FROM public.processos WHERE numero = $1 LIMIT 1`,
        [processNumber]
      );
    }

    if ((!processoLookup || processoLookup.rowCount === 0) && trackingId) {
      processoLookup = await client.query(
        `SELECT id FROM public.processos WHERE judit_tracking_id = $1 LIMIT 1`,
        [trackingId]
      );
    }

    if (!processoLookup || processoLookup.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(202).json({ status: 'ignored' });
    }

    const processoId: number = processoLookup.rows[0].id;

    await client.query(
      `UPDATE public.processos
          SET judit_tracking_id = COALESCE($1, judit_tracking_id),
              judit_tracking_hour_range = COALESCE($2, judit_tracking_hour_range),
              ultima_sincronizacao = NOW(),
              atualizado_em = NOW()
        WHERE id = $3`,
      [trackingId, hourRange, processoId]
    );

    await client.query(
      `INSERT INTO public.processo_sync (processo_id, provider, status, tracking_id, hour_range, last_synced_at)
          VALUES ($1, 'judit', $2, COALESCE($3, $4), COALESCE($5, $6), NOW())
          ON CONFLICT (processo_id, provider)
          DO UPDATE SET
            status = EXCLUDED.status,
            tracking_id = COALESCE(EXCLUDED.tracking_id, public.processo_sync.tracking_id),
            hour_range = COALESCE(EXCLUDED.hour_range, public.processo_sync.hour_range),
            last_synced_at = EXCLUDED.last_synced_at,
            atualizado_em = NOW()`,
      [processoId, status, trackingId, trackingId, hourRange, hourRange]
    );

    const requestPayload = (payload as Record<string, unknown>).request ??
      (payload as Record<string, unknown>).request_info ??
      null;

    let requestId: string | null = null;
    let requestStatus: string | null = null;
    let requestResult: unknown = null;

    if (requestPayload && typeof requestPayload === 'object') {
      const raw = requestPayload as Record<string, unknown>;
      requestId =
        normalizeString(raw.id) ||
        normalizeString(raw.request_id) ||
        normalizeString((payload as Record<string, unknown>).request_id);
      requestStatus =
        normalizeString(raw.status) ||
        normalizeString((payload as Record<string, unknown>).request_status);
      requestResult = raw.result ?? (payload as Record<string, unknown>).result ?? null;
    } else {
      requestId = normalizeString((payload as Record<string, unknown>).request_id);
      requestStatus = normalizeString((payload as Record<string, unknown>).request_status);
      requestResult = (payload as Record<string, unknown>).result ?? null;
    }

    if (requestId && requestStatus) {
      await juditProcessService.updateRequestStatus(
        processoId,
        requestId,
        requestStatus,
        requestResult,
        { source: 'webhook', client }
      );
    }

    for (const increment of increments) {
      await client.query(
        `INSERT INTO public.processo_sync_history (processo_id, provider, request_id, event_type, payload)
            VALUES ($1, 'judit', $2, $3, $4)`,
        [
          processoId,
          requestId,
          normalizeString((increment as Record<string, unknown>)?.type) ?? 'increment',
          increment,
        ]
      );
    }

    await client.query('COMMIT');

    res.json({ status: 'ok' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[JuditWebhook] Falha ao processar webhook da Judit.', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};
