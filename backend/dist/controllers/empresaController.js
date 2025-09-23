"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteEmpresa = exports.updateEmpresa = exports.createEmpresa = exports.getEmpresaById = exports.listEmpresas = void 0;
const db_1 = __importDefault(require("../services/db"));
const empresaQueries_1 = require("../services/empresaQueries");
const listEmpresas = async (_req, res) => {
    try {
        const result = await (0, empresaQueries_1.queryEmpresas)();
        res.json(result.rows);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.listEmpresas = listEmpresas;
const getEmpresaById = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await (0, empresaQueries_1.queryEmpresas)('WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Empresa não encontrada' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getEmpresaById = getEmpresaById;
const createEmpresa = async (req, res) => {
    const { nome_empresa, cnpj, telefone, email, plano, responsavel, ativo } = req.body;
    try {
        const result = await db_1.default.query('INSERT INTO public.empresas (nome_empresa, cnpj, telefone, email, plano, responsavel, ativo, datacadastro) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING id, nome_empresa, cnpj, telefone, email, plano, responsavel, ativo, datacadastro', [nome_empresa, cnpj, telefone, email, plano, responsavel, ativo]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.createEmpresa = createEmpresa;
const updateEmpresa = async (req, res) => {
    const { id } = req.params;
    const { nome_empresa, cnpj, telefone, email, plano, responsavel, ativo } = req.body;
    try {
        const result = await db_1.default.query('UPDATE public.empresas SET nome_empresa = $1, cnpj = $2, telefone = $3, email = $4, plano = $5, responsavel = $6, ativo = $7 WHERE id = $8 RETURNING id, nome_empresa, cnpj, telefone, email, plano, responsavel, ativo, datacadastro', [nome_empresa, cnpj, telefone, email, plano, responsavel, ativo, id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Empresa não encontrada' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateEmpresa = updateEmpresa;
const deleteEmpresa = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db_1.default.query('DELETE FROM public.empresas WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Empresa não encontrada' });
        }
        res.status(204).send();
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.deleteEmpresa = deleteEmpresa;
