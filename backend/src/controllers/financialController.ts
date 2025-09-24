import { Request, Response } from 'express';
import type { QueryResult } from 'pg';
import pool from '../services/db';
import type { Flow } from '../models/flow';
import { fetchAuthenticatedUserEmpresa } from '../utils/authUser';
import AsaasChargeService, {
  ChargeConflictError,
  ValidationError as AsaasValidationError,
} from '../services/asaasChargeService';

const getAuthenticatedUser = (
  req: Request,
  res: Response,
): NonNullable<Request['auth']> | null => {
  if (!req.auth) {
    res.status(401).json({ error: 'Token inválido.' });
    return null;
  }

  return req.auth;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INTEGER_ID_REGEX = /^-?\d+$/;

const normalizeFlowId = (value: unknown): string | number | null => {
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 0) {
      return null;
    }

    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (UUID_REGEX.test(trimmed)) {
    return trimmed;
  }

  if (INTEGER_ID_REGEX.test(trimmed)) {
    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isInteger(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return null;
};

const normalizeOptionalInteger = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isInteger(parsed)) {
      return parsed;
    }
    return null;
  }

  return null;
};

const POSTGRES_UNDEFINED_TABLE = '42P01';
const POSTGRES_UNDEFINED_COLUMN = '42703';
const POSTGRES_INSUFFICIENT_PRIVILEGE = '42501';

const OPPORTUNITY_TABLES_CACHE_TTL_MS = 5 * 60 * 1000;
const FINANCIAL_FLOW_EMPRESA_COLUMN_CACHE_TTL_MS = 5 * 60 * 1000;
const FINANCIAL_FLOW_CLIENTE_COLUMN_CACHE_TTL_MS = 5 * 60 * 1000;
const FINANCIAL_FLOW_FORNECEDOR_COLUMN_CACHE_TTL_MS = 5 * 60 * 1000;

type FinancialFlowEmpresaColumn = string;
type FinancialFlowClienteColumn = string;
type FinancialFlowFornecedorColumn = string;


const FINANCIAL_FLOW_EMPRESA_CANDIDATES = ['idempresa', 'empresa_id', 'empresa'] as const;
const FINANCIAL_FLOW_CLIENTE_CANDIDATES = [
  'cliente_id',
  'clienteid',
  'idcliente',
  'cliente',
] as const;
const FINANCIAL_FLOW_FORNECEDOR_CANDIDATES = [
  'fornecedor_id',
  'fornecedorid',
  'idfornecedor',
  'fornecedor',
] as const;


const quoteIdentifier = (value: string): string => `"${value.replace(/"/g, '""')}"`;

let opportunityTablesAvailability: boolean | null = null;
let opportunityTablesAvailabilityCheckedAt: number | null = null;
let opportunityTablesCheckPromise: Promise<boolean> | null = null;

let financialFlowEmpresaColumn: FinancialFlowEmpresaColumn | null = null;
let financialFlowEmpresaColumnCheckedAt: number | null = null;

let financialFlowClienteColumn: FinancialFlowClienteColumn | null = null;
let financialFlowClienteColumnCheckedAt: number | null = null;

let financialFlowFornecedorColumn: FinancialFlowFornecedorColumn | null = null;
let financialFlowFornecedorColumnCheckedAt: number | null = null;

type FinancialFlowColumnsLookup = Map<string, string>;

let financialFlowColumnsLookup: FinancialFlowColumnsLookup | null = null;
let financialFlowColumnsCheckedAt: number | null = null;
let financialFlowColumnsPromise:
  | Promise<FinancialFlowColumnsLookup | null>
  | null = null;

const updateFinancialFlowColumnsLookup = (
  value: FinancialFlowColumnsLookup | null,
) => {
  financialFlowColumnsLookup = value;
  financialFlowColumnsCheckedAt = Date.now();
};

const resetFinancialFlowColumnsLookup = () => {
  financialFlowColumnsLookup = null;
  financialFlowColumnsCheckedAt = null;
  financialFlowColumnsPromise = null;
  financialFlowEmpresaColumn = null;
  financialFlowEmpresaColumnCheckedAt = null;
  financialFlowClienteColumn = null;
  financialFlowClienteColumnCheckedAt = null;
  financialFlowFornecedorColumn = null;
  financialFlowFornecedorColumnCheckedAt = null;

};

const updateOpportunityTablesAvailability = (value: boolean) => {
  opportunityTablesAvailability = value;
  opportunityTablesAvailabilityCheckedAt = Date.now();
};

const resetOpportunityTablesAvailabilityCache = () => {
  opportunityTablesAvailability = null;
  opportunityTablesAvailabilityCheckedAt = null;
  opportunityTablesCheckPromise = null;
};

const updateFinancialFlowEmpresaColumn = (value: FinancialFlowEmpresaColumn | null) => {
  financialFlowEmpresaColumn = value;
  financialFlowEmpresaColumnCheckedAt = Date.now();
};

const resetFinancialFlowEmpresaColumnCache = () => {
  resetFinancialFlowColumnsLookup();
};

const updateFinancialFlowClienteColumn = (value: FinancialFlowClienteColumn | null) => {
  financialFlowClienteColumn = value;
  financialFlowClienteColumnCheckedAt = Date.now();
};

const resetFinancialFlowClienteColumnCache = () => {
  resetFinancialFlowColumnsLookup();
};

const updateFinancialFlowFornecedorColumn = (
  value: FinancialFlowFornecedorColumn | null,
) => {
  financialFlowFornecedorColumn = value;
  financialFlowFornecedorColumnCheckedAt = Date.now();
};

const resetFinancialFlowFornecedorColumnCache = () => {
  resetFinancialFlowColumnsLookup();
};


const ensureFinancialFlowColumns = async () => {
  if (
    financialFlowColumnsLookup !== null &&
    financialFlowColumnsCheckedAt !== null &&
    Date.now() - financialFlowColumnsCheckedAt < FINANCIAL_FLOW_EMPRESA_COLUMN_CACHE_TTL_MS
  ) {
    return;
  }

  if (financialFlowColumnsPromise) {
    await financialFlowColumnsPromise;
    return;
  }

  financialFlowColumnsPromise = pool
    .query<{ column_name: string }>(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'financial_flows'
      `,
    )
    .then((result) => {
      const available = result.rows
        .map((row) => row?.column_name)
        .filter((name): name is string => typeof name === 'string');

      const lookup: FinancialFlowColumnsLookup = new Map();
      for (const name of available) {
        lookup.set(name.toLowerCase(), name);
      }

      updateFinancialFlowColumnsLookup(lookup);

      const empresaMatch = FINANCIAL_FLOW_EMPRESA_CANDIDATES.find((candidate) =>
        lookup.has(candidate.toLowerCase()),
      );
      const resolvedEmpresa = empresaMatch
        ? lookup.get(empresaMatch.toLowerCase()) ?? empresaMatch
        : null;
      updateFinancialFlowEmpresaColumn(resolvedEmpresa ?? null);

      const clienteMatch = FINANCIAL_FLOW_CLIENTE_CANDIDATES.find((candidate) =>
        lookup.has(candidate.toLowerCase()),
      );
      const resolvedCliente = clienteMatch
        ? lookup.get(clienteMatch.toLowerCase()) ?? clienteMatch
        : null;
      updateFinancialFlowClienteColumn(resolvedCliente ?? null);

      const fornecedorMatch = FINANCIAL_FLOW_FORNECEDOR_CANDIDATES.find((candidate) =>
        lookup.has(candidate.toLowerCase()),
      );
      const resolvedFornecedor = fornecedorMatch
        ? lookup.get(fornecedorMatch.toLowerCase()) ?? fornecedorMatch
        : null;
      updateFinancialFlowFornecedorColumn(resolvedFornecedor ?? null);

      return lookup;
    })
    .catch(() => {
      updateFinancialFlowColumnsLookup(null);
      updateFinancialFlowEmpresaColumn(null);
      updateFinancialFlowClienteColumn(null);
      updateFinancialFlowFornecedorColumn(null);

      return null;
    })
    .finally(() => {
      financialFlowColumnsPromise = null;
    });

  await financialFlowColumnsPromise;
};

const determineOpportunityTablesAvailability = async (): Promise<boolean> => {
  const cachedValue = opportunityTablesAvailability;
  const checkedAt = opportunityTablesAvailabilityCheckedAt;
  if (
    cachedValue !== null &&
    checkedAt !== null &&
    Date.now() - checkedAt < OPPORTUNITY_TABLES_CACHE_TTL_MS
  ) {
    return cachedValue;
  }

  if (opportunityTablesCheckPromise) {
    return opportunityTablesCheckPromise;
  }

  opportunityTablesCheckPromise = pool
    .query(
      `
        WITH tables AS (
          SELECT
            to_regclass('public.oportunidade_parcelas') AS parcelas,
            to_regclass('public.oportunidades') AS oportunidades,
            to_regclass('public.clientes') AS clientes,
            to_regclass('public.oportunidade_faturamentos') AS faturamentos
        )
        SELECT
          CASE
            WHEN parcelas IS NULL THEN FALSE
            ELSE COALESCE(has_table_privilege(parcelas, 'SELECT'), FALSE)
          END AS parcelas,
          CASE
            WHEN oportunidades IS NULL THEN FALSE
            ELSE COALESCE(has_table_privilege(oportunidades, 'SELECT'), FALSE)
          END AS oportunidades,
          CASE
            WHEN clientes IS NULL THEN FALSE
            ELSE COALESCE(has_table_privilege(clientes, 'SELECT'), FALSE)
          END AS clientes,
          CASE
            WHEN faturamentos IS NULL THEN FALSE
            ELSE COALESCE(has_table_privilege(faturamentos, 'SELECT'), FALSE)
          END AS faturamentos
        FROM tables

      `,
    )
    .then((result) => {
      const row = result.rows[0] ?? {};
      const available =
        Boolean(row?.parcelas) &&
        Boolean(row?.oportunidades) &&
        Boolean(row?.clientes) &&
        Boolean(row?.faturamentos);
      updateOpportunityTablesAvailability(available);
      return available;
    })
    .catch(() => {
      updateOpportunityTablesAvailability(false);
      return false;
    })
    .finally(() => {
      opportunityTablesCheckPromise = null;
    });

  return opportunityTablesCheckPromise;
};

const markOpportunityTablesUnavailable = () => {
  updateOpportunityTablesAvailability(false);
};

const FALLBACK_ERROR_CODES = new Set([
  POSTGRES_UNDEFINED_TABLE,
  POSTGRES_UNDEFINED_COLUMN,
  POSTGRES_INSUFFICIENT_PRIVILEGE,
]);

type GenericQueryResult = QueryResult<Record<string, unknown>>;

const shouldFallbackToFinancialFlowsOnly = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const code = (error as { code?: string }).code;
  return typeof code === 'string' && FALLBACK_ERROR_CODES.has(code);

};

export const __internal = {
  resetOpportunityTablesAvailabilityCache,
  resetFinancialFlowEmpresaColumnCache,
  resetFinancialFlowClienteColumnCache,
  resetFinancialFlowFornecedorColumnCache,

};

const asaasChargeService = new AsaasChargeService();

const determineFinancialFlowEmpresaColumn = async (): Promise<FinancialFlowEmpresaColumn | null> => {
  if (
    financialFlowEmpresaColumnCheckedAt !== null &&
    Date.now() - financialFlowEmpresaColumnCheckedAt < FINANCIAL_FLOW_EMPRESA_COLUMN_CACHE_TTL_MS
  ) {
    return financialFlowEmpresaColumn;
  }

  await ensureFinancialFlowColumns();

  return financialFlowEmpresaColumn;
};

const determineFinancialFlowClienteColumn = async (): Promise<FinancialFlowClienteColumn | null> => {
  if (
    financialFlowClienteColumnCheckedAt !== null &&
    Date.now() - financialFlowClienteColumnCheckedAt < FINANCIAL_FLOW_CLIENTE_COLUMN_CACHE_TTL_MS
  ) {
    return financialFlowClienteColumn;
  }

  await ensureFinancialFlowColumns();

  return financialFlowClienteColumn;
};

const determineFinancialFlowFornecedorColumn = async (): Promise<FinancialFlowFornecedorColumn | null> => {
  if (
    financialFlowFornecedorColumnCheckedAt !== null &&
    Date.now() - financialFlowFornecedorColumnCheckedAt < FINANCIAL_FLOW_FORNECEDOR_COLUMN_CACHE_TTL_MS
  ) {
    return financialFlowFornecedorColumn;
  }

  await ensureFinancialFlowColumns();

  return financialFlowFornecedorColumn;

};

export const listFlows = async (req: Request, res: Response) => {
  const { page = '1', limit = '10', clienteId } = req.query;

  const pickStringQueryValue = (value: unknown): string | undefined => {
    if (Array.isArray(value)) {
      const [first] = value;
      return typeof first === 'string' ? first : undefined;
    }
    return typeof value === 'string' ? value : undefined;
  };

  const pageValue = pickStringQueryValue(page) ?? '1';
  const limitValue = pickStringQueryValue(limit) ?? '10';
  const pageNum = Number.parseInt(pageValue, 10);
  const limitNum = Number.parseInt(limitValue, 10);
  const effectivePage = Number.isNaN(pageNum) || pageNum <= 0 ? 1 : pageNum;
  const effectiveLimit = Number.isNaN(limitNum) || limitNum <= 0 ? 10 : limitNum;
  const offset = (effectivePage - 1) * effectiveLimit;

  const clienteValue = pickStringQueryValue(clienteId);
  const trimmedClienteId =
    clienteValue && clienteValue.trim().length > 0 ? clienteValue.trim() : null;

  try {
    const auth = getAuthenticatedUser(req, res);
    if (!auth) {
      return;
    }

    const empresaLookup = await fetchAuthenticatedUserEmpresa(auth.userId);

    if (!empresaLookup.success) {
      res.status(empresaLookup.status).json({ error: empresaLookup.message });
      return;
    }

    const { empresaId } = empresaLookup;

    if (empresaId === null) {
      res.json({
        items: [],
        total: 0,
        page: effectivePage,
        limit: effectiveLimit,
      });
      return;
    }

    const empresaColumn = await determineFinancialFlowEmpresaColumn();
    const clienteColumn = await determineFinancialFlowClienteColumn();
    const fornecedorColumn = await determineFinancialFlowFornecedorColumn();

    const hasEmpresaColumn = typeof empresaColumn === 'string' && empresaColumn.length > 0;
    const empresaColumnExpression = hasEmpresaColumn
      ? `ff.${quoteIdentifier(empresaColumn)}`
      : '$1::INTEGER';
    const clienteColumnExpression =
      typeof clienteColumn === 'string' && clienteColumn.length > 0
        ? `ff.${quoteIdentifier(clienteColumn)}::TEXT`
        : 'NULL::TEXT';
    const fornecedorColumnExpression =
      typeof fornecedorColumn === 'string' && fornecedorColumn.length > 0
        ? `ff.${quoteIdentifier(fornecedorColumn)}::TEXT`
        : 'NULL::TEXT';


    const filters: (string | number)[] = [empresaId];
    const filterConditions: string[] = ['combined_flows.empresa_id = $1'];

    if (trimmedClienteId) {
      filters.push(trimmedClienteId);
      filterConditions.push(`combined_flows.cliente_id = $${filters.length}`);
    }

    const filterClause = `WHERE ${filterConditions.join(' AND ')}`;

    const baseFinancialFlowsSelect = `
        SELECT
          ff.id::TEXT AS id,
          ff.tipo AS tipo,
          ff.descricao AS descricao,
          ff.valor::numeric AS valor,
          ff.vencimento::date AS vencimento,
          ff.pagamento::date AS pagamento,
          ff.status AS status,
          ff.conta_id::TEXT AS conta_id,
          ff.categoria_id::TEXT AS categoria_id,
          ${clienteColumnExpression} AS cliente_id,
          ${fornecedorColumnExpression} AS fornecedor_id,
          ${empresaColumnExpression} AS empresa_id
        FROM financial_flows ff
      `;

    const buildCombinedCte = (includeOpportunities: boolean): string => {
      if (!includeOpportunities) {
        return `
      WITH combined_flows AS (
${baseFinancialFlowsSelect}
      )
    `;
      }

      return `
      WITH oportunidade_parcelas_enriched AS (
        SELECT
          p.id,
          p.oportunidade_id,
          p.numero_parcela,
          p.valor,
          p.data_prevista,
          p.status,
          p.quitado_em,
          p.faturamento_id,
          o.sequencial_empresa,
          o.qtde_parcelas,
          o.solicitante_id,
          p.idempresa,
          c.nome AS cliente_nome,
          f.valor AS faturamento_valor,
          f.parcelas AS faturamento_parcelas,
          f.data_faturamento
        FROM public.oportunidade_parcelas p
        JOIN public.oportunidades o ON o.id = p.oportunidade_id
        LEFT JOIN public.clientes c ON c.id = o.solicitante_id
        LEFT JOIN public.oportunidade_faturamentos f ON f.id = p.faturamento_id
      ),
      combined_flows AS (
${baseFinancialFlowsSelect}
        UNION ALL
        SELECT
          (-p.id)::TEXT AS id,
          'receita' AS tipo,
          TRIM(BOTH FROM CONCAT(
            'Oportunidade ',
            COALESCE(p.sequencial_empresa::text, p.oportunidade_id::text),
            CASE WHEN p.cliente_nome IS NOT NULL THEN ' - ' || p.cliente_nome ELSE '' END,
            CASE
              WHEN p.numero_parcela IS NOT NULL THEN
                ' - Parcela ' || p.numero_parcela::text ||
                CASE
                  WHEN NULLIF(COALESCE(p.faturamento_parcelas, p.qtde_parcelas), 0) IS NOT NULL AND NULLIF(COALESCE(p.faturamento_parcelas, p.qtde_parcelas), 0) > 1 THEN
                    '/' || NULLIF(COALESCE(p.faturamento_parcelas, p.qtde_parcelas), 0)::text
                  ELSE ''
                END
              ELSE ''
            END
          )) AS descricao,
          COALESCE(
            p.valor,
            CASE
              WHEN NULLIF(COALESCE(p.faturamento_parcelas, p.qtde_parcelas), 0) IS NOT NULL THEN
                p.faturamento_valor / NULLIF(COALESCE(p.faturamento_parcelas, p.qtde_parcelas), 0)
              ELSE p.faturamento_valor
            END,
            0
          )::numeric AS valor,
          COALESCE(p.data_prevista, p.data_faturamento::date, CURRENT_DATE) AS vencimento,
          CASE
            WHEN LOWER(p.status) IN ('quitado','quitada','pago','paga') THEN COALESCE(p.quitado_em::date, p.data_faturamento::date)
            ELSE NULL
          END AS pagamento,
          CASE
            WHEN LOWER(p.status) IN ('quitado','quitada','pago','paga') THEN 'pago'
            ELSE 'pendente'
          END AS status,
          NULL::TEXT AS conta_id,
          NULL::TEXT AS categoria_id,
          p.solicitante_id::TEXT AS cliente_id,
          NULL::TEXT AS fornecedor_id,
          p.idempresa AS empresa_id

        FROM oportunidade_parcelas_enriched p
      )
    `;
    };

    const runListFlowsQuery = async (
      includeOpportunities: boolean,
    ): Promise<{
      items: GenericQueryResult;
      total: GenericQueryResult;
    }> => {
      const combinedCte = buildCombinedCte(includeOpportunities);
      const limitParamIndex = filters.length + 1;
      const offsetParamIndex = filters.length + 2;

      const dataQuery = `
      ${combinedCte}
      SELECT id, tipo, descricao, valor, vencimento, pagamento, status, conta_id, categoria_id, cliente_id, fornecedor_id
      FROM combined_flows
      ${filterClause}
      ORDER BY vencimento DESC, id DESC
      LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
    `;

      const dataValues = [...filters, effectiveLimit, offset];

      const countQuery = `
      ${combinedCte}
      SELECT COUNT(*)::INTEGER AS total
      FROM combined_flows
      ${filterClause}
    `;

      const countValues = [...filters];

      const items = await pool.query<Record<string, unknown>>(dataQuery, dataValues);
      const total = await pool.query<Record<string, unknown>>(countQuery, countValues);

      return { items, total };
    };

    const includeOpportunityFlows = await determineOpportunityTablesAvailability();

    let queryResult: {
      items: GenericQueryResult;
      total: GenericQueryResult;
    };

    try {
      queryResult = await runListFlowsQuery(includeOpportunityFlows);
    } catch (queryError) {
      if (includeOpportunityFlows && shouldFallbackToFinancialFlowsOnly(queryError)) {
        markOpportunityTablesUnavailable();
        queryResult = await runListFlowsQuery(false);
      } else {
        throw queryError;
      }
    }

    const { items: itemsResult, total: totalResult } = queryResult;

    const normalizeDate = (value: unknown): string | null => {
      if (!value) {
        return null;
      }
      if (value instanceof Date) {
        return value.toISOString().slice(0, 10);
      }
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.length === 0) {
          return null;
        }
        if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
          return trimmed.slice(0, 10);
        }
        const parsed = new Date(trimmed);
        if (!Number.isNaN(parsed.getTime())) {
          return parsed.toISOString().slice(0, 10);
        }
        return null;
      }
      const coerced = new Date(value as string);
      if (!Number.isNaN(coerced.getTime())) {
        return coerced.toISOString().slice(0, 10);
      }
      return null;
    };

    const normalizeNumber = (value: unknown): number => {
      if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0;
      }
      if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
      }
      if (value === null || value === undefined) {
        return 0;
      }
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const normalizeDescricao = (value: unknown): string => {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : 'Fluxo financeiro';
      }
      if (value === null || value === undefined) {
        return 'Fluxo financeiro';
      }
      const stringValue = String(value).trim();
      return stringValue.length > 0 ? stringValue : 'Fluxo financeiro';
    };

    const normalizeStatus = (value: unknown): 'pendente' | 'pago' => {
      if (typeof value === 'string' && value.trim().toLowerCase() === 'pago') {
        return 'pago';
      }
      return 'pendente';
    };

    const normalizeTipo = (value: unknown): Flow['tipo'] => {
      if (typeof value === 'string' && value.trim().toLowerCase() === 'despesa') {
        return 'despesa';
      }
      return 'receita';
    };

    const isNumericString = (value: string): boolean => /^-?\d+$/.test(value);

    const normalizeId = (value: unknown): Flow['id'] => {

      if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0;
      }
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.length === 0) {
          return 0;
        }
        if (isNumericString(trimmed)) {
          const parsed = Number(trimmed);
          if (Number.isFinite(parsed)) {
            return parsed;
          }
        }
        return trimmed;
      }
      if (typeof value === 'bigint') {
        const text = value.toString();
        if (isNumericString(text)) {
          const parsed = Number(text);
          if (Number.isFinite(parsed)) {
            return parsed;
          }
        }
        return text;

      }
      if (value === null || value === undefined) {
        return 0;
      }
      const textValue = String(value);
      if (isNumericString(textValue)) {
        const parsed = Number(textValue);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
      return textValue;

    };

    const items: Flow[] = itemsResult.rows.map((row) => {
      const vencimento = normalizeDate(row.vencimento) ?? new Date().toISOString().slice(0, 10);
      const pagamento = normalizeDate(row.pagamento);

      const flow: Flow = {
        id: normalizeId(row.id),
        tipo: normalizeTipo(row.tipo),
        conta_id:
          row.conta_id === null || row.conta_id === undefined
            ? null
            : Number.isFinite(Number(row.conta_id))
              ? Number(row.conta_id)
              : null,
        categoria_id:
          row.categoria_id === null || row.categoria_id === undefined
            ? null
            : Number.isFinite(Number(row.categoria_id))
              ? Number(row.categoria_id)
              : null,
        descricao: normalizeDescricao(row.descricao),
        valor: normalizeNumber(row.valor),
        vencimento,
        pagamento,
        status: normalizeStatus(row.status),
      };

      if (Object.prototype.hasOwnProperty.call(row, 'cliente_id')) {
        flow.cliente_id =
          typeof row.cliente_id === 'string' && row.cliente_id.trim().length > 0
            ? row.cliente_id.trim()
            : null;
      }

      if (Object.prototype.hasOwnProperty.call(row, 'fornecedor_id')) {
        flow.fornecedor_id =
          typeof row.fornecedor_id === 'string' && row.fornecedor_id.trim().length > 0
            ? row.fornecedor_id.trim()
            : null;
      }

      return flow;
    });

    const total = Number(totalResult.rows[0]?.total ?? 0);
    res.json({
      items,
      total: Number.isFinite(total) ? total : 0,
      page: effectivePage,
      limit: effectiveLimit,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getFlow = async (req: Request, res: Response) => {
  const { id } = req.params;
  const flowId = normalizeFlowId(id);
  if (flowId === null) {
    return res.status(400).json({ error: 'Invalid flow id' });
  }
  try {
    const result = await pool.query('SELECT * FROM financial_flows WHERE id = $1', [flowId]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Flow not found' });
    res.json({ flow: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createFlow = async (req: Request, res: Response) => {
  const {
    tipo,
    descricao,
    valor,
    vencimento,
    paymentMethod,
    clienteId,
    fornecedorId,
    integrationApiKeyId,
    cardToken,
    asaasCustomerId,
    asaasPayload,
    payerEmail,
    payerName,
    customerDocument,
    externalReferenceId,
    metadata,
    remoteIp,
  } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const tipoText = typeof tipo === 'string' ? tipo.trim().toLowerCase() : '';
    const isDespesa = tipoText === 'despesa';
    const normalizedTipo: Flow['tipo'] = isDespesa ? 'despesa' : 'receita';
    const normalizedClienteId = normalizeOptionalInteger(clienteId);
    const normalizedFornecedorId = normalizeOptionalInteger(fornecedorId);
    const clienteIdForInsert = isDespesa ? null : normalizedClienteId;
    const fornecedorIdForInsert = isDespesa ? normalizedFornecedorId : null;
    const inserted = await client.query(
      'INSERT INTO financial_flows (tipo, descricao, valor, vencimento, status, cliente_id, fornecedor_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [normalizedTipo, descricao, valor, vencimento, 'pendente', clienteIdForInsert, fornecedorIdForInsert],
    );

    let flow = inserted.rows[0];
    let charge = null;

    if (typeof paymentMethod === 'string' && paymentMethod.trim()) {
      if (flow.tipo !== 'receita') {
        throw new AsaasValidationError('Apenas receitas podem gerar cobrança no Asaas');
      }

      const chargeResult = await asaasChargeService.createCharge(
        {
          financialFlowId: flow.id,
          billingType: paymentMethod,
          clienteId: clienteIdForInsert,
          integrationApiKeyId: integrationApiKeyId ?? null,
          value: valor,
          dueDate: vencimento,
          description: descricao,
          cardToken: cardToken ?? null,
          asaasCustomerId: asaasCustomerId ?? null,
          additionalFields: asaasPayload ?? null,
          payerEmail: payerEmail ?? null,
          payerName: payerName ?? null,
          customerDocument: customerDocument ?? null,
          externalReferenceId: externalReferenceId ?? null,
          metadata: metadata ?? null,
          remoteIp: remoteIp ?? null,
        },
        { dbClient: client },
      );

      flow = chargeResult.flow;
      charge = chargeResult.charge;
    }

    await client.query('COMMIT');
    res.status(201).json({ flow, charge });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err instanceof AsaasValidationError) {
      return res.status(400).json({ error: err.message });
    }
    if (err instanceof ChargeConflictError) {
      return res.status(409).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

export const updateFlow = async (req: Request, res: Response) => {
  const { id } = req.params;
  const flowId = normalizeFlowId(id);
  if (flowId === null) {
    return res.status(400).json({ error: 'Invalid flow id' });
  }
  const {
    tipo,
    descricao,
    valor,
    vencimento,
    pagamento,
    status,
    paymentMethod,
    clienteId,
    fornecedorId,
    integrationApiKeyId,
    cardToken,
    asaasCustomerId,
    asaasPayload,
    payerEmail,
    payerName,
    customerDocument,
    externalReferenceId,
    metadata,
    remoteIp,
  } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const tipoText = typeof tipo === 'string' ? tipo.trim().toLowerCase() : '';
    const isDespesa = tipoText === 'despesa';
    const normalizedTipo: Flow['tipo'] = isDespesa ? 'despesa' : 'receita';
    const normalizedClienteId = normalizeOptionalInteger(clienteId);
    const normalizedFornecedorId = normalizeOptionalInteger(fornecedorId);
    const clienteIdForUpdate = isDespesa ? null : normalizedClienteId;
    const fornecedorIdForUpdate = isDespesa ? normalizedFornecedorId : null;
    const result = await client.query(
      'UPDATE financial_flows SET tipo=$1, descricao=$2, valor=$3, vencimento=$4, pagamento=$5, status=$6, cliente_id=$7, fornecedor_id=$8 WHERE id=$9 RETURNING *',
      [normalizedTipo, descricao, valor, vencimento, pagamento, status, clienteIdForUpdate, fornecedorIdForUpdate, flowId],
    );
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Flow not found' });
    }

    let flow = result.rows[0];
    let charge = null;

    if (typeof paymentMethod === 'string' && paymentMethod.trim()) {
      if (flow.tipo !== 'receita') {
        throw new AsaasValidationError('Apenas receitas podem gerar cobrança no Asaas');
      }

      const chargeResult = await asaasChargeService.createCharge(
        {
          financialFlowId: flow.id,
          billingType: paymentMethod,
          clienteId: clienteIdForUpdate,
          integrationApiKeyId: integrationApiKeyId ?? null,
          value: valor ?? flow.valor,
          dueDate: vencimento ?? flow.vencimento,
          description: descricao ?? flow.descricao,
          cardToken: cardToken ?? null,
          asaasCustomerId: asaasCustomerId ?? null,
          additionalFields: asaasPayload ?? null,
          payerEmail: payerEmail ?? null,
          payerName: payerName ?? null,
          customerDocument: customerDocument ?? null,
          externalReferenceId: externalReferenceId ?? flow.external_reference_id ?? null,
          metadata: metadata ?? null,
          remoteIp: remoteIp ?? null,
        },
        { dbClient: client },
      );

      flow = chargeResult.flow;
      charge = chargeResult.charge;
    }

    await client.query('COMMIT');
    res.json({ flow, charge });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err instanceof AsaasValidationError) {
      return res.status(400).json({ error: err.message });
    }
    if (err instanceof ChargeConflictError) {
      return res.status(409).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

export const deleteFlow = async (req: Request, res: Response) => {
  const { id } = req.params;
  const flowId = normalizeFlowId(id);
  if (flowId === null) {
    return res.status(400).json({ error: 'Invalid flow id' });
  }
  try {
    const result = await pool.query('DELETE FROM financial_flows WHERE id=$1', [flowId]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Flow not found' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const settleFlow = async (req: Request, res: Response) => {
  const { id } = req.params;
  const flowId = normalizeFlowId(id);
  if (flowId === null) {
    return res.status(400).json({ error: 'Invalid flow id' });
  }
  const { pagamentoData } = req.body;
  try {
    const current = await pool.query('SELECT external_provider FROM financial_flows WHERE id = $1', [flowId]);
    if (current.rowCount === 0) {
      return res.status(404).json({ error: 'Flow not found' });
    }

    const provider = current.rows[0].external_provider;
    if (typeof provider === 'string' && provider.trim().toLowerCase() === 'asaas') {
      return res.status(409).json({ error: 'Status controlado pelo Asaas para este fluxo financeiro' });
    }

    const result = await pool.query(
      "UPDATE financial_flows SET pagamento=$1, status='pago' WHERE id=$2 RETURNING *",
      [pagamentoData, flowId],
    );
    res.json({ flow: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createAsaasChargeForFlow = async (req: Request, res: Response) => {
  const { id } = req.params;
  const flowId = normalizeFlowId(id);
  if (flowId === null) {
    return res.status(400).json({ error: 'Invalid flow id' });
  }
  const {
    paymentMethod,
    clienteId,
    integrationApiKeyId,
    cardToken,
    asaasCustomerId,
    asaasPayload,
    payerEmail,
    payerName,
    customerDocument,
    externalReferenceId,
    metadata,
    remoteIp,
  } = req.body;

  if (typeof paymentMethod !== 'string' || !paymentMethod.trim()) {
    return res.status(400).json({ error: 'paymentMethod é obrigatório' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const flowResult = await client.query('SELECT * FROM financial_flows WHERE id = $1', [flowId]);
    if (flowResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Flow not found' });
    }

    const flow = flowResult.rows[0];
    if (flow.tipo !== 'receita') {
      throw new AsaasValidationError('Apenas receitas podem gerar cobrança no Asaas');
    }

    const chargeResult = await asaasChargeService.createCharge(
      {
        financialFlowId: flow.id,
        billingType: paymentMethod,
        clienteId: clienteId ?? null,
        integrationApiKeyId: integrationApiKeyId ?? null,
        value: flow.valor,
        dueDate: flow.vencimento,
        description: flow.descricao,
        cardToken: cardToken ?? null,
        asaasCustomerId: asaasCustomerId ?? null,
        additionalFields: asaasPayload ?? null,
        payerEmail: payerEmail ?? null,
        payerName: payerName ?? null,
        customerDocument: customerDocument ?? null,
        externalReferenceId: externalReferenceId ?? flow.external_reference_id ?? null,
        metadata: metadata ?? null,
        remoteIp: remoteIp ?? null,
      },
      { dbClient: client },
    );

    await client.query('COMMIT');
    res.status(201).json({ flow: chargeResult.flow, charge: chargeResult.charge });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err instanceof AsaasValidationError) {
      return res.status(400).json({ error: err.message });
    }
    if (err instanceof ChargeConflictError) {
      return res.status(409).json({ error: err.message });
    }
    if ((err as Error & { code?: string }).code === '23505') {
      return res
        .status(409)
        .json({ error: 'O fluxo financeiro já possui uma cobrança vinculada ao Asaas' });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};
