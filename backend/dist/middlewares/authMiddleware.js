"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateRequest = void 0;
const auth_1 = require("../constants/auth");
const tokenUtils_1 = require("../utils/tokenUtils");
const extractBearerToken = (authorizationHeader) => {
    if (!authorizationHeader) {
        return null;
    }
    const [scheme, token] = authorizationHeader.split(' ');
    if (!scheme || !token) {
        return null;
    }
    if (scheme.toLowerCase() !== 'bearer') {
        return null;
    }
    return token.trim() || null;
};
const authenticateRequest = (req, res, next) => {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
        res.status(401).json({ error: 'Token de autenticação ausente.' });
        return;
    }
    try {
        const payload = (0, tokenUtils_1.verifyToken)(token, auth_1.authConfig.secret);
        if (typeof payload.sub !== 'string' && typeof payload.sub !== 'number') {
            res.status(401).json({ error: 'Token inválido.' });
            return;
        }
        const userId = typeof payload.sub === 'number'
            ? payload.sub
            : Number.parseInt(payload.sub, 10);
        if (!Number.isFinite(userId)) {
            res.status(401).json({ error: 'Token inválido.' });
            return;
        }
        req.auth = {
            userId,
            email: typeof payload.email === 'string' ? payload.email : undefined,
            payload,
        };
        next();
    }
    catch (error) {
        console.error('Falha ao validar token de autenticação', error);
        res.status(401).json({ error: 'Token inválido ou expirado.' });
    }
};
exports.authenticateRequest = authenticateRequest;
