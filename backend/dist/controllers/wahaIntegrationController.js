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
exports.getWahaConfigHandler = getWahaConfigHandler;
exports.updateWahaConfigHandler = updateWahaConfigHandler;
const wahaConfigService_1 = __importStar(require("../services/wahaConfigService"));
const configService = new wahaConfigService_1.default();
function parseUpsertPayload(body) {
    if (!body || typeof body !== 'object') {
        throw new wahaConfigService_1.ValidationError('Request body must be an object');
    }
    return {
        baseUrl: typeof body.baseUrl === 'string' ? body.baseUrl : '',
        apiKey: typeof body.apiKey === 'string' ? body.apiKey : '',
        webhookSecret: typeof body.webhookSecret === 'string' ? body.webhookSecret : undefined,
        isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
    };
}
async function getWahaConfigHandler(_req, res) {
    try {
        const config = await configService.getConfig();
        res.json(config ?? null);
    }
    catch (error) {
        console.error('Failed to load WAHA configuration', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
async function updateWahaConfigHandler(req, res) {
    try {
        const payload = parseUpsertPayload(req.body);
        const config = await configService.saveConfig(payload);
        res.json(config);
    }
    catch (error) {
        if (error instanceof wahaConfigService_1.ValidationError) {
            return res.status(400).json({ error: error.message });
        }
        console.error('Failed to save WAHA configuration', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
