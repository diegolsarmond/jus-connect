import { setTimeout as delay } from 'timers/promises';
import { PoolClient } from 'pg';
import pool from './db';

const TRACKING_ENDPOINT = 'https://tracking.prod.judit.io/tracking';
const REQUESTS_ENDPOINT = 'https://requests.prod.judit.io/requests';

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BACKOFF_MS = 500;

export class JuditConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JuditConfigurationError';
  }
}

export class JuditApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'JuditApiError';
    this.status = status;
    this.body = body;
  }
}

export type JuditRequestSource = 'details' | 'manual' | 'cron' | 'webhook' | 'system';

export interface JuditTrackingResponse {
  tracking_id: string;
  process_number?: string;
  hour_range?: string | null;
  status?: string | null;
  recurrence?: number | null;
}

export interface JuditRequestResponse {
  request_id: string;
  status: string;
  result?: unknown;
  tracking_id?: string;
}

export interface JuditRequestRecord {
  requestId: string;
  status: string;
  source: JuditRequestSource;
  result: unknown;
  createdAt: string;
  updatedAt: string;
}

interface EnsureTrackingOptions {
  trackingId?: string | null;
  hourRange?: string | null;
  client?: PoolClient;
}

interface TriggerRequestOptions {
  source: JuditRequestSource;
  actorUserId?: number | null;
  skipIfPending?: boolean;
  client?: PoolClient;
}

export class JuditProcessService {
  private readonly apiKey: string | null;
  private readonly maxRetries: number;
  private readonly backoffMs: number;

  constructor(apiKey: string | undefined | null = process.env.JUDIT_API_KEY) {
    this.apiKey = apiKey ?? null;
    this.maxRetries = this.resolveNumericEnv('JUDIT_MAX_RETRIES', DEFAULT_MAX_RETRIES, 1, 10);
    this.backoffMs = this.resolveNumericEnv('JUDIT_BACKOFF_MS', DEFAULT_BACKOFF_MS, 100, 60000);
  }

  isEnabled(): boolean {
    return Boolean(this.apiKey);
  }

  private resolveNumericEnv(name: string, fallback: number, min: number, max: number): number {
    const raw = process.env[name];
    if (!raw) {
      return fallback;
    }

    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    return Math.min(Math.max(parsed, min), max);
  }

  private buildHeaders(): HeadersInit {
    if (!this.apiKey) {
      throw new JuditConfigurationError('Variável de ambiente JUDIT_API_KEY não configurada.');
    }

    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'api-key': this.apiKey,
    } satisfies HeadersInit;
  }

  private async requestWithRetry<T>(url: string, init: RequestInit, attempt = 0): Promise<T> {
    try {
      const response = await fetch(url, { ...init, headers: { ...init.headers, ...this.buildHeaders() } });

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return (await response.json()) as T;
        }

        const text = await response.text();
        return JSON.parse(text) as T;
      }

      const retryable = response.status >= 500 || response.status === 429;
      const body = await this.safeParseBody(response);

      if (retryable && attempt + 1 < this.maxRetries) {
        await delay(this.backoffMs * 2 ** attempt);
        return this.requestWithRetry<T>(url, init, attempt + 1);
      }

      throw new JuditApiError(`Requisição para Judit falhou com status ${response.status}`, response.status, body);
    } catch (error) {
      if (error instanceof JuditApiError) {
        throw error;
      }

      if (attempt + 1 < this.maxRetries) {
        await delay(this.backoffMs * 2 ** attempt);
        return this.requestWithRetry<T>(url, init, attempt + 1);
      }

      throw error;
    }
  }

  private async safeParseBody(response: Response): Promise<unknown> {
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      const text = await response.text();
      if (!text) {
        return null;
      }
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  async createTracking(processNumber: string): Promise<JuditTrackingResponse> {
    if (!this.isEnabled()) {
      throw new JuditConfigurationError('Integração com a Judit está desabilitada.');
    }

    return this.requestWithRetry<JuditTrackingResponse>(TRACKING_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify({ process_number: processNumber, recurrence: 1 }),
    });
  }

  async renewTracking(trackingId: string, processNumber: string): Promise<JuditTrackingResponse> {
    if (!this.isEnabled()) {
      throw new JuditConfigurationError('Integração com a Judit está desabilitada.');
    }

    const url = `${TRACKING_ENDPOINT}/${encodeURIComponent(trackingId)}`;
    return this.requestWithRetry<JuditTrackingResponse>(url, {
      method: 'PUT',
      body: JSON.stringify({ process_number: processNumber, recurrence: 1 }),
    });
  }

  async triggerRequest(processNumber: string): Promise<JuditRequestResponse> {
    if (!this.isEnabled()) {
      throw new JuditConfigurationError('Integração com a Judit está desabilitada.');
    }

    return this.requestWithRetry<JuditRequestResponse>(REQUESTS_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify({ process_number: processNumber }),
    });
  }

  async getRequestStatusFromApi(requestId: string): Promise<JuditRequestResponse> {
    if (!this.isEnabled()) {
      throw new JuditConfigurationError('Integração com a Judit está desabilitada.');
    }

    const url = `${REQUESTS_ENDPOINT}/${encodeURIComponent(requestId)}`;
    return this.requestWithRetry<JuditRequestResponse>(url, { method: 'GET' });
  }

  async ensureTrackingForProcess(
    processoId: number,
    processNumber: string,
    options: EnsureTrackingOptions = {}
  ): Promise<JuditTrackingResponse | null> {
    if (!this.isEnabled()) {
      return null;
    }

    const useClient = options.client ?? (await pool.connect());
    const shouldRelease = !options.client;
    const manageTransaction = !options.client;

    try {
      if (manageTransaction) {
        await useClient.query('BEGIN');
      }

      let trackingResponse: JuditTrackingResponse;

      if (options.trackingId) {
        try {
          trackingResponse = await this.renewTracking(options.trackingId, processNumber);
        } catch (error) {
          console.warn('[Judit] Falha ao renovar tracking, criando um novo.', error);
          trackingResponse = await this.createTracking(processNumber);
        }
      } else {
        trackingResponse = await this.createTracking(processNumber);
      }

      const hourRange = typeof trackingResponse.hour_range === 'string' ? trackingResponse.hour_range : null;
      const status = trackingResponse.status ?? 'active';

      await useClient.query(
        `UPDATE public.processos
           SET judit_tracking_id = $1,
               judit_tracking_hour_range = $2,
               atualizado_em = NOW()
         WHERE id = $3`,
        [trackingResponse.tracking_id, hourRange, processoId]
      );

      await useClient.query(
        `INSERT INTO public.processo_sync (processo_id, provider, status, tracking_id, hour_range, last_synced_at)
           VALUES ($1, 'judit', $2, $3, $4, NOW())
           ON CONFLICT (processo_id, provider)
           DO UPDATE SET
             status = EXCLUDED.status,
             tracking_id = EXCLUDED.tracking_id,
             hour_range = EXCLUDED.hour_range,
             last_synced_at = EXCLUDED.last_synced_at,
             atualizado_em = NOW()`,
        [processoId, status, trackingResponse.tracking_id, hourRange]
      );

      if (manageTransaction) {
        await useClient.query('COMMIT');
      }
      return trackingResponse;
    } catch (error) {
      if (manageTransaction) {
        await useClient.query('ROLLBACK');
      }
      throw error;
    } finally {
      if (shouldRelease) {
        useClient.release();
      }
    }
  }

  async triggerRequestForProcess(
    processoId: number,
    processNumber: string,
    options: TriggerRequestOptions
  ): Promise<JuditRequestRecord | null> {
    if (!this.isEnabled()) {
      return null;
    }

    const client = options.client ?? (await pool.connect());
    const shouldRelease = !options.client;
    const manageTransaction = !options.client;

    try {
      if (manageTransaction) {
        await client.query('BEGIN');
      }

      if (options.skipIfPending) {
        const pendingLookup = await client.query(
          `SELECT request_id, status, source, result, criado_em, atualizado_em
             FROM public.processo_judit_requests
            WHERE processo_id = $1 AND status = 'pending'
            ORDER BY atualizado_em DESC
            LIMIT 1`,
          [processoId]
        );

        if ((pendingLookup.rowCount ?? 0) > 0) {
          const row = pendingLookup.rows[0];
          if (manageTransaction) {
            await client.query('COMMIT');
          }
          return {
            requestId: row.request_id,
            status: row.status,
            source: row.source,
            result: row.result,
            createdAt: row.criado_em.toISOString?.() ?? row.criado_em,
            updatedAt: row.atualizado_em.toISOString?.() ?? row.atualizado_em,
          };
        }
      }

      const response = await this.triggerRequest(processNumber);

      const requestId = response.request_id;
      const status = response.status ?? 'pending';
      const result = response.result ?? null;

      const upsert = await client.query(
        `INSERT INTO public.processo_judit_requests (processo_id, request_id, status, source, result)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (request_id)
           DO UPDATE SET
             status = EXCLUDED.status,
             source = EXCLUDED.source,
             result = EXCLUDED.result,
             atualizado_em = NOW()
           RETURNING request_id, status, source, result, criado_em, atualizado_em`,
        [processoId, requestId, status, options.source, result]
      );

      const row = upsert.rows[0];

      await client.query(
        `UPDATE public.processo_sync
            SET last_request_id = $1,
                last_request_status = $2,
                last_request_payload = $3,
                atualizado_em = NOW()
          WHERE processo_id = $4 AND provider = 'judit'`,
        [requestId, status, result, processoId]
      );

      if (options.actorUserId) {
        await client.query(
          `INSERT INTO public.processo_consultas_api (processo_id, sucesso, detalhes)
             VALUES ($1, $2, $3)`,
          [
            processoId,
            status === 'completed',
            JSON.stringify({
              provider: 'judit',
              action: 'trigger-request',
              source: options.source,
              requestId,
              status,
              actorUserId: options.actorUserId,
            }),
          ]
        );
      }

      if (manageTransaction) {
        await client.query('COMMIT');
      }

      return {
        requestId: row.request_id,
        status: row.status,
        source: row.source,
        result: row.result,
        createdAt: row.criado_em.toISOString?.() ?? row.criado_em,
        updatedAt: row.atualizado_em.toISOString?.() ?? row.atualizado_em,
      };
    } catch (error) {
      if (manageTransaction) {
        await client.query('ROLLBACK');
      }
      throw error;
    } finally {
      if (shouldRelease) {
        client.release();
      }
    }
  }

  async updateRequestStatus(
    processoId: number,
    requestId: string,
    status: string,
    result: unknown,
    options: { source?: JuditRequestSource; client?: PoolClient } = {}
  ): Promise<JuditRequestRecord | null> {
    if (!this.isEnabled()) {
      return null;
    }

    const client = options.client ?? (await pool.connect());
    const shouldRelease = !options.client;
    const manageTransaction = !options.client;

    try {
      if (manageTransaction) {
        await client.query('BEGIN');
      }

      const upsert = await client.query(
        `INSERT INTO public.processo_judit_requests (processo_id, request_id, status, source, result)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (request_id)
           DO UPDATE SET
             status = EXCLUDED.status,
             source = EXCLUDED.source,
             result = EXCLUDED.result,
             atualizado_em = NOW()
           RETURNING request_id, status, source, result, criado_em, atualizado_em`,
        [processoId, requestId, status, options.source ?? 'system', result]
      );

      const row = upsert.rows[0];

      await client.query(
        `UPDATE public.processo_sync
            SET last_request_id = $1,
                last_request_status = $2,
                last_request_payload = $3,
                last_synced_at = NOW(),
                atualizado_em = NOW()
          WHERE processo_id = $4 AND provider = 'judit'`,
        [requestId, status, result, processoId]
      );

      if (manageTransaction) {
        await client.query('COMMIT');
      }

      return {
        requestId: row.request_id,
        status: row.status,
        source: row.source,
        result: row.result,
        createdAt: row.criado_em.toISOString?.() ?? row.criado_em,
        updatedAt: row.atualizado_em.toISOString?.() ?? row.atualizado_em,
      };
    } catch (error) {
      if (manageTransaction) {
        await client.query('ROLLBACK');
      }
      throw error;
    } finally {
      if (shouldRelease) {
        client.release();
      }
    }
  }

  async getStoredRequest(
    processoId: number,
    requestId: string,
    client?: PoolClient
  ): Promise<JuditRequestRecord | null> {
    const useClient = client ?? (await pool.connect());
    const shouldRelease = !client;

    try {
      const result = await useClient.query(
        `SELECT request_id, status, source, result, criado_em, atualizado_em
           FROM public.processo_judit_requests
          WHERE processo_id = $1 AND request_id = $2
          LIMIT 1`,
        [processoId, requestId]
      );

      if (result.rowCount === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        requestId: row.request_id,
        status: row.status,
        source: row.source,
        result: row.result,
        createdAt: row.criado_em.toISOString?.() ?? row.criado_em,
        updatedAt: row.atualizado_em.toISOString?.() ?? row.atualizado_em,
      };
    } finally {
      if (shouldRelease) {
        useClient.release();
      }
    }
  }
}

const juditProcessService = new JuditProcessService();

export default juditProcessService;
