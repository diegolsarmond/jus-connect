import { Request, Response } from 'express';
import { PoolClient } from 'pg';
import IntegrationApiKeyService, {
  ESCAVADOR_DEFAULT_API_URL,
} from '../services/integrationApiKeyService';

import pool from '../services/db';
import { Processo } from '../models/processo';
import { fetchAuthenticatedUserEmpresa } from '../utils/authUser';

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

const integrationApiKeyService = new IntegrationApiKeyService();
const DEFAULT_ESCAVADOR_INTEGRATION_ID = 4;
const parsedEscavadorIntegrationId = Number.parseInt(
  process.env.ESCAVADOR_INTEGRATION_ID ?? '',
  10,
);
const ESCAVADOR_INTEGRATION_ID =
  Number.isNaN(parsedEscavadorIntegrationId) || parsedEscavadorIntegrationId <= 0
    ? DEFAULT_ESCAVADOR_INTEGRATION_ID
    : parsedEscavadorIntegrationId;
const FALLBACK_ESCAVADOR_API_BASE_URL =
  normalizeString(process.env.ESCAVADOR_API_BASE_URL) ?? ESCAVADOR_DEFAULT_API_URL;

const normalizeUppercase = (value: unknown): string | null => {
  const normalized = normalizeString(value);
  return normalized ? normalized.toUpperCase() : null;
};

const normalizeDate = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }

  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      return null;
    }

    const isoCandidate = new Date(trimmed);
    if (!Number.isNaN(isoCandidate.getTime())) {
      return isoCandidate.toISOString().slice(0, 10);
    }

    const brFormatMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (brFormatMatch) {
      const [, day, month, year] = brFormatMatch;
      return `${year}-${month}-${day}`;
    }

    const isoFormatMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoFormatMatch) {
      return trimmed;
    }
  }

  return null;
};

const normalizeTimestamp = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }

    return trimmed;
  }

  return null;
};

const parseInteger = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return 0;
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
};

type RawAdvogado = {
  id?: number | string | null;
  nome?: string | null;
  name?: string | null;
};

const parseAdvogados = (value: unknown): Processo['advogados'] => {
  const advogados: Processo['advogados'] = [];

  const processRawItem = (item: unknown) => {
    if (!item || typeof item !== 'object') {
      return;
    }

    const raw = item as RawAdvogado;
    const idCandidate = raw.id ?? null;
    let parsedId: number | null = null;

    if (typeof idCandidate === 'number' && Number.isInteger(idCandidate)) {
      parsedId = idCandidate;
    } else if (typeof idCandidate === 'string') {
      const trimmed = idCandidate.trim();
      if (trimmed) {
        const parsed = Number.parseInt(trimmed, 10);
        if (Number.isFinite(parsed)) {
          parsedId = parsed;
        }
      }
    }

    if (!parsedId || parsedId <= 0) {
      return;
    }

    const nomeValue =
      typeof raw.nome === 'string'
        ? raw.nome
        : typeof raw.name === 'string'
          ? raw.name
          : null;

    advogados.push({ id: parsedId, nome: nomeValue });
  };

  if (Array.isArray(value)) {
    value.forEach(processRawItem);
    return advogados;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        parsed.forEach(processRawItem);
      } else {
        processRawItem(parsed);
      }
    } catch {
      // ignore invalid JSON
    }

    return advogados;
  }

  if (value && typeof value === 'object' && 'rows' in (value as Record<string, unknown>)) {
    const possibleArray = (value as { rows?: unknown[] }).rows;
    if (Array.isArray(possibleArray)) {
      possibleArray.forEach(processRawItem);
    }
  }

  return advogados;
};

type RawMovimentacao = {
  id?: number | string | null;
  data?: string | null;
  tipo?: string | null;
  tipo_publicacao?: string | null;
  classificacao_predita?: Record<string, unknown> | null;
  conteudo?: string | null;
  texto_categoria?: string | null;
  fonte?: Record<string, unknown> | null;
  criado_em?: string | null;
  atualizado_em?: string | null;
};

const parseMovimentacoes = (value: unknown): Processo['movimentacoes'] => {
  const movimentacoes: Processo['movimentacoes'] = [];

  const processItem = (item: unknown) => {
    if (!item || typeof item !== 'object') {
      return;
    }

    const raw = item as RawMovimentacao;
    const idCandidate = raw.id ?? null;
    let parsedId: string | null = null;

    if (typeof idCandidate === 'number' && Number.isFinite(idCandidate)) {
      parsedId = String(Math.trunc(idCandidate));
    } else if (typeof idCandidate === 'string') {
      const trimmed = idCandidate.trim();
      if (trimmed) {
        parsedId = trimmed;
      }
    }

    if (!parsedId) {
      return;
    }

    movimentacoes.push({
      id: parsedId,
      data: raw.data ?? null,
      tipo: raw.tipo ?? null,
      tipo_publicacao: raw.tipo_publicacao ?? null,
      classificacao_predita: raw.classificacao_predita ?? null,
      conteudo: raw.conteudo ?? null,
      texto_categoria: raw.texto_categoria ?? null,
      fonte: raw.fonte ?? null,
      criado_em: raw.criado_em ?? null,
      atualizado_em: raw.atualizado_em ?? null,
    });
  };

  if (Array.isArray(value)) {
    value.forEach(processItem);
    return movimentacoes;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        parsed.forEach(processItem);
      } else {
        processItem(parsed);
      }
    } catch {
      // ignore invalid JSON
    }

    return movimentacoes;
  }

  return movimentacoes;
};

const MOVIMENTACOES_DEFAULT_LIMIT = 200;

const MOVIMENTACOES_BASE_QUERY = `
  SELECT
    pm.id,
    pm.data,
    pm.tipo,
    pm.tipo_publicacao,
    pm.classificacao_predita,
    pm.conteudo,
    pm.texto_categoria,
    pm.fonte,
    pm.criado_em,
    pm.atualizado_em
  FROM public.processo_movimentacoes pm
  WHERE pm.processo_id = $1
  ORDER BY pm.data DESC NULLS LAST, pm.id DESC
`;

const fetchProcessoMovimentacoes = async (
  processoId: number,
  client?: PoolClient,
  limit: number = MOVIMENTACOES_DEFAULT_LIMIT,
): Promise<Processo['movimentacoes']> => {
  const executor = client ?? pool;
  const trimmedLimit = Number.isFinite(limit) && limit > 0 ? Math.trunc(limit) : 0;
  const query =
    trimmedLimit > 0
      ? `${MOVIMENTACOES_BASE_QUERY}\n  LIMIT $2`
      : MOVIMENTACOES_BASE_QUERY;
  const params = trimmedLimit > 0 ? [processoId, trimmedLimit] : [processoId];
  const result = await executor.query(query, params);
  return parseMovimentacoes(result.rows);
};

const safeJsonStringify = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  try {
    return JSON.stringify(value);
  } catch (error) {
    console.error('Erro ao serializar JSON de movimentação', error);
    return null;
  }
};

type PreparedMovimentacaoRecord = {
  id: string;
  data: string | null;
  tipo: string | null;
  tipo_publicacao: string | null;
  classificacao_predita: string | null;
  conteudo: string | null;
  texto_categoria: string | null;
  fonte: string | null;
};

const prepareMovimentacaoRecord = (
  item: unknown
): PreparedMovimentacaoRecord | null => {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const raw = item as Record<string, unknown>;
  const idCandidate = raw.id;
  let id: string | null = null;

  if (typeof idCandidate === 'number' && Number.isFinite(idCandidate)) {
    id = String(Math.trunc(idCandidate));
  } else if (typeof idCandidate === 'string') {
    const trimmed = idCandidate.trim();
    if (trimmed) {
      id = trimmed;
    }
  }

  if (!id) {
    return null;
  }

  const dataValue = normalizeDate(raw.data) ?? normalizeString(raw.data);

  return {
    id,
    data: dataValue,
    tipo: normalizeString(raw.tipo),
    tipo_publicacao: normalizeString(raw.tipo_publicacao),
    classificacao_predita: safeJsonStringify(raw.classificacao_predita),
    conteudo: normalizeString(raw.conteudo),
    texto_categoria: normalizeString(raw.texto_categoria),
    fonte: safeJsonStringify(raw.fonte),
  };
};

const baseProcessoSelect = `
  SELECT
    p.id,
    p.cliente_id,
    p.idempresa,
    p.numero,
    p.uf,
    p.municipio,
    p.orgao_julgador,
    p.tipo,
    p.status,
    p.classe_judicial,
    p.assunto,
    p.jurisdicao,
    p.advogado_responsavel,
    p.data_distribuicao,
    p.criado_em,
    p.atualizado_em,
    p.ultima_sincronizacao,
    p.consultas_api_count,
    c.nome AS cliente_nome,
    c.documento AS cliente_documento,
    c.tipo AS cliente_tipo,
    (
      SELECT COALESCE(
        jsonb_agg(jsonb_build_object('id', pa.usuario_id, 'nome', u.nome_completo) ORDER BY u.nome_completo)
          FILTER (WHERE pa.usuario_id IS NOT NULL),
        '[]'::jsonb
      )
      FROM public.processo_advogados pa
      LEFT JOIN public.usuarios u ON u.id = pa.usuario_id
      WHERE pa.processo_id = p.id
    ) AS advogados,
    (
      SELECT COUNT(*)::int
      FROM public.processo_movimentacoes pm
      WHERE pm.processo_id = p.id
    ) AS movimentacoes_count
  FROM public.processos p
  LEFT JOIN public.clientes c ON c.id = p.cliente_id
`;

const mapProcessoRow = (row: any): Processo => ({
  id: row.id,
  cliente_id: row.cliente_id,
  idempresa: row.idempresa ?? null,
  numero: row.numero,
  uf: row.uf,
  municipio: row.municipio,
  orgao_julgador: row.orgao_julgador,
  tipo: row.tipo,
  status: row.status,
  classe_judicial: row.classe_judicial,
  assunto: row.assunto,
  jurisdicao: row.jurisdicao,
  advogado_responsavel: row.advogado_responsavel,
  data_distribuicao: row.data_distribuicao,
  criado_em: row.criado_em,
  atualizado_em: row.atualizado_em,
  ultima_sincronizacao: normalizeTimestamp(row.ultima_sincronizacao),
  consultas_api_count: parseInteger(row.consultas_api_count),
  movimentacoes_count: parseInteger(row.movimentacoes_count),
  cliente: row.cliente_id
    ? {
        id: row.cliente_id,
        nome: row.cliente_nome ?? null,
        documento: row.cliente_documento ?? null,
        tipo:
          row.cliente_tipo === null || row.cliente_tipo === undefined
            ? null
            : String(row.cliente_tipo),
      }
    : null,
  advogados: parseAdvogados(row.advogados),
  movimentacoes: parseMovimentacoes(row.movimentacoes),
});

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

    if (empresaId === null) {
      return res.json([]);
    }

    const result = await pool.query(
      `${baseProcessoSelect}
       WHERE p.idempresa IS NOT DISTINCT FROM $1
       ORDER BY p.criado_em DESC`,
      [empresaId]
    );

    return res.json(result.rows.map(mapProcessoRow));
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
      `${baseProcessoSelect}
       WHERE p.cliente_id = $1
         AND p.idempresa IS NOT DISTINCT FROM $2
       ORDER BY p.criado_em DESC`,
      [parsedClienteId, empresaId]
    );

    res.json(result.rows.map(mapProcessoRow));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getProcessoById = async (req: Request, res: Response) => {
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
      return res.status(404).json({ error: 'Processo não encontrado' });
    }

    const result = await pool.query(
      `${baseProcessoSelect}
       WHERE p.id = $1
         AND p.idempresa IS NOT DISTINCT FROM $2
       LIMIT 1`,
      [parsedId, empresaId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Processo não encontrado' });
    }

    const processo = mapProcessoRow(result.rows[0]);
    processo.movimentacoes = await fetchProcessoMovimentacoes(parsedId);

    res.json(processo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
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
  } = req.body;

  const parsedClienteId = Number(cliente_id);

  if (!Number.isInteger(parsedClienteId) || parsedClienteId <= 0) {
    return res.status(400).json({ error: 'cliente_id inválido' });
  }

  const numeroValue = normalizeString(numero);
  const ufValue = normalizeUppercase(uf);
  const municipioValue = normalizeString(municipio);
  const orgaoValue = normalizeString(orgao_julgador);

  if (!numeroValue || !ufValue || !municipioValue) {
    return res.status(400).json({
      error: 'Os campos cliente_id, numero, uf e municipio são obrigatórios',
    });
  }

  const tipoValue = normalizeString(tipo);
  const statusValue = normalizeString(status);
  const classeValue = normalizeString(classe_judicial);
  const assuntoValue = normalizeString(assunto);
  const jurisdicaoValue = normalizeString(jurisdicao);
  const advogadoValue = normalizeString(advogado_responsavel);
  const dataDistribuicaoValue = normalizeDate(data_distribuicao);
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

    const clienteExists = await pool.query(
      'SELECT 1 FROM public.clientes WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2',
      [parsedClienteId, empresaId]
    );

    if (clienteExists.rowCount === 0) {
      return res.status(400).json({ error: 'Cliente não encontrado' });
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

    const clientDb = await pool.connect();

    try {
      await clientDb.query('BEGIN');

      const insertResult = await clientDb.query(
        `INSERT INTO public.processos (
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
            idempresa
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING id`,
        [
          parsedClienteId,
          numeroValue,
          ufValue,
          municipioValue,
          orgaoValue,
          tipoValue,
          statusValue,
          classeValue,
          assuntoValue,
          jurisdicaoValue,
          advogadoColumnValue,
          dataDistribuicaoValue,
          empresaId,
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

      res.status(201).json(mapProcessoRow(finalResult.rows[0]));
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
  } = req.body;

  const parsedClienteId = Number(cliente_id);

  if (!Number.isInteger(parsedClienteId) || parsedClienteId <= 0) {
    return res.status(400).json({ error: 'cliente_id inválido' });
  }

  const numeroValue = normalizeString(numero);
  const ufValue = normalizeUppercase(uf);
  const municipioValue = normalizeString(municipio);
  const orgaoValue = normalizeString(orgao_julgador);

  if (!numeroValue || !ufValue || !municipioValue) {
    return res.status(400).json({
      error: 'Os campos cliente_id, numero, uf e municipio são obrigatórios',
    });
  }

  const tipoValue = normalizeString(tipo);
  const statusValue = normalizeString(status);
  const classeValue = normalizeString(classe_judicial);
  const assuntoValue = normalizeString(assunto);
  const jurisdicaoValue = normalizeString(jurisdicao);
  const advogadoValue = normalizeString(advogado_responsavel);
  const dataDistribuicaoValue = normalizeDate(data_distribuicao);
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

    const existingProcess = await pool.query(
      'SELECT id FROM public.processos WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2',
      [parsedId, empresaId]
    );

    if (existingProcess.rowCount === 0) {
      return res.status(404).json({ error: 'Processo não encontrado' });
    }

    const clienteExists = await pool.query(
      'SELECT 1 FROM public.clientes WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2',
      [parsedClienteId, empresaId]
    );

    if (clienteExists.rowCount === 0) {
      return res.status(400).json({ error: 'Cliente não encontrado' });
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

    const clientDb = await pool.connect();

    try {
      await clientDb.query('BEGIN');

      const updateResult = await clientDb.query(
        `UPDATE public.processos
            SET cliente_id = $1,
                numero = $2,
                uf = $3,
                municipio = $4,
                orgao_julgador = $5,
                tipo = $6,
                status = $7,
                classe_judicial = $8,
                assunto = $9,
                jurisdicao = $10,
                advogado_responsavel = $11,
                data_distribuicao = $12,
                atualizado_em = NOW()
          WHERE id = $13
            AND idempresa IS NOT DISTINCT FROM $14
          RETURNING id`,
        [
          parsedClienteId,
          numeroValue,
          ufValue,
          municipioValue,
          orgaoValue,
          tipoValue,
          statusValue,
          classeValue,
          assuntoValue,
          jurisdicaoValue,
          advogadoColumnValue,
          dataDistribuicaoValue,
          parsedId,
          empresaId,
        ]
      );

      if (updateResult.rowCount === 0) {
        await clientDb.query('ROLLBACK');
        return res.status(404).json({ error: 'Processo não encontrado' });
      }

      await clientDb.query('DELETE FROM public.processo_advogados WHERE processo_id = $1', [
        parsedId,
      ]);

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
          values
        );
      }

      const finalResult = await clientDb.query(
        `${baseProcessoSelect}
         WHERE p.id = $1
         LIMIT 1`,
        [parsedId]
      );

      await clientDb.query('COMMIT');

      if (finalResult.rowCount === 0) {
        return res.status(404).json({ error: 'Processo não encontrado' });
      }

      res.json(mapProcessoRow(finalResult.rows[0]));
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

export const syncProcessoMovimentacoes = async (req: Request, res: Response) => {
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

    const processoResult = await pool.query(
      'SELECT numero FROM public.processos WHERE id = $1 AND idempresa IS NOT DISTINCT FROM $2',
      [parsedId, empresaId]
    );

    if (processoResult.rowCount === 0) {
      return res.status(404).json({ error: 'Processo não encontrado' });
    }

    const numeroProcesso = normalizeString(
      (processoResult.rows[0] as { numero: unknown }).numero
    );

    if (!numeroProcesso) {
      return res
        .status(400)
        .json({ error: 'Número do processo inválido para sincronização.' });
    }

    const escavadorIntegration = await integrationApiKeyService.findById(
      ESCAVADOR_INTEGRATION_ID,
    );

    if (!escavadorIntegration) {
      return res.status(503).json({
        error:
          'Integração do Escavador não configurada. Cadastre a chave (ID 4) em Configurações > Integrações.',
      });
    }

    if (escavadorIntegration.provider !== 'escavador') {
      return res.status(503).json({
        error: 'A integração configurada não corresponde ao provedor Escavador.',
      });
    }

    if (!escavadorIntegration.active) {
      return res.status(503).json({
        error: 'Integração do Escavador desativada. Ative a chave para sincronizar processos.',
      });
    }

    const escavadorToken = normalizeString(escavadorIntegration.key);

    if (!escavadorToken) {
      return res.status(503).json({
        error: 'Chave de API do Escavador não definida. Atualize a integração para continuar.',
      });
    }

    const baseFromIntegration = normalizeString(escavadorIntegration.apiUrl);
    const endpointBase = (baseFromIntegration ?? FALLBACK_ESCAVADOR_API_BASE_URL).replace(
      /\/$/,
      '',
    );

    const url = `${endpointBase}/processos/numero_cnj/${encodeURIComponent(numeroProcesso)}/movimentacoes`;

    let externalResponse: globalThis.Response;

    try {
      externalResponse = await fetch(url, {
        headers: {
          Authorization: `Bearer ${escavadorToken}`,

          'X-Requested-With': 'XMLHttpRequest',
          Accept: 'application/json',
        },
      });
    } catch (fetchError) {
      console.error('Erro ao consultar API do Escavador', fetchError);
      await pool.query(
        'INSERT INTO public.processo_consultas_api (processo_id, sucesso, detalhes) VALUES ($1, $2, $3)',
        [parsedId, false, 'Falha de rede ao consultar a API do Escavador']
      );
      return res
        .status(502)
        .json({ error: 'Falha ao consultar a API de movimentações.' });
    }

    try {
      await integrationApiKeyService.update(escavadorIntegration.id, {
        lastUsed: new Date(),
      });
    } catch (updateError) {
      console.error(
        'Não foi possível atualizar a data de último uso da integração do Escavador',
        updateError,
      );
    }

    let payload: any = null;
    try {
      payload = await externalResponse.json();
    } catch (parseError) {
      console.error('Não foi possível interpretar a resposta da API do Escavador', parseError);
    }

    if (!externalResponse.ok) {
      const detalheErro =
        payload && typeof payload === 'object' && 'error' in payload
          ? String((payload as { error: unknown }).error)
          : `HTTP ${externalResponse.status}`;

      await pool.query(
        'INSERT INTO public.processo_consultas_api (processo_id, sucesso, detalhes) VALUES ($1, $2, $3)',
        [parsedId, false, detalheErro]
      );

      return res.status(externalResponse.status).json({
        error: 'Não foi possível sincronizar as movimentações do processo.',
      });
    }

    const items: unknown[] = Array.isArray(payload?.items)
      ? (payload.items as unknown[])
      : [];
    const movimentacoesPreparadas: PreparedMovimentacaoRecord[] = items
      .map((item) => prepareMovimentacaoRecord(item))
      .filter((mov): mov is PreparedMovimentacaoRecord => Boolean(mov));

    const movimentoIds = movimentacoesPreparadas.map((mov) => mov.id);

    const clientDb = await pool.connect();

    try {
      await clientDb.query('BEGIN');

      let existentes = new Set<string>();

      if (movimentoIds.length > 0) {
        const existentesResult = await clientDb.query(
          'SELECT id::text AS id_text FROM public.processo_movimentacoes WHERE processo_id = $1 AND id::text = ANY($2::text[])',
          [parsedId, movimentoIds]
        );

        existentes = new Set(
          existentesResult.rows.map((row) =>
            String((row as { id_text: unknown }).id_text)
          )
        );
      }

      if (movimentacoesPreparadas.length > 0) {
        const values: unknown[] = [];
        const placeholders = movimentacoesPreparadas
            .map((mov: PreparedMovimentacaoRecord, index: number) => {
              const baseIndex = index * 9;
              values.push(
                mov.id,
                parsedId,
                mov.data,
                mov.tipo,
                mov.tipo_publicacao,
                mov.classificacao_predita,
                mov.conteudo,
                mov.texto_categoria,
                mov.fonte
              );
              return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}::jsonb, $${baseIndex + 7}, $${baseIndex + 8}, $${baseIndex + 9}::jsonb)`;
            })
            .join(', ');


        await clientDb.query(
          `INSERT INTO public.processo_movimentacoes (
             id,
             processo_id,
             data,
             tipo,
             tipo_publicacao,
             classificacao_predita,
             conteudo,
             texto_categoria,
             fonte
           ) VALUES ${placeholders}
           ON CONFLICT (id) DO UPDATE
             SET processo_id = EXCLUDED.processo_id,
                 data = EXCLUDED.data,
                 tipo = EXCLUDED.tipo,
                 tipo_publicacao = EXCLUDED.tipo_publicacao,
                 classificacao_predita = EXCLUDED.classificacao_predita,
                 conteudo = EXCLUDED.conteudo,
                 texto_categoria = EXCLUDED.texto_categoria,
                 fonte = EXCLUDED.fonte,
                 atualizado_em = NOW()`,
          values
        );
      }

      const novasMovimentacoesCount = movimentacoesPreparadas.filter(
        (mov: PreparedMovimentacaoRecord) => !existentes.has(mov.id)
      ).length;

      await clientDb.query(
        'INSERT INTO public.processo_consultas_api (processo_id, sucesso, detalhes) VALUES ($1, $2, $3)',
        [parsedId, true, null]
      );

      await clientDb.query(
        `UPDATE public.processos
            SET consultas_api_count = consultas_api_count + 1,
                ultima_sincronizacao = NOW(),
                atualizado_em = NOW()
          WHERE id = $1`,
        [parsedId]
      );

      const processoAtualizadoResult = await clientDb.query(
        `${baseProcessoSelect}
         WHERE p.id = $1
         LIMIT 1`,
        [parsedId]
      );

      const totalMovimentacoesResult = await clientDb.query(
        'SELECT COUNT(*)::int AS total FROM public.processo_movimentacoes WHERE processo_id = $1',
        [parsedId]
      );

      const movimentacoesCompletas = await fetchProcessoMovimentacoes(
        parsedId,
        clientDb,
      );

      await clientDb.query('COMMIT');

      if (processoAtualizadoResult.rowCount === 0) {
        return res.status(404).json({ error: 'Processo não encontrado' });
      }

      const processoAtualizado = mapProcessoRow(processoAtualizadoResult.rows[0]);
      const totalMovimentacoes = parseInteger(
        (totalMovimentacoesResult.rows[0] as { total?: unknown })?.total
      );

      processoAtualizado.movimentacoes_count = totalMovimentacoes;
      processoAtualizado.movimentacoes = movimentacoesCompletas;

      return res.json({
        processo: processoAtualizado,
        movimentacoes: {
          importadas: movimentacoesPreparadas.length,
          novas: novasMovimentacoesCount,
          total: totalMovimentacoes,
        },
      });
    } catch (transactionError) {
      await clientDb.query('ROLLBACK');
      await pool.query(
        'INSERT INTO public.processo_consultas_api (processo_id, sucesso, detalhes) VALUES ($1, $2, $3)',
        [
          parsedId,
          false,
          transactionError instanceof Error
            ? transactionError.message
            : 'Erro interno durante a sincronização',
        ]
      );
      console.error(transactionError);
      return res
        .status(500)
        .json({ error: 'Não foi possível sincronizar o processo' });
    } finally {
      clientDb.release();
    }
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ error: 'Não foi possível sincronizar o processo' });
  }
};

export const deleteProcesso = async (req: Request, res: Response) => {
  const { id } = req.params;
  const parsedId = Number(id);

  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  try {
    const result = await pool.query(
      'DELETE FROM public.processos WHERE id = $1',
      [parsedId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Processo não encontrado' });
    }

    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
