"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PjeWebhookSignatureError = exports.PjeRequestError = exports.PjeConfigurationError = void 0;
const crypto_1 = __importDefault(require("crypto"));
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const url_1 = require("url");
class PjeConfigurationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PjeConfigurationError';
    }
}
exports.PjeConfigurationError = PjeConfigurationError;
class PjeRequestError extends Error {
    constructor(message, status, responseBody) {
        super(message);
        this.name = 'PjeRequestError';
        this.status = status;
        this.responseBody = responseBody;
    }
}
exports.PjeRequestError = PjeRequestError;
class PjeWebhookSignatureError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PjeWebhookSignatureError';
    }
}
exports.PjeWebhookSignatureError = PjeWebhookSignatureError;
class PjeNotificationService {
    constructor(baseUrl = 'https://pje.jus.br') {
        this.baseUrl = baseUrl;
        this.expirationToleranceMs = 5 * 60 * 1000; // 5 minutes
        this.maintenanceIntervalMs = 10 * 60 * 1000; // 10 minutes
        this.maxStoredNotifications = 100;
        this.tokenState = null;
        this.tokenRequest = null;
        this.webhookState = null;
        this.webhookRequest = null;
        this.storedNotifications = [];
        this.maintenanceTimer = null;
        this.startMaintenanceJob();
    }
    async processIncomingNotification({ payload, signature, deliveryId, headers, rawBody, }) {
        const serializedPayload = rawBody ?? this.serializePayload(payload);
        this.ensureSignatureIsValid(signature, serializedPayload);
        const notification = this.persistNotification(payload, signature ?? '', deliveryId, headers);
        return notification;
    }
    listNotifications(limit) {
        const slice = typeof limit === 'number' && limit > 0
            ? this.storedNotifications.slice(0, limit)
            : this.storedNotifications;
        return slice.map((item) => ({
            ...item,
            payload: this.clonePayload(item.payload),
            headers: item.headers ? { ...item.headers } : undefined,
        }));
    }
    async ensureCurrentSubscription() {
        if (!this.hasRequiredConfiguration()) {
            return;
        }
        try {
            await this.getAccessToken();
            await this.registerWebhook();
        }
        catch (error) {
            console.error('[PjeNotificationService] Failed to ensure subscription', error);
        }
    }
    startMaintenanceJob() {
        if (this.maintenanceTimer) {
            clearInterval(this.maintenanceTimer);
        }
        this.maintenanceTimer = setInterval(() => {
            void this.ensureCurrentSubscription();
        }, this.maintenanceIntervalMs);
        // Kick off the first run immediately so we don't wait for the first interval.
        void this.ensureCurrentSubscription();
    }
    hasRequiredConfiguration() {
        return Boolean(process.env.PJE_CLIENT_ID &&
            process.env.PJE_CLIENT_SECRET &&
            process.env.PJE_WEBHOOK_URL);
    }
    serializePayload(payload) {
        if (typeof payload === 'string') {
            return payload;
        }
        if (payload === null || payload === undefined) {
            return '';
        }
        try {
            return JSON.stringify(payload);
        }
        catch (error) {
            console.warn('[PjeNotificationService] Failed to stringify payload', error);
            return String(payload);
        }
    }
    ensureSignatureIsValid(signature, payload) {
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
        const isValid = crypto_1.default.timingSafeEqual(providedBuffer, expectedBuffer);
        if (!isValid) {
            throw new PjeWebhookSignatureError('Assinatura inválida');
        }
    }
    decodeSignatureToBuffer(signature) {
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
            }
            catch (error) {
                return null;
            }
        }
        return null;
    }
    computeSignature(payload) {
        const secret = this.getClientSecret();
        return crypto_1.default.createHmac('sha256', secret).update(payload, 'utf8').digest();
    }
    persistNotification(payload, signature, deliveryId, headers) {
        const record = {
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
    clonePayload(payload) {
        if (payload === null || payload === undefined) {
            return payload;
        }
        if (typeof payload === 'object') {
            try {
                return JSON.parse(JSON.stringify(payload));
            }
            catch (error) {
                console.warn('[PjeNotificationService] Failed to clone payload', error);
            }
        }
        return payload;
    }
    async getAccessToken(forceRefresh = false) {
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
    async registerWebhook(forceRenew = false) {
        const now = Date.now();
        if (!forceRenew &&
            this.webhookState &&
            now < this.webhookState.expiresAt - this.expirationToleranceMs) {
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
    async requestAccessToken() {
        const clientId = this.getClientId();
        const clientSecret = this.getClientSecret();
        const endpoint = this.buildUrl('/oauth/token');
        const body = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
        });
        const response = await this.postRequest(endpoint, body.toString(), {
            'Content-Type': 'application/x-www-form-urlencoded',
        });
        if (response.status >= 400) {
            throw new PjeRequestError('Falha ao obter token de acesso', response.status, response.data);
        }
        const data = (response.data ?? {});
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
    async requestWebhookRegistration(forceRenew) {
        const accessToken = await this.getAccessToken(forceRenew);
        const endpoint = this.buildUrl('/api/public/push/notificacoes');
        const webhookUrl = this.getWebhookUrl();
        const payload = {
            url: webhookUrl,
            ativo: true,
        };
        const response = await this.postRequest(endpoint, JSON.stringify(payload), {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
        });
        if (response.status === 401 && !forceRenew) {
            // Possível token expirado. Força renovação uma única vez.
            return this.requestWebhookRegistration(true);
        }
        if (response.status >= 400) {
            throw new PjeRequestError('Falha ao registrar webhook no PJE', response.status, response.data);
        }
        const data = (response.data ?? {});
        const id = this.extractSubscriptionId(data);
        const expiresAt = this.resolveExpirationTimestamp(data, 24 * 3600);
        return {
            id,
            expiresAt,
            lastRegisteredAt: Date.now(),
            rawResponse: data,
        };
    }
    extractSubscriptionId(data) {
        const candidates = [
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
    resolveExpirationTimestamp(data, defaultSeconds) {
        const now = Date.now();
        const dateCandidates = [
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
        const secondsCandidates = [
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
    parsePositiveNumber(value) {
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
    async postRequest(url, body, headers, timeoutMs = 10000) {
        const parsedUrl = new url_1.URL(url);
        const isHttps = parsedUrl.protocol === 'https:';
        const transport = isHttps ? https_1.default : http_1.default;
        const finalHeaders = { ...headers };
        if (body) {
            finalHeaders['Content-Length'] = Buffer.byteLength(body).toString();
        }
        return new Promise((resolve, reject) => {
            const request = transport.request(parsedUrl, {
                method: 'POST',
                headers: finalHeaders,
            }, (response) => {
                const chunks = [];
                response.on('data', (chunk) => {
                    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                });
                response.on('end', () => {
                    const raw = Buffer.concat(chunks).toString('utf8');
                    const contentType = response.headers['content-type'] ?? '';
                    let data = raw ? raw : null;
                    if (raw && /json/i.test(String(contentType))) {
                        try {
                            data = JSON.parse(raw);
                        }
                        catch (error) {
                            data = raw;
                        }
                    }
                    resolve({
                        status: response.statusCode ?? 0,
                        data,
                        headers: response.headers,
                    });
                });
            });
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
    getClientId() {
        const value = process.env.PJE_CLIENT_ID;
        if (!value) {
            throw new PjeConfigurationError('PJE_CLIENT_ID não configurado');
        }
        return value;
    }
    getClientSecret() {
        const value = process.env.PJE_CLIENT_SECRET;
        if (!value) {
            throw new PjeConfigurationError('PJE_CLIENT_SECRET não configurado');
        }
        return value;
    }
    getWebhookUrl() {
        const value = process.env.PJE_WEBHOOK_URL;
        if (!value) {
            throw new PjeConfigurationError('PJE_WEBHOOK_URL não configurado');
        }
        return value;
    }
    buildUrl(pathname) {
        const normalizedBase = this.baseUrl.replace(/\/$/, '');
        const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
        return `${normalizedBase}${normalizedPath}`;
    }
}
const pjeNotificationService = new PjeNotificationService();
exports.default = pjeNotificationService;
