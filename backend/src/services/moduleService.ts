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

export const fetchPerfilModules = async (perfil: unknown): Promise<string[]> => {
  const perfilId = normalizePerfilId(perfil);

  if (perfilId == null) {
    return [];
  }

  const result = await pool.query(
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
  const result = await pool.query(
    'SELECT perfil FROM public.usuarios WHERE id = $1 LIMIT 1',
    [userId]
  );

  if (result.rowCount === 0) {
    return [];
  }

  return fetchPerfilModules(result.rows[0]?.perfil);
};
