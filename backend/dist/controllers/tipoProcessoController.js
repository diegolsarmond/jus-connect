"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteTipoProcesso = exports.updateTipoProcesso = exports.createTipoProcesso = exports.listTiposProcesso = void 0;
const db_1 = __importDefault(require("../services/db"));
const authUser_1 = require("../utils/authUser");
const listTiposProcesso = async (req, res) => {
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
        const result = await db_1.default.query('SELECT id, nome, ativo, datacriacao FROM public.tipo_processo WHERE idempresa = $1', [empresaId]);
        return res.json(result.rows);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.listTiposProcesso = listTiposProcesso;
const createTipoProcesso = async (req, res) => {
    const { nome, ativo } = req.body;
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
        const result = await db_1.default.query('INSERT INTO public.tipo_processo (nome, ativo, datacriacao, idempresa) VALUES ($1, COALESCE($2, TRUE), NOW(), $3) RETURNING id, nome, ativo, datacriacao', [nome, ativo, empresaId]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.createTipoProcesso = createTipoProcesso;
const updateTipoProcesso = async (req, res) => {
    const { id } = req.params;
    const { nome, ativo } = req.body;
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
        const result = await db_1.default.query('UPDATE public.tipo_processo SET nome = $1, ativo = COALESCE($2, TRUE) WHERE id = $3 AND idempresa IS NOT DISTINCT FROM $4 RETURNING id, nome, ativo, datacriacao', [nome, ativo, id, empresaId]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Tipo de processo não encontrado' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateTipoProcesso = updateTipoProcesso;
const deleteTipoProcesso = async (req, res) => {
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
        const result = await db_1.default.query('DELETE FROM public.tipo_processo WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2', [id, empresaId]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Tipo de processo não encontrado' });
        }
        res.status(204).send();
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.deleteTipoProcesso = deleteTipoProcesso;
