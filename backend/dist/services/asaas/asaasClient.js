"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AsaasClient = exports.AsaasApiError = void 0;
const url_1 = require("url");
class AsaasApiError extends Error {
    constructor(message, status, responseBody, errorCode) {
        super(message);
        this.name = 'AsaasApiError';
        this.status = status;
        this.responseBody = responseBody;
        this.errorCode = errorCode;
    }
}
exports.AsaasApiError = AsaasApiError;
function isJsonContentType(headers) {
    const contentType = headers.get('content-type');
    return Boolean(contentType && contentType.toLowerCase().includes('application/json'));
}
async function parseResponseBody(response) {
    if (response.status === 204) {
        return null;
    }
    const cloned = response.clone();
    try {
        if (isJsonContentType(response.headers)) {
            return await cloned.json();
        }
        const text = await cloned.text();
        return text ? text : null;
    }
    catch (error) {
        return null;
    }
}
function buildUrl(baseUrl, path) {
    const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const trimmedPath = path.startsWith('/') ? path.slice(1) : path;
    return new url_1.URL(trimmedPath, base).toString();
}
function extractErrorDetails(body, status) {
    if (!body || typeof body !== 'object') {
        return { message: `Asaas API request failed with status ${status}` };
    }
    const payload = body;
    if (Array.isArray(payload.errors) && payload.errors.length > 0) {
        const first = payload.errors[0];
        const description = typeof first.description === 'string' ? first.description : undefined;
        const message = description || (typeof first.message === 'string' ? first.message : undefined);
        const code = typeof first.code === 'string' ? first.code : undefined;
        if (message) {
            return { message, code };
        }
    }
    if (typeof payload.message === 'string' && payload.message.trim()) {
        return { message: payload.message.trim(), code: typeof payload.code === 'string' ? payload.code : undefined };
    }
    if (typeof payload.error === 'string' && payload.error.trim()) {
        return { message: payload.error.trim() };
    }
    return { message: `Asaas API request failed with status ${status}` };
}
class AsaasClient {
    constructor(config) {
        if (!config.baseUrl) {
            throw new Error('AsaasClient requires a baseUrl');
        }
        if (!config.accessToken) {
            throw new Error('AsaasClient requires an accessToken');
        }
        this.baseUrl = config.baseUrl.replace(/\/$/, '');
        this.accessToken = config.accessToken;
        this.fetch = config.fetchImpl ?? fetch;
    }
    async request(path, init = {}) {
        const url = buildUrl(this.baseUrl, path);
        const headers = new Headers(init.headers);
        headers.set('Authorization', `Bearer ${this.accessToken}`);
        headers.set('access_token', this.accessToken);
        headers.set('Accept', 'application/json');
        const hasBody = typeof init.body !== 'undefined' && init.body !== null;
        if (hasBody && !headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json');
        }
        const response = await this.fetch(url, {
            ...init,
            headers,
        });
        const responseBody = await parseResponseBody(response);
        if (!response.ok) {
            const { message, code } = extractErrorDetails(responseBody, response.status);
            throw new AsaasApiError(message, response.status, responseBody, code);
        }
        return responseBody;
    }
    async createCustomer(payload) {
        return this.request('/customers', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    }
    async updateCustomer(customerId, payload) {
        return this.request(`/customers/${customerId}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
        });
    }
    async createCharge(payload) {
        return this.request('/payments', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    }
    async getCharge(chargeId) {
        return this.request(`/payments/${chargeId}`);
    }
    async createPix(payload) {
        return this.request('/pix/payments', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    }
    async createCreditCardCharge(payload) {
        const normalizedPayload = {
            ...payload,
            billingType: 'CREDIT_CARD',
        };
        return this.createCharge(normalizedPayload);
    }
    async validateCredentials() {
        return this.request('/accounts');
    }
}
exports.AsaasClient = AsaasClient;
exports.default = AsaasClient;
