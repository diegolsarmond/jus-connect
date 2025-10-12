"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASAAS_DEFAULT_API_URLS = exports.ValidationError = exports.API_KEY_ENVIRONMENTS = exports.API_KEY_PROVIDERS = void 0;
const crypto_1 = __importDefault(require("crypto"));
const url_1 = require("url");
const db_1 = __importDefault(require("./db"));
exports.API_KEY_PROVIDERS = ['gemini', 'openai', 'asaas'];
exports.API_KEY_ENVIRONMENTS = ['producao', 'homologacao'];
class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
exports.ASAAS_DEFAULT_API_URLS = {
    producao: 'https://api.asaas.com/api/v3',
    homologacao: 'https://sandbox.asaas.com/api/v3',
};
function getDefaultApiUrl(provider, environment) {
    if (provider === 'asaas') {
        return exports.ASAAS_DEFAULT_API_URLS[environment] ?? null;
    }
    return null;
}
function normalizeProvider(value) {
    if (typeof value !== 'string') {
        throw new ValidationError('Provider is required');
    }
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
        throw new ValidationError('Provider is required');
    }
    if (!exports.API_KEY_PROVIDERS.includes(normalized)) {
        throw new ValidationError('Provider must be Gemini, OpenAI ou Asaas');
    }
    return normalized;
}
function normalizeEnvironment(value) {
    if (typeof value !== 'string') {
        throw new ValidationError('Environment is required');
    }
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
        throw new ValidationError('Environment is required');
    }
    if (!exports.API_KEY_ENVIRONMENTS.includes(normalized)) {
        throw new ValidationError('Environment must be produção or homologação');
    }
    return normalized;
}
function normalizeKey(value) {
    if (typeof value !== 'string') {
        throw new ValidationError('API key value is required');
    }
    const normalized = value.trim();
    if (!normalized) {
        throw new ValidationError('API key value is required');
    }
    return normalized;
}
function normalizeOptionalApiUrl(value) {
    if (value === undefined || value === null) {
        return null;
    }
    if (typeof value !== 'string') {
        throw new ValidationError('API URL must be a string value');
    }
    const normalized = value.trim();
    if (!normalized) {
        return null;
    }
    try {
        const parsedUrl = new url_1.URL(normalized);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            throw new ValidationError('API URL must use HTTP or HTTPS protocol');
        }
    }
    catch (error) {
        if (error instanceof ValidationError) {
            throw error;
        }
        throw new ValidationError('API URL must be a valid URL');
    }
    return normalized;
}
function resolveApiUrl(provider, environment, value) {
    const normalized = normalizeOptionalApiUrl(value);
    if (normalized) {
        return normalized;
    }
    return getDefaultApiUrl(provider, environment);
}
function normalizeLastUsed(value) {
    if (value === undefined || value === null) {
        return null;
    }
    if (value instanceof Date) {
        return value;
    }
    if (typeof value === 'string') {
        const normalized = value.trim();
        if (!normalized) {
            return null;
        }
        const parsed = new Date(normalized);
        if (Number.isNaN(parsed.getTime())) {
            throw new ValidationError('Invalid lastUsed datetime');
        }
        return parsed;
    }
    throw new ValidationError('Invalid lastUsed datetime');
}
function formatDate(value) {
    if (value instanceof Date) {
        return value.toISOString();
    }
    return new Date(value).toISOString();
}
function formatNullableDate(value) {
    if (!value) {
        return null;
    }
    return formatDate(value);
}
let hasLoggedUnexpectedProvider = false;
let hasLoggedUnexpectedEnvironment = false;
function mapProviderFromRow(value) {
    if (typeof value !== 'string') {
        return '';
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return '';
    }
    const lowerCased = trimmed.toLowerCase();
    if (exports.API_KEY_PROVIDERS.includes(lowerCased)) {
        return lowerCased;
    }
    if (!hasLoggedUnexpectedProvider) {
        console.warn('integration_api_keys has unexpected provider value:', value);
        hasLoggedUnexpectedProvider = true;
    }
    return trimmed;
}
function mapEnvironmentFromRow(value) {
    if (typeof value !== 'string') {
        return '';
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return '';
    }
    const lowerCased = trimmed.toLowerCase();
    if (exports.API_KEY_ENVIRONMENTS.includes(lowerCased)) {
        return lowerCased;
    }
    if (!hasLoggedUnexpectedEnvironment) {
        console.warn('integration_api_keys has unexpected environment value:', value);
        hasLoggedUnexpectedEnvironment = true;
    }
    return trimmed;
}
function mapRow(row) {
    return {
        id: row.id,
        provider: mapProviderFromRow(row.provider),
        apiUrl: typeof row.url_api === 'string' ? row.url_api.trim() || null : null,
        key: row.key_value,
        environment: mapEnvironmentFromRow(row.environment),
        active: row.active,
        lastUsed: formatNullableDate(row.last_used),
        createdAt: formatDate(row.created_at),
        updatedAt: formatDate(row.updated_at),
    };
}
function sanitizeWebhookSecret(value) {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    return trimmed || null;
}
function generateWebhookSecret() {
    return crypto_1.default.randomBytes(32).toString('hex');
}
class IntegrationApiKeyService {
    constructor(db = db_1.default) {
        this.db = db;
    }
    async ensureAsaasCredential(integrationId) {
        if (!Number.isInteger(integrationId) || integrationId <= 0) {
            return;
        }
        const existing = await this.db.query('SELECT id, webhook_secret FROM asaas_credentials WHERE integration_api_key_id = $1', [integrationId]);
        if (existing.rowCount > 0) {
            const row = existing.rows[0];
            const currentId = typeof row.id === 'number' && Number.isFinite(row.id)
                ? Math.trunc(row.id)
                : typeof row.id === 'string' && row.id.trim()
                    ? Number.parseInt(row.id.trim(), 10)
                    : null;
            const currentSecret = sanitizeWebhookSecret(row.webhook_secret);
            if (currentId && currentSecret) {
                return;
            }
            const secret = generateWebhookSecret();
            if (currentId) {
                await this.db.query('UPDATE asaas_credentials SET webhook_secret = $1, updated_at = NOW() WHERE id = $2', [secret, currentId]);
                return;
            }
        }
        const secret = generateWebhookSecret();
        await this.db.query(`INSERT INTO asaas_credentials (integration_api_key_id, webhook_secret)
       VALUES ($1, $2)
       ON CONFLICT (integration_api_key_id) DO NOTHING`, [integrationId, secret]);
    }
    async list() {
        const result = await this.db.query(`SELECT id, provider, url_api, key_value, environment, active, last_used, created_at, updated_at
       FROM integration_api_keys WHERE gloabal IS FALSE
       ORDER BY created_at DESC`);
        return result.rows.map(mapRow);
    }
    async create(input) {
        const provider = normalizeProvider(input.provider);
        const environment = normalizeEnvironment(input.environment);
        const apiUrl = resolveApiUrl(provider, environment, input.apiUrl);
        const key = normalizeKey(input.key);
        const active = input.active ?? true;
        const lastUsed = normalizeLastUsed(input.lastUsed);
        const result = await this.db.query(`INSERT INTO integration_api_keys (provider, url_api, key_value, environment, active, last_used)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, provider, url_api, key_value, environment, active, last_used, created_at, updated_at`, [provider, apiUrl, key, environment, active, lastUsed]);
        const mapped = mapRow(result.rows[0]);
        if (mapped.provider === 'asaas') {
            await this.ensureAsaasCredential(mapped.id);
        }
        return mapped;
    }
    async update(id, updates) {
        const fields = [];
        const values = [];
        let index = 1;
        let provider;
        if (updates.provider !== undefined) {
            provider = normalizeProvider(updates.provider);
            fields.push(`provider = $${index}`);
            values.push(provider);
            index += 1;
        }
        let environment;
        if (updates.environment !== undefined) {
            environment = normalizeEnvironment(updates.environment);
            fields.push(`environment = $${index}`);
            values.push(environment);
            index += 1;
        }
        if (updates.apiUrl !== undefined) {
            let resolvedProvider = provider;
            let resolvedEnvironment = environment;
            if (!resolvedProvider || !resolvedEnvironment) {
                const currentResult = await this.db.query('SELECT provider, environment FROM integration_api_keys WHERE id = $1', [id]);
                if (currentResult.rowCount === 0) {
                    return null;
                }
                const currentRow = currentResult.rows[0];
                if (!resolvedProvider) {
                    resolvedProvider = normalizeProvider(currentRow.provider);
                }
                if (!resolvedEnvironment) {
                    resolvedEnvironment = normalizeEnvironment(currentRow.environment);
                }
            }
            if (!resolvedProvider || !resolvedEnvironment) {
                throw new ValidationError('Unable to resolve provider and environment for API URL');
            }
            const apiUrl = resolveApiUrl(resolvedProvider, resolvedEnvironment, updates.apiUrl);
            fields.push(`url_api = $${index}`);
            values.push(apiUrl);
            index += 1;
        }
        if (updates.key !== undefined) {
            const key = normalizeKey(updates.key);
            fields.push(`key_value = $${index}`);
            values.push(key);
            index += 1;
        }
        if (updates.active !== undefined) {
            fields.push(`active = $${index}`);
            values.push(Boolean(updates.active));
            index += 1;
        }
        if (updates.lastUsed !== undefined) {
            const lastUsed = normalizeLastUsed(updates.lastUsed);
            fields.push(`last_used = $${index}`);
            values.push(lastUsed);
            index += 1;
        }
        if (fields.length === 0) {
            throw new ValidationError('No fields provided to update');
        }
        const query = `UPDATE integration_api_keys
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${index}
      RETURNING id, provider, url_api, key_value, environment, active, last_used, created_at, updated_at`;
        values.push(id);
        const result = await this.db.query(query, values);
        if (result.rowCount === 0) {
            return null;
        }
        return mapRow(result.rows[0]);
    }
    async delete(id) {
        const result = await this.db.query('DELETE FROM integration_api_keys WHERE id = $1', [id]);
        return result.rowCount > 0;
    }
    async findById(id) {
        if (!Number.isInteger(id) || id <= 0) {
            return null;
        }
        const result = await this.db.query(`SELECT id, provider, url_api, key_value, environment, active, last_used, created_at, updated_at
       FROM integration_api_keys
       WHERE id = $1`, [id]);
        if (result.rowCount === 0) {
            return null;
        }
        const mapped = mapRow(result.rows[0]);
        if (mapped.provider === 'asaas') {
            await this.ensureAsaasCredential(mapped.id);
        }
        return mapped;
    }
}
exports.default = IntegrationApiKeyService;
