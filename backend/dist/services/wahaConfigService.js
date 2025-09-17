"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationError = void 0;
const db_1 = __importDefault(require("./db"));
class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
function stripKnownSuffixes(pathname) {
    let result = pathname;
    const suffixes = [
        /\/v1\/messages$/i,
        /\/v1$/i,
        /\/api\/send[a-z]+$/i,
        /\/api$/i,
    ];
    let updated = true;
    while (updated) {
        updated = false;
        for (const suffix of suffixes) {
            if (suffix.test(result)) {
                result = result.replace(suffix, '');
                updated = true;
            }
        }
    }
    return result.replace(/\/$/, '');
}
function normalizeBaseUrl(value) {
    if (typeof value !== 'string') {
        throw new ValidationError('baseUrl is required');
    }
    const trimmed = value.trim();
    if (!trimmed) {
        throw new ValidationError('baseUrl is required');
    }
    let parsed;
    try {
        parsed = new URL(trimmed);
    }
    catch (error) {
        throw new ValidationError('baseUrl must be a valid URL');
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new ValidationError('baseUrl must use http or https');
    }
    parsed.pathname = stripKnownSuffixes(parsed.pathname);
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
}
function normalizeApiKey(value) {
    if (typeof value !== 'string') {
        throw new ValidationError('apiKey is required');
    }
    const trimmed = value.trim();
    if (!trimmed) {
        throw new ValidationError('apiKey is required');
    }
    return trimmed;
}
function normalizeSecret(value) {
    if (value === undefined || value === null) {
        return null;
    }
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}
function formatDate(value) {
    if (value instanceof Date) {
        return value.toISOString();
    }
    return new Date(value).toISOString();
}
function mapRow(row) {
    return {
        baseUrl: row.base_url,
        apiKey: row.api_key,
        webhookSecret: row.webhook_secret,
        isActive: row.is_active,
        createdAt: formatDate(row.created_at),
        updatedAt: formatDate(row.updated_at),
    };
}
class WahaConfigService {
    constructor(db = db_1.default) {
        this.db = db;
    }
    async getConfig() {
        const result = await this.db.query(`SELECT id, base_url, api_key, webhook_secret, is_active, created_at, updated_at
         FROM waha_settings
         WHERE id = 1`);
        if (result.rowCount === 0) {
            return null;
        }
        return mapRow(result.rows[0]);
    }
    async requireConfig() {
        const config = await this.getConfig();
        if (!config) {
            throw new ValidationError('WAHA integration is not configured');
        }
        if (!config.isActive) {
            throw new ValidationError('WAHA integration is disabled');
        }
        return config;
    }
    async saveConfig(input) {
        const baseUrl = normalizeBaseUrl(input.baseUrl);
        const apiKey = normalizeApiKey(input.apiKey);
        const webhookSecret = normalizeSecret(input.webhookSecret ?? null);
        const isActive = input.isActive ?? true;
        const result = await this.db.query(`INSERT INTO waha_settings (id, base_url, api_key, webhook_secret, is_active)
       VALUES (1, $1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE
         SET base_url = EXCLUDED.base_url,
             api_key = EXCLUDED.api_key,
             webhook_secret = EXCLUDED.webhook_secret,
             is_active = EXCLUDED.is_active
       RETURNING id, base_url, api_key, webhook_secret, is_active, created_at, updated_at`, [baseUrl, apiKey, webhookSecret, isActive]);
        return mapRow(result.rows[0]);
    }
}
exports.default = WahaConfigService;
