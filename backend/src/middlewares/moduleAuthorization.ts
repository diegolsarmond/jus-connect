import { NextFunction, Request, Response } from 'express';
import { fetchUserModules } from '../services/moduleService';

const normalizeRequiredModules = (value: string | string[]): string[] => {
  if (Array.isArray(value)) {
    return value;
  }

  return [value];
};

export const authorizeModules = (required: string | string[]) => {
  const requiredModules = normalizeRequiredModules(required).filter((moduleId) => typeof moduleId === 'string');

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

      const userModules = req.auth.modules ?? [];
      const hasAccess = requiredModules.length === 0
        ? true
        : requiredModules.some((moduleId) => userModules.includes(moduleId));

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
