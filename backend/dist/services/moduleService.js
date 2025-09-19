"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchUserModules = exports.fetchPerfilModules = void 0;
const db_1 = __importDefault(require("./db"));
const modules_1 = require("../constants/modules");
const normalizePerfilId = (value) => {
    if (value == null) {
        return null;
    }
    if (typeof value === 'number' && Number.isInteger(value)) {
        return value;
    }
    if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = Number.parseInt(value, 10);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return null;
};
const parsePerfilIdValue = (value) => {
    if (typeof value === 'number' && Number.isInteger(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const parsed = Number.parseInt(value, 10);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return null;
};
const normalizePerfilName = (value) => {
    if (typeof value !== 'string') {
        return '';
    }
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\bperfil\b/gi, ' ')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim()
        .toLowerCase();
};
const findPerfilIdByName = async (name) => {
    const directResult = await db_1.default.query('SELECT id FROM public.perfis WHERE LOWER(nome) = LOWER($1) LIMIT 1', [name]);
    const directRowCount = typeof directResult.rowCount === 'number' ? directResult.rowCount : 0;
    if (directRowCount > 0) {
        const candidate = parsePerfilIdValue(directResult.rows[0]?.id);
        if (candidate != null) {
            return candidate;
        }
    }
    const normalizedTarget = normalizePerfilName(name);
    if (!normalizedTarget) {
        return null;
    }
    const fallbackResult = await db_1.default.query('SELECT id, nome FROM public.perfis');
    for (const row of fallbackResult.rows) {
        const normalizedRowName = normalizePerfilName(row.nome);
        if (!normalizedRowName || normalizedRowName !== normalizedTarget) {
            continue;
        }
        const candidate = parsePerfilIdValue(row.id);
        if (candidate != null) {
            return candidate;
        }
    }
    return null;
};
const resolvePerfilId = async (perfil) => {
    const normalizedId = normalizePerfilId(perfil);
    if (normalizedId != null) {
        return normalizedId;
    }
    if (typeof perfil !== 'string') {
        return null;
    }
    const trimmedPerfil = perfil.trim();
    if (!trimmedPerfil) {
        return null;
    }
    return findPerfilIdByName(trimmedPerfil);
};
const fetchPerfilModules = async (perfil) => {
    const perfilId = await resolvePerfilId(perfil);
    if (perfilId == null || typeof perfilId !== 'number' || !Number.isInteger(perfilId)) {
        return [];
    }
    const result = await db_1.default.query('SELECT pm.modulo FROM public.perfil_modulos pm WHERE pm.perfil_id = $1', [perfilId]);
    const uniqueModules = new Set();
    for (const row of result.rows) {
        if (typeof row.modulo !== 'string') {
            continue;
        }
        const trimmed = row.modulo.trim();
        if (!trimmed) {
            continue;
        }
        const normalized = (0, modules_1.normalizeModuleId)(trimmed);
        if (normalized) {
            uniqueModules.add(normalized);
            continue;
        }
        uniqueModules.add(trimmed);
    }
    return (0, modules_1.sortModules)(Array.from(uniqueModules));
};
exports.fetchPerfilModules = fetchPerfilModules;
const fetchUserModules = async (userId) => {
    const result = await db_1.default.query('SELECT perfil FROM public.usuarios WHERE id = $1 LIMIT 1', [userId]);
    if (result.rowCount === 0) {
        return [];
    }
    return (0, exports.fetchPerfilModules)(result.rows[0]?.perfil);
};
exports.fetchUserModules = fetchUserModules;
