"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUsuario = exports.updateUsuario = exports.createUsuario = exports.getUsuarioById = exports.listUsuarios = void 0;
const db_1 = __importDefault(require("../services/db"));
const listUsuarios = async (_req, res) => {
    try {
        const result = await db_1.default.query('SELECT id, nome_completo, cpf, email, perfil, empresa, escritorio, oab, status, senha, telefone, ultimo_login, observacoes, datacriacao 	FROM public."vw.usuarios"');
        res.json(result.rows);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.listUsuarios = listUsuarios;
const getUsuarioById = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db_1.default.query('SELECT id, nome_completo, cpf, email, perfil, empresa, escritorio, oab, status, senha, telefone, ultimo_login, observacoes, datacriacao  FROM public."vw.usuarios" WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getUsuarioById = getUsuarioById;
const createUsuario = async (req, res) => {
    const { nome_completo, cpf, email, perfil, empresa, escritorio, oab, status, senha, telefone, ultimo_login, observacoes, } = req.body;
    try {
        const result = await db_1.default.query('INSERT INTO public.usuarios (nome_completo, cpf, email, perfil, empresa, escritorio, oab, status, senha, telefone, ultimo_login, observacoes, datacriacao) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW()) RETURNING id, nome_completo, cpf, email, perfil, empresa, escritorio, oab, status, senha, telefone, ultimo_login, observacoes, datacriacao', [
            nome_completo,
            cpf,
            email,
            perfil,
            empresa,
            escritorio,
            oab,
            status,
            senha,
            telefone,
            ultimo_login,
            observacoes,
        ]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.createUsuario = createUsuario;
const updateUsuario = async (req, res) => {
    const { id } = req.params;
    const { nome_completo, cpf, email, perfil, empresa, escritorio, oab, status, senha, telefone, ultimo_login, observacoes, } = req.body;
    try {
        const result = await db_1.default.query('UPDATE public.usuarios SET nome_completo = $1, cpf = $2, email = $3, perfil = $4, empresa = $5, escritorio = $6, oab = $7, status = $8, senha = $9, telefone = $10, ultimo_login = $11, observacoes = $12 WHERE id = $13 RETURNING id, nome_completo, cpf, email, perfil, empresa, escritorio, oab, status, senha, telefone, ultimo_login, observacoes, datacriacao', [
            nome_completo,
            cpf,
            email,
            perfil,
            empresa,
            escritorio,
            oab,
            status,
            senha,
            telefone,
            ultimo_login,
            observacoes,
            id,
        ]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateUsuario = updateUsuario;
const deleteUsuario = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db_1.default.query('DELETE FROM public.usuarios WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        res.status(204).send();
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.deleteUsuario = deleteUsuario;
