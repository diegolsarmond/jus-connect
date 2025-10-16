import { Request, Response } from 'express';
import { PoolClient } from 'pg';
import {
  fetchPlanLimitsForCompany,
  countCompanyResource,
} from '../services/planLimitsService';

import pool from '../services/db';
import { notificarAtualizacao, notificarCriacao } from '../services/processoNotificationService';
import { Processo, ProcessoAttachment, ProcessoParticipant } from '../models/processo';
import {
  createCompanyOabMonitor,
  deleteCompanyOabMonitor,
  listCompanyOabMonitors,
} from '../services/oabMonitorService';
import { fetchAuthenticatedUserEmpresa } from '../utils/authUser';

import {
  normalizeString,
  normalizeUppercase,
  normalizeParticipantSide,
  normalizeParticipantDocument,
  resolveDocumentKey,
  resolveNullablePositiveInteger,
  resolveNullableNonNegativeInteger,
  parseBooleanFlag,
  parseDiasSemanaArray,
  parsePositiveIntegerQuery,
  parseNonNegativeIntegerQuery,
  normalizeDate,
  normalizeTimestamp,
  parseInteger,
  parseOptionalInteger,
  parseMovimentacoes,
  parseAttachments,
  mergeMovimentacoesWithAttachments,
  buildCrawlerParticipant,
  buildOpportunityParticipant,
  mergeParticipantData,
  mapProcessoRow,
  prepareMovimentacaoRecord,
  sanitizeCpfDigits,
} from '../services/processoNormalizer';


const MOVIMENTACOES_DEFAULT_LIMIT = 200;

const MOVIMENTACOES_BASE_QUERY = `
  SELECT
    id,
    numero_cnj,
    instancia_processo,
    tipo_andamento,
    descricao,
    sigiloso,
    data_movimentacao,
    data_cadastro
  FROM public.trigger_movimentacao_processo
  WHERE numero_cnj = $1
  ORDER BY
    data_movimentacao DESC NULLS LAST,
    id DESC
`;

const fetchProcessoMovimentacoes = async (
  numeroCnj: string | null | undefined,
  client?: PoolClient,
  limit: number = MOVIMENTACOES_DEFAULT_LIMIT,
): Promise<Processo['movimentacoes']> => {
  const normalizedNumero = normalizeString(numeroCnj);

  if (!normalizedNumero) {
    return [];
  }

  const executor = client ?? pool;
  const trimmedLimit = Number.isFinite(limit) && limit > 0 ? Math.trunc(limit) : 0;
  const query =
    trimmedLimit > 0
      ? `${MOVIMENTACOES_BASE_QUERY}
  LIMIT $2`
      : MOVIMENTACOES_BASE_QUERY;
  const params = trimmedLimit > 0 ? [normalizedNumero, trimmedLimit] : [normalizedNumero];
  const result = await executor.query(query, params);
  return parseMovimentacoes(result.rows);
};

const ANEXOS_BASE_QUERY = `
SELECT DISTINCT ON (ap.id)
  ap.id AS id_anexo,
  ap.id,
  ap.sequencia AS sequencia_anexo,
  mp.id AS id_andamento,
  ap.nome,
  ap.tipo,
  ap.data_cadastro,
  ap."dataHoraJuntada" AS data_andamento,
  ap.instancia_processo,
  NULL::text AS crawl_id,
  mp.data_cadastro AS movimentacao_criado_em,
  mp.data_movimentacao AS movimentacao_data_andamento
FROM public.trigger_anexos_processo ap
LEFT JOIN public.trigger_movimentacao_processo mp
  ON mp.numero_cnj = ap.numero_cnj
 AND mp.instancia_processo = ap.instancia_processo
 AND mp.data_movimentacao = ap."dataHoraJuntada"
WHERE ap.numero_cnj = $1
ORDER BY ap.id, mp.data_movimentacao DESC NULLS LAST
`;

const fetchProcessoAnexos = async (
  numeroCnj: string | null | undefined,
  client?: PoolClient,
): Promise<Processo['attachments']> => {
  const normalizedNumero = normalizeString(numeroCnj);

  if (!normalizedNumero) {
    return [];
  }

  const executor = client ?? pool;
  const result = await executor.query(ANEXOS_BASE_QUERY, [normalizedNumero]);
  return parseAttachments(result.rows);
};

const baseProcessoSelect = `
  SELECT
    p.id,
    p.cliente_id,
    p.idempresa,
    p.numero_cnj AS numero,
    p.uf,
    p.municipio,
    p.orgao_julgador,
    COALESCE(dp.area, tp.nome, p.tipo) AS tipo,
    COALESCE(dp.situacao, sp.nome, p.status) AS status,
    COALESCE(dp.classe, p.classe_judicial) AS classe_judicial,
    COALESCE(dp.assunto, p.assunto) AS assunto,
    COALESCE(dp.jurisdicao, p.jurisdicao) AS jurisdicao,
    p.oportunidade_id,
    o.sequencial_empresa AS oportunidade_sequencial_empresa,
    o.data_criacao AS oportunidade_data_criacao,
    o.numero_processo_cnj AS oportunidade_numero_processo_cnj,
    o.numero_protocolo AS oportunidade_numero_protocolo,
    o.solicitante_id AS oportunidade_solicitante_id,
    solicitante.nome AS oportunidade_solicitante_nome,
    p.advogado_responsavel,
    p.data_distribuicao,
    p.criado_em,
    p.atualizado_em,
    p.ultima_sincronizacao,
    p.consultas_api_count,
    p.grau,
    p.justica_gratuita,
    p.liminar,
    p.nivel_sigilo,
    p.tramitacaoatual,
    p.permite_peticionar,
    p.envolvidos_id,
    p.descricao,
    p.setor_id,
    s.nome AS setor_nome,
    p.data_citacao,
    p.data_recebimento,
    p.data_arquivamento,
    p.data_encerramento,
    p.instancia,
    p.sistema_cnj_id,
    p.monitorar_processo,
    p.situacao_processo_id,
    sp.nome AS situacao_processo_nome,
    p.tipo_processo_id,
    tp.nome AS tipo_processo_nome,
    p.area_atuacao_id,
    aa.nome AS area_atuacao_nome,
    (
      SELECT MAX(pm.data)
      FROM public.processo_movimentacoes pm
      WHERE pm.processo_id = p.id
    ) AS ultima_movimentacao,
    (
      SELECT COUNT(*)::int
      FROM public.processo_movimentacoes pm
      WHERE pm.processo_id = p.id
    ) AS movimentacoes_count,
    c.nome AS cliente_nome,
    c.documento AS cliente_documento,
    c.tipo AS cliente_tipo,
    (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', pa.usuario_id,
            'nome', u.nome_completo,
            'oab', COALESCE(
              NULLIF(CONCAT_WS('/', NULLIF(up.oab_number, ''), NULLIF(up.oab_uf, '')), ''),
              NULLIF(u.oab, '')
            )
          ) ORDER BY u.nome_completo
        ) FILTER (WHERE pa.usuario_id IS NOT NULL),
        '[]'::jsonb
      )
      FROM public.processo_advogados pa
      LEFT JOIN public.usuarios u ON u.id = pa.usuario_id
      LEFT JOIN public.user_profiles up ON up.user_id = pa.usuario_id
      WHERE pa.processo_id = p.id
    ) AS advogados,
    NULL::jsonb AS movimentacoes,
    NULL::jsonb AS attachments
  FROM public.processos p
  LEFT JOIN public.oportunidades o ON o.id = p.oportunidade_id
  LEFT JOIN public.clientes solicitante ON solicitante.id = o.solicitante_id
  LEFT JOIN public.clientes c ON c.id = p.cliente_id
  LEFT JOIN public.situacao_processo sp ON sp.id = p.situacao_processo_id
  LEFT JOIN public.tipo_processo tp ON tp.id = p.tipo_processo_id
  LEFT JOIN public.area_atuacao aa ON aa.id = p.area_atuacao_id
  LEFT JOIN public.setores s ON s.id = p.setor_id
  LEFT JOIN public.trigger_dados_processo dp ON dp.numero_cnj = p.numero_cnj
`;

const listProcessoSelect = baseProcessoSelect;

const mapProcessoListRow = mapProcessoRow;

type RawCrawlerParticipant = {
  nome?: unknown;
  polo?: unknown;
  tipo_pessoa?: unknown;
  documento_principal?: unknown;
  tipo_documento_principal?: unknown;
  data_cadastro?: unknown;
  tipo_parte?: unknown;
};

type RawOpportunityParticipant = {
  id?: unknown;
  oportunidade_id?: unknown;
  nome?: unknown;
  documento?: unknown;
  telefone?: unknown;
  endereco?: unknown;
  relacao?: unknown;
  polo?: unknown;
  tipo_pessoa?: unknown;
  numero_cnj?: unknown;
  party_role?: unknown;
  side?: unknown;
};

const fetchProcessParticipants = async (
  numeroCnj: string | null | undefined,
  oportunidadeId: number | null | undefined,
  client?: PoolClient,
): Promise<ProcessoParticipant[]> => {
  const normalizedNumero = normalizeString(numeroCnj);
  const executor = client ?? pool;

  let crawlerRows: RawCrawlerParticipant[] = [];

  if (normalizedNumero) {
    const crawlerResult = await executor.query(
      `SELECT
          nome,
          CASE
            WHEN polo = 'Passive' THEN 'Passivo'
            WHEN polo = 'Active' THEN 'Ativo'
            ELSE polo
          END AS polo,
          tipo_pessoa,
          documento_principal,
          tipo_documento_principal,
          data_cadastro,
          tipo_parte
        FROM public.trigger_envolvidos_processo
       WHERE numero_cnj = $1`,
      [normalizedNumero],
    );

    crawlerRows = Array.isArray(crawlerResult.rows)
      ? (crawlerResult.rows as RawCrawlerParticipant[])
      : [];
  }

  let oportunidadeRows: RawOpportunityParticipant[] = [];

  const opportunityConditions: string[] = [];
  const opportunityParams: Array<string | number> = [];

  if (
    typeof oportunidadeId === 'number' &&
    Number.isInteger(oportunidadeId) &&
    oportunidadeId > 0
  ) {
    opportunityParams.push(oportunidadeId);
    const index = opportunityParams.length;
    opportunityConditions.push(`oportunidade_id = $${index}`);
  }

  if (normalizedNumero) {
    opportunityParams.push(normalizedNumero);
    const numeroIndex = opportunityParams.length;
    opportunityConditions.push(
      `(
        to_jsonb(oe)->>'numero_cnj' = $${numeroIndex}
        OR to_jsonb(oe)->>'numero_processo_cnj' = $${numeroIndex}
      )`,
    );
  }

  if (opportunityConditions.length > 0) {
    const whereClause = opportunityConditions
      .map((condition) => `(${condition})`)
      .join(' OR ');

    const oportunidadeResult = await executor.query(
      `SELECT
         id,
         oportunidade_id,
         nome,
         documento,
         telefone,
         endereco,
         relacao,
         to_jsonb(oe)->>'polo' AS polo,
         to_jsonb(oe)->>'tipo_pessoa' AS tipo_pessoa,
         to_jsonb(oe)->>'numero_cnj' AS numero_cnj,
         to_jsonb(oe)->>'party_role' AS party_role,
         to_jsonb(oe)->>'side' AS side
       FROM public.oportunidade_envolvidos oe
       WHERE ${whereClause}`,
      opportunityParams,
    );

    oportunidadeRows = Array.isArray(oportunidadeResult.rows)
      ? (oportunidadeResult.rows as RawOpportunityParticipant[])
      : [];
  }

  const participants: ProcessoParticipant[] = [];
  const participantsByDocument = new Map<string, ProcessoParticipant>();

  const registerParticipant = (participant: ProcessoParticipant | null) => {
    if (!participant) {
      return;
    }

    const documentKey = resolveDocumentKey(participant.document ?? null);

    if (documentKey) {
      const existing = participantsByDocument.get(documentKey);

      if (existing) {
        if (!existing.side && participant.side) {
          existing.side = participant.side;
        } else if (!participant.side && existing.side) {
          participant.side = existing.side;
        }

        mergeParticipantData(existing, participant);
        return;
      }

      participantsByDocument.set(documentKey, participant);
    }

    participants.push(participant);
  };

  crawlerRows.forEach((row) => {
    registerParticipant(buildCrawlerParticipant(row));
  });

  oportunidadeRows.forEach((row) => {
    registerParticipant(buildOpportunityParticipant(row));
  });

  const filteredParticipants = participants.filter((participant) => {
    const resolvedSide =
      participant.side ??
      normalizeParticipantSide(participant.type) ??
      normalizeParticipantSide(participant.role) ??
      normalizeParticipantSide(participant.party_role);

    if (resolvedSide !== 'ativo' && resolvedSide !== 'passivo') {
      return false;
    }

    const normalizedPersonType = normalizeUppercase(participant.person_type);

    return normalizedPersonType !== 'AUTORIDADE';
  });

  return filteredParticipants.map((participant) => {
    const normalizedName = normalizeString(participant.name);
    const normalizedDocument = normalizeString(participant.document);
    const normalizedType = normalizeString(participant.type);
    const normalizedRole = normalizeString(participant.role);
    const normalizedPartyRole = normalizeString(participant.party_role);
    const normalizedPersonType = normalizeUppercase(participant.person_type);
    const normalizedDocumentType = normalizeUppercase(participant.document_type);
    const normalizedRegisteredAt = normalizeTimestamp(participant.registered_at);

    const resolvedSide =
      participant.side ??
      normalizeParticipantSide(normalizedType) ??
      normalizeParticipantSide(normalizedRole) ??
      normalizeParticipantSide(normalizedPartyRole);

    const normalizedLawyers = Array.isArray(participant.lawyers)
      ? participant.lawyers
          .map((lawyer) => ({
            name: normalizeString(lawyer?.name ?? ''),
            document: normalizeString(lawyer?.document ?? ''),
          }))
          .filter(
            (lawyer): lawyer is { name: string | null; document: string | null } =>
              Boolean(lawyer.name) || Boolean(lawyer.document),
          )
      : null;

    const normalizedRepresentatives = Array.isArray(participant.representatives)
      ? participant.representatives
          .map((rep) => ({
            name: normalizeString(rep?.name ?? ''),
            document: normalizeString(rep?.document ?? ''),
          }))
          .filter(
            (rep): rep is { name: string | null; document: string | null } =>
              Boolean(rep.name) || Boolean(rep.document),
          )
      : null;

    return {
      ...participant,
      name: normalizedName,
      document: normalizedDocument,
      document_type: normalizedDocumentType,
      side: resolvedSide,
      type: normalizedType,
      role: normalizedRole,
      party_role: normalizedPartyRole,
      person_type: normalizedPersonType,
      registered_at: normalizedRegisteredAt,
      lawyers: normalizedLawyers,
      representatives: normalizedRepresentatives,
    };
  });
};

const AUTO_LINK_BATCH_LIMIT = 25;

const tryAutoLinkProcessClientByCpf = async (
  processId: number,
  numeroCnj: string,
  oportunidadeId: number | null,
  empresaId: number,
): Promise<void> => {
  const participants = await fetchProcessParticipants(numeroCnj, oportunidadeId);

  if (!Array.isArray(participants) || participants.length === 0) {
    return;
  }

  const cpfSet = new Set<string>();

  for (const participant of participants) {
    const digits = sanitizeCpfDigits(participant.document);
    if (digits) {
      cpfSet.add(digits);
    }
  }

  if (cpfSet.size === 0) {
    return;
  }

  const documentos = Array.from(cpfSet);

  const clientResult = await pool.query(
    `SELECT id, nome, documento, tipo
       FROM public.clientes
      WHERE documento = ANY($1::text[])
        AND idempresa IS NOT DISTINCT FROM $2
      LIMIT 2`,
    [documentos, empresaId],
  );

  const matchedClients = clientResult.rows
    .map((row) => {
      const idValue = Number((row as { id?: unknown }).id);
      if (!Number.isInteger(idValue) || idValue <= 0) {
        return null;
      }

      const documentoDigits = sanitizeCpfDigits(
        typeof (row as { documento?: unknown }).documento === 'string'
          ? (row as { documento: string }).documento
          : null,
      );

      if (!documentoDigits || !cpfSet.has(documentoDigits)) {
        return null;
      }

      const nomeValue =
        typeof (row as { nome?: unknown }).nome === 'string'
          ? (row as { nome: string }).nome
          : null;

      const tipoRaw = (row as { tipo?: unknown }).tipo;
      const tipoValue =
        tipoRaw === null || tipoRaw === undefined
          ? null
          : typeof tipoRaw === 'string'
            ? tipoRaw
            : String(tipoRaw);

      return {
        id: idValue,
        nome: nomeValue,
        documento: documentoDigits,
        tipo: tipoValue,
      };
    })
    .filter(
      (
        value,
      ): value is {
        id: number;
        nome: string | null;
        documento: string;
        tipo: string | null;
      } => value !== null,
    );

  if (matchedClients.length !== 1) {
    return;
  }

  const client = matchedClients[0];

  await pool.query(
    `UPDATE public.processos
        SET cliente_id = $1,
            atualizado_em = NOW()
      WHERE id = $2
        AND (cliente_id IS NULL OR cliente_id <= 0)`,
    [client.id, processId],
  );
};

const autoLinkProcessesWithoutClient = async (
  empresaId: number,
  limit: number,
): Promise<void> => {
  if (!Number.isInteger(empresaId) || empresaId <= 0) {
    return;
  }

  const baseLimit = Number.isFinite(limit) && limit > 0 ? Math.trunc(limit) : AUTO_LINK_BATCH_LIMIT;
  const effectiveLimit = Math.max(1, Math.min(baseLimit, AUTO_LINK_BATCH_LIMIT));

  const candidateResult = await pool.query(
    `SELECT id, numero_cnj, oportunidade_id
       FROM public.processos
      WHERE idempresa = $1
        AND (cliente_id IS NULL OR cliente_id <= 0)
        AND numero_cnj IS NOT NULL
      ORDER BY atualizado_em DESC
      LIMIT $2`,
    [empresaId, effectiveLimit],
  );

  for (const row of candidateResult.rows) {
    const processId = Number((row as { id?: unknown }).id);
    if (!Number.isInteger(processId) || processId <= 0) {
      continue;
    }

    const numeroValue = normalizeString((row as { numero_cnj?: unknown }).numero_cnj);
    if (!numeroValue) {
      continue;
    }

    const oportunidadeIdValue = parseOptionalInteger(
      (row as { oportunidade_id?: unknown }).oportunidade_id,
    );

    try {
      await tryAutoLinkProcessClientByCpf(
        processId,
        numeroValue,
        oportunidadeIdValue,
        empresaId,
      );
    } catch (error) {
      console.error('Erro ao vincular cliente automaticamente ao processo', error);
    }
  }
};





export const listProcessos = async (req: Request, res: Response) => {
  try {
    if (!req.auth) {
      return res.status(401).json({ error: 'Token inválido.' });
    }

    const empresaLookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);

    if (!empresaLookup.success) {
      return res.status(empresaLookup.status).json({ error: empresaLookup.message });
    }

    const { empresaId } = empresaLookup;

    const limitParam =
      parsePositiveIntegerQuery(req.query.pageSize) ?? parsePositiveIntegerQuery(req.query.limit);
    const pageParam = parsePositiveIntegerQuery(req.query.page);
    const offsetParam = parseNonNegativeIntegerQuery(req.query.offset);

    if (empresaId === null) {
      const resolvedLimit = limitParam ?? 0;
      res.setHeader('X-Total-Count', '0');
      return res.json({
        rows: [],
        total: 0,
        page: 1,
        pageSize: resolvedLimit,
        summary: {
          andamento: 0,
          arquivados: 0,
          clientes: 0,
          totalSincronizacoes: 0,
          statusOptions: [],
          tipoOptions: [],
        },
      });
    }

    const limit = limitParam ?? null;
    const offset =
      offsetParam !== null
        ? offsetParam
        : limit !== null && pageParam !== null
          ? (pageParam - 1) * limit
          : null;
    const onlyWithoutClient = parseBooleanFlag(req.query.semCliente) === true;

    if (onlyWithoutClient) {
      try {
        const autoLinkLimit = limitParam ?? AUTO_LINK_BATCH_LIMIT;
        await autoLinkProcessesWithoutClient(empresaId, autoLinkLimit);
      } catch (autoLinkError) {
        console.error('Erro ao vincular cliente automaticamente ao processo', autoLinkError);
      }
    }

    const queryParams: unknown[] = [empresaId];
    const whereConditions = ['p.idempresa = $1'];

    if (onlyWithoutClient) {
      whereConditions.push('(p.cliente_id IS NULL OR p.cliente_id <= 0)');
    }
    let paginationClause = '';

    if (limit !== null) {
      queryParams.push(limit);
      paginationClause += ` LIMIT $${queryParams.length}`;
    }

    if (offset !== null) {
      queryParams.push(offset);
      paginationClause += ` OFFSET $${queryParams.length}`;
    }

    const listPromise = pool.query(
      `${listProcessoSelect}
       WHERE ${whereConditions.join(' AND ')}
       ORDER BY p.criado_em DESC${paginationClause}`,
      queryParams
    );

    const totalPromise = pool.query(
      `SELECT COUNT(*)::bigint AS total FROM public.processos p WHERE p.idempresa = $1${
        onlyWithoutClient ? ' AND (p.cliente_id IS NULL OR p.cliente_id <= 0)' : ''
      }`,
      [empresaId]
    );

    const summaryPromise = pool.query(
      `SELECT
         COALESCE(dp.situacao, sp.nome) AS status,
         COALESCE(dp.area, tp.nome) AS tipo,
         p.cliente_id,
         (
           SELECT COUNT(*)::int
           FROM public.processo_consultas_api pc
           WHERE pc.processo_id = p.id
         ) AS consultas_api_count
       FROM public.processos p
       LEFT JOIN public.tipo_processo tp ON tp.id = p.tipo_processo_id
       LEFT JOIN public.situacao_processo sp ON sp.id = p.situacao_processo_id
       LEFT JOIN public.trigger_dados_processo dp ON dp.numero_cnj = p.numero_cnj
       WHERE ${whereConditions.join(' AND ')}`,
      [empresaId]
    );

    const [result, totalResult, summaryResult] = await Promise.all([
      listPromise,
      totalPromise,
      summaryPromise,
    ]);

    const rows = result.rows.map(mapProcessoListRow);

    const totalRow = totalResult.rows[0] as { total?: unknown } | undefined;
    const totalValue = (() => {
      if (!totalRow) {
        return 0;
      }

      if (typeof totalRow.total === 'number') {
        return totalRow.total;
      }

      if (typeof totalRow.total === 'bigint') {
        return Number(totalRow.total);
      }

      if (typeof totalRow.total === 'string') {
        const parsed = Number.parseInt(totalRow.total, 10);
        return Number.isFinite(parsed) ? parsed : 0;
      }

      return 0;
    })();

    const summaryRows = summaryResult.rows as Array<{
      status: unknown;
      tipo: unknown;
      cliente_id: unknown;
      consultas_api_count: unknown;
    }>;

    const statusSet = new Set<string>();
    const tipoSet = new Set<string>();
    const clienteSet = new Set<number>();
    let andamentoCount = 0;
    let arquivadoCount = 0;
    let totalConsultas = 0;

    const arquivadoKeywords = ['arquiv', 'baix', 'encerr', 'finaliz', 'transit', 'extint'];

    summaryRows.forEach((row) => {
      const statusRaw = typeof row.status === 'string' ? row.status.trim() : '';

      if (statusRaw && statusRaw.toLowerCase() !== 'não informado') {
        statusSet.add(statusRaw);
      }

      const normalizedStatus = statusRaw ? stripDiacritics(statusRaw).toLowerCase() : '';
      if (arquivadoKeywords.some((keyword) => normalizedStatus.includes(keyword))) {
        arquivadoCount += 1;
      } else {
        andamentoCount += 1;
      }

      const tipoRaw = typeof row.tipo === 'string' ? row.tipo.trim() : '';
      if (tipoRaw && tipoRaw.toLowerCase() !== 'não informado') {
        tipoSet.add(tipoRaw);
      }

      const clienteId = (() => {
        if (typeof row.cliente_id === 'number' && Number.isInteger(row.cliente_id)) {
          return row.cliente_id;
        }

        if (typeof row.cliente_id === 'string') {
          const parsed = Number.parseInt(row.cliente_id, 10);
          return Number.isFinite(parsed) ? parsed : null;
        }

        return null;
      })();

      if (clienteId !== null) {
        clienteSet.add(clienteId);
      }

      const consultasValue = (() => {
        if (typeof row.consultas_api_count === 'number') {
          return row.consultas_api_count;
        }

        if (typeof row.consultas_api_count === 'string') {
          const parsed = Number.parseInt(row.consultas_api_count, 10);
          return Number.isFinite(parsed) ? parsed : 0;
        }

        return 0;
      })();

      if (Number.isFinite(consultasValue)) {
        totalConsultas += consultasValue;
      }
    });

    const resolvedLimit = limit ?? (totalValue > 0 ? totalValue : rows.length);
    const resolvedOffset = offset ?? 0;
    const resolvedPage = resolvedLimit > 0 ? Math.floor(resolvedOffset / resolvedLimit) + 1 : 1;
    const resolvedPageSize = resolvedLimit > 0 ? resolvedLimit : totalValue;

    res.setHeader('X-Total-Count', String(totalValue));

    return res.json({
      rows,
      total: totalValue,
      page: resolvedPage,
      pageSize: resolvedPageSize,
      summary: {
        andamento: andamentoCount,
        arquivados: arquivadoCount,
        clientes: clienteSet.size,
        totalSincronizacoes: totalConsultas,
        statusOptions: Array.from(statusSet).sort((a, b) => a.localeCompare(b)),
        tipoOptions: Array.from(tipoSet).sort((a, b) => a.localeCompare(b)),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const listProcessosByCliente = async (req: Request, res: Response) => {
  const { clienteId } = req.params;
  const parsedClienteId = Number(clienteId);

  if (!Number.isInteger(parsedClienteId) || parsedClienteId <= 0) {
    return res.status(400).json({ error: 'clienteId inválido' });
  }

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
      return res.json([]);
    }

    const result = await pool.query(
      `${listProcessoSelect}
       WHERE p.cliente_id = $1
         AND p.idempresa = $2
       ORDER BY p.criado_em DESC`,
      [parsedClienteId, empresaId]
    );

    res.json(result.rows.map(mapProcessoListRow));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getProcessoById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const trimmedId = typeof id === 'string' ? id.trim() : '';
  const parsedId = Number(trimmedId);
  const hasNumericId = Number.isInteger(parsedId) && parsedId > 0;
  const normalizedNumero = hasNumericId ? null : normalizeString(trimmedId);

  if (!hasNumericId && !normalizedNumero) {
    return res.status(400).json({ error: 'ID inválido' });
  }

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
      return res.status(404).json({ error: 'Processo não encontrado' });
    }

    let query: string;
    let params: (string | number)[];

    if (hasNumericId) {
      query = `${baseProcessoSelect}
       WHERE p.id = $1
         AND p.idempresa = $2
       LIMIT 1`;
      params = [parsedId, empresaId];
    } else {
      if (!normalizedNumero) {
        return res.status(400).json({ error: 'ID inválido' });
      }

      query = `${baseProcessoSelect}
       WHERE p.numero_cnj = $1
         AND p.idempresa = $2
       LIMIT 1`;
      params = [normalizedNumero, empresaId];
    }

    const result = await pool.query(query, params);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Processo não encontrado' });
    }

    const processo = mapProcessoRow(result.rows[0]);

    const [participants, movimentacoes, attachments] = await Promise.all([
      fetchProcessParticipants(processo.numero, processo.oportunidade_id),
      fetchProcessoMovimentacoes(processo.numero),
      fetchProcessoAnexos(processo.numero),
    ]);

    processo.movimentacoes = mergeMovimentacoesWithAttachments(
      movimentacoes,
      attachments,
    );
    processo.attachments = attachments;
    processo.participants = participants.length > 0 ? participants : [];

    res.json(processo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createProcessoMovimentacaoManual = async (
  req: Request,
  res: Response,
) => {
  const { id } = req.params;
  const trimmedId = typeof id === 'string' ? id.trim() : '';
  const parsedId = Number(trimmedId);
  const hasNumericId = Number.isInteger(parsedId) && parsedId > 0;
  const normalizedNumero = hasNumericId ? null : normalizeString(trimmedId);

  if (!hasNumericId && !normalizedNumero) {
    return res.status(400).json({ error: 'ID inválido' });
  }

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
      return res.status(404).json({ error: 'Processo não encontrado' });
    }

    let processoResult;

    if (hasNumericId) {
      processoResult = await pool.query(
        'SELECT numero_cnj, instancia FROM public.processos WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2',
        [parsedId, empresaId],
      );
    } else {
      if (!normalizedNumero) {
        return res.status(400).json({ error: 'ID inválido' });
      }

      processoResult = await pool.query(
        'SELECT numero_cnj, instancia FROM public.processos WHERE numero_cnj = $1 AND idempresa IS NOT DISTINCT FROM $2',
        [normalizedNumero, empresaId],
      );
    }

    if (processoResult.rowCount === 0) {
      return res.status(404).json({ error: 'Processo não encontrado' });
    }

    const processoData = processoResult.rows[0];
    const numeroCnj = normalizeString(processoData?.numero_cnj);

    if (!numeroCnj) {
      return res.status(404).json({ error: 'Processo não encontrado' });
    }
    const instanciaRaw = processoData?.instancia;
    let instanciaProcesso: number | null = null;

    if (typeof instanciaRaw === 'number' && Number.isFinite(instanciaRaw)) {
      instanciaProcesso = Math.trunc(instanciaRaw);
    } else if (typeof instanciaRaw === 'string') {
      const parsed = Number.parseInt(instanciaRaw.trim(), 10);
      instanciaProcesso = Number.isFinite(parsed) ? parsed : null;
    }

    const preparedRecord = prepareMovimentacaoRecord({
      data: req.body?.data ?? null,
      tipo: req.body?.tipo ?? null,
      tipo_publicacao: req.body?.tipo_publicacao ?? null,
      classificacao_predita: req.body?.classificacao_predita ?? null,
      conteudo: req.body?.conteudo ?? null,
      texto_categoria: req.body?.texto_categoria ?? null,
      fonte: req.body?.fonte ?? null,
    });

    if (!preparedRecord) {
      return res.status(400).json({ error: 'Dados da movimentação inválidos' });
    }

    const sigilosoValue = parseBooleanFlag(req.body?.sigiloso) ?? false;
    const insertResult = await pool.query(
      `INSERT INTO public.trigger_movimentacao_processo (
         numero_cnj,
         instancia_processo,
         tipo_andamento,
         descricao,
         sigiloso,
         data_movimentacao
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING
         id,
         numero_cnj,
         instancia_processo,
         tipo_andamento,
         descricao,
         sigiloso,
         data_movimentacao,
         data_cadastro`,
      [
        numeroCnj,
        instanciaProcesso,
        preparedRecord.tipo,
        preparedRecord.conteudo,
        sigilosoValue,
        preparedRecord.data,
      ],
    );

    const insertedRow = insertResult.rows[0];

    if (!insertedRow) {
      throw new Error('Falha ao criar movimentação');
    }

    const movimentacoes = parseMovimentacoes([insertedRow]) ?? [];

    if (movimentacoes.length === 0) {
      throw new Error('Falha ao processar movimentação criada');
    }

    return res.status(201).json(movimentacoes[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const createProcesso = async (req: Request, res: Response) => {
  const {
    cliente_id,
    numero,
    uf,
    municipio,
    orgao_julgador,
    tipo,
    status,
    classe_judicial,
    assunto,
    jurisdicao,
    advogado_responsavel,
    data_distribuicao,
    advogados,
    situacao_processo_id,
    tipo_processo_id,
    area_atuacao_id,
    instancia,
    sistema_cnj_id,
    monitorar_processo,
    envolvidos_id,
    descricao,
    setor_id,
    data_citacao,
    data_recebimento,
    data_arquivamento,
    data_encerramento,
  } = req.body;

  const parsedClienteId = Number(cliente_id);

  if (!Number.isInteger(parsedClienteId) || parsedClienteId <= 0) {
    return res.status(400).json({ error: 'cliente_id inválido' });
  }

  const numeroValue = normalizeString(numero);
  const ufValue = normalizeUppercase(uf);
  const municipioValue = normalizeString(municipio);
  const orgaoValue = normalizeString(orgao_julgador);
  const grauValue = normalizeString(req.body?.grau);

  if (!numeroValue || !ufValue || !municipioValue || !grauValue) {
    return res.status(400).json({
      error:
        'Os campos cliente_id, numero, uf, municipio e grau são obrigatórios',
    });
  }

  const tipoValue = normalizeString(tipo);
  const statusValue = normalizeString(status);
  const classeValue = normalizeString(classe_judicial);
  const assuntoValue = normalizeString(assunto);
  const jurisdicaoValue = normalizeString(jurisdicao);
  const advogadoValue = normalizeString(advogado_responsavel);
  const dataDistribuicaoValue = normalizeDate(data_distribuicao);
  const justicaGratuitaFlag = parseBooleanFlag(req.body?.justica_gratuita);
  const liminarFlag = parseBooleanFlag(req.body?.liminar);
  const permitePeticionarFlag = parseBooleanFlag(req.body?.permite_peticionar);
  const nivelSigiloValue = parseOptionalInteger(req.body?.nivel_sigilo);

  if (nivelSigiloValue !== null && nivelSigiloValue < 0) {
    return res.status(400).json({ error: 'nivel_sigilo inválido' });
  }

  const tramitacaoAtualValue = normalizeString(
    req.body?.tramitacao_atual ?? req.body?.tramitacaoatual,
  );
  const oportunidadeResolution = resolveNullablePositiveInteger(
    req.body?.oportunidade_id ?? req.body?.proposta_id ?? null,
  );

  if (!oportunidadeResolution.ok) {
    return res.status(400).json({ error: 'oportunidade_id inválido' });
  }

  const oportunidadeIdValue = oportunidadeResolution.value;
  const situacaoProcessoResolution = resolveNullablePositiveInteger(
    situacao_processo_id,
  );

  if (!situacaoProcessoResolution.ok) {
    return res.status(400).json({ error: 'situacao_processo_id inválido' });
  }

  let situacaoProcessoIdValue = situacaoProcessoResolution.value;

  const tipoProcessoResolution = resolveNullablePositiveInteger(
    tipo_processo_id,
  );

  if (!tipoProcessoResolution.ok) {
    return res.status(400).json({ error: 'tipo_processo_id inválido' });
  }

  let tipoProcessoIdValue = tipoProcessoResolution.value;

  const areaAtuacaoResolution = resolveNullablePositiveInteger(
    area_atuacao_id,
  );

  if (!areaAtuacaoResolution.ok) {
    return res.status(400).json({ error: 'area_atuacao_id inválido' });
  }

  const areaAtuacaoIdValue = areaAtuacaoResolution.value;

  const sistemaCnjResolution = resolveNullablePositiveInteger(sistema_cnj_id);

  if (!sistemaCnjResolution.ok) {
    return res.status(400).json({ error: 'sistema_cnj_id inválido' });
  }

  const sistemaCnjIdValue = sistemaCnjResolution.value;

  const envolvidosResolution = resolveNullablePositiveInteger(envolvidos_id);

  if (!envolvidosResolution.ok) {
    return res.status(400).json({ error: 'envolvidos_id inválido' });
  }

  const envolvidosIdValue = envolvidosResolution.value;

  const setorResolution = resolveNullablePositiveInteger(setor_id);

  if (!setorResolution.ok) {
    return res.status(400).json({ error: 'setor_id inválido' });
  }

  const setorIdValue = setorResolution.value;
  const instanciaValue = normalizeString(instancia);
  const descricaoValue = normalizeString(descricao);
  const monitorarProcessoFlag = parseBooleanFlag(monitorar_processo);
  let monitorarProcessoValue = monitorarProcessoFlag;
  const dataCitacaoValue = normalizeDate(data_citacao);
  const dataRecebimentoValue = normalizeDate(data_recebimento);
  const dataArquivamentoValue = normalizeDate(data_arquivamento);
  const dataEncerramentoValue = normalizeDate(data_encerramento);
  const rawAdvogados = Array.isArray(advogados) ? advogados : [];
  const advogadoIds = Array.from(
    new Set(
      rawAdvogados
        .map((value: unknown) => {
          if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
            return value;
          }

          if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) {
              return null;
            }

            const parsed = Number.parseInt(trimmed, 10);
            if (Number.isFinite(parsed) && parsed > 0) {
              return parsed;
            }
          }

          return null;
        })
        .filter((value): value is number => value !== null && Number.isInteger(value) && value > 0)
    )
  );

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
        .status(400)
        .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
    }

    const planLimits = await fetchPlanLimitsForCompany(empresaId);
    if (planLimits?.limiteProcessos != null) {
      const processosCount = await countCompanyResource(
        empresaId,
        'processos',
      );
      if (processosCount >= planLimits.limiteProcessos) {
        return res
          .status(403)
          .json({ error: 'Limite de processos do plano atingido.' });
      }
    }

    const clienteExists = await pool.query(
      'SELECT 1 FROM public.clientes WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2',
      [parsedClienteId, empresaId]
    );

    if (clienteExists.rowCount === 0) {
      return res.status(400).json({ error: 'Cliente não encontrado' });
    }

    if (tipoProcessoIdValue === null && tipoValue && empresaId !== null) {
      const tipoLookup = await pool.query(
        'SELECT id FROM public.tipo_processo WHERE idempresa IS NOT DISTINCT FROM $1 AND LOWER(nome) = LOWER($2) LIMIT 1',
        [empresaId, tipoValue],
      );

      if ((tipoLookup.rowCount ?? 0) > 0) {
        const resolvedId = parseOptionalInteger(tipoLookup.rows[0]?.id);
        if (resolvedId) {
          tipoProcessoIdValue = resolvedId;
        }
      }
    }

    if (situacaoProcessoIdValue === null && statusValue) {
      const situacaoLookup = await pool.query(
        'SELECT id FROM public.situacao_processo WHERE LOWER(nome) = LOWER($1) LIMIT 1',
        [statusValue],
      );

      if ((situacaoLookup.rowCount ?? 0) > 0) {
        const resolvedSituacaoId = parseOptionalInteger(
          situacaoLookup.rows[0]?.id,
        );
        if (resolvedSituacaoId) {
          situacaoProcessoIdValue = resolvedSituacaoId;
        }
      }
    }

    if (oportunidadeIdValue !== null) {
      const oportunidadeExists = await pool.query(
        'SELECT 1 FROM public.oportunidades WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2',
        [oportunidadeIdValue, empresaId],
      );

      if (oportunidadeExists.rowCount === 0) {
        return res.status(400).json({ error: 'Proposta não encontrada' });
      }
    }

    let advogadosSelecionados: Array<{ id: number; nome: string | null }> = [];

    if (advogadoIds.length > 0) {
      const advResult = await pool.query(
        `SELECT id, COALESCE(nome_completo, email, '') AS nome
         FROM public.usuarios
         WHERE id = ANY($1::int[])
           AND empresa IS NOT DISTINCT FROM $2`,
        [advogadoIds, empresaId]
      );

      const advogadosMap = new Map<number, string | null>();
      for (const row of advResult.rows) {
        const idValue = Number((row as { id: unknown }).id);
        if (Number.isInteger(idValue)) {
          const nomeValue = (row as { nome?: unknown }).nome;
          advogadosMap.set(
            idValue,
            typeof nomeValue === 'string' ? nomeValue : null
          );
        }
      }

      const missingAdvogados = advogadoIds.filter((id) => !advogadosMap.has(id));

      if (missingAdvogados.length > 0) {
        return res.status(400).json({
          error:
            'Um ou mais advogados informados não pertencem à empresa autenticada.',
        });
      }

      advogadosSelecionados = advogadoIds.map((id) => ({
        id,
        nome: advogadosMap.get(id) ?? null,
      }));
    }

    const advogadoConcatValue = advogadosSelecionados
      .map((item) => (item.nome ? item.nome.trim() : ''))
      .filter((nome) => nome !== '')
      .join(', ');

    const advogadoColumnValue = advogadoConcatValue || advogadoValue;
    const finalMonitorarProcesso = monitorarProcessoValue ?? false;
    const finalPermitePeticionar = permitePeticionarFlag ?? true;

    const clientDb = await pool.connect();

    try {
      await clientDb.query('BEGIN');

      const insertResult = await clientDb.query(
        `INSERT INTO public.processos (
            cliente_id,
            numero_cnj,
            uf,
            municipio,
            orgao_julgador,
            situacao_processo_id,
            classe_judicial,
            assunto,
            jurisdicao,
            oportunidade_id,
            advogado_responsavel,
            data_distribuicao,
            idempresa,
            area_atuacao_id,
            tipo_processo_id,
            instancia,
            sistema_cnj_id,
            monitorar_processo,
            envolvidos_id,
            descricao,
            setor_id,
            data_citacao,
            data_recebimento,
            data_arquivamento,
            data_encerramento,
            grau,
            justica_gratuita,
            liminar,
            nivel_sigilo,
            tramitacaoatual,
            permite_peticionar
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            $12,
            $13,
            $14,
            $15,
            $16,
            $17,
            $18,
            $19,
            $20,
            $21,
            $22,
            $23,
            $24,
            $25,
            $26,
            $27,
            $28,
            $29,
            $30,
            $31
          )
          RETURNING id`,
        [
          parsedClienteId,
          numeroValue,
          ufValue,
          municipioValue,
          orgaoValue,
          situacaoProcessoIdValue,
          classeValue,
          assuntoValue,
          jurisdicaoValue,
          oportunidadeIdValue,
          advogadoColumnValue,
          dataDistribuicaoValue,
          empresaId,
          areaAtuacaoIdValue,
          tipoProcessoIdValue,
          instanciaValue,
          sistemaCnjIdValue,
          finalMonitorarProcesso,
          envolvidosIdValue,
          descricaoValue,
          setorIdValue,
          dataCitacaoValue,
          dataRecebimentoValue,
          dataArquivamentoValue,
          dataEncerramentoValue,
          grauValue,
          justicaGratuitaFlag,
          liminarFlag,
          nivelSigiloValue,
          tramitacaoAtualValue,
          finalPermitePeticionar,
        ]
      );

      const processoIdRow = insertResult.rows[0] as { id: number } | undefined;

      if (!processoIdRow || !processoIdRow.id) {
        throw new Error('Falha ao cadastrar o processo.');
      }

      const processoId = processoIdRow.id;

      if (advogadosSelecionados.length > 0) {
        const values: unknown[] = [];
        const placeholders = advogadosSelecionados
          .map((adv, index) => {
            values.push(processoId, adv.id);
            const baseIndex = index * 2;
            return `($${baseIndex + 1}, $${baseIndex + 2})`;
          })
          .join(', ');

        await clientDb.query(
          `INSERT INTO public.processo_advogados (processo_id, usuario_id)
           VALUES ${placeholders}
           ON CONFLICT (processo_id, usuario_id) DO UPDATE
             SET atualizado_em = NOW()`,
          values
        );
      }

      const finalResult = await clientDb.query(
        `${baseProcessoSelect}
         WHERE p.id = $1
         LIMIT 1`,
        [processoId]
      );

      await clientDb.query('COMMIT');


      if (finalResult.rowCount === 0) {
        throw new Error('Não foi possível localizar o processo recém-criado.');
      }

      const processo = mapProcessoRow(finalResult.rows[0]);

      await notificarCriacao({
        processo,
        criadorId: req.auth.userId,
        advogadosSelecionados,
      });

      res.status(201).json(processo);
    } catch (transactionError) {
      await clientDb.query('ROLLBACK');
      throw transactionError;
    } finally {
      clientDb.release();
    }
  } catch (error: any) {
    console.error(error);

    if (error?.code === '23505') {
      return res.status(409).json({ error: 'Número de processo já cadastrado' });
    }

    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateProcesso = async (req: Request, res: Response) => {
  const { id } = req.params;
  const parsedId = Number(id);

  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  const {
    cliente_id,
    numero,
    uf,
    municipio,
    orgao_julgador,
    tipo,
    status,
    classe_judicial,
    assunto,
    jurisdicao,
    advogado_responsavel,
    data_distribuicao,
    advogados,
    situacao_processo_id,
    tipo_processo_id,
    area_atuacao_id,
    instancia,
    sistema_cnj_id,
    monitorar_processo,
    envolvidos_id,
    descricao,
    setor_id,
    data_citacao,
    data_recebimento,
    data_arquivamento,
    data_encerramento,
  } = req.body;

  const body = req.body ?? {};
  const hasBodyField = (field: string) =>
    Object.prototype.hasOwnProperty.call(body, field);

  const parsedClienteId = Number(cliente_id);

  if (!Number.isInteger(parsedClienteId) || parsedClienteId <= 0) {
    return res.status(400).json({ error: 'cliente_id inválido' });
  }

  const numeroValue = normalizeString(numero);
  const ufValue = normalizeUppercase(uf);
  const municipioValue = normalizeString(municipio);
  const orgaoValue = normalizeString(orgao_julgador);
  const grauValue = normalizeString(req.body?.grau);
  let finalNumeroValue = numeroValue;
  let finalUfValue = ufValue;
  let finalMunicipioValue = municipioValue;
  let finalGrauValue = grauValue;

  const tipoValue = normalizeString(tipo);
  const statusValue = normalizeString(status);
  const classeValue = normalizeString(classe_judicial);
  const assuntoValue = normalizeString(assunto);
  const jurisdicaoValue = normalizeString(jurisdicao);
  const advogadoValue = normalizeString(advogado_responsavel);
  const dataDistribuicaoValue = normalizeDate(data_distribuicao);
  const justicaGratuitaFlag = parseBooleanFlag(req.body?.justica_gratuita);
  const liminarFlag = parseBooleanFlag(req.body?.liminar);
  const permitePeticionarFlag = parseBooleanFlag(req.body?.permite_peticionar);
  const nivelSigiloValue = parseOptionalInteger(req.body?.nivel_sigilo);

  if (nivelSigiloValue !== null && nivelSigiloValue < 0) {
    return res.status(400).json({ error: 'nivel_sigilo inválido' });
  }

  const tramitacaoAtualValue = normalizeString(
    req.body?.tramitacao_atual ?? req.body?.tramitacaoatual,
  );
  const oportunidadeResolution = resolveNullablePositiveInteger(
    req.body?.oportunidade_id ?? req.body?.proposta_id ?? null,
  );

  if (!oportunidadeResolution.ok) {
    return res.status(400).json({ error: 'oportunidade_id inválido' });
  }

  const oportunidadeIdValue = oportunidadeResolution.value;
  const situacaoProcessoResolution = resolveNullablePositiveInteger(
    situacao_processo_id,
  );

  if (!situacaoProcessoResolution.ok) {
    return res.status(400).json({ error: 'situacao_processo_id inválido' });
  }

  let situacaoProcessoIdValue = situacaoProcessoResolution.value;

  const tipoProcessoResolution = resolveNullablePositiveInteger(
    tipo_processo_id,
  );

  if (!tipoProcessoResolution.ok) {
    return res.status(400).json({ error: 'tipo_processo_id inválido' });
  }

  let tipoProcessoIdValue = tipoProcessoResolution.value;

  const areaAtuacaoResolution = resolveNullablePositiveInteger(
    area_atuacao_id,
  );

  if (!areaAtuacaoResolution.ok) {
    return res.status(400).json({ error: 'area_atuacao_id inválido' });
  }

  let areaAtuacaoIdValue = areaAtuacaoResolution.value;

  const sistemaCnjResolution = resolveNullablePositiveInteger(sistema_cnj_id);

  if (!sistemaCnjResolution.ok) {
    return res.status(400).json({ error: 'sistema_cnj_id inválido' });
  }

  let sistemaCnjIdValue = sistemaCnjResolution.value;

  const envolvidosResolution = resolveNullablePositiveInteger(envolvidos_id);

  if (!envolvidosResolution.ok) {
    return res.status(400).json({ error: 'envolvidos_id inválido' });
  }

  let envolvidosIdValue = envolvidosResolution.value;

  const setorResolution = resolveNullablePositiveInteger(setor_id);

  if (!setorResolution.ok) {
    return res.status(400).json({ error: 'setor_id inválido' });
  }

  let setorIdValue = setorResolution.value;
  const instanciaValue = normalizeString(instancia);
  const descricaoValue = normalizeString(descricao);
  const monitorarProcessoFlag = parseBooleanFlag(monitorar_processo);
  let monitorarProcessoValue = monitorarProcessoFlag;
  const dataCitacaoValue = normalizeDate(data_citacao);
  const dataRecebimentoValue = normalizeDate(data_recebimento);
  const dataArquivamentoValue = normalizeDate(data_arquivamento);
  const dataEncerramentoValue = normalizeDate(data_encerramento);
  const rawAdvogados = Array.isArray(advogados) ? advogados : null;
  const shouldUpdateAdvogados = rawAdvogados !== null;
  const advogadoIds = rawAdvogados
    ? Array.from(
        new Set(
          rawAdvogados
            .map((value: unknown) => {
              if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
                return value;
              }

              if (typeof value === 'string') {
                const trimmed = value.trim();
                if (!trimmed) {
                  return null;
                }

                const parsed = Number.parseInt(trimmed, 10);
                if (Number.isFinite(parsed) && parsed > 0) {
                  return parsed;
                }
              }

              return null;
            })
            .filter((value): value is number => value !== null && Number.isInteger(value) && value > 0),
        ),
      )
    : [];

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
        .status(400)
        .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
    }

    if (oportunidadeIdValue !== null) {
      const oportunidadeExists = await pool.query(
        'SELECT 1 FROM public.oportunidades WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2',
        [oportunidadeIdValue, empresaId],
      );

      if (oportunidadeExists.rowCount === 0) {
        return res.status(400).json({ error: 'Proposta não encontrada' });
      }
    }

    const existingProcess = await pool.query(
      `SELECT monitorar_processo,
              numero_cnj,
              uf,
              municipio,
              grau,
              orgao_julgador,
              situacao_processo_id,
              classe_judicial,
              assunto,
              jurisdicao,
              oportunidade_id,
              advogado_responsavel,
              data_distribuicao,
              area_atuacao_id,
              tipo_processo_id,
              instancia,
              sistema_cnj_id,
              envolvidos_id,
              descricao,
              setor_id,
              data_citacao,
              data_recebimento,
              data_arquivamento,
              data_encerramento,
              justica_gratuita,
              liminar,
              nivel_sigilo,
              tramitacaoatual,
              permite_peticionar
         FROM public.processos
        WHERE id = $1
          AND idempresa IS NOT DISTINCT FROM $2`,
      [parsedId, empresaId],
    );

    if (existingProcess.rowCount === 0) {
      return res.status(404).json({ error: 'Processo não encontrado' });
    }

    const existingRow = existingProcess.rows[0] as Record<string, unknown>;

    if (monitorarProcessoValue === null) {
      monitorarProcessoValue = existingRow['monitorar_processo'] === true;
    }

    if (!finalNumeroValue) {
      const existingNumero = normalizeString(existingRow['numero_cnj']);
      if (existingNumero) {
        finalNumeroValue = existingNumero;
      }
    }

    if (!finalUfValue) {
      const existingUf = normalizeUppercase(existingRow['uf']);
      if (existingUf) {
        finalUfValue = existingUf;
      }
    }

    if (!finalMunicipioValue) {
      const existingMunicipio = normalizeString(existingRow['municipio']);
      if (existingMunicipio) {
        finalMunicipioValue = existingMunicipio;
      }
    }

    if (!finalGrauValue) {
      const existingGrau = normalizeString(existingRow['grau']);
      if (existingGrau) {
        finalGrauValue = existingGrau;
      }
    }

    let finalOrgaoValue = orgaoValue;
    if (!hasBodyField('orgao_julgador')) {
      finalOrgaoValue = normalizeString(existingRow['orgao_julgador']);
    }

    let finalClasseValue = classeValue;
    if (!hasBodyField('classe_judicial')) {
      finalClasseValue = normalizeString(existingRow['classe_judicial']);
    }

    let finalAssuntoValue = assuntoValue;
    if (!hasBodyField('assunto')) {
      finalAssuntoValue = normalizeString(existingRow['assunto']);
    }

    let finalJurisdicaoValue = jurisdicaoValue;
    if (!hasBodyField('jurisdicao')) {
      finalJurisdicaoValue = normalizeString(existingRow['jurisdicao']);
    }

    const hasOportunidadeField =
      hasBodyField('oportunidade_id') || hasBodyField('proposta_id');
    let finalOportunidadeIdValue = oportunidadeIdValue;
    if (!hasOportunidadeField) {
      finalOportunidadeIdValue = parseOptionalInteger(existingRow['oportunidade_id']);
    }

    const existingAdvogadoResponsavel = normalizeString(
      existingRow['advogado_responsavel'],
    );

    const existingDataDistribuicao = normalizeDate(existingRow['data_distribuicao']);

    let finalDataDistribuicaoValue = dataDistribuicaoValue;
    if (!hasBodyField('data_distribuicao')) {
      finalDataDistribuicaoValue = existingDataDistribuicao;
    }

    const existingSituacaoProcessoId = parseOptionalInteger(
      existingRow['situacao_processo_id'],
    );
    if (!hasBodyField('situacao_processo_id') && !statusValue) {
      situacaoProcessoIdValue = existingSituacaoProcessoId;
    }

    const existingTipoProcessoId = parseOptionalInteger(existingRow['tipo_processo_id']);
    if (!hasBodyField('tipo_processo_id') && !tipoValue) {
      tipoProcessoIdValue = existingTipoProcessoId;
    }

    const existingAreaAtuacaoId = parseOptionalInteger(existingRow['area_atuacao_id']);
    if (!hasBodyField('area_atuacao_id')) {
      areaAtuacaoIdValue = existingAreaAtuacaoId;
    }

    let finalInstanciaValue = instanciaValue;
    if (!hasBodyField('instancia')) {
      finalInstanciaValue = normalizeString(existingRow['instancia']);
    }

    const existingSistemaCnjId = parseOptionalInteger(existingRow['sistema_cnj_id']);
    if (!hasBodyField('sistema_cnj_id')) {
      sistemaCnjIdValue = existingSistemaCnjId;
    }

    const existingEnvolvidosId = parseOptionalInteger(existingRow['envolvidos_id']);
    if (!hasBodyField('envolvidos_id')) {
      envolvidosIdValue = existingEnvolvidosId;
    }

    let finalDescricaoValue = descricaoValue;
    if (!hasBodyField('descricao')) {
      finalDescricaoValue = normalizeString(existingRow['descricao']);
    }

    const existingSetorId = parseOptionalInteger(existingRow['setor_id']);
    if (!hasBodyField('setor_id')) {
      setorIdValue = existingSetorId;
    }

    const existingDataCitacao = normalizeDate(existingRow['data_citacao']);
    const existingDataRecebimento = normalizeDate(existingRow['data_recebimento']);
    const existingDataArquivamento = normalizeDate(existingRow['data_arquivamento']);
    const existingDataEncerramento = normalizeDate(existingRow['data_encerramento']);

    let finalDataCitacaoValue = dataCitacaoValue;
    if (!hasBodyField('data_citacao')) {
      finalDataCitacaoValue = existingDataCitacao;
    }

    let finalDataRecebimentoValue = dataRecebimentoValue;
    if (!hasBodyField('data_recebimento')) {
      finalDataRecebimentoValue = existingDataRecebimento;
    }

    let finalDataArquivamentoValue = dataArquivamentoValue;
    if (!hasBodyField('data_arquivamento')) {
      finalDataArquivamentoValue = existingDataArquivamento;
    }

    let finalDataEncerramentoValue = dataEncerramentoValue;
    if (!hasBodyField('data_encerramento')) {
      finalDataEncerramentoValue = existingDataEncerramento;
    }

    let finalJusticaGratuitaFlag = justicaGratuitaFlag;
    if (!hasBodyField('justica_gratuita')) {
      finalJusticaGratuitaFlag = parseBooleanFlag(existingRow['justica_gratuita']);
    }

    let finalLiminarFlag = liminarFlag;
    if (!hasBodyField('liminar')) {
      finalLiminarFlag = parseBooleanFlag(existingRow['liminar']);
    }

    let finalNivelSigiloValue = nivelSigiloValue;
    if (!hasBodyField('nivel_sigilo')) {
      finalNivelSigiloValue = parseOptionalInteger(existingRow['nivel_sigilo']);
    }

    const hasTramitacaoField =
      hasBodyField('tramitacao_atual') || hasBodyField('tramitacaoatual');
    let finalTramitacaoAtualValue = tramitacaoAtualValue;
    if (!hasTramitacaoField) {
      finalTramitacaoAtualValue = normalizeString(existingRow['tramitacaoatual']);
    }

    if (!finalNumeroValue || !finalUfValue || !finalMunicipioValue || !finalGrauValue) {
      return res.status(400).json({
        error:
          'Os campos cliente_id, numero, uf, municipio e grau são obrigatórios',
      });
    }

    const clienteExists = await pool.query(
      'SELECT 1 FROM public.clientes WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2',
      [parsedClienteId, empresaId],
    );

    if (clienteExists.rowCount === 0) {
      return res.status(400).json({ error: 'Cliente não encontrado' });
    }

    if (tipoProcessoIdValue === null && tipoValue && empresaId !== null) {
      const tipoLookup = await pool.query(
        'SELECT id FROM public.tipo_processo WHERE idempresa IS NOT DISTINCT FROM $1 AND LOWER(nome) = LOWER($2) LIMIT 1',
        [empresaId, tipoValue],
      );

      if ((tipoLookup.rowCount ?? 0) > 0) {
        const resolvedId = parseOptionalInteger(tipoLookup.rows[0]?.id);
        if (resolvedId) {
          tipoProcessoIdValue = resolvedId;
        }
      }
    }

    if (situacaoProcessoIdValue === null && statusValue) {
      const situacaoLookup = await pool.query(
        'SELECT id FROM public.situacao_processo WHERE LOWER(nome) = LOWER($1) LIMIT 1',
        [statusValue],
      );

      if ((situacaoLookup.rowCount ?? 0) > 0) {
        const resolvedSituacaoId = parseOptionalInteger(
          situacaoLookup.rows[0]?.id,
        );
        if (resolvedSituacaoId) {
          situacaoProcessoIdValue = resolvedSituacaoId;
        }
      }
    }

    let advogadosSelecionados: Array<{ id: number; nome: string | null }> = [];

    if (advogadoIds.length > 0) {
      const advResult = await pool.query(
        `SELECT id, COALESCE(nome_completo, email, '') AS nome
         FROM public.usuarios
         WHERE id = ANY($1::int[])
           AND empresa IS NOT DISTINCT FROM $2`,
        [advogadoIds, empresaId],
      );

      const advogadosMap = new Map<number, string | null>();
      for (const row of advResult.rows) {
        const idValue = Number((row as { id: unknown }).id);
        if (Number.isInteger(idValue)) {
          const nomeValue = (row as { nome?: unknown }).nome;
          advogadosMap.set(
            idValue,
            typeof nomeValue === 'string' ? nomeValue : null,
          );
        }
      }

      const missingAdvogados = advogadoIds.filter((id) => !advogadosMap.has(id));

      if (missingAdvogados.length > 0) {
        return res.status(400).json({
          error:
            'Um ou mais advogados informados não pertencem à empresa autenticada.',
        });
      }

      advogadosSelecionados = advogadoIds.map((id) => ({
        id,
        nome: advogadosMap.get(id) ?? null,
      }));
    }

    const advogadoConcatValue = advogadosSelecionados
      .map((item) => (item.nome ? item.nome.trim() : ''))
      .filter((nome) => nome !== '')
      .join(', ');

    const hasAdvogadoResponsavelField = hasBodyField('advogado_responsavel');
    let finalAdvogadoColumnValue = advogadoConcatValue || advogadoValue;
    if (!shouldUpdateAdvogados && !hasAdvogadoResponsavelField) {
      finalAdvogadoColumnValue = existingAdvogadoResponsavel;
    }

    const finalMonitorarProcesso = monitorarProcessoValue ?? false;

    let finalPermitePeticionarFlag = permitePeticionarFlag;
    if (!hasBodyField('permite_peticionar')) {
      finalPermitePeticionarFlag = parseBooleanFlag(
        existingRow['permite_peticionar'],
      );
    }
    const finalPermitePeticionar = finalPermitePeticionarFlag ?? true;

    const clientDb = await pool.connect();

    try {
      await clientDb.query('BEGIN');

      const updateResult = await clientDb.query(
        `UPDATE public.processos
            SET cliente_id = $1,
                numero_cnj = $2,
                uf = $3,
                municipio = $4,
                orgao_julgador = $5,
                situacao_processo_id = $6,
                classe_judicial = $7,
                assunto = $8,
                jurisdicao = $9,
                oportunidade_id = $10,
                advogado_responsavel = $11,
                data_distribuicao = $12,
                area_atuacao_id = $13,
                tipo_processo_id = $14,
                instancia = $15,
                sistema_cnj_id = $16,
                monitorar_processo = $17,
                envolvidos_id = $18,
                descricao = $19,
                setor_id = $20,
                data_citacao = $21,
                data_recebimento = $22,
                data_arquivamento = $23,
                data_encerramento = $24,
                grau = $25,
                justica_gratuita = $26,
                liminar = $27,
                nivel_sigilo = $28,
                tramitacaoatual = $29,
                permite_peticionar = $30,
                atualizado_em = NOW()
          WHERE id = $31
            AND idempresa IS NOT DISTINCT FROM $32
          RETURNING id`,
        [
          parsedClienteId,
          finalNumeroValue,
          finalUfValue,
          finalMunicipioValue,
          finalOrgaoValue,
          situacaoProcessoIdValue,
          finalClasseValue,
          finalAssuntoValue,
          finalJurisdicaoValue,
          finalOportunidadeIdValue,
          finalAdvogadoColumnValue,
          finalDataDistribuicaoValue,
          areaAtuacaoIdValue,
          tipoProcessoIdValue,
          finalInstanciaValue,
          sistemaCnjIdValue,
          finalMonitorarProcesso,
          envolvidosIdValue,
          finalDescricaoValue,
          setorIdValue,
          finalDataCitacaoValue,
          finalDataRecebimentoValue,
          finalDataArquivamentoValue,
          finalDataEncerramentoValue,
          finalGrauValue,
          finalJusticaGratuitaFlag,
          finalLiminarFlag,
          finalNivelSigiloValue,
          finalTramitacaoAtualValue,
          finalPermitePeticionar,
          parsedId,
          empresaId,
        ],
      );

      if (updateResult.rowCount === 0) {
        await clientDb.query('ROLLBACK');
        return res.status(404).json({ error: 'Processo não encontrado' });
      }

      if (shouldUpdateAdvogados) {
        await clientDb.query(
          'DELETE FROM public.processo_advogados WHERE processo_id = $1',
          [parsedId],
        );

        if (advogadosSelecionados.length > 0) {
          const values: unknown[] = [];
          const placeholders = advogadosSelecionados
            .map((adv, index) => {
              values.push(parsedId, adv.id);
              const baseIndex = index * 2;
              return `($${baseIndex + 1}, $${baseIndex + 2})`;
            })
            .join(', ');

          await clientDb.query(
            `INSERT INTO public.processo_advogados (processo_id, usuario_id)
             VALUES ${placeholders}
             ON CONFLICT (processo_id, usuario_id) DO UPDATE
               SET atualizado_em = NOW()`,
            values,
          );
        }
      }

      const finalResult = await clientDb.query(
        `${baseProcessoSelect}
         WHERE p.id = $1
         LIMIT 1`,
        [parsedId],
      );

      await clientDb.query('COMMIT');

      if (finalResult.rowCount === 0) {
        return res.status(404).json({ error: 'Processo não encontrado' });
      }

      const processo = mapProcessoRow(finalResult.rows[0]);

      await notificarAtualizacao({
        processo,
        usuarioAtualizadorId: req.auth?.userId,
        advogadosSelecionados,
      });

      res.json(processo);
    } catch (transactionError) {
      await clientDb.query('ROLLBACK');
      throw transactionError;
    } finally {
      clientDb.release();
    }
  } catch (error: any) {
    console.error(error);

    if (error?.code === '23505') {
      return res.status(409).json({ error: 'Número de processo já cadastrado' });
    }

    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteProcesso = async (req: Request, res: Response) => {
  const { id } = req.params;
  const parsedId = Number(id);

  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    return res.status(400).json({ error: 'ID inválido' });
  }

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
        .status(400)
        .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
    }

    const existingProcess = await pool.query(
      'SELECT 1 FROM public.processos WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2',
      [parsedId, empresaId]
    );

    if (existingProcess.rowCount === 0) {
      return res.status(404).json({ error: 'Processo não encontrado' });
    }

    const result = await pool.query(
      'DELETE FROM public.processos WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2',
      [parsedId, empresaId]
    );

    if (result.rowCount === 0) {
      const processStillExists = await pool.query(
        'SELECT 1 FROM public.processos WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2',
        [parsedId, empresaId]
      );

      if (processStillExists.rowCount === 0) {
        return res.status(404).json({ error: 'Processo não encontrado' });
      }
    }

    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const listOabMonitoradas = async (req: Request, res: Response) => {
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
      return res.json([]);
    }

    const monitors = await listCompanyOabMonitors(empresaId);
    return res.json(monitors);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createOabMonitorada = async (req: Request, res: Response) => {
  const { uf, numero, diasSemana } = req.body ?? {};
  const usuarioIdRaw =
    (req.body as { usuarioId?: unknown })?.usuarioId ??
    (req.body as { usuario_id?: unknown })?.usuario_id;

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
        .status(400)
        .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
    }

    if (typeof uf !== 'string' || typeof numero !== 'string') {
      return res.status(400).json({ error: 'Informe a UF e o número da OAB.' });
    }

    const usuarioId = parseOptionalInteger(usuarioIdRaw);

    if (!usuarioId || usuarioId <= 0) {
      return res
        .status(400)
        .json({ error: 'Informe o usuário responsável pela OAB.' });
    }

    const diasSemanaResult = parseDiasSemanaArray(diasSemana);

    if (!diasSemanaResult.ok) {
      return res.status(400).json({ error: 'Informe ao menos um dia da semana válido.' });
    }

    const planLimits = await fetchPlanLimitsForCompany(empresaId);
    const planLimit = planLimits?.limiteAdvogadosProcessos;

    if (planLimit != null) {
      const normalizedUf =
        typeof uf === 'string'
          ? uf.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase()
          : '';
      const normalizedNumero =
        typeof numero === 'string'
          ? numero.replace(/\D/g, '').slice(0, 12)
          : '';
      const canEvaluateExisting =
        normalizedUf.length === 2 && normalizedNumero.length > 0;
      const monitors = await listCompanyOabMonitors(empresaId);
      const alreadyMonitored =
        canEvaluateExisting &&
        monitors.some(
          (monitor) =>
            monitor.uf === normalizedUf && monitor.numero === normalizedNumero,
        );

      if (!alreadyMonitored && monitors.length >= planLimit) {
        return res.status(400).json({
          error:
            'Limite de advogados monitorados por processos atingido pelo plano atual.',
        });
      }
    }

    try {
      const monitor = await createCompanyOabMonitor(
        empresaId,
        uf,
        numero,
        usuarioId,
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
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteOabMonitorada = async (req: Request, res: Response) => {
  const { id } = req.params;

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
        .status(400)
        .json({ error: 'Usuário autenticado não possui empresa vinculada.' });
    }

    const monitorId = parseOptionalInteger(id);

    if (!monitorId || monitorId <= 0) {
      return res.status(400).json({ error: 'Identificador de OAB inválido.' });
    }

    const deleted = await deleteCompanyOabMonitor(empresaId, monitorId);

    if (!deleted) {
      return res.status(404).json({ error: 'OAB monitorada não encontrada.' });
    }

    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
