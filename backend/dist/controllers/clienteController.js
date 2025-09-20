"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCliente = exports.updateCliente = exports.createCliente = exports.countClientesAtivos = exports.getClienteById = exports.listClientes = void 0;
const db_1 = __importDefault(require("../services/db"));
const authUser_1 = require("../utils/authUser");
const listClientes = async (req, res) => {
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
        const result = await db_1.default.query('SELECT id, nome, tipo, documento, email, telefone, cep, rua, numero, complemento, bairro, cidade, uf, ativo, idempresa, datacadastro FROM public.clientes WHERE idempresa = $1', [empresaId]);
        return res.json(result.rows);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.listClientes = listClientes;
const getClienteById = async (req, res) => {
    const { id } = req.params;
    try {
        if (!req.auth) {
            return res.status(401).json({ error: 'Token inválido.' });
        }
        const empresaLookup = await (0, authUser_1.fetchAuthenticatedUserEmpresa)(req.auth.userId);
        if (!empresaLookup.success) {
            return res.status(empresaLookup.status).json({ error: empresaLookup.message });
        }
        const result = await db_1.default.query('SELECT id, nome, tipo, documento, email, telefone, cep, rua, numero, complemento, bairro, cidade, uf, ativo, idempresa, datacadastro FROM public.clientes WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2', [id, empresaLookup.empresaId]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getClienteById = getClienteById;
const countClientesAtivos = async (req, res) => {
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
            return res.json({ total_clientes_ativos: 0 });
        }
        const result = await db_1.default.query('SELECT COUNT(*) AS total_clientes_ativos FROM public.clientes WHERE ativo = TRUE AND idempresa = $1', [empresaId]);
        res.json({
            total_clientes_ativos: parseInt(result.rows[0].total_clientes_ativos, 10),
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.countClientesAtivos = countClientesAtivos;
const createCliente = async (req, res) => {
    const { nome, tipo, documento, email, telefone, cep, rua, numero, complemento, bairro, cidade, uf, ativo, } = req.body;
    const documentoLimpo = documento ? documento.replace(/\D/g, '') : null;
    const telefoneLimpo = telefone ? telefone.replace(/\D/g, '') : null;
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
        const result = await db_1.default.query('INSERT INTO public.clientes (nome, tipo, documento, email, telefone, cep, rua, numero, complemento, bairro, cidade, uf, ativo, idempresa, datacadastro) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW()) RETURNING id, nome, tipo, documento, email, telefone, cep, rua, numero, complemento, bairro, cidade, uf, ativo, idempresa, datacadastro', [
            nome,
            tipo,
            documentoLimpo,
            email,
            telefoneLimpo,
            cep,
            rua,
            numero,
            complemento,
            bairro,
            cidade,
            uf,
            ativo,
            empresaId,
        ]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.createCliente = createCliente;
const updateCliente = async (req, res) => {
    const { id } = req.params;
    const { nome, tipo, documento, email, telefone, cep, rua, numero, complemento, bairro, cidade, uf, ativo, } = req.body;
    const documentoLimpo = documento ? documento.replace(/\D/g, '') : null;
    const telefoneLimpo = telefone ? telefone.replace(/\D/g, '') : null;
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
        const result = await db_1.default.query('UPDATE public.clientes SET nome = $1, tipo = $2, documento = $3, email = $4, telefone = $5, cep = $6, rua = $7, numero = $8, complemento = $9, bairro = $10, cidade = $11, uf = $12, ativo = $13, idempresa = $14 WHERE id = $15 AND idempresa IS NOT DISTINCT FROM $16 RETURNING id, nome, tipo, documento, email, telefone, cep, rua, numero, complemento, bairro, cidade, uf, ativo, idempresa, datacadastro', [
            nome,
            tipo,
            documentoLimpo,
            email,
            telefoneLimpo,
            cep,
            rua,
            numero,
            complemento,
            bairro,
            cidade,
            uf,
            ativo,
            empresaId,
            id,
            empresaId,
        ]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateCliente = updateCliente;
const deleteCliente = async (req, res) => {
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
        const result = await db_1.default.query('UPDATE public.clientes SET ativo = NOT ativo WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2 RETURNING ativo', [id, empresaId]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }
        res.json({ ativo: result.rows[0].ativo });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.deleteCliente = deleteCliente;
