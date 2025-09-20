"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAgenda = exports.updateAgenda = exports.createAgenda = exports.getTotalCompromissosHoje = exports.listAgendas = void 0;
const db_1 = __importDefault(require("../services/db"));
const authUser_1 = require("../utils/authUser");
const VALID_STATUS_NUMBERS = new Set([0, 1, 2, 3]);
const STATUS_TEXT_TO_NUMBER = new Map([
    ['cancelado', 0],
    ['cancelada', 0],
    ['agendado', 1],
    ['agendada', 1],
    ['em_curso', 2],
    ['emcurso', 2],
    ['em_andamento', 2],
    ['emandamento', 2],
    ['concluido', 3],
    ['concluida', 3],
]);
const normalizeAgendaStatus = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        const parsed = Math.trunc(value);
        if (VALID_STATUS_NUMBERS.has(parsed)) {
            return parsed;
        }
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed === '') {
            return 1;
        }
        const numeric = Number(trimmed);
        if (Number.isFinite(numeric)) {
            const parsed = Math.trunc(numeric);
            if (VALID_STATUS_NUMBERS.has(parsed)) {
                return parsed;
            }
        }
        const normalized = trimmed
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
        const mapped = (STATUS_TEXT_TO_NUMBER.get(normalized) || STATUS_TEXT_TO_NUMBER.get(normalized.replace(/_/g, '')));
        if (mapped !== undefined) {
            return mapped;
        }
    }
    if (typeof value === 'boolean') {
        return value ? 1 : 0;
    }
    return 1;
};
const buildAgendaSelect = (cteName) => `
  SELECT
    ${cteName}.id,
    ${cteName}.titulo,
    ${cteName}.tipo,
    te.nome AS tipo_evento,
    ${cteName}.descricao,
    ${cteName}.data,
    ${cteName}.hora_inicio,
    ${cteName}.hora_fim,
    CASE
      WHEN c.nome IS NOT NULL THEN c.nome
      WHEN ${cteName}.cliente IS NOT NULL THEN ${cteName}.cliente::text
      ELSE NULL
    END AS cliente,
    c.email AS cliente_email,
    c.telefone AS cliente_telefone,
    ${cteName}.tipo_local,
    ${cteName}.local,
    ${cteName}.lembrete,
    ${cteName}.status,
    ${cteName}.datacadastro,
    ${cteName}.dataatualizacao
  FROM ${cteName}
  LEFT JOIN public.tipo_evento te ON te.id = ${cteName}.tipo
  LEFT JOIN public.clientes c ON c.id = ${cteName}.cliente
`;
const listAgendas = async (req, res) => {
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
        const result = await db_1.default.query(`SELECT a.id,
              a.titulo,
              a.tipo,
              te.nome AS tipo_evento,
              a.descricao,
              a.data,
              a.hora_inicio,
              a.hora_fim,
              CASE
                WHEN c.nome IS NOT NULL THEN c.nome
                WHEN a.cliente IS NOT NULL THEN a.cliente::text
                ELSE NULL
              END AS cliente,
              c.email AS cliente_email,
              c.telefone AS cliente_telefone,
              a.tipo_local,
              a.local,
              a.lembrete,
              a.status,
              a.datacadastro,
              a.dataatualizacao
         FROM public.agenda a
         LEFT JOIN public.tipo_evento te ON te.id = a.tipo
         LEFT JOIN public.clientes c ON c.id = a.cliente
        WHERE a.idempresa IS NOT DISTINCT FROM $1
          AND a.idusuario = $2
        ORDER BY a.data, a.hora_inicio`, [empresaId, req.auth.userId]);
        res.json(result.rows);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.listAgendas = listAgendas;
const getTotalCompromissosHoje = async (req, res) => {
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
            return res.json({ total_compromissos_hoje: 0 });
        }
        const result = await db_1.default.query(`SELECT COUNT(*) AS total_compromissos_hoje
         FROM public.agenda
        WHERE "data" = CURRENT_DATE
          AND status <> 0
          AND idempresa IS NOT DISTINCT FROM $1
          AND idusuario = $2`, [empresaId, req.auth.userId]);
        res.json({
            total_compromissos_hoje: Number.parseInt(result.rows[0].total_compromissos_hoje, 10),
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getTotalCompromissosHoje = getTotalCompromissosHoje;
const createAgenda = async (req, res) => {
    const { titulo, tipo, descricao, data, hora_inicio, hora_fim, cliente, tipo_local, local, lembrete, status, } = req.body;
    const normalizedStatus = normalizeAgendaStatus(status);
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
        const result = await db_1.default.query(`WITH inserted AS (
         INSERT INTO public.agenda (
           titulo,
           tipo,
           descricao,
           data,
           hora_inicio,
           hora_fim,
           cliente,
           tipo_local,
           local,
           lembrete,
           status,
           datacadastro,
           idempresa,
           idusuario
         )
         VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12, $13
         )
         RETURNING id, titulo, tipo, descricao, data, hora_inicio, hora_fim, cliente, tipo_local, local, lembrete, status, datacadastro, idempresa, idusuario, dataatualizacao
       )
       ${buildAgendaSelect('inserted')}
       WHERE inserted.idempresa IS NOT DISTINCT FROM $12
         AND inserted.idusuario = $13`, [
            titulo,
            tipo,
            descricao,
            data,
            hora_inicio,
            hora_fim,
            cliente,
            tipo_local,
            local,
            lembrete,
            normalizedStatus,
            empresaId,
            req.auth.userId,
        ]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.createAgenda = createAgenda;
const updateAgenda = async (req, res) => {
    const { id } = req.params;
    const { titulo, tipo, descricao, data, hora_inicio, hora_fim, cliente, tipo_local, local, lembrete, status, } = req.body;
    const normalizedStatus = normalizeAgendaStatus(status);
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
            return res.status(404).json({ error: 'Agenda não encontrada' });
        }
        const result = await db_1.default.query(`WITH updated AS (
         UPDATE public.agenda
            SET titulo = $1,
                tipo = $2,
                descricao = $3,
                data = $4,
                hora_inicio = $5,
                hora_fim = $6,
                cliente = $7,
                tipo_local = $8,
                local = $9,
                lembrete = $10,
                status = $11,
                dataatualizacao = NOW()
          WHERE id = $12
            AND idempresa IS NOT DISTINCT FROM $13
            AND idusuario = $14
          RETURNING id, titulo, tipo, descricao, data, hora_inicio, hora_fim, cliente, tipo_local, local, lembrete, status, datacadastro, idempresa, idusuario, dataatualizacao
       )
       ${buildAgendaSelect('updated')}
       WHERE updated.idempresa IS NOT DISTINCT FROM $13
         AND updated.idusuario = $14`, [
            titulo,
            tipo,
            descricao,
            data,
            hora_inicio,
            hora_fim,
            cliente,
            tipo_local,
            local,
            lembrete,
            normalizedStatus,
            id,
            empresaId,
            req.auth.userId,
        ]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Agenda não encontrada' });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateAgenda = updateAgenda;
const deleteAgenda = async (req, res) => {
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
            return res.status(404).json({ error: 'Agenda não encontrada' });
        }
        const result = await db_1.default.query('DELETE FROM public.agenda WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2 AND idusuario = $3', [id, empresaId, req.auth.userId]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Agenda não encontrada' });
        }
        res.status(204).send();
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.deleteAgenda = deleteAgenda;
