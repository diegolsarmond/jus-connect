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
const fetchPerfilModules = async (perfilId) => {
    if (perfilId == null) {
        return [];
    }
    const result = await db_1.default.query('SELECT pm.modulo FROM public.perfil_modulos pm WHERE pm.perfil_id = $1', [perfilId]);
    const uniqueModules = new Set();
    for (const row of result.rows) {
        if (typeof row.modulo === 'string') {
            uniqueModules.add(row.modulo);
        }
    }
    return (0, modules_1.sortModules)(Array.from(uniqueModules));
};
exports.fetchPerfilModules = fetchPerfilModules;
const fetchUserModules = async (userId) => {
    const result = await db_1.default.query('SELECT perfil FROM public.usuarios WHERE id = $1 LIMIT 1', [userId]);
    if (result.rowCount === 0) {
        return [];
    }
    const perfilId = normalizePerfilId(result.rows[0]?.perfil);
    return (0, exports.fetchPerfilModules)(perfilId);
};
exports.fetchUserModules = fetchUserModules;
