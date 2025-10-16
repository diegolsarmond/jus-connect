import { Request, Response } from 'express';
import pool from '../services/db';
import {
  createIntimacaoOabMonitor,
  deleteIntimacaoOabMonitor,
  listIntimacaoOabMonitors,
} from '../services/intimacaoOabMonitorService';
import { fetchPlanLimitsForCompany } from '../services/planLimitsService';
import { fetchAuthenticatedUserEmpresa } from '../utils/authUser';

export const listIntimacoesHandler = async (req: Request, res: Response) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    const empresaLookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);

    if (!empresaLookup.success) {
      return res.status(empresaLookup.status).json({ error: empresaLookup.message });
    }

    const { empresaId } = empresaLookup;

    if (empresaId === null) {
      return res
        .status(403)
        .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
    }

    const result = await pool.query(
      `SELECT id,
              "siglaTribunal",
              external_id,
              numero_processo,
              "nomeOrgao",
              "tipoComunicacao",
              texto,
              prazo,
              data_disponibilizacao,
              created_at,
              updated_at,
              meio,
              link,
              tipodocumento,
              nomeclasse,
              codigoclasse,
              numerocomunicacao,
              ativo,
              hash,
              status,
              motivo_cancelamento,
              data_cancelamento,
              destinatarios,
              destinatarios_advogados,
              idusuario,
              idempresa,
              nao_lida,
              arquivada,
              idusuario_leitura,
              lida_em
         FROM public.intimacoes
        WHERE idempresa = $1 AND "tipoComunicacao" <> 'Lista de distribuição'
        ORDER BY data_disponibilizacao DESC NULLS LAST,
                 created_at DESC NULLS LAST,
                 id DESC`,
      [empresaId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Failed to list intimações', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const archiveIntimacaoHandler = async (req: Request, res: Response) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    const intimacaoId = Number(req.params.id);

    if (!Number.isInteger(intimacaoId) || intimacaoId <= 0) {
      return res.status(400).json({ error: 'Identificador de intimação inválido.' });
    }

    const empresaLookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);

    if (!empresaLookup.success) {
      return res.status(empresaLookup.status).json({ error: empresaLookup.message });
    }

    const { empresaId } = empresaLookup;

    if (empresaId === null) {
      return res
        .status(403)
        .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
    }

    const result = await pool.query(
      `UPDATE public.intimacoes
          SET arquivada = TRUE,
              updated_at = NOW()
        WHERE id = $1
          AND idempresa = $2
        RETURNING id,
                  arquivada,
                  updated_at`,
      [intimacaoId, empresaId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Intimação não encontrada.' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Failed to archive intimação', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const markIntimacaoAsReadHandler = async (req: Request, res: Response) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    const intimacaoId = Number(req.params.id);

    if (!Number.isInteger(intimacaoId) || intimacaoId <= 0) {
      return res.status(400).json({ error: 'Identificador de intimação inválido.' });
    }

    const empresaLookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);

    if (!empresaLookup.success) {
      return res.status(empresaLookup.status).json({ error: empresaLookup.message });
    }

    const { empresaId } = empresaLookup;

    if (empresaId === null) {
      return res
        .status(403)
        .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
    }

    const usuarioId = Number(req.auth.userId);

    if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
      return res.status(400).json({ error: 'Usuário autenticado inválido.' });
    }

    const result = await pool.query(
      `UPDATE public.intimacoes
          SET nao_lida = FALSE,
              updated_at = NOW(),
              idusuario_leitura = $3::bigint,
              lida_em = NOW()
        WHERE id = $1
          AND idempresa = $2
        RETURNING id,
                  nao_lida,
                  updated_at,
                  idusuario_leitura,
                  lida_em`,
      [intimacaoId, empresaId, usuarioId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Intimação não encontrada.' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Failed to mark intimação as read', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const parsePositiveInt = (value: unknown): number | 'invalid' => {
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value <= 0) {
      return 'invalid';
    }

    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (!trimmed) {
      return 'invalid';
    }

    const parsed = Number(trimmed);

    if (!Number.isInteger(parsed) || parsed <= 0) {
      return 'invalid';
    }

    return parsed;
  }

  return 'invalid';
};

const parseDiasSemanaArray = (
  value: unknown,
): { ok: true; value: number[] | null } | { ok: false } => {
  if (value === undefined || value === null) {
    return { ok: true, value: null };
  }

  if (!Array.isArray(value)) {
    return { ok: false };
  }

  const set = new Set<number>();

  for (const item of value) {
    let parsed: number | null = null;

    if (typeof item === 'number' && Number.isInteger(item)) {
      parsed = item;
    } else if (typeof item === 'string') {
      const trimmed = item.trim();
      if (trimmed) {
        const candidate = Number.parseInt(trimmed, 10);
        if (Number.isInteger(candidate)) {
          parsed = candidate;
        }
      }
    }

    if (parsed == null || parsed < 1 || parsed > 7) {
      return { ok: false };
    }

    set.add(Math.trunc(parsed));
  }

  if (set.size === 0) {
    return { ok: false };
  }

  const normalized = Array.from(set).sort((a, b) => a - b);
  return { ok: true, value: normalized };
};

export const listIntimacaoOabMonitoradasHandler = async (req: Request, res: Response) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    const empresaLookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);

    if (!empresaLookup.success) {
      return res.status(empresaLookup.status).json({ error: empresaLookup.message });
    }

    const { empresaId } = empresaLookup;

    if (empresaId === null) {
      return res
        .status(403)
        .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
    }

    const monitors = await listIntimacaoOabMonitors(empresaId);
    return res.json(monitors);
  } catch (error) {
    console.error('Failed to list monitored OABs for intimações', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createIntimacaoOabMonitoradaHandler = async (req: Request, res: Response) => {
  const { uf, numero, usuarioId, diasSemana } = req.body ?? {};

  try {
    if (!req.auth) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    const empresaLookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);

    if (!empresaLookup.success) {
      return res.status(empresaLookup.status).json({ error: empresaLookup.message });
    }

    const { empresaId } = empresaLookup;

    if (empresaId === null) {
      return res
        .status(403)
        .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
    }

    if (typeof uf !== 'string' || typeof numero !== 'string') {
      return res.status(400).json({ error: 'Informe a UF e o número da OAB.' });
    }

    const parsedUsuarioId = parsePositiveInt(usuarioId);

    if (parsedUsuarioId === 'invalid') {
      return res.status(400).json({ error: 'Informe um usuário válido.' });
    }

    const diasSemanaResult = parseDiasSemanaArray(diasSemana);

    if (!diasSemanaResult.ok) {
      return res.status(400).json({ error: 'Informe ao menos um dia da semana válido.' });
    }

    const planLimits = await fetchPlanLimitsForCompany(empresaId);
    const limit = planLimits?.limiteAdvogadosIntimacoesMonitoradas;

    if (limit != null) {
      const normalizedUf = typeof uf === 'string' ? uf.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase() : '';
      const normalizedNumero = typeof numero === 'string' ? numero.replace(/\D/g, '').slice(0, 12) : '';

      const canEvaluateExisting = normalizedUf.length === 2 && normalizedNumero.length > 0;
      const monitors = await listIntimacaoOabMonitors(empresaId);
      const alreadyMonitored =
        canEvaluateExisting &&
        monitors.some((monitor) => monitor.uf === normalizedUf && monitor.numero === normalizedNumero);

      if (!alreadyMonitored && monitors.length >= limit) {
        return res
          .status(400)
          .json({ error: 'Limite de advogados monitorados por intimações atingido pelo plano atual.' });
      }
    }

    try {
      const monitor = await createIntimacaoOabMonitor(
        empresaId,
        parsedUsuarioId,
        uf,
        numero,
        diasSemanaResult.value,
      );
      return res.status(201).json(monitor);
    } catch (serviceError) {
      const message =
        serviceError instanceof Error
          ? serviceError.message
          : 'Não foi possível cadastrar a OAB informada.';
      return res.status(400).json({ error: message });
    }
  } catch (error) {
    console.error('Failed to create monitored OAB for intimações', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteIntimacaoOabMonitoradaHandler = async (req: Request, res: Response) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    const monitorId = parsePositiveInt(req.params.id);

    if (monitorId === 'invalid') {
      return res.status(400).json({ error: 'Identificador de monitoramento inválido.' });
    }

    const empresaLookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);

    if (!empresaLookup.success) {
      return res.status(empresaLookup.status).json({ error: empresaLookup.message });
    }

    const { empresaId } = empresaLookup;

    if (empresaId === null) {
      return res
        .status(403)
        .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
    }

    const deleted = await deleteIntimacaoOabMonitor(empresaId, monitorId);

    if (!deleted) {
      return res.status(404).json({ error: 'Registro de monitoramento não encontrado.' });
    }

    return res.status(204).send();
  } catch (error) {
    console.error('Failed to delete monitored OAB for intimações', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
