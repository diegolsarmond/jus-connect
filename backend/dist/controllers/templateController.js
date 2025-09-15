"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateWithAI = exports.deleteTemplate = exports.updateTemplate = exports.createTemplate = exports.getTemplate = exports.listTemplates = void 0;
const db_1 = __importDefault(require("../services/db"));
const listTemplates = async (_req, res) => {
    try {
        const result = await db_1.default.query('SELECT id, title, content FROM templates ORDER BY id');
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
        const result = await db_1.default.query('SELECT id, title, content FROM templates WHERE id = $1', [id]);
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
        const result = await db_1.default.query('INSERT INTO templates (title, content) VALUES ($1, $2) RETURNING id, title, content', [title, content]);
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
        const result = await db_1.default.query('UPDATE templates SET title = $1, content = $2 WHERE id = $3 RETURNING id, title, content', [title, content, id]);
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
        const result = await db_1.default.query('DELETE FROM templates WHERE id = $1', [id]);
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
