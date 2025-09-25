import type { Request } from 'express';
import type { Notification } from '../notificationService';
import {
  findProcessByNumber,
  findProcessSyncByRemoteId,
  registerProcessResponse,
  registerSyncAudit,
  updateProcessSyncStatus,
  type ProcessSyncRecord,
  type RegisterProcessResponseInput,
  type UpdateProcessSyncStatusInput,
} from '../juditProcessService';
import { INotificationProvider, NotificationProviderError } from './types';

function pickHeader(headers: Request['headers'], name: string): string | undefined {
  const value = headers[name];
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === 'string' && item.trim().length > 0);
    return first ? first.trim() : undefined;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseNumeric(value: unknown): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function cloneHeaders(headers: Request['headers']): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(headers)) {
    result[key] = value as unknown;
  }
  return result;
}

function resolveProcessNumber(payload: Record<string, unknown>): string | undefined {
  const candidateKeys = [
    'processNumber',
    'numeroProcesso',
    'numero_processo',
    'processoNumero',
    'numero',
  ];

  for (const key of candidateKeys) {
    const value = normalizeString(payload[key]);
    if (value) {
      return value;
    }
  }

  return undefined;
}

function resolveSyncReference(payload: Record<string, unknown>): string | undefined {
  const candidateKeys = [
    'syncId',
    'processSyncId',
    'syncReference',
    'requestId',
    'remoteRequestId',
    'idSincronizacao',
  ];

  for (const key of candidateKeys) {
    const value = normalizeString(payload[key]);
    if (value) {
      return value;
    }
  }

  return undefined;
}

function resolveStatusCode(payload: Record<string, unknown>): number | undefined {
  const candidateKeys = ['statusCode', 'httpStatus', 'code'];

  for (const key of candidateKeys) {
    const value = parseNumeric(payload[key]);
    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function resolveErrorMessage(payload: Record<string, unknown>): string | undefined {
  const candidateKeys = ['error', 'errorMessage', 'mensagem', 'message', 'descricaoErro'];

  for (const key of candidateKeys) {
    const value = normalizeString(payload[key]);
    if (value) {
      return value;
    }
  }

  return undefined;
}

function resolveSyncStatus(payload: Record<string, unknown>): string | undefined {
  const candidateKeys = ['status', 'syncStatus', 'resultado'];

  for (const key of candidateKeys) {
    const value = normalizeString(payload[key]);
    if (value) {
      return value.toLowerCase();
    }
  }

  return undefined;
}

function resolveSuccessFlag(payload: Record<string, unknown>): boolean | undefined {
  const candidateKeys = ['success', 'sucesso', 'ok'];
  for (const key of candidateKeys) {
    const value = payload[key];
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'sim'].includes(normalized)) {
        return true;
      }
      if (['false', '0', 'no', 'nao', 'não'].includes(normalized)) {
        return false;
      }
    }
  }
  return undefined;
}

function normalizePayload(body: unknown): Record<string, unknown> {
  if (body === null || body === undefined) {
    throw new NotificationProviderError('JUDIT webhook payload cannot be empty', 400);
  }

  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, unknown>;
      }
    } catch (error) {
      throw new NotificationProviderError('JUDIT webhook payload must be valid JSON', 400);
    }
  }

  if (typeof body !== 'object') {
    throw new NotificationProviderError('JUDIT webhook payload must be an object', 400);
  }

  return body as Record<string, unknown>;
}

function resolveDeliveryId(req: Request, payload: Record<string, unknown>): string | undefined {
  const headerKeys = ['x-delivery-id', 'x-request-id', 'x-correlation-id', 'x-message-id'];

  for (const key of headerKeys) {
    const value = pickHeader(req.headers, key);
    if (value) {
      return value;
    }
  }

  const payloadKeys = ['deliveryId', 'requestId', 'correlationId'];
  for (const key of payloadKeys) {
    const value = normalizeString(payload[key]);
    if (value) {
      return value;
    }
  }

  return undefined;
}

function resolveIntegrationId(req: Request, payload: Record<string, unknown>): number | undefined {
  const headerKeys = ['x-integration-key-id', 'x-judit-credential-id', 'x-credential-id'];

  for (const key of headerKeys) {
    const value = pickHeader(req.headers, key);
    if (value) {
      const parsed = parseNumeric(value);
      if (parsed !== undefined) {
        return parsed;
      }
    }
  }

  const payloadKeys = ['integrationKeyId', 'credentialId', 'apiKeyId'];
  for (const key of payloadKeys) {
    const value = parseNumeric(payload[key]);
    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function shouldMarkSyncCompleted(
  payload: Record<string, unknown>,
  currentSync: ProcessSyncRecord | null,
): UpdateProcessSyncStatusInput | null {
  const statusUpdate = resolveSyncStatus(payload);
  const successFlag = resolveSuccessFlag(payload);
  const errorMessage = resolveErrorMessage(payload);

  const updates: UpdateProcessSyncStatusInput = {};

  if (statusUpdate) {
    updates.status = statusUpdate;
  }

  if (successFlag === true) {
    updates.completedAt = new Date();
    if (!updates.status) {
      updates.status = 'completed';
    }
    updates.statusReason = null;
  } else if (successFlag === false) {
    if (!updates.status) {
      updates.status = statusUpdate ?? 'failed';
    }
    updates.completedAt = new Date();
    updates.statusReason = errorMessage ?? updates.statusReason ?? 'JUDIT retornou falha na sincronização';
  } else if (errorMessage && !updates.statusReason) {
    updates.statusReason = errorMessage;
  }

  if (!updates.status && !updates.statusReason && !updates.completedAt) {
    return null;
  }

  if (currentSync && updates.status === currentSync.status && !updates.statusReason && !updates.completedAt) {
    return null;
  }

  return updates;
}

export class JuditNotificationProvider implements INotificationProvider {
  public readonly id = 'judit';

  async subscribe(): Promise<void> {
    // JUDIT não requer assinatura ativa via API.
  }

  async fetchUpdates(): Promise<Notification[]> {
    return [];
  }

  async handleWebhook(req: Request): Promise<Notification[]> {
    const payload = normalizePayload(req.body);
    const deliveryId = resolveDeliveryId(req, payload);
    const integrationId = resolveIntegrationId(req, payload);
    const processNumber = resolveProcessNumber(payload);
    const syncReference = resolveSyncReference(payload);

    let processoId: number | null = null;
    if (processNumber) {
      const processo = await findProcessByNumber(processNumber);
      processoId = processo?.id ?? null;
    }

    let syncRecord: ProcessSyncRecord | null = null;
    if (syncReference) {
      syncRecord = await findProcessSyncByRemoteId(syncReference);
      if (!processoId && syncRecord?.processoId) {
        processoId = syncRecord.processoId;
      }
    }

    const responsePayload: RegisterProcessResponseInput = {
      processoId: processoId ?? syncRecord?.processoId ?? null,
      processSyncId: syncRecord?.id ?? null,
      integrationApiKeyId: integrationId ?? syncRecord?.integrationApiKeyId ?? null,
      deliveryId: deliveryId ?? null,
      source: 'webhook',
      statusCode: resolveStatusCode(payload),
      payload,
      headers: cloneHeaders(req.headers),
      errorMessage: resolveErrorMessage(payload),
    };

    const responseRecord = await registerProcessResponse(responsePayload);

    await registerSyncAudit({
      processoId: responseRecord.processoId ?? processoId ?? null,
      processSyncId: responseRecord.processSyncId ?? syncRecord?.id ?? null,
      processResponseId: responseRecord.id,
      integrationApiKeyId: responseRecord.integrationApiKeyId ?? integrationId ?? syncRecord?.integrationApiKeyId ?? null,
      eventType: 'webhook_received',
      eventDetails: {
        deliveryId: deliveryId ?? null,
        processNumber: processNumber ?? null,
        syncReference: syncReference ?? null,
        status: resolveSyncStatus(payload) ?? null,
        success: resolveSuccessFlag(payload) ?? null,
      },
    });

    if (syncRecord?.id) {
      const updates = shouldMarkSyncCompleted(payload, syncRecord);
      if (updates) {
        await updateProcessSyncStatus(syncRecord.id, updates);
      }
    }

    return [];
  }
}

export const juditNotificationProvider = new JuditNotificationProvider();
