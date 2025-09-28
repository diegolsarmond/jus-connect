import { Request, Response } from 'express';
import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import pool from '../services/db';
import type { Flow } from '../models/flow';
import { fetchAuthenticatedUserEmpresa } from '../utils/authUser';
import AsaasChargeService, {
  ChargeConflictError,
  type AsaasChargeRecord,
  type AsaasChargeResult,
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
const OPPORTUNITY_INSTALLMENT_PAID_STATUSES = new Set(['quitado', 'quitada', 'pago', 'paga']);

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
const FINANCIAL_ACCOUNT_TABLE_CACHE_TTL_MS = 5 * 60 * 1000;

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

const FINANCIAL_ACCOUNT_TABLE_CANDIDATES = [
  { schema: 'public', table: 'financeiro_contas' },
  { schema: 'public', table: 'contas_financeiras' },
  { schema: 'public', table: 'financial_accounts' },
  { schema: 'public', table: 'contas' },
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

type FinancialAccountTableInfo = {
  schema: string;
  table: string;
  empresaColumn: string;
};

let financialAccountTableInfo: FinancialAccountTableInfo | null = null;
let financialAccountTableCheckedAt: number | null = null;
let financialAccountTablePromise: Promise<FinancialAccountTableInfo | null> | null = null;

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

const updateFinancialAccountTableInfo = (
  value: FinancialAccountTableInfo | null,
) => {
  financialAccountTableInfo = value;
  financialAccountTableCheckedAt = Date.now();
};

const resetFinancialAccountTableCache = () => {
  financialAccountTableInfo = null;
  financialAccountTableCheckedAt = null;
  financialAccountTablePromise = null;
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
  resetFinancialAccountTableCache,

};

const asaasChargeService = new AsaasChargeService();

type QueryExecutor = Pick<PoolClient, 'query'>;

interface AsaasChargeCreationParams {
  dbClient: QueryExecutor;
  flow: QueryResultRow;
  paymentMethod: unknown;
  clienteId: number | null;
  integrationApiKeyId?: number | null;
  value: unknown;
  dueDate: unknown;
  description: unknown;
  cardToken?: string | null;
  asaasCustomerId?: string | null;
  additionalFields?: Record<string, unknown> | null;
  payerEmail?: string | null;
  payerName?: string | null;
  customerDocument?: string | null;
  externalReferenceId?: unknown;
  metadata?: Record<string, unknown> | null;
  remoteIp?: string | null;
}

const ensureReceitaFlow = (flow: QueryResultRow): void => {
  const tipo = (flow as { tipo?: unknown }).tipo;
  const normalizedTipo = typeof tipo === 'string' ? tipo.trim().toLowerCase() : '';

  if (normalizedTipo !== 'receita') {
    throw new AsaasValidationError('Apenas receitas podem gerar cobrança no Asaas');
  }
};

const extractFlowId = (flow: QueryResultRow): number | string => {
  const flowId = (flow as { id?: unknown }).id;

  if (typeof flowId === 'number' || typeof flowId === 'string') {
    return flowId;
  }

  throw new AsaasValidationError('Fluxo financeiro inválido para geração de cobrança');
};

const createChargeForFlowIfRequested = async (
  params: AsaasChargeCreationParams,
): Promise<AsaasChargeResult | null> => {
  if (typeof params.paymentMethod !== 'string' || !params.paymentMethod.trim()) {
    return null;
  }

  ensureReceitaFlow(params.flow);

  const flowId = extractFlowId(params.flow);

  return asaasChargeService.createCharge(
    {
      financialFlowId: flowId,
      billingType: params.paymentMethod,
      clienteId: params.clienteId ?? null,
      integrationApiKeyId: params.integrationApiKeyId ?? null,
      value: params.value,
      dueDate: params.dueDate,
      description: params.description ?? null,
      cardToken: params.cardToken ?? null,
      asaasCustomerId: params.asaasCustomerId ?? null,
      additionalFields: params.additionalFields ?? null,
      payerEmail: params.payerEmail ?? null,
      payerName: params.payerName ?? null,
      customerDocument: params.customerDocument ?? null,
      externalReferenceId: params.externalReferenceId ?? null,
      metadata: params.metadata ?? null,
      remoteIp: params.remoteIp ?? null,
    },
    { dbClient: params.dbClient },
  );
};

const parseNullableInteger = (value: unknown): number | null => {
  if (value === null || typeof value === 'undefined') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.trunc(value) : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const normalizeBillingTypeFromRow = (
  value: unknown,
): AsaasChargeRecord['billingType'] => {
  const normalized = String(value ?? '').trim().toUpperCase();

  if (normalized === 'PIX' || normalized === 'BOLETO' || normalized === 'CREDIT_CARD' || normalized === 'DEBIT_CARD') {
    return normalized;
  }

  if (normalized === 'CREDITCARD') {
    return 'CREDIT_CARD';
  }

  if (normalized === 'DEBITCARD' || normalized === 'DEBIT' || normalized === 'DEBITO' || normalized === 'DÉBITO') {
    return 'DEBIT_CARD';
  }

  if (normalized === 'BOLETO_BANCARIO' || normalized === 'BANK_SLIP') {
    return 'BOLETO';
  }

  return 'PIX';
};

const normalizeFinancialFlowIdValue = (value: unknown): number | string => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === 'string') {
    return value;
  }

  return String(value ?? '');
};

const formatDateOnly = (value: unknown): string => {
  const date = value instanceof Date ? value : new Date(value as string);
  return date.toISOString().slice(0, 10);
};

const formatDateTime = (value: unknown): string => {
  const date = value instanceof Date ? value : new Date(value as string);
  return date.toISOString();
};

const normalizeAsaasChargeFromRow = (row: QueryResultRow): AsaasChargeRecord => {
  const record = row as Record<string, unknown>;
  const id = parseNullableInteger(record.id);

  if (id === null) {
    throw new Error('Invalid identifier for Asaas charge row');
  }

  return {
    id,
    financialFlowId: normalizeFinancialFlowIdValue(record.financial_flow_id),
    clienteId: parseNullableInteger(record.cliente_id),
    integrationApiKeyId: parseNullableInteger(record.integration_api_key_id),
    asaasChargeId: String(record.asaas_charge_id ?? ''),
    billingType: normalizeBillingTypeFromRow(record.billing_type),
    status: String(record.status ?? ''),
    dueDate: formatDateOnly(record.due_date),
    value: String(record.value ?? ''),
    invoiceUrl: record.invoice_url ? String(record.invoice_url) : null,
    pixPayload: record.pix_payload ? String(record.pix_payload) : null,
    pixQrCode: record.pix_qr_code ? String(record.pix_qr_code) : null,
    boletoUrl: record.boleto_url ? String(record.boleto_url) : null,
    cardLast4: record.card_last4 ? String(record.card_last4) : null,
    cardBrand: record.card_brand ? String(record.card_brand) : null,
    createdAt: formatDateTime(record.created_at),
    updatedAt: formatDateTime(record.updated_at),
  };
};

const findAsaasChargeByFlowId = async (
  flowId: string | number,
): Promise<AsaasChargeRecord | null> => {
  const result = await pool.query(
    `SELECT
        id,
        financial_flow_id,
        cliente_id,
        integration_api_key_id,
        asaas_charge_id,
        billing_type,
        status,
        due_date,
        value,
        invoice_url,
        pix_payload,
        pix_qr_code,
        boleto_url,
        card_last4,
        card_brand,
        created_at,
        updated_at
      FROM asaas_charges
      WHERE financial_flow_id = $1
      ORDER BY updated_at DESC
      LIMIT 1`,
    [flowId],
  );

  if (result.rowCount === 0) {
    return null;
  }

  return normalizeAsaasChargeFromRow(result.rows[0]);
};

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

const determineFinancialAccountTable = async (): Promise<FinancialAccountTableInfo | null> => {
  if (
    financialAccountTableInfo !== null &&
    financialAccountTableCheckedAt !== null &&
    Date.now() - financialAccountTableCheckedAt < FINANCIAL_ACCOUNT_TABLE_CACHE_TTL_MS
  ) {
    return financialAccountTableInfo;
  }

  if (financialAccountTablePromise) {
    return financialAccountTablePromise;
  }

  financialAccountTablePromise = (async () => {
    for (const candidate of FINANCIAL_ACCOUNT_TABLE_CANDIDATES) {
      const columnsResult = await pool.query<{ column_name?: unknown }>(
        `SELECT column_name
           FROM information_schema.columns
          WHERE table_schema = $1 AND table_name = $2`,
        [candidate.schema, candidate.table],
      );

      if (columnsResult.rowCount === 0) {
        continue;
      }

      let empresaColumn: string | null = null;
      let hasIdColumn = false;

      for (const row of columnsResult.rows) {
        if (empresaColumn && hasIdColumn) {
          break;
        }

        const columnName =
          typeof row.column_name === 'string' && row.column_name.trim().length > 0
            ? row.column_name.trim()
            : null;

        if (!columnName) {
          continue;
        }

        const normalized = columnName.toLowerCase();

        if (!hasIdColumn && normalized === 'id') {
          hasIdColumn = true;
        }

        if (!empresaColumn) {
          const match = FINANCIAL_FLOW_EMPRESA_CANDIDATES.find(
            (candidateColumn) => normalized === candidateColumn,
          );

          if (match) {
            empresaColumn = columnName;
          }
        }
      }

      if (hasIdColumn && empresaColumn) {
        const info: FinancialAccountTableInfo = {
          schema: candidate.schema,
          table: candidate.table,
          empresaColumn,
        };

        updateFinancialAccountTableInfo(info);
        return info;
      }
    }

    updateFinancialAccountTableInfo(null);
    return null;
  })().finally(() => {
    financialAccountTablePromise = null;
  });

  return financialAccountTablePromise;
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
  const auth = getAuthenticatedUser(req, res);
  if (!auth) {
    return;
  }

  const {
    contaId,
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
  } = req.body ?? {};

  const normalizedContaId = normalizeOptionalInteger(contaId);

  if (normalizedContaId === null || normalizedContaId <= 0) {
    res.status(400).json({ error: 'contaId é obrigatório e deve ser um inteiro positivo.' });
    return;
  }

  const empresaLookup = await fetchAuthenticatedUserEmpresa(auth.userId);

  if (!empresaLookup.success) {
    res.status(empresaLookup.status).json({ error: empresaLookup.message });
    return;
  }

  const { empresaId } = empresaLookup;

  if (empresaId === null) {
    res.status(403).json({ error: 'Usuário não está vinculado a uma empresa.' });
    return;
  }

  const accountTableInfo = await determineFinancialAccountTable();

  if (!accountTableInfo) {
    console.warn('Não foi possível determinar tabela de contas financeiras para validação.');
    res.status(500).json({ error: 'Não foi possível validar a conta informada.' });
    return;
  }

  let accountResult: QueryResult | null = null;

  try {
    accountResult = await pool.query(
      `SELECT id
         FROM ${quoteIdentifier(accountTableInfo.schema)}.${quoteIdentifier(accountTableInfo.table)}
        WHERE id = $1 AND ${quoteIdentifier(accountTableInfo.empresaColumn)} = $2
        LIMIT 1`,
      [normalizedContaId, empresaId],
    );
  } catch (error) {
    console.error('Failed to validate contaId for createFlow:', error);
    res.status(500).json({ error: 'Não foi possível validar a conta informada.' });
    return;
  }

  if (accountResult.rowCount === 0) {
    res.status(400).json({ error: 'Conta inválida para a empresa autenticada.' });
    return;
  }

  let client: PoolClient | null = null;
  let transactionStarted = false;

  try {
    client = await pool.connect();
    await client.query('BEGIN');
    transactionStarted = true;

    const tipoText = typeof tipo === 'string' ? tipo.trim().toLowerCase() : '';
    const isDespesa = tipoText === 'despesa';
    const normalizedTipo: Flow['tipo'] = isDespesa ? 'despesa' : 'receita';
    const normalizedClienteId = normalizeOptionalInteger(clienteId);
    const normalizedFornecedorId = normalizeOptionalInteger(fornecedorId);
    const clienteIdForInsert = isDespesa ? null : normalizedClienteId;
    const fornecedorIdForInsert = isDespesa ? normalizedFornecedorId : null;
    const inserted = await client.query(
      'INSERT INTO financial_flows (tipo, descricao, valor, vencimento, status, conta_id, cliente_id, fornecedor_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [
        normalizedTipo,
        descricao,
        valor,
        vencimento,
        'pendente',
        normalizedContaId,
        clienteIdForInsert,
        fornecedorIdForInsert,
      ],
    );

    let flow = inserted.rows[0];
    let charge = null;

    const chargeResult = await createChargeForFlowIfRequested({
      dbClient: client,
      flow,
      paymentMethod,
      clienteId: clienteIdForInsert,
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
      externalReferenceId: externalReferenceId ?? null,
      metadata: metadata ?? null,
      remoteIp: remoteIp ?? null,
    });

    if (chargeResult) {
      flow = chargeResult.flow;
      charge = chargeResult.charge;
    }

    await client.query('COMMIT');
    res.status(201).json({ flow, charge });
  } catch (err) {
    if (client && transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Failed to rollback transaction after createFlow error:', rollbackError);
      }
    }

    if (err instanceof AsaasValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (err instanceof ChargeConflictError) {
      res.status(409).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (client) {
      client.release();
    }
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

    const chargeResult = await createChargeForFlowIfRequested({
      dbClient: client,
      flow,
      paymentMethod,
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
    });

    if (chargeResult) {
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

const parseOpportunityInstallmentId = (value: unknown): number | null => {
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value >= 0) {
      return null;
    }

    return Math.abs(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0 || !INTEGER_ID_REGEX.test(trimmed)) {
      return null;
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isInteger(parsed) || parsed >= 0) {
      return null;
    }

    return Math.abs(parsed);
  }

  return null;
};

const parseDateOnlyInput = (value: unknown): Date | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const candidate = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? `${trimmed}T00:00:00` : trimmed;
  const parsed = new Date(candidate);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeEmpresaIdValue = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }

    const parsed = Number.parseInt(trimmed, 10);
    return Number.isInteger(parsed) ? parsed : null;
  }

  return null;
};

const isOpportunityInstallmentPaid = (status: unknown): boolean => {
  if (typeof status !== 'string') {
    return false;
  }

  const normalized = status.trim().toLowerCase();
  return normalized.length > 0 && OPPORTUNITY_INSTALLMENT_PAID_STATUSES.has(normalized);
};

const settleOpportunityInstallment = async (
  req: Request,
  res: Response,
  installmentId: number,
  pagamentoData: unknown,
): Promise<void> => {
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
    res.status(403).json({ error: 'Usuário não está vinculado a uma empresa.' });
    return;
  }

  const paymentDate = (() => {
    if (pagamentoData === undefined || pagamentoData === null) {
      return new Date();
    }

    const parsed = parseDateOnlyInput(pagamentoData);
    if (!parsed) {
      res.status(400).json({ error: 'Data de pagamento inválida.' });
      return null;
    }

    return parsed;
  })();

  if (!paymentDate) {
    return;
  }

  try {
    const installmentResult = await pool.query(
      `SELECT id, valor, status, idempresa
         FROM public.oportunidade_parcelas
        WHERE id = $1`,
      [installmentId],
    );

    if (installmentResult.rowCount === 0) {
      res.status(404).json({ error: 'Parcela de oportunidade não encontrada.' });
      return;
    }

    const installmentRow = installmentResult.rows[0] as {
      valor?: unknown;
      status?: unknown;
      idempresa?: unknown;
    };

    const installmentEmpresaId = normalizeEmpresaIdValue(installmentRow.idempresa);

    if (installmentEmpresaId === null || installmentEmpresaId !== empresaId) {
      res.status(403).json({ error: 'Parcela indisponível para este usuário.' });
      return;
    }

    if (isOpportunityInstallmentPaid(installmentRow.status)) {
      res.status(409).json({ error: 'A parcela já está quitada.' });
      return;
    }

    const rawValor = installmentRow.valor;
    const valorNumero =
      typeof rawValor === 'number'
        ? rawValor
        : typeof rawValor === 'string'
          ? Number.parseFloat(rawValor)
          : Number(rawValor ?? 0);

    const valorPago = Number.isFinite(valorNumero) ? Number(valorNumero) : 0;

    const updateResult = await pool.query(
      `UPDATE public.oportunidade_parcelas
          SET status = 'quitado',
              valor_pago = $2,
              quitado_em = $3,
              atualizado_em = NOW()
        WHERE id = $1
        RETURNING id, oportunidade_id, numero_parcela, valor, valor_pago, status, data_prevista, quitado_em, faturamento_id, criado_em, atualizado_em, idempresa`,
      [installmentId, valorPago, paymentDate],
    );

    if (updateResult.rowCount === 0) {
      res.status(404).json({ error: 'Parcela de oportunidade não encontrada.' });
      return;
    }

    res.json({ parcela: updateResult.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const settleFlow = async (req: Request, res: Response) => {
  const { id } = req.params;
  const opportunityInstallmentId = parseOpportunityInstallmentId(id);

  if (opportunityInstallmentId !== null) {
    await settleOpportunityInstallment(req, res, opportunityInstallmentId, req.body?.pagamentoData);
    return;
  }

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
    const normalizedClienteId = normalizeOptionalInteger(clienteId);
    const normalizedIntegrationApiKeyId = normalizeOptionalInteger(integrationApiKeyId);

    const chargeResult = await createChargeForFlowIfRequested({
      dbClient: client,
      flow,
      paymentMethod,
      clienteId: normalizedClienteId,
      integrationApiKeyId: normalizedIntegrationApiKeyId,
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
    });

    if (!chargeResult) {
      throw new Error('Falha ao criar cobrança no Asaas');
    }

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

export const getAsaasChargeForFlow = async (req: Request, res: Response) => {
  const { id } = req.params;
  const flowId = normalizeFlowId(id);

  if (flowId === null) {
    return res.status(400).json({ error: 'Invalid flow id' });
  }

  try {
    const charge = await findAsaasChargeByFlowId(flowId);

    if (!charge) {
      return res.status(404).json({ error: 'Charge not found' });
    }

    const chargePayload: Record<string, unknown> = { ...charge };

    if (typeof charge.financialFlowId === 'number') {
      chargePayload.flowId = charge.financialFlowId;
    }

    res.json({ charge: chargePayload });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const listAsaasChargeStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const flowId = normalizeFlowId(id);

  if (flowId === null) {
    return res.status(400).json({ error: 'Invalid flow id' });
  }

  try {
    const charge = await findAsaasChargeByFlowId(flowId);

    if (!charge) {
      return res.status(404).json({ error: 'Charge not found' });
    }

    const statuses = [
      {
        status: charge.status,
        description: 'Status atual sincronizado localmente.',
        updatedAt: charge.updatedAt,
        metadata: {
          source: 'asaas_charges',
          chargeId: charge.asaasChargeId,
          financialFlowId: charge.financialFlowId,
          billingType: charge.billingType,
          value: charge.value,
          createdAt: charge.createdAt,
        },
      },
    ];

    res.json({ statuses });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
