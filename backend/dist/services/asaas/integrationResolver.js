"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AsaasIntegrationNotConfiguredError = exports.ASAAS_DEFAULT_BASE_URLS = void 0;
exports.resolveAsaasIntegration = resolveAsaasIntegration;
exports.createAsaasClient = createAsaasClient;
const db_1 = __importDefault(require("../db"));
const asaasClient_1 = __importDefault(require("./asaasClient"));
exports.ASAAS_DEFAULT_BASE_URLS = {
    producao: 'https://www.asaas.com/api/v3',
    homologacao: 'https://sandbox.asaas.com/api/v3',
};
class AsaasIntegrationNotConfiguredError extends Error {
    constructor(message = 'Asaas integration credentials are not configured') {
        super(message);
        this.name = 'AsaasIntegrationNotConfiguredError';
    }
}
exports.AsaasIntegrationNotConfiguredError = AsaasIntegrationNotConfiguredError;
function normalizeEnvironment(value) {
    if (value && value.trim().toLowerCase() === 'producao') {
        return 'producao';
    }
    return 'homologacao';
}
function normalizeBaseUrl(environment, apiUrl) {
    if (apiUrl) {
        const trimmed = apiUrl.trim();
        if (trimmed) {
            return trimmed.replace(/\/$/, '');
        }
    }
    return exports.ASAAS_DEFAULT_BASE_URLS[environment];
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
async function resolveAsaasIntegration(db = db_1.default) {
    const result = await db.query(`SELECT id, provider, url_api, key_value, environment, active
     FROM integration_api_keys
     WHERE provider = $1 AND active = TRUE
     ORDER BY updated_at DESC
     LIMIT 1`, ['asaas']);
    if (!result.rowCount) {
        throw new AsaasIntegrationNotConfiguredError();
    }
    const row = result.rows[0];
    const environment = normalizeEnvironment(row.environment);
    const baseUrl = normalizeBaseUrl(environment, row.url_api);
    const accessToken = normalizeToken(row.key_value);
    return { baseUrl, accessToken, environment };
}
async function createAsaasClient(db = db_1.default, overrides = {}) {
    const integration = await resolveAsaasIntegration(db);
    return new asaasClient_1.default({
        baseUrl: integration.baseUrl,
        accessToken: integration.accessToken,
        ...overrides,
    });
}
exports.default = resolveAsaasIntegration;
