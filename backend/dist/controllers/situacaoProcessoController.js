"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSituacaoProcesso = exports.updateSituacaoProcesso = exports.createSituacaoProcesso = exports.listSituacoesProcesso = void 0;
const db_1 = __importDefault(require("../services/db"));
const listSituacoesProcesso = async (_req, res) => {
    try {
        const result = await db_1.default.query('SELECT id, nome, ativo, datacriacao FROM public.situacao_processo');
        res.json(result.rows);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.listSituacoesProcesso = listSituacoesProcesso;
const createSituacaoProcesso = async (req, res) => {
    const { nome, ativo } = req.body;
    try {
        const result = await db_1.default.query('INSERT INTO public.situacao_processo (nome, ativo, datacriacao) VALUES ($1, $2, NOW()) RETURNING id, nome, ativo, datacriacao', [nome, ativo]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.createSituacaoProcesso = createSituacaoProcesso;
const updateSituacaoProcesso = async (req, res) => {
    const { id } = req.params;
    const { nome, ativo } = req.body;
    try {
        const result = await db_1.default.query('UPDATE public.situacao_processo SET nome = $1, ativo = $2 WHERE id = $3 RETURNING id, nome, ativo, datacriacao', [nome, ativo, id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Situação de processo não encontrada' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateSituacaoProcesso = updateSituacaoProcesso;
const deleteSituacaoProcesso = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db_1.default.query('DELETE FROM public.situacao_processo WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Situação de processo não encontrada' });
        }
        res.status(204).send();
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.deleteSituacaoProcesso = deleteSituacaoProcesso;
