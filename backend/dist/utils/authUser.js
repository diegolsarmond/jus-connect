"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchAuthenticatedUserEmpresa = void 0;
const db_1 = __importDefault(require("../services/db"));
const parseOptionalInteger = (value) => {
    if (value === undefined || value === null) {
        return null;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed === '') {
            return null;
        }
        const parsed = Number(trimmed);
        if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
            return 'invalid';
        }
        return parsed;
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value) || !Number.isInteger(value)) {
            return 'invalid';
        }
        return value;
    }
    return 'invalid';
};
const fetchAuthenticatedUserEmpresa = async (userId) => {
    const empresaUsuarioResult = await db_1.default.query('SELECT empresa FROM public.usuarios WHERE id = $1 LIMIT 1', [userId]);
    if (empresaUsuarioResult.rowCount === 0) {
        return {
            success: false,
            status: 404,
            message: 'Usuário autenticado não encontrado',
        };
    }
    const empresaAtualResult = parseOptionalInteger(empresaUsuarioResult.rows[0].empresa);
    if (empresaAtualResult === 'invalid') {
        return {
            success: false,
            status: 500,
            message: 'Não foi possível identificar a empresa do usuário autenticado.',
        };
    }
    return {
        success: true,
        empresaId: empresaAtualResult,
    };
};
exports.fetchAuthenticatedUserEmpresa = fetchAuthenticatedUserEmpresa;
