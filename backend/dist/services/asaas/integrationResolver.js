"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeAsaasEnvironment = exports.normalizeAsaasBaseUrl = exports.ASAAS_DEFAULT_BASE_URLS = exports.AsaasIntegrationNotConfiguredError = void 0;
exports.resolveAsaasIntegration = resolveAsaasIntegration;
exports.createAsaasClient = createAsaasClient;
const db_1 = __importDefault(require("../db"));
const asaasClient_1 = __importDefault(require("./asaasClient"));
const urlNormalization_1 = require("./urlNormalization");
Object.defineProperty(exports, "ASAAS_DEFAULT_BASE_URLS", { enumerable: true, get: function () { return urlNormalization_1.ASAAS_DEFAULT_BASE_URLS; } });
Object.defineProperty(exports, "normalizeAsaasBaseUrl", { enumerable: true, get: function () { return urlNormalization_1.normalizeAsaasBaseUrl; } });
Object.defineProperty(exports, "normalizeAsaasEnvironment", { enumerable: true, get: function () { return urlNormalization_1.normalizeAsaasEnvironment; } });
class AsaasIntegrationNotConfiguredError extends Error {
    constructor(message = 'Asaas integration credentials are not configured') {
        super(message);
        this.name = 'AsaasIntegrationNotConfiguredError';
    }
}
exports.AsaasIntegrationNotConfiguredError = AsaasIntegrationNotConfiguredError;
async function findCredentialId(db, integrationId) {
    const result = await db.query('SELECT id FROM asaas_credentials WHERE integration_api_key_id = $1', [
        integrationId,
    ]);
    if (result.rowCount === 0) {
        return null;
    }
    const rawId = result.rows[0]?.id;
    if (typeof rawId === 'number' && Number.isFinite(rawId)) {
        return Math.trunc(rawId);
    }
    if (typeof rawId === 'string' && rawId.trim()) {
        const parsed = Number.parseInt(rawId.trim(), 10);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return null;
}
function resolveBooleanEnv(name, fallback) {
    const raw = process.env[name];
    if (typeof raw !== 'string') {
        return fallback;
    }
    const normalized = raw.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on', 'habilitado', 'enabled'].includes(normalized)) {
        return true;
    }
    if (['0', 'false', 'no', 'off', 'desabilitado', 'disabled'].includes(normalized)) {
        return false;
    }
    return fallback;
}
function normalizeToken(token) {
    if (!token) {
        throw new AsaasIntegrationNotConfiguredError('Active Asaas credential is missing access token');
    }
    const trimmed = token.trim();
    if (!trimmed) {
        throw new AsaasIntegrationNotConfiguredError('Active Asaas credential is missing access token');
    }
    return trimmed;
}
function assertValidEmpresaId(empresaId) {
    if (!Number.isInteger(empresaId) || empresaId <= 0) {
        throw new AsaasIntegrationNotConfiguredError('Identificador de empresa inválido para integração do Asaas');
    }
}
async function resolveAsaasIntegration(empresaId, db = db_1.default) {
    assertValidEmpresaId(empresaId);
    const allowLegacyFallback = resolveBooleanEnv('ASAAS_ALLOW_LEGACY_CREDENTIAL_FALLBACK', true);
    const result = await db.query(`SELECT id, provider, url_api, key_value, environment, active
     FROM integration_api_keys
     WHERE provider = $1
       AND active = TRUE
       AND (global IS TRUE OR idempresa = $2)
     ORDER BY updated_at DESC
     LIMIT 1`, ['asaas', empresaId]);
    let row = null;
    if (result.rowCount > 0) {
        row = result.rows[0];
    }
    else {
        if (!allowLegacyFallback) {
            console.warn('[Asaas] Nenhuma credencial global encontrada e fallback legado está desabilitado.');
            throw new AsaasIntegrationNotConfiguredError();
        }
        console.warn('[Asaas] Nenhuma credencial global encontrada. Aplicando fallback legado.');
        const legacyResult = await db.query(`SELECT id, provider, url_api, key_value, environment, active
       FROM integration_api_keys
       WHERE provider = $1 AND active = TRUE
       ORDER BY updated_at DESC
       LIMIT 1`, ['asaas']);
        if (!legacyResult.rowCount) {
            console.warn('[Asaas] Fallback legado não encontrou credenciais ativas para o Asaas.');
            throw new AsaasIntegrationNotConfiguredError();
        }
        row = legacyResult.rows[0];
    }
    if (!row) {
        throw new AsaasIntegrationNotConfiguredError();
    }
    const environment = (0, urlNormalization_1.normalizeAsaasEnvironment)(row.environment);
    const baseUrl = (0, urlNormalization_1.normalizeAsaasBaseUrl)(environment, row.url_api);
    const accessToken = normalizeToken(row.key_value);
    const credentialId = await findCredentialId(db, row.id);
    return { baseUrl, accessToken, environment, integrationId: row.id, credentialId };
}
async function createAsaasClient(empresaId, db = db_1.default, overrides = {}) {
    const integration = await resolveAsaasIntegration(empresaId, db);
    return new asaasClient_1.default({
        baseUrl: integration.baseUrl,
        accessToken: integration.accessToken,
        ...overrides,
    });
}
exports.default = resolveAsaasIntegration;
