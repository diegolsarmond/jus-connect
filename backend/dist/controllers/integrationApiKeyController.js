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
exports.listIntegrationApiKeys = listIntegrationApiKeys;
exports.getIntegrationApiKey = getIntegrationApiKey;
exports.createIntegrationApiKey = createIntegrationApiKey;
exports.updateIntegrationApiKey = updateIntegrationApiKey;
exports.deleteIntegrationApiKey = deleteIntegrationApiKey;
const integrationApiKeyService_1 = __importStar(require("../services/integrationApiKeyService"));
const service = new integrationApiKeyService_1.default();
function parseIdParam(param) {
    const value = Number(param);
    if (!Number.isInteger(value) || value <= 0) {
        return null;
    }
    return value;
}
function toOptionalBoolean(value, field) {
    if (value === undefined) {
        return undefined;
    }
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true') {
            return true;
        }
        if (normalized === 'false') {
            return false;
        }
    }
    throw new integrationApiKeyService_1.ValidationError(`${field} must be a boolean value`);
}
function toOptionalDate(value, field) {
    if (value === undefined) {
        return undefined;
    }
    if (value === null || value instanceof Date || typeof value === 'string') {
        return value;
    }
    throw new integrationApiKeyService_1.ValidationError(`${field} must be a string, Date or null`);
}
function toOptionalString(value, field) {
    if (value === undefined) {
        return undefined;
    }
    if (value === null) {
        return null;
    }
    if (typeof value === 'string') {
        return value;
    }
    throw new integrationApiKeyService_1.ValidationError(`${field} must be a string or null`);
}
async function listIntegrationApiKeys(_req, res) {
    try {
        const items = await service.list();
        return res.json(items);
    }
    catch (error) {
        console.error('Failed to list integration API keys:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
async function getIntegrationApiKey(req, res) {
    const apiKeyId = parseIdParam(req.params.id);
    if (!apiKeyId) {
        return res.status(400).json({ error: 'Invalid API key id' });
    }
    try {
        const apiKey = await service.findById(apiKeyId);
        if (!apiKey) {
            return res.status(404).json({ error: 'API key not found' });
        }
        return res.json(apiKey);
    }
    catch (error) {
        console.error('Failed to retrieve integration API key:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
async function createIntegrationApiKey(req, res) {
    const { provider, apiUrl, key, environment, active, lastUsed } = req.body;
    const input = {
        provider: provider ?? '',
        key: key ?? '',
        environment: environment ?? '',
    };
    try {
        const parsedApiUrl = toOptionalString(apiUrl, 'apiUrl');
        if (parsedApiUrl !== undefined) {
            input.apiUrl = parsedApiUrl;
        }
        const parsedActive = toOptionalBoolean(active, 'active');
        if (parsedActive !== undefined) {
            input.active = parsedActive;
        }
        const parsedLastUsed = toOptionalDate(lastUsed, 'lastUsed');
        if (parsedLastUsed !== undefined) {
            input.lastUsed = parsedLastUsed;
        }
        const created = await service.create(input);
        return res.status(201).json(created);
    }
    catch (error) {
        if (error instanceof integrationApiKeyService_1.ValidationError) {
            return res.status(400).json({ error: error.message });
        }
        console.error('Failed to create integration API key:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
async function updateIntegrationApiKey(req, res) {
    const apiKeyId = parseIdParam(req.params.id);
    if (!apiKeyId) {
        return res.status(400).json({ error: 'Invalid API key id' });
    }
    const { provider, apiUrl, key, environment, active, lastUsed } = req.body;
    const updates = {};
    if (provider !== undefined) {
        updates.provider = provider;
    }
    if (key !== undefined) {
        updates.key = key;
    }
    if (environment !== undefined) {
        updates.environment = environment;
    }
    try {
        if (apiUrl !== undefined) {
            updates.apiUrl = toOptionalString(apiUrl, 'apiUrl') ?? null;
        }
        const parsedActive = toOptionalBoolean(active, 'active');
        if (parsedActive !== undefined) {
            updates.active = parsedActive;
        }
        const parsedLastUsed = toOptionalDate(lastUsed, 'lastUsed');
        if (parsedLastUsed !== undefined) {
            updates.lastUsed = parsedLastUsed;
        }
        const updated = await service.update(apiKeyId, updates);
        if (!updated) {
            return res.status(404).json({ error: 'API key not found' });
        }
        return res.json(updated);
    }
    catch (error) {
        if (error instanceof integrationApiKeyService_1.ValidationError) {
            return res.status(400).json({ error: error.message });
        }
        console.error('Failed to update integration API key:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
async function deleteIntegrationApiKey(req, res) {
    const apiKeyId = parseIdParam(req.params.id);
    if (!apiKeyId) {
        return res.status(400).json({ error: 'Invalid API key id' });
    }
    try {
        const deleted = await service.delete(apiKeyId);
        if (!deleted) {
            return res.status(404).json({ error: 'API key not found' });
        }
        return res.status(204).send();
    }
    catch (error) {
        console.error('Failed to delete integration API key:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
