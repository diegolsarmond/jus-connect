"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorizeModules = void 0;
const moduleService_1 = require("../services/moduleService");
const normalizeRequiredModules = (value) => {
    if (Array.isArray(value)) {
        return value;
    }
    return [value];
};
const authorizeModules = (required) => {
    const requiredModules = normalizeRequiredModules(required).filter((moduleId) => typeof moduleId === 'string');
    return async (req, res, next) => {
        if (!req.auth) {
            res.status(401).json({ error: 'Token inválido.' });
            return;
        }
        try {
            if (!req.auth.modules) {
                const modules = await (0, moduleService_1.fetchUserModules)(req.auth.userId);
                req.auth.modules = modules;
            }
            const userModules = req.auth.modules ?? [];
            const hasAccess = requiredModules.length === 0
                ? true
                : requiredModules.some((moduleId) => userModules.includes(moduleId));
            if (!hasAccess) {
                res.status(403).json({ error: 'Acesso negado.' });
                return;
            }
            next();
        }
        catch (error) {
            console.error('Erro ao validar módulos do usuário', error);
            res.status(500).json({ error: 'Não foi possível validar as permissões do usuário.' });
        }
    };
};
exports.authorizeModules = authorizeModules;
