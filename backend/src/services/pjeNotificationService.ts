import crypto from 'crypto';
import http from 'http';
import https from 'https';
import { URL } from 'url';

interface AccessTokenState {
  value: string;
  expiresAt: number;
}

interface WebhookSubscriptionState {
  id: string;
  expiresAt: number;
  lastRegisteredAt: number;
  rawResponse?: unknown;
}

export interface StoredPjeNotification {
  id: string;
  signature: string;
  payload: unknown;
  receivedAt: string;
  deliveryId?: string;
  headers?: Record<string, unknown>;
}

export class PjeConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PjeConfigurationError';
  }
}

export class PjeRequestError extends Error {
  status?: number;
  responseBody?: unknown;

  constructor(message: string, status?: number, responseBody?: unknown) {
    super(message);
    this.name = 'PjeRequestError';
    this.status = status;
    this.responseBody = responseBody;
  }
}

export class PjeWebhookSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PjeWebhookSignatureError';
  }
}

interface HttpResponse<T> {
  status: number;
  data: T | string | null;
  headers: http.IncomingHttpHeaders;
}

interface ProcessWebhookInput {
  payload: unknown;
  signature?: string;
  deliveryId?: string;
  headers?: http.IncomingHttpHeaders;
  rawBody?: string;
}

class PjeNotificationService {
  private readonly expirationToleranceMs = 5 * 60 * 1000; // 5 minutes
  private readonly maintenanceIntervalMs = 10 * 60 * 1000; // 10 minutes
  private readonly maxStoredNotifications = 100;

  private tokenState: AccessTokenState | null = null;
  private tokenRequest: Promise<AccessTokenState> | null = null;
  private webhookState: WebhookSubscriptionState | null = null;
  private webhookRequest: Promise<WebhookSubscriptionState> | null = null;
  private readonly storedNotifications: StoredPjeNotification[] = [];
  private maintenanceTimer: NodeJS.Timeout | null = null;

  constructor(private readonly baseUrl: string = 'https://pje.jus.br') {
    this.startMaintenanceJob();
  }

  async processIncomingNotification({
    payload,
    signature,
    deliveryId,
    headers,
    rawBody,
  }: ProcessWebhookInput): Promise<StoredPjeNotification> {
    const serializedPayload = rawBody ?? this.serializePayload(payload);
    this.ensureSignatureIsValid(signature, serializedPayload);
    const notification = this.persistNotification(payload, signature ?? '', deliveryId, headers);
    return notification;
  }

  listNotifications(limit?: number): StoredPjeNotification[] {
    const slice =
      typeof limit === 'number' && limit > 0
        ? this.storedNotifications.slice(0, limit)
        : this.storedNotifications;
    return slice.map((item) => ({
      ...item,
      payload: this.clonePayload(item.payload),
      headers: item.headers ? { ...item.headers } : undefined,
    }));
  }

  async ensureCurrentSubscription(): Promise<void> {
    if (!this.hasRequiredConfiguration()) {
      return;
    }

    try {
      await this.getAccessToken();
      await this.registerWebhook();
    } catch (error) {
      console.error('[PjeNotificationService] Failed to ensure subscription', error);
    }
  }

  private startMaintenanceJob() {
    if (this.maintenanceTimer) {
      clearInterval(this.maintenanceTimer);
    }

    this.maintenanceTimer = setInterval(() => {
      void this.ensureCurrentSubscription();
    }, this.maintenanceIntervalMs);

    // Kick off the first run immediately so we don't wait for the first interval.
    void this.ensureCurrentSubscription();
  }

  private hasRequiredConfiguration(): boolean {
    return Boolean(
      process.env.PJE_CLIENT_ID &&
        process.env.PJE_CLIENT_SECRET &&
        process.env.PJE_WEBHOOK_URL,
    );
  }

  private serializePayload(payload: unknown): string {
    if (typeof payload === 'string') {
      return payload;
    }
    if (payload === null || payload === undefined) {
      return '';
    }
    try {
      return JSON.stringify(payload);
    } catch (error) {
      console.warn('[PjeNotificationService] Failed to stringify payload', error);
      return String(payload);
    }
  }

  private ensureSignatureIsValid(signature: string | undefined, payload: string) {
    if (!signature) {
      throw new PjeWebhookSignatureError('Assinatura ausente no cabeçalho da requisição');
    }

    const normalized = signature.replace(/^sha256=/i, '').trim();
    if (!normalized) {
      throw new PjeWebhookSignatureError('Assinatura inválida');
    }

    const providedBuffer = this.decodeSignatureToBuffer(normalized);
    if (!providedBuffer) {
      throw new PjeWebhookSignatureError('Formato de assinatura desconhecido');
    }

    const expectedBuffer = this.computeSignature(payload);
    if (providedBuffer.length !== expectedBuffer.length) {
      throw new PjeWebhookSignatureError('Assinatura inválida');
    }

    const isValid = crypto.timingSafeEqual(providedBuffer, expectedBuffer);
    if (!isValid) {
      throw new PjeWebhookSignatureError('Assinatura inválida');
    }
  }

  private decodeSignatureToBuffer(signature: string): Buffer | null {
    const trimmed = signature.trim();
    if (!trimmed) {
      return null;
    }

    if (/^[0-9a-f]+$/i.test(trimmed) && trimmed.length % 2 === 0) {
      return Buffer.from(trimmed, 'hex');
    }

    if (/^[0-9a-z+/=]+$/i.test(trimmed)) {
      try {
        const buffer = Buffer.from(trimmed, 'base64');
        if (buffer.length > 0) {
          return buffer;
        }
      } catch (error) {
        return null;
      }
    }

    return null;
  }

  private computeSignature(payload: string): Buffer {
    const secret = this.getClientSecret();
    return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest();
  }

  private persistNotification(
    payload: unknown,
    signature: string,
    deliveryId?: string,
    headers?: http.IncomingHttpHeaders,
  ): StoredPjeNotification {
    const record: StoredPjeNotification = {
      id: `pje-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      signature,
      payload: this.clonePayload(payload),
      receivedAt: new Date().toISOString(),
      deliveryId,
      headers: headers ? { ...headers } : undefined,
    };

    this.storedNotifications.unshift(record);
    if (this.storedNotifications.length > this.maxStoredNotifications) {
      this.storedNotifications.length = this.maxStoredNotifications;
    }

    return record;
  }

  private clonePayload<T>(payload: T): T {
    if (payload === null || payload === undefined) {
      return payload;
    }
    if (typeof payload === 'object') {
      try {
        return JSON.parse(JSON.stringify(payload)) as T;
      } catch (error) {
        console.warn('[PjeNotificationService] Failed to clone payload', error);
      }
    }
    return payload;
  }

  private async getAccessToken(forceRefresh = false): Promise<string> {
    const now = Date.now();
    if (!forceRefresh && this.tokenState && now < this.tokenState.expiresAt - this.expirationToleranceMs) {
      return this.tokenState.value;
    }

    if (!this.tokenRequest) {
      this.tokenRequest = this.requestAccessToken()
        .then((token) => {
          this.tokenState = token;
          return token;
        })
        .finally(() => {
          this.tokenRequest = null;
        });
    }

    const token = await this.tokenRequest;
    return token.value;
  }

  private async registerWebhook(forceRenew = false): Promise<WebhookSubscriptionState> {
    const now = Date.now();
    if (
      !forceRenew &&
      this.webhookState &&
      now < this.webhookState.expiresAt - this.expirationToleranceMs
    ) {
      return this.webhookState;
    }

    if (!this.webhookRequest) {
      this.webhookRequest = this.requestWebhookRegistration(forceRenew)
        .then((subscription) => {
          this.webhookState = subscription;
          return subscription;
        })
        .finally(() => {
          this.webhookRequest = null;
        });
    }

    return this.webhookRequest;
  }

  private async requestAccessToken(): Promise<AccessTokenState> {
    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();
    const endpoint = this.buildUrl('/oauth/token');
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    });

    const response = await this.postRequest<Record<string, unknown>>(
      endpoint,
      body.toString(),
      {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    );

    if (response.status >= 400) {
      throw new PjeRequestError('Falha ao obter token de acesso', response.status, response.data);
    }

    const data = (response.data ?? {}) as Record<string, unknown>;
    const token = typeof data.access_token === 'string' ? data.access_token : undefined;

    if (!token) {
      throw new PjeRequestError('Resposta sem access_token', response.status, response.data);
    }

    const expiresAt = this.resolveExpirationTimestamp(data, 3600);

    return {
      value: token,
      expiresAt,
    };
  }

  private async requestWebhookRegistration(
    forceRenew: boolean,
  ): Promise<WebhookSubscriptionState> {
    const accessToken = await this.getAccessToken(forceRenew);
    const endpoint = this.buildUrl('/api/public/push/notificacoes');
    const webhookUrl = this.getWebhookUrl();
    const payload = {
      url: webhookUrl,
      ativo: true,
    };

    const response = await this.postRequest<Record<string, unknown>>(
      endpoint,
      JSON.stringify(payload),
      {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    );

    if (response.status === 401 && !forceRenew) {
      // Possível token expirado. Força renovação uma única vez.
      return this.requestWebhookRegistration(true);
    }

    if (response.status >= 400) {
      throw new PjeRequestError('Falha ao registrar webhook no PJE', response.status, response.data);
    }

    const data = (response.data ?? {}) as Record<string, unknown>;
    const id = this.extractSubscriptionId(data);
    const expiresAt = this.resolveExpirationTimestamp(data, 24 * 3600);

    return {
      id,
      expiresAt,
      lastRegisteredAt: Date.now(),
      rawResponse: data,
    };
  }

  private extractSubscriptionId(data: Record<string, unknown>): string {
    const candidates: unknown[] = [
      data.id,
      data.subscriptionId,
      data.inscricaoId,
      data.codigo,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
      if (typeof candidate === 'number' && Number.isFinite(candidate)) {
        return String(candidate);
      }
    }

    return 'unknown';
  }

  private resolveExpirationTimestamp(data: Record<string, unknown>, defaultSeconds: number): number {
    const now = Date.now();

    const dateCandidates: unknown[] = [
      data.expires_at,
      data.expiresAt,
      data.expiraEm,
      data.expiration,
      data.expirationDate,
      data.valid_until,
      data.validUntil,
    ];

    for (const candidate of dateCandidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        const parsed = new Date(candidate);
        if (!Number.isNaN(parsed.getTime())) {
          return parsed.getTime();
        }
      }
      if (typeof candidate === 'number' && Number.isFinite(candidate)) {
        if (candidate > 1e12) {
          return candidate;
        }
        return now + candidate * 1000;
      }
    }

    const secondsCandidates: unknown[] = [
      data.expires_in,
      data.expiresIn,
      data.expiraEmSegundos,
      data.validade,
    ];

    for (const candidate of secondsCandidates) {
      const seconds = this.parsePositiveNumber(candidate);
      if (seconds) {
        return now + seconds * 1000;
      }
    }

    return now + defaultSeconds * 1000;
  }

  private parsePositiveNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return value;
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number.parseFloat(value);
      if (!Number.isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
    return undefined;
  }

  private async postRequest<T>(
    url: string,
    body: string,
    headers: Record<string, string>,
    timeoutMs = 10000,
  ): Promise<HttpResponse<T>> {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const transport = isHttps ? https : http;
    const finalHeaders = { ...headers };
    if (body) {
      finalHeaders['Content-Length'] = Buffer.byteLength(body).toString();
    }

    return new Promise<HttpResponse<T>>((resolve, reject) => {
      const request = transport.request(
        parsedUrl,
        {
          method: 'POST',
          headers: finalHeaders,
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });
          response.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            const contentType = response.headers['content-type'] ?? '';
            let data: T | string | null = raw ? raw : null;
            if (raw && /json/i.test(String(contentType))) {
              try {
                data = JSON.parse(raw) as T;
              } catch (error) {
                data = raw;
              }
            }

            resolve({
              status: response.statusCode ?? 0,
              data,
              headers: response.headers,
            });
          });
        },
      );

      request.on('error', (error) => reject(error));
      request.setTimeout(timeoutMs, () => {
        request.destroy(new Error(`Requisição ao PJE excedeu ${timeoutMs}ms`));
      });

      if (body) {
        request.write(body);
      }
      request.end();
    });
  }

  private getClientId(): string {
    const value = process.env.PJE_CLIENT_ID;
    if (!value) {
      throw new PjeConfigurationError('PJE_CLIENT_ID não configurado');
    }
    return value;
  }

  private getClientSecret(): string {
    const value = process.env.PJE_CLIENT_SECRET;
    if (!value) {
      throw new PjeConfigurationError('PJE_CLIENT_SECRET não configurado');
    }
    return value;
  }

  private getWebhookUrl(): string {
    const value = process.env.PJE_WEBHOOK_URL;
    if (!value) {
      throw new PjeConfigurationError('PJE_WEBHOOK_URL não configurado');
    }
    return value;
  }

  private buildUrl(pathname: string): string {
    const normalizedBase = this.baseUrl.replace(/\/$/, '');
    const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
    return `${normalizedBase}${normalizedPath}`;
  }
}

const pjeNotificationService = new PjeNotificationService();

export default pjeNotificationService;
