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
exports.revokeAllMySessions = exports.revokeMySession = exports.listMySessions = exports.listMyAuditLogs = exports.updateMyProfile = exports.getMyProfile = void 0;
const userProfileService_1 = __importStar(require("../services/userProfileService"));
const service = new userProfileService_1.default();
const ensureAuthenticatedUserId = (req) => {
    if (!req.auth || !Number.isInteger(req.auth.userId)) {
        return null;
    }
    return req.auth.userId;
};
const extractPerformer = (req) => {
    if (!req.auth) {
        return undefined;
    }
    const performerName = typeof req.auth.payload?.name === 'string' && req.auth.payload.name.trim()
        ? req.auth.payload.name.trim()
        : undefined;
    return { id: req.auth.userId, name: performerName };
};
const handleControllerError = (res, error) => {
    if (error instanceof userProfileService_1.ValidationError) {
        res.status(400).json({ error: error.message });
        return;
    }
    if (error instanceof userProfileService_1.NotFoundError) {
        res.status(404).json({ error: error.message });
        return;
    }
    console.error('Erro ao processar requisição de perfil', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
};
const getMyProfile = async (req, res) => {
    const userId = ensureAuthenticatedUserId(req);
    if (!userId) {
        res.status(401).json({ error: 'Usuário não autenticado.' });
        return;
    }
    try {
        const profile = await service.getProfile(userId);
        res.json(profile);
    }
    catch (error) {
        handleControllerError(res, error);
    }
};
exports.getMyProfile = getMyProfile;
const updateMyProfile = async (req, res) => {
    const userId = ensureAuthenticatedUserId(req);
    if (!userId) {
        res.status(401).json({ error: 'Usuário não autenticado.' });
        return;
    }
    try {
        const payload = req.body;
        const performer = extractPerformer(req);
        const profile = await service.updateProfile(userId, payload, performer);
        res.json(profile);
    }
    catch (error) {
        handleControllerError(res, error);
    }
};
exports.updateMyProfile = updateMyProfile;
const listMyAuditLogs = async (req, res) => {
    const userId = ensureAuthenticatedUserId(req);
    if (!userId) {
        res.status(401).json({ error: 'Usuário não autenticado.' });
        return;
    }
    try {
        const limitParam = req.query.limit;
        const offsetParam = req.query.offset;
        const limit = typeof limitParam === 'string' ? Number.parseInt(limitParam, 10) : undefined;
        const offset = typeof offsetParam === 'string' ? Number.parseInt(offsetParam, 10) : undefined;
        const logs = await service.listAuditLogs(userId, { limit, offset });
        res.json(logs);
    }
    catch (error) {
        handleControllerError(res, error);
    }
};
exports.listMyAuditLogs = listMyAuditLogs;
const listMySessions = async (req, res) => {
    const userId = ensureAuthenticatedUserId(req);
    if (!userId) {
        res.status(401).json({ error: 'Usuário não autenticado.' });
        return;
    }
    try {
        const sessions = await service.listSessions(userId);
        res.json(sessions);
    }
    catch (error) {
        handleControllerError(res, error);
    }
};
exports.listMySessions = listMySessions;
const revokeMySession = async (req, res) => {
    const userId = ensureAuthenticatedUserId(req);
    if (!userId) {
        res.status(401).json({ error: 'Usuário não autenticado.' });
        return;
    }
    const sessionIdParam = req.params.sessionId;
    const sessionId = Number.parseInt(sessionIdParam, 10);
    if (!Number.isInteger(sessionId) || sessionId <= 0) {
        res.status(400).json({ error: 'Sessão inválida.' });
        return;
    }
    try {
        const performer = extractPerformer(req);
        const session = await service.revokeSession(userId, sessionId, performer);
        if (!session) {
            res.status(404).json({ error: 'Sessão não encontrada ou já revogada.' });
            return;
        }
        res.json(session);
    }
    catch (error) {
        handleControllerError(res, error);
    }
};
exports.revokeMySession = revokeMySession;
const revokeAllMySessions = async (req, res) => {
    const userId = ensureAuthenticatedUserId(req);
    if (!userId) {
        res.status(401).json({ error: 'Usuário não autenticado.' });
        return;
    }
    try {
        const performer = extractPerformer(req);
        const revokedCount = await service.revokeAllSessions(userId, performer);
        res.json({ revokedCount });
    }
    catch (error) {
        handleControllerError(res, error);
    }
};
exports.revokeAllMySessions = revokeAllMySessions;
