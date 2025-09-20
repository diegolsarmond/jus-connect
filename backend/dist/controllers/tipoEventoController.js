"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteTipoEvento = exports.updateTipoEvento = exports.createTipoEvento = exports.listTiposEvento = void 0;
const db_1 = __importDefault(require("../services/db"));
const authUser_1 = require("../utils/authUser");
const listTiposEvento = async (req, res) => {
    try {
        if (!req.auth) {
            return res.status(401).json({ error: 'Token inválido.' });
        }
        const empresaLookup = await (0, authUser_1.fetchAuthenticatedUserEmpresa)(req.auth.userId);
        if (!empresaLookup.success) {
            return res.status(empresaLookup.status).json({ error: empresaLookup.message });
        }
        const { empresaId } = empresaLookup;
        if (empresaId === null) {
            return res.json([]);
        }
        const result = await db_1.default.query('SELECT id, nome, ativo, datacriacao, agenda, tarefa FROM public.tipo_evento WHERE idempresa IS NOT DISTINCT FROM $1', [empresaId]);
        return res.json(result.rows);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.listTiposEvento = listTiposEvento;
const createTipoEvento = async (req, res) => {
    const { nome, ativo, agenda = true, tarefa = true } = req.body;
    try {
        if (!req.auth) {
            return res.status(401).json({ error: 'Token inválido.' });
        }
        const empresaLookup = await (0, authUser_1.fetchAuthenticatedUserEmpresa)(req.auth.userId);
        if (!empresaLookup.success) {
            return res.status(empresaLookup.status).json({ error: empresaLookup.message });
        }
        const { empresaId } = empresaLookup;
        if (empresaId === null) {
            return res
                .status(400)
                .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
        }
        const result = await db_1.default.query('INSERT INTO public.tipo_evento (nome, ativo, agenda, tarefa, datacriacao, idempresa) VALUES ($1, $2, $3, $4, NOW(), $5) RETURNING id, nome, ativo, agenda, tarefa, datacriacao', [nome, ativo, agenda, tarefa, empresaId]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.createTipoEvento = createTipoEvento;
const updateTipoEvento = async (req, res) => {
    const { id } = req.params;
    const { nome, ativo, agenda = true, tarefa = true } = req.body;
    try {
        if (!req.auth) {
            return res.status(401).json({ error: 'Token inválido.' });
        }
        const empresaLookup = await (0, authUser_1.fetchAuthenticatedUserEmpresa)(req.auth.userId);
        if (!empresaLookup.success) {
            return res.status(empresaLookup.status).json({ error: empresaLookup.message });
        }
        const { empresaId } = empresaLookup;
        if (empresaId === null) {
            return res
                .status(400)
                .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
        }
        const result = await db_1.default.query('UPDATE public.tipo_evento SET nome = $1, ativo = $2, agenda = $3, tarefa = $4 WHERE id = $5 AND idempresa IS NOT DISTINCT FROM $6 RETURNING id, nome, ativo, agenda, tarefa, datacriacao', [nome, ativo, agenda, tarefa, id, empresaId]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Tipo de evento não encontrado' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateTipoEvento = updateTipoEvento;
const deleteTipoEvento = async (req, res) => {
    const { id } = req.params;
    try {
        if (!req.auth) {
            return res.status(401).json({ error: 'Token inválido.' });
        }
        const empresaLookup = await (0, authUser_1.fetchAuthenticatedUserEmpresa)(req.auth.userId);
        if (!empresaLookup.success) {
            return res.status(empresaLookup.status).json({ error: empresaLookup.message });
        }
        const { empresaId } = empresaLookup;
        if (empresaId === null) {
            return res
                .status(400)
                .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
        }
        const result = await db_1.default.query('DELETE FROM public.tipo_evento WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2', [id, empresaId]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Tipo de evento não encontrado' });
        }
        res.status(204).send();
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.deleteTipoEvento = deleteTipoEvento;
