import { NextFunction, Request, Response } from 'express';
import { isAdminUserId } from '../constants/admin';

export const requireAdminUser = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.auth) {
    res.status(401).json({ error: 'Token inválido.' });
    return;
  }

  if (!isAdminUserId(req.auth.userId)) {
    res.status(403).json({ error: 'Acesso restrito ao ambiente administrativo.' });
    return;
  }

  next();
};
