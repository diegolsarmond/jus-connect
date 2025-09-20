import pool from '../services/db';

type ParsedInteger = number | null | 'invalid';

export type EmpresaLookupResult =
  | { success: true; empresaId: number | null }
  | { success: false; status: number; message: string };

const parseOptionalInteger = (value: unknown): ParsedInteger => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      return null;
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
      return 'invalid';
    }

    return parsed;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      return 'invalid';
    }

    return value;
  }

  return 'invalid';
};

export const fetchAuthenticatedUserEmpresa = async (
  userId: number
): Promise<EmpresaLookupResult> => {
  const empresaUsuarioResult = await pool.query(
    'SELECT empresa FROM public.usuarios WHERE id = $1 LIMIT 1',
    [userId]
  );

  if (empresaUsuarioResult.rowCount === 0) {
    return {
      success: false,
      status: 404,
      message: 'Usuário autenticado não encontrado',
    };
  }

  const empresaAtualResult = parseOptionalInteger(
    (empresaUsuarioResult.rows[0] as { empresa: unknown }).empresa
  );

  if (empresaAtualResult === 'invalid') {
    return {
      success: false,
      status: 500,
      message: 'Não foi possível identificar a empresa do usuário autenticado.',
    };
  }

  return {
    success: true,
    empresaId: empresaAtualResult,
  };
};
