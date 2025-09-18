"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorizeModules = void 0;
const moduleService_1 = require("../services/moduleService");
const modules_1 = require("../constants/modules");
const normalizeRequiredModules = (value) => {
    if (Array.isArray(value)) {
        return value;
    }
    return [value];
};
const authorizeModules = (required) => {
    const requiredModuleSet = new Set();
    for (const moduleId of normalizeRequiredModules(required)) {
        if (typeof moduleId !== 'string') {
            continue;
        }
        const trimmed = moduleId.trim();
        if (!trimmed) {
            continue;
        }
        requiredModuleSet.add(trimmed);
        const normalized = (0, modules_1.normalizeModuleId)(trimmed);
        if (normalized) {
            requiredModuleSet.add(normalized);
        }
    }
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
            const userModules = new Set();
            for (const moduleId of req.auth.modules ?? []) {
                if (typeof moduleId !== 'string') {
                    continue;
                }
                const trimmed = moduleId.trim();
                if (!trimmed) {
                    continue;
                }
                userModules.add(trimmed);
                const normalized = (0, modules_1.normalizeModuleId)(trimmed);
                if (normalized) {
                    userModules.add(normalized);
                }
            }
            const hasAccess = requiredModuleSet.size === 0
                ? true
                : Array.from(requiredModuleSet).some((moduleId) => userModules.has(moduleId));
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
