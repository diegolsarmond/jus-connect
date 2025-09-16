"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteEscritorio = exports.updateEscritorio = exports.createEscritorio = exports.listEscritorios = void 0;
const db_1 = __importDefault(require("../services/db"));
const parseEmpresaId = (value) => {
    if (value === undefined || value === null || value === '') {
        return null;
    }
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
};
const listEscritorios = async (_req, res) => {
    try {
        const result = await db_1.default.query(`SELECT e.id,
              e.nome,
              e.empresa,
              emp.nome_empresa AS empresa_nome,
              e.ativo,
              e.datacriacao
         FROM public.escritorios e
         LEFT JOIN public.empresas emp ON emp.id = e.empresa
         ORDER BY e.nome`);
        res.json(result.rows);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.listEscritorios = listEscritorios;
const createEscritorio = async (req, res) => {
    const { nome, empresa, ativo } = req.body;
    const nomeTrimmed = typeof nome === 'string' ? nome.trim() : '';
    if (!nomeTrimmed) {
        return res.status(400).json({ error: 'Nome é obrigatório' });
    }
    const empresaId = parseEmpresaId(empresa);
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
    const { nome, empresa, ativo } = req.body;
    const nomeTrimmed = typeof nome === 'string' ? nome.trim() : '';
    if (!nomeTrimmed) {
        return res.status(400).json({ error: 'Nome é obrigatório' });
    }
    const empresaId = parseEmpresaId(empresa);
    const ativoValue = typeof ativo === 'boolean' ? ativo : true;
    try {
        const result = await db_1.default.query(`WITH updated AS (
         UPDATE public.escritorios
            SET nome = $1,
                empresa = $2,
                ativo = $3
          WHERE id = $4
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
    try {
        const result = await db_1.default.query('DELETE FROM public.escritorios WHERE id = $1', [id]);
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
