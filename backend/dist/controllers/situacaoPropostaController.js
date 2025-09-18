"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSituacaoProposta = exports.updateSituacaoProposta = exports.createSituacaoProposta = exports.listSituacoesProposta = void 0;
const db_1 = __importDefault(require("../services/db"));
const listSituacoesProposta = async (_req, res) => {
    try {
        const result = await db_1.default.query('SELECT id, nome, ativo, datacriacao FROM public.situacao_proposta ORDER BY nome ASC');
        res.json(result.rows);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.listSituacoesProposta = listSituacoesProposta;
const createSituacaoProposta = async (req, res) => {
    const { nome, ativo } = req.body;
    try {
        const result = await db_1.default.query('INSERT INTO public.situacao_proposta (nome, ativo, datacriacao) VALUES ($1, $2, NOW()) RETURNING id, nome, ativo, datacriacao', [nome, ativo]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.createSituacaoProposta = createSituacaoProposta;
const updateSituacaoProposta = async (req, res) => {
    const { id } = req.params;
    const { nome, ativo } = req.body;
    try {
        const result = await db_1.default.query('UPDATE public.situacao_proposta SET nome = $1, ativo = $2 WHERE id = $3 RETURNING id, nome, ativo, datacriacao', [nome, ativo, id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Situação de proposta não encontrada' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateSituacaoProposta = updateSituacaoProposta;
const deleteSituacaoProposta = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db_1.default.query('DELETE FROM public.situacao_proposta WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Situação de proposta não encontrada' });
        }
        res.status(204).send();
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.deleteSituacaoProposta = deleteSituacaoProposta;
exports.default = {
    listSituacoesProposta,
    createSituacaoProposta,
    updateSituacaoProposta,
    deleteSituacaoProposta,
};
