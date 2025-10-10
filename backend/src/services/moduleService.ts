import type { QueryResult } from 'pg';
import pool from './db';
import { normalizeModuleId, sortModules } from '../constants/modules';

const normalizePerfilId = (value: unknown): number | null => {
  if (value == null) {
    return null;
  }

  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const parsePerfilIdValue = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const normalizePerfilName = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\bperfil\b/gi, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLowerCase();
};

type PoolQueryResult = QueryResult<any>;

const runQuery = async (query: string, params: unknown[]): Promise<PoolQueryResult> => {
  try {
    return await pool.query(query, params);
  } catch (error) {
    if (
      error instanceof Error &&
      typeof error.message === 'string' &&
      error.message.toLowerCase().includes('connection terminated unexpectedly')
    ) {
      return pool.query(query, params);
    }

    throw error;
  }
};

const findPerfilIdByName = async (name: string): Promise<number | null> => {
  const directResult = await runQuery(
    'SELECT id FROM public.perfis WHERE LOWER(nome) = LOWER($1) LIMIT 1',
    [name]
  );

  const directRowCount = typeof directResult.rowCount === 'number' ? directResult.rowCount : 0;
  if (directRowCount > 0) {
    const candidate = parsePerfilIdValue(directResult.rows[0]?.id);
    if (candidate != null) {
      return candidate;
    }
  }

  const normalizedTarget = normalizePerfilName(name);
  if (!normalizedTarget) {
    return null;
  }

  const fallbackResult = await runQuery('SELECT id, nome FROM public.perfis', []);

  for (const row of fallbackResult.rows as Array<{ id?: unknown; nome?: unknown }>) {
    const normalizedRowName = normalizePerfilName(row.nome);
    if (!normalizedRowName || normalizedRowName !== normalizedTarget) {
      continue;
    }

    const candidate = parsePerfilIdValue(row.id);
    if (candidate != null) {
      return candidate;
    }
  }

  return null;
};

const resolvePerfilId = async (perfil: unknown): Promise<number | null> => {
  const normalizedId = normalizePerfilId(perfil);
  if (normalizedId != null) {
    return normalizedId;
  }

  if (typeof perfil !== 'string') {
    return null;
  }

  const trimmedPerfil = perfil.trim();
  if (!trimmedPerfil) {
    return null;
  }

  return findPerfilIdByName(trimmedPerfil);
};

export const fetchPerfilModules = async (perfil: unknown): Promise<string[]> => {
  const perfilId = await resolvePerfilId(perfil);

  if (perfilId == null || typeof perfilId !== 'number' || !Number.isInteger(perfilId)) {
    return [];
  }

  const result = await runQuery(
    'SELECT pm.modulo FROM public.perfil_modulos pm WHERE pm.perfil_id = $1',
    [perfilId]
  );

  const uniqueModules = new Set<string>();

  for (const row of result.rows as Array<{ modulo?: unknown }>) {
    if (typeof row.modulo !== 'string') {
      continue;
    }

    const trimmed = row.modulo.trim();
    if (!trimmed) {
      continue;
    }

    const normalized = normalizeModuleId(trimmed);
    if (normalized) {
      uniqueModules.add(normalized);
      continue;
    }

    uniqueModules.add(trimmed);
  }

  return sortModules(Array.from(uniqueModules));
};

export const fetchUserModules = async (userId: number): Promise<string[]> => {
  const result = await runQuery(
    'SELECT perfil FROM public.usuarios WHERE id = $1 LIMIT 1',
    [userId]
  );

  if (result.rowCount === 0) {
    return [];
  }

  return fetchPerfilModules(result.rows[0]?.perfil);
};
