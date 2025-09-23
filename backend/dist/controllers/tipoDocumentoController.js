"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteTipoDocumento = exports.updateTipoDocumento = exports.createTipoDocumento = exports.listTiposDocumento = void 0;
const db_1 = __importDefault(require("../services/db"));
const authUser_1 = require("../utils/authUser");
const getAuthenticatedUser = (req, res) => {
    if (!req.auth) {
        res.status(401).json({ error: 'Token inválido.' });
        return null;
    }
    return req.auth;
};
const listTiposDocumento = async (req, res) => {
    try {
        const auth = getAuthenticatedUser(req, res);
        if (!auth) {
            return;
        }
        const empresaLookup = await (0, authUser_1.fetchAuthenticatedUserEmpresa)(auth.userId);
        if (!empresaLookup.success) {
            res
                .status(empresaLookup.status)
                .json({ error: empresaLookup.message });
            return;
        }
        const { empresaId } = empresaLookup;
        if (empresaId === null) {
            res.json([]);
            return;
        }
        const result = await db_1.default.query('SELECT id, nome, ativo, datacriacao FROM public.tipo_documento WHERE idempresa = $1', [empresaId]);
        res.json(result.rows);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.listTiposDocumento = listTiposDocumento;
const createTipoDocumento = async (req, res) => {
    const { nome, ativo } = req.body;
    const ativoValue = typeof ativo === 'boolean' ? ativo : true;
    try {
        const auth = getAuthenticatedUser(req, res);
        if (!auth) {
            return;
        }
        const empresaLookup = await (0, authUser_1.fetchAuthenticatedUserEmpresa)(auth.userId);
        if (!empresaLookup.success) {
            res
                .status(empresaLookup.status)
                .json({ error: empresaLookup.message });
            return;
        }
        const { empresaId } = empresaLookup;
        if (empresaId === null) {
            res
                .status(400)
                .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
            return;
        }
        const result = await db_1.default.query('INSERT INTO public.tipo_documento (nome, ativo, datacriacao, idempresa) VALUES ($1, $2, NOW(), $3) RETURNING id, nome, ativo, datacriacao', [nome, ativoValue, empresaId]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.createTipoDocumento = createTipoDocumento;
const updateTipoDocumento = async (req, res) => {
    const { id } = req.params;
    const { nome, ativo } = req.body;
    try {
        const auth = getAuthenticatedUser(req, res);
        if (!auth) {
            return;
        }
        const empresaLookup = await (0, authUser_1.fetchAuthenticatedUserEmpresa)(auth.userId);
        if (!empresaLookup.success) {
            res
                .status(empresaLookup.status)
                .json({ error: empresaLookup.message });
            return;
        }
        const { empresaId } = empresaLookup;
        if (empresaId === null) {
            res
                .status(400)
                .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
            return;
        }
        const result = await db_1.default.query('UPDATE public.tipo_documento SET nome = $1, ativo = $2 WHERE id = $3 AND idempresa IS NOT DISTINCT FROM $4 RETURNING id, nome, ativo, datacriacao', [nome, ativo, id, empresaId]);
        if (result.rowCount === 0) {
            res.status(404).json({ error: 'Tipo de documento não encontrado' });
            return;
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateTipoDocumento = updateTipoDocumento;
const deleteTipoDocumento = async (req, res) => {
    const { id } = req.params;
    try {
        const auth = getAuthenticatedUser(req, res);
        if (!auth) {
            return;
        }
        const empresaLookup = await (0, authUser_1.fetchAuthenticatedUserEmpresa)(auth.userId);
        if (!empresaLookup.success) {
            res
                .status(empresaLookup.status)
                .json({ error: empresaLookup.message });
            return;
        }
        const { empresaId } = empresaLookup;
        if (empresaId === null) {
            res
                .status(400)
                .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
            return;
        }
        const result = await db_1.default.query('DELETE FROM public.tipo_documento WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2', [id, empresaId]);
        if (result.rowCount === 0) {
            res.status(404).json({ error: 'Tipo de documento não encontrado' });
            return;
        }
        res.status(204).send();
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.deleteTipoDocumento = deleteTipoDocumento;
