import pool from './db';

export type PlanLimitResource = 'usuarios' | 'processos' | 'propostas' | 'clientes';

export interface CompanyPlanLimits {
  limiteUsuarios: number | null;
  limiteProcessos: number | null;
  limitePropostas: number | null;
  limiteClientes: number | null;
  limiteAdvogadosProcessos: number | null;
  limiteAdvogadosIntimacoesMonitoradas: number | null;
  sincronizacaoProcessosHabilitada: boolean | null;
  sincronizacaoProcessosCota: number | null;
}

const toInteger = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }

  return null;
};

const toNonNegativeLimit = (value: unknown): number | null => {
  const parsed = toInteger(value);
  if (parsed === null) {
    return null;
  }

  if (parsed < 0) {
    return 0;
  }

  return parsed;
};

const toBoolean = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (!normalized) {
      return null;
    }

    if (['1', 'true', 't', 'yes', 'y', 'sim', 'ativo', 'on'].includes(normalized)) {
      return true;
    }

    if (['0', 'false', 'f', 'no', 'n', 'nao', 'não', 'inativo', 'off'].includes(normalized)) {
      return false;
    }
  }

  return null;
};

export const fetchPlanLimitsForCompany = async (
  companyId: number,
): Promise<CompanyPlanLimits | null> => {
  if (!Number.isInteger(companyId) || companyId <= 0) {
    return null;
  }

  const result = await pool.query<{
    limite_usuarios: unknown;
    limite_processos: unknown;
    limite_propostas: unknown;
    limite_clientes: unknown;
    limite_advogados_processos: unknown;
    limite_advogados_intimacoes_monitoradas: unknown;
    sincronizacao_processos_habilitada: unknown;
    sincronizacao_processos_cota: unknown;
  }>(
    `SELECT pl.limite_usuarios,
            pl.limite_processos,
            pl.limite_propostas,
            pl.limite_clientes,
            pl.limite_advogados_processos,
            pl.limite_advogados_intimacao AS limite_advogados_intimacoes_monitoradas,
            pl.sincronizacao_processos_habilitada,
            pl.sincronizacao_processos_cota
       FROM public.empresas emp
       LEFT JOIN public.planos pl ON pl.id::text = emp.plano::text
      WHERE emp.id = $1
      LIMIT 1`,
    [companyId],
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];

  return {
    limiteUsuarios: toNonNegativeLimit(row.limite_usuarios),
    limiteProcessos: toNonNegativeLimit(row.limite_processos),
    limitePropostas: toNonNegativeLimit(row.limite_propostas),
    limiteClientes: toNonNegativeLimit(row.limite_clientes),
    limiteAdvogadosProcessos: toNonNegativeLimit(row.limite_advogados_processos),
    limiteAdvogadosIntimacoesMonitoradas: toNonNegativeLimit(
      row.limite_advogados_intimacoes_monitoradas,
    ),
    sincronizacaoProcessosHabilitada: toBoolean(
      row.sincronizacao_processos_habilitada,
    ),
    sincronizacaoProcessosCota: toNonNegativeLimit(
      row.sincronizacao_processos_cota,
    ),
  };
};

const RESOURCE_QUERIES: Record<PlanLimitResource, string> = {
  usuarios:
    'SELECT 1 FROM public.usuarios WHERE empresa IS NOT DISTINCT FROM $1 LIMIT $2',
  processos:
    'SELECT 1 FROM public.processos WHERE idempresa IS NOT DISTINCT FROM $1 LIMIT $2',
  propostas:
    'SELECT 1 FROM public.oportunidades WHERE idempresa IS NOT DISTINCT FROM $1 LIMIT $2',
  clientes:
    'SELECT 1 FROM public.clientes WHERE idempresa IS NOT DISTINCT FROM $1 LIMIT $2',
};

export const countCompanyResource = async (
  companyId: number,
  resource: PlanLimitResource,
  maxAllowed: number,
): Promise<number> => {
  if (!Number.isInteger(companyId) || companyId <= 0) {
    return 0;
  }

  const normalizedLimit = Number.isInteger(maxAllowed) ? Math.trunc(maxAllowed) : 0;

  if (normalizedLimit <= 0) {
    return 0;
  }

  const query = RESOURCE_QUERIES[resource];
  const result = await pool.query(query, [companyId, normalizedLimit]);

  const limitedCount = result.rowCount ?? 0;

  if (limitedCount <= 0) {
    return 0;
  }

  return limitedCount >= normalizedLimit ? normalizedLimit : limitedCount;
};
