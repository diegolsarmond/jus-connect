"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDocument = void 0;
const db_1 = __importDefault(require("../services/db"));
const templateService_1 = require("../services/templateService");
const generateDocument = async (req, res) => {
    const { templateId, values } = req.body;
    try {
        const result = await db_1.default.query('SELECT content FROM templates WHERE id = $1', [templateId]);
        if (result.rowCount === 0)
            return res.status(404).json({ error: 'Template not found' });
        const content = result.rows[0].content;
        const filled = (0, templateService_1.replaceVariables)(content, values || {});
        res.json({ content: filled });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.generateDocument = generateDocument;
