import { NextFunction, Request, Response } from 'express';
import { fetchUserModules } from '../services/moduleService';
import { normalizeModuleId } from '../constants/modules';

type ModuleCacheEntry = { modules: string[]; expiresAt: number };

const MODULE_CACHE_TTL_MS = 5_000;
const moduleCache = new Map<number, ModuleCacheEntry>();
type FetchUserModulesFn = typeof fetchUserModules;
let fetchUserModulesFn: FetchUserModulesFn = fetchUserModules;

const resolveCacheKey = (userId: unknown): number | null => {
  if (typeof userId === 'number' && Number.isInteger(userId)) {
    return userId;
  }

  if (typeof userId === 'string') {
    const parsed = Number.parseInt(userId, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const readModulesFromCache = (userId: unknown): string[] | null => {
  const cacheKey = resolveCacheKey(userId);
  if (cacheKey == null) {
    return null;
  }

  const entry = moduleCache.get(cacheKey);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    moduleCache.delete(cacheKey);
    return null;
  }

  return [...entry.modules];
};

const storeModulesInCache = (userId: unknown, modules: string[]) => {
  const cacheKey = resolveCacheKey(userId);
  if (cacheKey == null) {
    return;
  }

  moduleCache.set(cacheKey, {
    modules: [...modules],
    expiresAt: Date.now() + MODULE_CACHE_TTL_MS,
  });
};

export const invalidateUserModulesCache = (userId: unknown) => {
  const cacheKey = resolveCacheKey(userId);
  if (cacheKey == null) {
    return;
  }

  moduleCache.delete(cacheKey);
};

export const invalidateAllUserModulesCache = () => {
  moduleCache.clear();
};

export const __setFetchUserModulesForTests = (fn: FetchUserModulesFn) => {
  fetchUserModulesFn = fn;
};

export const __resetFetchUserModulesForTests = () => {
  fetchUserModulesFn = fetchUserModules;
};

const normalizeRequiredModules = (value: string | string[]): string[] => {
  if (Array.isArray(value)) {
    return value;
  }

  return [value];
};

export const authorizeModules = (required: string | string[]) => {
  const requiredModuleSet = new Set<string>();

  for (const moduleId of normalizeRequiredModules(required)) {
    if (typeof moduleId !== 'string') {
      continue;
    }

    const trimmed = moduleId.trim();
    if (!trimmed) {
      continue;
    }

    requiredModuleSet.add(trimmed);

    const normalized = normalizeModuleId(trimmed);
    if (normalized) {
      requiredModuleSet.add(normalized);
    }
  }

  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      res.status(401).json({ error: 'Token inválido.' });
      return;
    }

    try {
      if (!req.auth.modules) {
        const cachedModules = readModulesFromCache(req.auth.userId);
        if (cachedModules) {
          req.auth.modules = cachedModules;
        } else {
          const modules = await fetchUserModulesFn(req.auth.userId);
          req.auth.modules = modules;
          storeModulesInCache(req.auth.userId, modules);
        }
      }

      const userModules = new Set<string>();

      for (const moduleId of req.auth.modules ?? []) {
        if (typeof moduleId !== 'string') {
          continue;
        }

        const trimmed = moduleId.trim();
        if (!trimmed) {
          continue;
        }

        userModules.add(trimmed);

        const normalized = normalizeModuleId(trimmed);
        if (normalized) {
          userModules.add(normalized);
        }
      }

      const hasAccess = requiredModuleSet.size === 0
        ? true
        : Array.from(requiredModuleSet).some((moduleId) => userModules.has(moduleId));

      if (!hasAccess) {
        res.status(403).json({ error: 'Acesso negado.' });
        return;
      }

      next();
    } catch (error) {
      console.error('Erro ao validar módulos do usuário', error);
      res.status(500).json({ error: 'Não foi possível validar as permissões do usuário.' });
    }
  };
};
