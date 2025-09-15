"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSituacaoCliente = exports.updateSituacaoCliente = exports.createSituacaoCliente = exports.listSituacaoClientes = void 0;
const db_1 = __importDefault(require("../services/db"));
const listSituacaoClientes = async (_req, res) => {
    try {
        const result = await db_1.default.query('SELECT id, nome, ativo, datacriacao FROM public.situacao_cliente');
        res.json(result.rows);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.listSituacaoClientes = listSituacaoClientes;
const createSituacaoCliente = async (req, res) => {
    const { nome, ativo } = req.body;
    try {
        const result = await db_1.default.query('INSERT INTO public.situacao_cliente (nome, ativo, datacriacao) VALUES ($1, $2, NOW()) RETURNING id, nome, ativo, datacriacao', [nome, ativo]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.createSituacaoCliente = createSituacaoCliente;
const updateSituacaoCliente = async (req, res) => {
    const { id } = req.params;
    const { nome, ativo } = req.body;
    try {
        const result = await db_1.default.query('UPDATE public.situacao_cliente SET nome = $1, ativo = $2 WHERE id = $3 RETURNING id, nome, ativo, datacriacao', [nome, ativo, id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Situação do cliente não encontrada' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateSituacaoCliente = updateSituacaoCliente;
const deleteSituacaoCliente = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db_1.default.query('DELETE FROM public.situacao_cliente WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Situação do cliente não encontrada' });
        }
        res.status(204).send();
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.deleteSituacaoCliente = deleteSituacaoCliente;
