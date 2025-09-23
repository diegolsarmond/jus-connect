"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteFornecedor = exports.updateFornecedor = exports.createFornecedor = exports.getFornecedorById = exports.listFornecedores = void 0;
const db_1 = __importDefault(require("../services/db"));
const authUser_1 = require("../utils/authUser");
const sanitizeDigits = (value) => {
    if (typeof value !== 'string') {
        return null;
    }
    const digits = value.replace(/\D/g, '');
    return digits.length > 0 ? digits : null;
};
const listFornecedores = async (req, res) => {
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
        const result = await db_1.default.query(`SELECT id, nome, tipo, documento, email, telefone, cep, rua, numero, complemento, bairro, cidade, uf, ativo, idempresa, datacadastro
         FROM public.fornecedores
        WHERE idempresa = $1`, [empresaId]);
        return res.json(result.rows);
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
exports.listFornecedores = listFornecedores;
const getFornecedorById = async (req, res) => {
    const { id } = req.params;
    try {
        if (!req.auth) {
            return res.status(401).json({ error: 'Token inválido.' });
        }
        const empresaLookup = await (0, authUser_1.fetchAuthenticatedUserEmpresa)(req.auth.userId);
        if (!empresaLookup.success) {
            return res.status(empresaLookup.status).json({ error: empresaLookup.message });
        }
        const result = await db_1.default.query(`SELECT id, nome, tipo, documento, email, telefone, cep, rua, numero, complemento, bairro, cidade, uf, ativo, idempresa, datacadastro
         FROM public.fornecedores
        WHERE id = $1
          AND idempresa IS NOT DISTINCT FROM $2`, [id, empresaLookup.empresaId]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Fornecedor não encontrado' });
        }
        return res.json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getFornecedorById = getFornecedorById;
const createFornecedor = async (req, res) => {
    const { nome, tipo, documento, email, telefone, cep, rua, numero, complemento, bairro, cidade, uf, ativo, } = req.body ?? {};
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
        const documentoLimpo = sanitizeDigits(documento);
        const telefoneLimpo = sanitizeDigits(telefone);
        const result = await db_1.default.query(`INSERT INTO public.fornecedores
        (nome, tipo, documento, email, telefone, cep, rua, numero, complemento, bairro, cidade, uf, ativo, idempresa, datacadastro)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, COALESCE($13, TRUE), $14, NOW())
    RETURNING id, nome, tipo, documento, email, telefone, cep, rua, numero, complemento, bairro, cidade, uf, ativo, idempresa, datacadastro`, [
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
        return res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
exports.createFornecedor = createFornecedor;
const updateFornecedor = async (req, res) => {
    const { id } = req.params;
    const { nome, tipo, documento, email, telefone, cep, rua, numero, complemento, bairro, cidade, uf, ativo, } = req.body ?? {};
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
        const documentoLimpo = sanitizeDigits(documento);
        const telefoneLimpo = sanitizeDigits(telefone);
        const result = await db_1.default.query(`UPDATE public.fornecedores
          SET nome = $1,
              tipo = $2,
              documento = $3,
              email = $4,
              telefone = $5,
              cep = $6,
              rua = $7,
              numero = $8,
              complemento = $9,
              bairro = $10,
              cidade = $11,
              uf = $12,
              ativo = $13,
              idempresa = $14
        WHERE id = $15
          AND idempresa IS NOT DISTINCT FROM $16
      RETURNING id, nome, tipo, documento, email, telefone, cep, rua, numero, complemento, bairro, cidade, uf, ativo, idempresa, datacadastro`, [
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
            return res.status(404).json({ error: 'Fornecedor não encontrado' });
        }
        return res.json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateFornecedor = updateFornecedor;
const deleteFornecedor = async (req, res) => {
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
        const result = await db_1.default.query(`UPDATE public.fornecedores
          SET ativo = NOT ativo
        WHERE id = $1
          AND idempresa IS NOT DISTINCT FROM $2
      RETURNING ativo`, [id, empresaId]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Fornecedor não encontrado' });
        }
        return res.json({ ativo: result.rows[0].ativo });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
exports.deleteFornecedor = deleteFornecedor;
