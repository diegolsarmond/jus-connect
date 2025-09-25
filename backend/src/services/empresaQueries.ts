import type { QueryResult, QueryResultRow } from 'pg';
import pool from './db';

type PostgresError = Error & { code?: string };

const EMPRESA_QUERY_SOURCES = [
  {
    label: 'view',
    text:
      'SELECT id, nome_empresa, cnpj, telefone, email, plano, responsavel, ativo, datacadastro, trial_started_at, trial_ends_at, current_period_start, current_period_end, grace_expires_at, subscription_trial_ends_at, subscription_current_period_ends_at, subscription_grace_period_ends_at, subscription_cadence, NULL::timestamp AS atualizacao FROM public."empresas"',
  },
  {
    label: 'table',
    text:
      'SELECT id, nome_empresa, cnpj, telefone, email, plano, responsavel, ativo, datacadastro, trial_started_at, trial_ends_at, current_period_start, current_period_end, grace_expires_at, subscription_trial_ends_at, subscription_current_period_ends_at, subscription_grace_period_ends_at, subscription_cadence, NULL::timestamp AS atualizacao FROM public.empresas',
  },
] as const;

const isRecoverableEmpresasError = (error: unknown): error is PostgresError => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const { code } = error as PostgresError;
  return code === '42P01' || code === '42703';
};

export const queryEmpresas = async <T extends QueryResultRow = QueryResultRow>(
  whereClause = '',
  params: ReadonlyArray<unknown> = []
): Promise<QueryResult<T>> => {
  let lastError: unknown;

  for (const { label, text } of EMPRESA_QUERY_SOURCES) {
    try {
      const sql = whereClause ? `${text} ${whereClause}` : text;
      const queryParams = Array.from(params);
      return await pool.query<T>(sql, queryParams);
    } catch (error) {
      if (!isRecoverableEmpresasError(error)) {
        throw error;
      }

      lastError = error;
      console.warn(
        `Empresas query via ${label} failed, attempting fallback to alternative source.`,
        error
      );
    }
  }

  throw lastError ?? new Error('Falha ao consultar dados de empresas');
};
