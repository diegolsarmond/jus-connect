"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.countCompanyResource = exports.fetchPlanLimitsForCompany = void 0;
const db_1 = __importDefault(require("./db"));
const toInteger = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.trunc(value);
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }
        const parsed = Number.parseInt(trimmed, 10);
        if (Number.isFinite(parsed)) {
            return Math.trunc(parsed);
        }
    }
    return null;
};
const toNonNegativeLimit = (value) => {
    const parsed = toInteger(value);
    if (parsed === null) {
        return null;
    }
    if (parsed < 0) {
        return 0;
    }
    return parsed;
};
const toBoolean = (value) => {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value !== 0;
    }
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (!normalized) {
            return null;
        }
        if (['1', 'true', 't', 'yes', 'y', 'sim', 'ativo', 'on'].includes(normalized)) {
            return true;
        }
        if (['0', 'false', 'f', 'no', 'n', 'nao', 'não', 'inativo', 'off'].includes(normalized)) {
            return false;
        }
    }
    return null;
};
const parseCount = (value) => {
    const parsed = toInteger(value);
    return parsed !== null && parsed >= 0 ? parsed : 0;
};
const fetchPlanLimitsForCompany = async (companyId) => {
    if (!Number.isInteger(companyId) || companyId <= 0) {
        return null;
    }
    const result = await db_1.default.query(`SELECT pl.limite_usuarios,
            pl.limite_processos,
            pl.limite_propostas,
            pl.sincronizacao_processos_habilitada,
            pl.sincronizacao_processos_cota
       FROM public.empresas emp
       LEFT JOIN public.planos pl ON pl.id::text = emp.plano::text
      WHERE emp.id = $1
      LIMIT 1`, [companyId]);
    if (result.rowCount === 0) {
        return null;
    }
    const row = result.rows[0];
    return {
        limiteUsuarios: toNonNegativeLimit(row.limite_usuarios),
        limiteProcessos: toNonNegativeLimit(row.limite_processos),
        limitePropostas: toNonNegativeLimit(row.limite_propostas),
        sincronizacaoProcessosHabilitada: toBoolean(row.sincronizacao_processos_habilitada),
        sincronizacaoProcessosCota: toNonNegativeLimit(row.sincronizacao_processos_cota),
    };
};
exports.fetchPlanLimitsForCompany = fetchPlanLimitsForCompany;
const RESOURCE_QUERIES = {
    usuarios: 'SELECT COUNT(*)::bigint AS total FROM public.usuarios WHERE empresa IS NOT DISTINCT FROM $1',
    processos: 'SELECT COUNT(*)::bigint AS total FROM public.processos WHERE idempresa IS NOT DISTINCT FROM $1',
    propostas: 'SELECT COUNT(*)::bigint AS total FROM public.oportunidades WHERE idempresa IS NOT DISTINCT FROM $1',
};
const countCompanyResource = async (companyId, resource) => {
    if (!Number.isInteger(companyId) || companyId <= 0) {
        return 0;
    }
    const query = RESOURCE_QUERIES[resource];
    const result = await db_1.default.query(query, [companyId]);
    if (result.rowCount === 0) {
        return 0;
    }
    return parseCount(result.rows[0]?.total);
};
exports.countCompanyResource = countCompanyResource;
