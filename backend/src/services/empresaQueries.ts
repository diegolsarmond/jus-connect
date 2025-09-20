import type { QueryResult } from 'pg';
import pool from './db';

type PostgresError = Error & { code?: string };

const EMPRESA_SELECT_FIELDS =
  'id, nome_empresa, cnpj, telefone, email, plano, responsavel, ativo, datacadastro, atualizacao';

const EMPRESA_QUERY_SOURCES = [
  {
    label: 'view',
    text: `SELECT ${EMPRESA_SELECT_FIELDS} FROM public."vw.empresas"`,
  },
  {
    label: 'table',
    text: `SELECT ${EMPRESA_SELECT_FIELDS} FROM public.empresas`,
  },
] as const;

const isRecoverableEmpresasError = (error: unknown): error is PostgresError => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const { code } = error as PostgresError;
  return code === '42P01' || code === '42703';
};

export const queryEmpresas = async <T = Record<string, unknown>>(
  whereClause = '',
  params: ReadonlyArray<unknown> = []
): Promise<QueryResult<T>> => {
  let lastError: unknown;

  for (const { label, text } of EMPRESA_QUERY_SOURCES) {
    try {
      const sql = whereClause ? `${text} ${whereClause}` : text;
      return await pool.query<T>(sql, params);
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
