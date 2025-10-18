import { NextFunction, Request, Response } from 'express';
import { fetchUserModules } from '../services/moduleService';
import { normalizeModuleId } from '../constants/modules';

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
        const modules = await fetchUserModules(req.auth.userId);
        req.auth.modules = modules;
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
