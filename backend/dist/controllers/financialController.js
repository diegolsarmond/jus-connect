"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.settleFlow = exports.deleteFlow = exports.updateFlow = exports.createFlow = exports.getFlow = exports.listFlows = void 0;
const db_1 = __importDefault(require("../services/db"));
const listFlows = async (req, res) => {
    const { page = '1', limit = '10' } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;
    try {
        const items = await db_1.default.query('SELECT * FROM financial_flows ORDER BY vencimento DESC LIMIT $1 OFFSET $2', [limitNum, offset]);
        const totalResult = await db_1.default.query('SELECT COUNT(*) FROM financial_flows');
        res.json({
            items: items.rows,
            total: parseInt(totalResult.rows[0].count, 10),
            page: pageNum,
            limit: limitNum,
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.listFlows = listFlows;
const getFlow = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db_1.default.query('SELECT * FROM financial_flows WHERE id = $1', [id]);
        if (result.rowCount === 0)
            return res.status(404).json({ error: 'Flow not found' });
        res.json({ flow: result.rows[0] });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getFlow = getFlow;
const createFlow = async (req, res) => {
    const { tipo, descricao, valor, vencimento } = req.body;
    try {
        const result = await db_1.default.query('INSERT INTO financial_flows (tipo, descricao, valor, vencimento, status) VALUES ($1,$2,$3,$4,$5) RETURNING *', [tipo, descricao, valor, vencimento, 'pendente']);
        res.status(201).json({ flow: result.rows[0] });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.createFlow = createFlow;
const updateFlow = async (req, res) => {
    const { id } = req.params;
    const { tipo, descricao, valor, vencimento, pagamento, status } = req.body;
    try {
        const result = await db_1.default.query('UPDATE financial_flows SET tipo=$1, descricao=$2, valor=$3, vencimento=$4, pagamento=$5, status=$6 WHERE id=$7 RETURNING *', [tipo, descricao, valor, vencimento, pagamento, status, id]);
        if (result.rowCount === 0)
            return res.status(404).json({ error: 'Flow not found' });
        res.json({ flow: result.rows[0] });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateFlow = updateFlow;
const deleteFlow = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db_1.default.query('DELETE FROM financial_flows WHERE id=$1', [id]);
        if (result.rowCount === 0)
            return res.status(404).json({ error: 'Flow not found' });
        res.status(204).send();
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.deleteFlow = deleteFlow;
const settleFlow = async (req, res) => {
    const { id } = req.params;
    const { pagamentoData } = req.body;
    try {
        const result = await db_1.default.query("UPDATE financial_flows SET pagamento=$1, status='pago' WHERE id=$2 RETURNING *", [pagamentoData, id]);
        if (result.rowCount === 0)
            return res.status(404).json({ error: 'Flow not found' });
        res.json({ flow: result.rows[0] });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.settleFlow = settleFlow;
