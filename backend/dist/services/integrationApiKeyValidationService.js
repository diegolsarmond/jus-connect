"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const integrationApiKeyService_1 = __importStar(require("./integrationApiKeyService"));
function resolveAsaasApiUrl(environment, apiUrl) {
    if (typeof apiUrl === 'string') {
        const trimmed = apiUrl.trim();
        if (trimmed) {
            return trimmed;
        }
    }
    if (typeof environment === 'string') {
        const normalized = environment.trim().toLowerCase();
        if (normalized && normalized in integrationApiKeyService_1.ASAAS_DEFAULT_API_URLS) {
            return integrationApiKeyService_1.ASAAS_DEFAULT_API_URLS[normalized];
        }
    }
    throw new integrationApiKeyService_1.ValidationError('Unable to determine Asaas API URL for this integration');
}
function buildValidationUrl(baseUrl) {
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    try {
        const url = new URL('customers?limit=1', normalizedBase);
        return url.toString();
    }
    catch (error) {
        throw new integrationApiKeyService_1.ValidationError('Invalid Asaas API URL configured');
    }
}
function parseErrorMessage(payload) {
    if (!payload || typeof payload !== 'object') {
        if (typeof payload === 'string' && payload.trim()) {
            return payload.trim();
        }
        return undefined;
    }
    if ('message' in payload && typeof payload.message === 'string' && payload.message.trim()) {
        return payload.message.trim();
    }
    if ('error' in payload && typeof payload.error === 'string' && payload.error.trim()) {
        return payload.error.trim();
    }
    if (Array.isArray(payload.errors)) {
        for (const item of payload.errors) {
            if (!item) {
                continue;
            }
            if (typeof item === 'string' && item.trim()) {
                return item.trim();
            }
            if (typeof item === 'object') {
                if ('description' in item && typeof item.description === 'string' && item.description.trim()) {
                    return item.description.trim();
                }
                if ('message' in item && typeof item.message === 'string' && item.message.trim()) {
                    return item.message.trim();
                }
                if ('error' in item && typeof item.error === 'string' && item.error.trim()) {
                    return item.error.trim();
                }
            }
        }
    }
    return undefined;
}
class IntegrationApiKeyValidationService {
    constructor(apiKeyService = new integrationApiKeyService_1.default(), fetchImpl = globalThis.fetch ?? (async () => {
        throw new Error('Fetch API is not available');
    })) {
        this.apiKeyService = apiKeyService;
        this.fetchImpl = fetchImpl;
    }
    async validateAsaas(apiKeyId) {
        if (!Number.isInteger(apiKeyId) || apiKeyId <= 0) {
            throw new integrationApiKeyService_1.ValidationError('Invalid API key id');
        }
        const apiKey = await this.apiKeyService.findById(apiKeyId);
        if (!apiKey) {
            throw new integrationApiKeyService_1.ValidationError('Asaas API key not found');
        }
        if (apiKey.provider !== 'asaas') {
            throw new integrationApiKeyService_1.ValidationError('API key provider must be Asaas');
        }
        const baseUrl = resolveAsaasApiUrl(apiKey.environment, apiKey.apiUrl);
        const requestUrl = buildValidationUrl(baseUrl);
        const headers = {
            Accept: 'application/json',
            access_token: typeof apiKey.key === 'string' ? apiKey.key : '',
        };
        try {
            const response = await this.fetchImpl(requestUrl, {
                method: 'GET',
                headers,
            });
            if (response.ok) {
                return { success: true };
            }
            try {
                const payload = await response.json();
                const message = parseErrorMessage(payload);
                if (message) {
                    return { success: false, message };
                }
            }
            catch (error) {
                // Ignore body parsing issues and fall back to default message
            }
            return {
                success: false,
                message: `Asaas API request failed with status ${response.status}`,
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return {
                success: false,
                message: `Unable to connect to Asaas API: ${message}`,
            };
        }
    }
}
exports.default = IntegrationApiKeyValidationService;
