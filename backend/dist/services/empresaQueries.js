"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryEmpresas = void 0;
const db_1 = __importDefault(require("./db"));
const EMPRESA_QUERY_SOURCES = [
    {
        label: 'view',
        text: 'SELECT id, nome_empresa, cnpj, telefone, email, plano, responsavel, ativo, datacadastro, trial_started_at, trial_ends_at, current_period_start, current_period_end, grace_expires_at, subscription_trial_ends_at, subscription_current_period_ends_at, subscription_grace_period_ends_at, subscription_cadence, NULL::timestamp AS atualizacao FROM public."empresas"',
    },
    {
        label: 'table',
        text: 'SELECT id, nome_empresa, cnpj, telefone, email, plano, responsavel, ativo, datacadastro, trial_started_at, trial_ends_at, current_period_start, current_period_end, grace_expires_at, subscription_trial_ends_at, subscription_current_period_ends_at, subscription_grace_period_ends_at, subscription_cadence, NULL::timestamp AS atualizacao FROM public.empresas',
    },
];
const isRecoverableEmpresasError = (error) => {
    if (!error || typeof error !== 'object') {
        return false;
    }
    const { code } = error;
    return code === '42P01' || code === '42703';
};
const queryEmpresas = async (whereClause = '', params = []) => {
    let lastError;
    for (const { label, text } of EMPRESA_QUERY_SOURCES) {
        try {
            const sql = whereClause ? `${text} ${whereClause}` : text;
            const queryParams = Array.from(params);
            return await db_1.default.query(sql, queryParams);
        }
        catch (error) {
            if (!isRecoverableEmpresasError(error)) {
                throw error;
            }
            lastError = error;
            console.warn(`Empresas query via ${label} failed, attempting fallback to alternative source.`, error);
        }
    }
    throw lastError ?? new Error('Falha ao consultar dados de empresas');
};
exports.queryEmpresas = queryEmpresas;
