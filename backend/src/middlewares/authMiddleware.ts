import { NextFunction, Request, Response } from 'express';
import { authConfig } from '../constants/auth';
import { verifyToken } from '../utils/tokenUtils';

const extractBearerToken = (authorizationHeader: string | undefined): string | null => {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(' ');

  if (!scheme || !token) {
    return null;
  }

  if (scheme.toLowerCase() !== 'bearer') {
    return null;
  }

  return token.trim() || null;
};

export const authenticateRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    res.status(401).json({ error: 'Token de autenticação ausente.' });
    return;
  }

  try {
    const payload = verifyToken(token, authConfig.secret);

    if (typeof payload.sub !== 'string') {
      res.status(401).json({ error: 'Token inválido.' });
      return;
    }

    const subject = payload.sub.trim();
    if (subject === '') {
      res.status(401).json({ error: 'Token inválido.' });
      return;
    }
    const userId = Number.parseInt(subject, 10);

    if (!Number.isFinite(userId)) {
      res.status(401).json({ error: 'Token inválido.' });
      return;
    }

    req.auth = {
      userId,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      payload,
    };

    next();
  } catch (error) {
    console.error('Falha ao validar token de autenticação', error);
    res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
};
