"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deletePerfil = exports.updatePerfil = exports.createPerfil = exports.listPerfilModules = exports.listPerfis = void 0;
const db_1 = __importDefault(require("../services/db"));
const modules_1 = require("../constants/modules");
const authUser_1 = require("../utils/authUser");
const formatPerfilRow = (row) => ({
    id: row.id,
    nome: row.nome,
    ativo: row.ativo,
    datacriacao: row.datacriacao,
    modulos: row.modulos ? (0, modules_1.sortModules)(row.modulos) : [],
});
const parseModules = (value) => {
    try {
        const modules = (0, modules_1.sortModules)((0, modules_1.sanitizeModuleIds)(value));
        return { ok: true, modules };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Não foi possível processar os módulos informados';
        return { ok: false, error: message };
    }
};
const parsePerfilId = (value) => {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) {
        return null;
    }
    return id;
};
const listPerfis = async (req, res) => {
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
        const result = await db_1.default.query(`SELECT p.id,
              p.nome,
              p.ativo,
              p.datacriacao,
              COALESCE(
                array_agg(pm.modulo ORDER BY pm.modulo) FILTER (WHERE pm.modulo IS NOT NULL),
                '{}'
              ) AS modulos
         FROM public.perfis p
    LEFT JOIN public.perfil_modulos pm ON pm.perfil_id = p.id
        WHERE p.idempresa IS NOT DISTINCT FROM $1
     GROUP BY p.id, p.nome, p.ativo, p.datacriacao
     ORDER BY p.nome`, [empresaId]);
        res.json(result.rows.map(formatPerfilRow));
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.listPerfis = listPerfis;
const listPerfilModules = async (_req, res) => {
    res.json(modules_1.SYSTEM_MODULES);
};
exports.listPerfilModules = listPerfilModules;
const createPerfil = async (req, res) => {
    const nomeValue = typeof req.body?.nome === 'string' ? req.body.nome.trim() : '';
    const ativoValue = typeof req.body?.ativo === 'boolean' ? req.body.ativo : true;
    const parsedModules = parseModules(req.body?.modulos);
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
    if (!nomeValue) {
        return res.status(400).json({ error: 'O nome do perfil é obrigatório' });
    }
    if (!parsedModules.ok) {
        return res.status(400).json({ error: parsedModules.error });
    }
    const client = await db_1.default.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query('INSERT INTO public.perfis (nome, ativo, datacriacao, idempresa) VALUES ($1, $2, NOW(), $3) RETURNING id, nome, ativo, datacriacao', [nomeValue, ativoValue, empresaId]);
        const perfil = result.rows[0];
        if (parsedModules.modules.length > 0) {
            await client.query('INSERT INTO public.perfil_modulos (perfil_id, modulo) SELECT $1, unnest($2::text[])', [perfil.id, parsedModules.modules]);
        }
        await client.query('COMMIT');
        res.status(201).json({
            ...perfil,
            modulos: parsedModules.modules,
        });
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
exports.createPerfil = createPerfil;
const updatePerfil = async (req, res) => {
    const parsedId = parsePerfilId(req.params.id);
    if (parsedId == null) {
        return res.status(400).json({ error: 'ID de perfil inválido' });
    }
    const nomeValue = typeof req.body?.nome === 'string' ? req.body.nome.trim() : '';
    const ativoValue = typeof req.body?.ativo === 'boolean' ? req.body.ativo : true;
    const parsedModules = parseModules(req.body?.modulos);
    if (!nomeValue) {
        return res.status(400).json({ error: 'O nome do perfil é obrigatório' });
    }
    if (!parsedModules.ok) {
        return res.status(400).json({ error: parsedModules.error });
    }
    const client = await db_1.default.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query('UPDATE public.perfis SET nome = $1, ativo = $2 WHERE id = $3 RETURNING id, nome, ativo, datacriacao', [nomeValue, ativoValue, parsedId]);
        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Perfil não encontrado' });
        }
        await client.query('DELETE FROM public.perfil_modulos WHERE perfil_id = $1', [parsedId]);
        if (parsedModules.modules.length > 0) {
            await client.query('INSERT INTO public.perfil_modulos (perfil_id, modulo) SELECT $1, unnest($2::text[])', [parsedId, parsedModules.modules]);
        }
        await client.query('COMMIT');
        res.json({
            ...result.rows[0],
            modulos: parsedModules.modules,
        });
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
exports.updatePerfil = updatePerfil;
const deletePerfil = async (req, res) => {
    const parsedId = parsePerfilId(req.params.id);
    if (parsedId == null) {
        return res.status(400).json({ error: 'ID de perfil inválido' });
    }
    const client = await db_1.default.connect();
    try {
        await client.query('BEGIN');
        const exists = await client.query('SELECT 1 FROM public.perfis WHERE id = $1', [parsedId]);
        if (exists.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Perfil não encontrado' });
        }
        await client.query('DELETE FROM public.perfil_modulos WHERE perfil_id = $1', [parsedId]);
        await client.query('DELETE FROM public.perfis WHERE id = $1', [parsedId]);
        await client.query('COMMIT');
        res.status(204).send();
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
exports.deletePerfil = deletePerfil;
