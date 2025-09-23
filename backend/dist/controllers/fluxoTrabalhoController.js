"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteFluxoTrabalho = exports.updateFluxoTrabalho = exports.createFluxoTrabalho = exports.listFluxoTrabalhoMenus = exports.listFluxosTrabalho = void 0;
const db_1 = __importDefault(require("../services/db"));
const authUser_1 = require("../utils/authUser");
const getAuthenticatedUser = (req, res) => {
    if (!req.auth) {
        res.status(401).json({ error: 'Token inválido.' });
        return null;
    }
    return req.auth;
};
const listFluxosTrabalho = async (req, res) => {
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
        const result = await db_1.default.query('SELECT id, nome, ativo, datacriacao, exibe_menu, ordem FROM public.fluxo_trabalho WHERE idempresa = $1', [empresaId]);
        res.json(result.rows);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.listFluxosTrabalho = listFluxosTrabalho;
const listFluxoTrabalhoMenus = async (req, res) => {
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
        const result = await db_1.default.query(`SELECT id, nome, ordem
       FROM public.fluxo_trabalho
       WHERE idempresa = $1 AND ativo IS TRUE AND exibe_menu IS TRUE
       ORDER BY ordem ASC`, [empresaId]);
        res.json(result.rows);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.listFluxoTrabalhoMenus = listFluxoTrabalhoMenus;
const createFluxoTrabalho = async (req, res) => {
    const { nome, ativo, exibe_menu = true, ordem } = req.body;
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
        const result = await db_1.default.query('INSERT INTO public.fluxo_trabalho (nome, ativo, exibe_menu, ordem, datacriacao, idempresa) VALUES ($1, $2, $3, $4, NOW(), $5) RETURNING id, nome, ativo, exibe_menu, ordem, datacriacao', [nome, ativoValue, exibe_menu, ordem, empresaId]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.createFluxoTrabalho = createFluxoTrabalho;
const updateFluxoTrabalho = async (req, res) => {
    const { id } = req.params;
    const { nome, ativo, exibe_menu = true, ordem } = req.body;
    try {
        const result = await db_1.default.query('UPDATE public.fluxo_trabalho SET nome = $1, ativo = $2, exibe_menu = $3, ordem = $4 WHERE id = $5 RETURNING id, nome, ativo, exibe_menu, ordem, datacriacao', [nome, ativo, exibe_menu, ordem, id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Fluxo de trabalho não encontrado' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateFluxoTrabalho = updateFluxoTrabalho;
const deleteFluxoTrabalho = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db_1.default.query('DELETE FROM public.fluxo_trabalho WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Fluxo de trabalho não encontrado' });
        }
        res.status(204).send();
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.deleteFluxoTrabalho = deleteFluxoTrabalho;
