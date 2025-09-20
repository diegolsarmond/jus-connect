"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteEscritorio = exports.updateEscritorio = exports.createEscritorio = exports.listEscritorios = void 0;
const db_1 = __importDefault(require("../services/db"));
const authUser_1 = require("../utils/authUser");
const getAuthenticatedEmpresaId = async (req, res) => {
    if (!req.auth) {
        res.status(401).json({ error: 'Token inválido.' });
        return undefined;
    }
    const empresaLookup = await (0, authUser_1.fetchAuthenticatedUserEmpresa)(req.auth.userId);
    if (!empresaLookup.success) {
        res.status(empresaLookup.status).json({ error: empresaLookup.message });
        return undefined;
    }
    return empresaLookup.empresaId;
};
const ensureAuthenticatedEmpresaId = async (req, res) => {
    const empresaId = await getAuthenticatedEmpresaId(req, res);
    if (empresaId === undefined) {
        return undefined;
    }
    if (empresaId === null) {
        res
            .status(400)
            .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
        return undefined;
    }
    return empresaId;
};
const listEscritorios = async (req, res) => {
    try {
        const empresaId = await getAuthenticatedEmpresaId(req, res);
        if (empresaId === undefined) {
            return;
        }
        if (empresaId === null) {
            res.json([]);
            return;
        }
        const result = await db_1.default.query(`SELECT e.id,
              e.nome,
              e.empresa,
              emp.nome_empresa AS empresa_nome,
              e.ativo,
              e.datacriacao
         FROM public.escritorios e
         LEFT JOIN public.empresas emp ON emp.id = e.empresa
        WHERE e.empresa IS NOT DISTINCT FROM $1
         ORDER BY e.nome`, [empresaId]);
        res.json(result.rows);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.listEscritorios = listEscritorios;
const createEscritorio = async (req, res) => {
    const { nome, ativo } = req.body;
    const nomeTrimmed = typeof nome === 'string' ? nome.trim() : '';
    if (!nomeTrimmed) {
        return res.status(400).json({ error: 'Nome é obrigatório' });
    }
    const empresaId = await ensureAuthenticatedEmpresaId(req, res);
    if (empresaId === undefined) {
        return;
    }
    const ativoValue = typeof ativo === 'boolean' ? ativo : true;
    try {
        const result = await db_1.default.query(`WITH inserted AS (
         INSERT INTO public.escritorios (nome, empresa, ativo, datacriacao)
         VALUES ($1, $2, $3, NOW())
         RETURNING id, nome, empresa, ativo, datacriacao
       )
       SELECT i.id,
              i.nome,
              i.empresa,
              emp.nome_empresa AS empresa_nome,
              i.ativo,
              i.datacriacao
         FROM inserted i
         LEFT JOIN public.empresas emp ON emp.id = i.empresa`, [nomeTrimmed, empresaId, ativoValue]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.createEscritorio = createEscritorio;
const updateEscritorio = async (req, res) => {
    const { id } = req.params;
    const { nome, ativo } = req.body;
    const nomeTrimmed = typeof nome === 'string' ? nome.trim() : '';
    if (!nomeTrimmed) {
        return res.status(400).json({ error: 'Nome é obrigatório' });
    }
    const empresaId = await ensureAuthenticatedEmpresaId(req, res);
    if (empresaId === undefined) {
        return;
    }
    const ativoValue = typeof ativo === 'boolean' ? ativo : true;
    try {
        const result = await db_1.default.query(`WITH updated AS (
         UPDATE public.escritorios
            SET nome = $1,
                empresa = $2,
                ativo = $3
          WHERE id = $4
            AND empresa IS NOT DISTINCT FROM $2
          RETURNING id, nome, empresa, ativo, datacriacao
       )
       SELECT u.id,
              u.nome,
              u.empresa,
              emp.nome_empresa AS empresa_nome,
              u.ativo,
              u.datacriacao
         FROM updated u
         LEFT JOIN public.empresas emp ON emp.id = u.empresa`, [nomeTrimmed, empresaId, ativoValue, id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Setor não encontrado' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateEscritorio = updateEscritorio;
const deleteEscritorio = async (req, res) => {
    const { id } = req.params;
    const empresaId = await ensureAuthenticatedEmpresaId(req, res);
    if (empresaId === undefined) {
        return;
    }
    try {
        const result = await db_1.default.query('DELETE FROM public.escritorios WHERE id = $1 AND empresa IS NOT DISTINCT FROM $2', [id, empresaId]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Setor não encontrado' });
        }
        res.status(204).send();
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.deleteEscritorio = deleteEscritorio;
