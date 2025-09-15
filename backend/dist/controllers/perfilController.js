"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deletePerfil = exports.updatePerfil = exports.createPerfil = exports.listPerfis = void 0;
const db_1 = __importDefault(require("../services/db"));
const listPerfis = async (_req, res) => {
    try {
        const result = await db_1.default.query('SELECT id, nome, ativo, datacriacao FROM public.perfis');
        res.json(result.rows);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.listPerfis = listPerfis;
const createPerfil = async (req, res) => {
    const { nome, ativo } = req.body;
    try {
        const result = await db_1.default.query('INSERT INTO public.perfis (nome, ativo, datacriacao) VALUES ($1, $2, NOW()) RETURNING id, nome, ativo, datacriacao', [nome, ativo]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.createPerfil = createPerfil;
const updatePerfil = async (req, res) => {
    const { id } = req.params;
    const { nome, ativo } = req.body;
    try {
        const result = await db_1.default.query('UPDATE public.perfis SET nome = $1, ativo = $2 WHERE id = $3 RETURNING id, nome, ativo, datacriacao', [nome, ativo, id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Perfil não encontrado' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updatePerfil = updatePerfil;
const deletePerfil = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db_1.default.query('DELETE FROM public.perfis WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Perfil não encontrado' });
        }
        res.status(204).send();
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.deletePerfil = deletePerfil;
