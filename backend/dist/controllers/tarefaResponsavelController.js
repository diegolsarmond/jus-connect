"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addResponsaveis = exports.listResponsaveis = void 0;
const db_1 = __importDefault(require("../services/db"));
// Lista os usuários responsáveis por uma tarefa
const listResponsaveis = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db_1.default.query(`SELECT tr.id_tarefa, tr.id_usuario, u.nome_completo AS nome_responsavel
       FROM public.tarefas_responsaveis tr
       JOIN public.usuarios u ON tr.id_usuario = u.id
       WHERE tr.id_tarefa = $1`, [id]);
        res.json(result.rows);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.listResponsaveis = listResponsaveis;
// Adiciona usuários responsáveis a uma tarefa
const addResponsaveis = async (req, res) => {
    const { id } = req.params;
    const { responsaveis } = req.body;
    if (!Array.isArray(responsaveis) || responsaveis.length === 0) {
        return res
            .status(400)
            .json({ error: 'responsaveis deve ser um array de IDs de usuários' });
    }
    const client = await db_1.default.connect();
    try {
        await client.query('BEGIN');
        const values = responsaveis
            .map((_r, idx) => `($1, $${idx + 2})`)
            .join(', ');
        await client.query(`INSERT INTO public.tarefas_responsaveis (id_tarefa, id_usuario) VALUES ${values}`, [id, ...responsaveis]);
        await client.query('COMMIT');
        res.status(201).json({ id_tarefa: Number(id), responsaveis });
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
    finally {
        client.release();
    }
};
exports.addResponsaveis = addResponsaveis;
