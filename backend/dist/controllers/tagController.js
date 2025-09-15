"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteTag = exports.updateTag = exports.createTag = exports.listTags = void 0;
const db_1 = __importDefault(require("../services/db"));
const listTags = async (_req, res) => {
    try {
        const result = await db_1.default.query('SELECT id, key, label, example, group_name FROM tags ORDER BY group_name, label');
        res.json(result.rows);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.listTags = listTags;
const createTag = async (req, res) => {
    const { key, label, example, group_name } = req.body;
    try {
        const result = await db_1.default.query('INSERT INTO tags (key, label, example, group_name) VALUES ($1, $2, $3, $4) RETURNING id, key, label, example, group_name', [key, label, example, group_name]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.createTag = createTag;
const updateTag = async (req, res) => {
    const { id } = req.params;
    const { key, label, example, group_name } = req.body;
    try {
        const result = await db_1.default.query('UPDATE tags SET key = $1, label = $2, example = $3, group_name = $4 WHERE id = $5 RETURNING id, key, label, example, group_name', [key, label, example, group_name, id]);
        if (result.rowCount === 0)
            return res.status(404).json({ error: 'Tag not found' });
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateTag = updateTag;
const deleteTag = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db_1.default.query('DELETE FROM tags WHERE id = $1', [id]);
        if (result.rowCount === 0)
            return res.status(404).json({ error: 'Tag not found' });
        res.status(204).send();
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.deleteTag = deleteTag;
