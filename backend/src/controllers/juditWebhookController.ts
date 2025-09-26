import { Request, Response } from 'express';
import pool from '../services/db';
import juditProcessService, {
  findProcessSyncByRemoteId,
  registerProcessRequest,
  registerProcessResponse,
  registerSyncAudit,
  type UpdateProcessSyncStatusInput,
  updateProcessSyncStatus,
} from '../services/juditProcessService';

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

    const existingSync = requestId
      ? await findProcessSyncByRemoteId(requestId, client)
      : null;

    const integrationApiKeyId = existingSync?.integrationApiKeyId ?? null;

    const processResponse = await registerProcessResponse(
      {
        processoId,
        processSyncId: existingSync?.id ?? null,
        integrationApiKeyId,
        deliveryId: normalizeString((payload as Record<string, unknown>).delivery_id),
        source: 'webhook',
        payload,
        headers: req.headers,
      },
      client,
    );

    await registerSyncAudit(
      {
        processoId,
        processSyncId: existingSync?.id ?? null,
        processResponseId: processResponse.id,
        integrationApiKeyId,
        eventType: 'webhook_received',
        eventDetails: {
          trackingId,
          processNumber,
          requestId,
          status: requestStatus,
          increments: increments.length,
        },
      },
      client,
    );

    let syncRecord = existingSync;

    if (requestId) {
      if (!syncRecord) {
        syncRecord = await registerProcessRequest(
          {
            processoId,
            remoteRequestId: requestId,
            requestType: 'webhook',
            status: requestStatus ?? 'completed',
            metadata: {
              source: 'webhook',
              result: requestResult,
              trackingId,
              hourRange,
            },
          },
          client,
        );
      }

      const currentMetadata =
        syncRecord.metadata && typeof syncRecord.metadata === 'object' && !Array.isArray(syncRecord.metadata)
          ? { ...(syncRecord.metadata as Record<string, unknown>) }
          : ({} as Record<string, unknown>);

      const metadata: Record<string, unknown> = {
        ...currentMetadata,
        result: requestResult,
        trackingId: trackingId ?? (currentMetadata['trackingId'] as string | null | undefined) ?? null,
        hourRange: hourRange ?? (currentMetadata['hourRange'] as string | null | undefined) ?? null,
        status: requestStatus ?? syncRecord.status,
        lastWebhookAt: new Date().toISOString(),
        increments: increments.length,
      };

      const statusUpdates: UpdateProcessSyncStatusInput = {
        status: requestStatus ?? syncRecord.status,
        metadata,
      };

      if (requestStatus && requestStatus !== 'pending') {
        statusUpdates.completedAt = new Date();
      }

      const updates = await updateProcessSyncStatus(
        syncRecord.id,
        statusUpdates,
        client,
      );

      if (updates) {
        syncRecord = updates;
      }

      await registerSyncAudit(
        {
          processoId,
          processSyncId: syncRecord.id,
          processResponseId: processResponse.id,
          integrationApiKeyId: syncRecord.integrationApiKeyId,
          eventType: 'status_update',
          eventDetails: {
            requestId,
            status: requestStatus,
          },
        },
        client,
      );
    }

    for (const increment of increments) {
      await registerSyncAudit(
        {
          processoId,
          processSyncId: syncRecord?.id ?? null,
          processResponseId: processResponse.id,
          integrationApiKeyId: syncRecord?.integrationApiKeyId ?? integrationApiKeyId,
          eventType: normalizeString((increment as Record<string, unknown>)?.type) ?? 'increment',
          eventDetails: increment,
        },
        client,
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
