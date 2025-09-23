"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateWithAI = exports.deleteTemplate = exports.updateTemplate = exports.createTemplate = exports.getTemplate = exports.listTemplates = void 0;
const db_1 = __importDefault(require("../services/db"));
const authUser_1 = require("../utils/authUser");
const listTemplates = async (req, res) => {
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
        const result = await db_1.default.query('SELECT id, title, content FROM templates WHERE idempresa IS NOT DISTINCT FROM $1 AND idusuario = $2 ORDER BY id', [empresaId, req.auth.userId]);
        res.json(result.rows);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.listTemplates = listTemplates;
const getTemplate = async (req, res) => {
    const { id } = req.params;
    try {
        if (!req.auth) {
            return res.status(401).json({ error: 'Token inválido.' });
        }
        const empresaLookup = await (0, authUser_1.fetchAuthenticatedUserEmpresa)(req.auth.userId);
        if (!empresaLookup.success) {
            return res.status(empresaLookup.status).json({ error: empresaLookup.message });
        }
        const result = await db_1.default.query('SELECT id, title, content FROM templates WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2 AND idusuario = $3', [id, empresaLookup.empresaId, req.auth.userId]);
        if (result.rowCount === 0)
            return res.status(404).json({ error: 'Template not found' });
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getTemplate = getTemplate;
const createTemplate = async (req, res) => {
    const { title, content } = req.body;
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
        const result = await db_1.default.query('INSERT INTO templates (title, content, idempresa, idusuario) VALUES ($1, $2, $3, $4) RETURNING id, title, content', [title, content, empresaId, req.auth.userId]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.createTemplate = createTemplate;
const updateTemplate = async (req, res) => {
    const { id } = req.params;
    const { title, content } = req.body;
    try {
        if (!req.auth) {
            return res.status(401).json({ error: 'Token inválido.' });
        }
        const empresaLookup = await (0, authUser_1.fetchAuthenticatedUserEmpresa)(req.auth.userId);
        if (!empresaLookup.success) {
            return res.status(empresaLookup.status).json({ error: empresaLookup.message });
        }
        const result = await db_1.default.query('UPDATE templates SET title = $1, content = $2 WHERE id = $3 AND idempresa IS NOT DISTINCT FROM $4 AND idusuario = $5 RETURNING id, title, content', [title, content, id, empresaLookup.empresaId, req.auth.userId]);
        if (result.rowCount === 0)
            return res.status(404).json({ error: 'Template not found' });
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateTemplate = updateTemplate;
const deleteTemplate = async (req, res) => {
    const { id } = req.params;
    try {
        if (!req.auth) {
            return res.status(401).json({ error: 'Token inválido.' });
        }
        const empresaLookup = await (0, authUser_1.fetchAuthenticatedUserEmpresa)(req.auth.userId);
        if (!empresaLookup.success) {
            return res.status(empresaLookup.status).json({ error: empresaLookup.message });
        }
        const result = await db_1.default.query('DELETE FROM templates WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2 AND idusuario = $3', [id, empresaLookup.empresaId, req.auth.userId]);
        if (result.rowCount === 0)
            return res.status(404).json({ error: 'Template not found' });
        res.status(204).send();
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.deleteTemplate = deleteTemplate;
const generateWithAI = async (_req, res) => {
    res.json({ content: 'Exemplo gerado com IA' });
};
exports.generateWithAI = generateWithAI;
