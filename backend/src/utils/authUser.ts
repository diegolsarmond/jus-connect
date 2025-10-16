import { Request } from 'express';
import pool from '../services/db';

export type ParsedInteger = number | null | 'invalid';

export type EmpresaLookupResult =
  | { success: true; empresaId: number | null }
  | { success: false; status: number; message: string };

export type AuthenticatedEmpresaResult =
  | { success: true; userId: number; empresaId: number | null }
  | { success: false; status: number; message: string };

export type ConversationVisibilityLookup =
  | { success: true; viewAllConversations: boolean }
  | { success: false; status: number; message: string };

export const parseBooleanColumn = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return null;
    }
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    if (
      normalized === '1' ||
      normalized === 'true' ||
      normalized === 't' ||
      normalized === 'yes' ||
      normalized === 'y' ||
      normalized === 'sim' ||
      normalized === 'on' ||
      normalized === 'ativo' ||
      normalized === 'ativa'
    ) {
      return true;
    }

    if (
      normalized === '0' ||
      normalized === 'false' ||
      normalized === 'f' ||
      normalized === 'no' ||
      normalized === 'n' ||
      normalized === 'nao' ||
      normalized === 'não' ||
      normalized === 'off' ||
      normalized === 'inativo' ||
      normalized === 'inativa'
    ) {
      return false;
    }
  }

  return null;
};

export const parseOptionalInteger = (value: unknown): ParsedInteger => {
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

export async function fetchAuthenticatedUserEmpresa(
  userId: number
): Promise<EmpresaLookupResult> {
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
}

export const resolveAuthenticatedEmpresa = async (
  req: Request
): Promise<AuthenticatedEmpresaResult> => {
  const { auth } = req;

  if (!auth) {
    return {
      success: false,
      status: 401,
      message: 'Token inválido.',
    };
  }

  const lookup = await fetchAuthenticatedUserEmpresa(auth.userId);

  if (!lookup.success) {
    return {
      success: false,
      status: lookup.status,
      message: lookup.message,
    };
  }

  return {
    success: true,
    userId: auth.userId,
    empresaId: lookup.empresaId,
  };
};

export const fetchUserConversationVisibility = async (
  userId: number
): Promise<ConversationVisibilityLookup> => {
  const result = await pool.query(
    `SELECT COALESCE(p.ver_todas_conversas, TRUE) AS ver_todas_conversas
       FROM public.usuarios u
  LEFT JOIN public.perfis p ON p.id = u.perfil
      WHERE u.id = $1
      LIMIT 1`,
    [userId]
  );

  if (result.rowCount === 0) {
    return {
      success: false,
      status: 404,
      message: 'Usuário autenticado não encontrado',
    };
  }

  const row = result.rows[0] as { ver_todas_conversas?: unknown };
  const parsed = parseBooleanColumn(row.ver_todas_conversas);

  return {
    success: true,
    viewAllConversations: parsed ?? true,
  };
};
