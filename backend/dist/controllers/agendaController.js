"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAgenda = exports.updateAgenda = exports.createAgenda = exports.getTotalCompromissosHoje = exports.listAgendasByEmpresa = exports.listAgendas = void 0;
const pg_1 = require("pg");
const db_1 = __importDefault(require("../services/db"));
const notificationService_1 = require("../services/notificationService");
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
        const mapped = STATUS_TEXT_TO_NUMBER.get(normalized) ??
            STATUS_TEXT_TO_NUMBER.get(normalized.replace(/_/g, ''));
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
const buildAgendaFunctionQuery = (functionCall) => `
  WITH agenda_list AS (
    SELECT
      agenda.id,
      agenda.titulo,
      agenda.tipo,
      agenda.descricao,
      agenda.data,
      agenda.hora_inicio,
      agenda.hora_fim,
      agenda.cliente,
      agenda.tipo_local,
      agenda.local,
      agenda.lembrete,
      agenda.status,
      agenda.datacadastro,
      agenda.dataatualizacao
    FROM ${functionCall} AS agenda
  )
  ${buildAgendaSelect('agenda_list')}
  ORDER BY agenda_list.data, agenda_list.hora_inicio
`;
const isUndefinedFunctionError = (error) => error instanceof pg_1.DatabaseError && error.code === '42883';
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
        const functionAttempts = [
            {
                functionCall: 'public.get_api_agendas($1, $2)',
                params: [empresaId, req.auth.userId],
            },
            {
                functionCall: 'public.get_api_agendas($1, $2)',
                params: [req.auth.userId, empresaId],
            },
            {
                functionCall: 'public.get_api_agendas($1)',
                params: [empresaId],
            },
            {
                functionCall: 'public.get_api_agendas($1)',
                params: [req.auth.userId],
            },
        ];
        let queryResult;
        for (const attempt of functionAttempts) {
            try {
                queryResult = await db_1.default.query(buildAgendaFunctionQuery(attempt.functionCall), attempt.params);
                break;
            }
            catch (error) {
                if (isUndefinedFunctionError(error)) {
                    continue;
                }
                throw error;
            }
        }
        if (!queryResult) {
            console.warn('public.get_api_agendas não está disponível com as assinaturas esperadas. Utilizando consulta direta na tabela agenda.');
            queryResult = await db_1.default.query(`SELECT a.id,
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
        }
        res.json(queryResult.rows);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.listAgendas = listAgendas;
const listAgendasByEmpresa = async (req, res) => {
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
        ORDER BY a.data, a.hora_inicio`, [empresaId]);
        res.json(result.rows);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.listAgendasByEmpresa = listAgendasByEmpresa;
const getTotalCompromissosHoje = async (req, res) => {
    try {
        if (!req.auth) {
            return res.status(401).json({ error: 'Token inválido.' });
        }
        const result = await db_1.default.query(`SELECT COUNT(*) AS total_compromissos_hoje
         FROM public.agenda
        WHERE "data" = CURRENT_DATE
          AND status <> 0
          AND idusuario = $1`, [req.auth.userId]);
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
        const agenda = result.rows[0];
        try {
            await (0, notificationService_1.createNotification)({
                userId: String(req.auth.userId),
                title: `Novo compromisso: ${agenda.titulo}`,
                message: agenda.hora_inicio
                    ? `Evento agendado para ${agenda.data} das ${agenda.hora_inicio} às ${agenda.hora_fim ?? '—'}.`
                    : `Evento agendado para ${agenda.data}.`,
                category: 'agenda',
                type: 'info',
                metadata: {
                    eventId: agenda.id,
                    type: agenda.tipo,
                    clientId: agenda.cliente,
                    status: agenda.status,
                    locationType: agenda.tipo_local,
                    location: agenda.local,
                    reminder: agenda.lembrete,
                },
            });
        }
        catch (notifyError) {
            console.error('Falha ao enviar notificação de criação de agenda', notifyError);
        }
        res.status(201).json(agenda);
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
        const agenda = result.rows[0];
        try {
            await (0, notificationService_1.createNotification)({
                userId: String(req.auth.userId),
                title: `Compromisso atualizado: ${agenda.titulo}`,
                message: agenda.hora_inicio
                    ? `Evento atualizado para ${agenda.data} das ${agenda.hora_inicio} às ${agenda.hora_fim ?? '—'}.`
                    : `Evento atualizado para ${agenda.data}.`,
                category: 'agenda',
                type: 'info',
                metadata: {
                    eventId: agenda.id,
                    type: agenda.tipo,
                    clientId: agenda.cliente,
                    status: agenda.status,
                    locationType: agenda.tipo_local,
                    location: agenda.local,
                    reminder: agenda.lembrete,
                    updatedAt: agenda.dataatualizacao,
                },
            });
        }
        catch (notifyError) {
            console.error('Falha ao enviar notificação de atualização de agenda', notifyError);
        }
        res.json(agenda);
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
