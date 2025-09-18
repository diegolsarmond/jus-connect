import { Request, Response } from 'express';
import UserProfileService, {
  NotFoundError,
  UpdateProfileInput,
  ValidationError,
} from '../services/userProfileService';

const service = new UserProfileService();

const ensureAuthenticatedUserId = (req: Request): number | null => {
  if (!req.auth || !Number.isInteger(req.auth.userId)) {
    return null;
  }
  return req.auth.userId;
};

const extractPerformer = (req: Request) => {
  if (!req.auth) {
    return undefined;
  }

  const performerName =
    typeof req.auth.payload?.name === 'string' && req.auth.payload.name.trim()
      ? req.auth.payload.name.trim()
      : undefined;

  return { id: req.auth.userId, name: performerName };
};

const handleControllerError = (res: Response, error: unknown) => {
  if (error instanceof ValidationError) {
    res.status(400).json({ error: error.message });
    return;
  }

  if (error instanceof NotFoundError) {
    res.status(404).json({ error: error.message });
    return;
  }

  console.error('Erro ao processar requisição de perfil', error);
  res.status(500).json({ error: 'Erro interno do servidor.' });
};

export const getMyProfile = async (req: Request, res: Response) => {
  const userId = ensureAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Usuário não autenticado.' });
    return;
  }

  try {
    const profile = await service.getProfile(userId);
    res.json(profile);
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const updateMyProfile = async (req: Request, res: Response) => {
  const userId = ensureAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Usuário não autenticado.' });
    return;
  }

  try {
    const payload = req.body as UpdateProfileInput;
    const performer = extractPerformer(req);
    const profile = await service.updateProfile(userId, payload, performer);
    res.json(profile);
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const listMyAuditLogs = async (req: Request, res: Response) => {
  const userId = ensureAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Usuário não autenticado.' });
    return;
  }

  try {
    const limitParam = req.query.limit;
    const offsetParam = req.query.offset;
    const limit =
      typeof limitParam === 'string' ? Number.parseInt(limitParam, 10) : undefined;
    const offset =
      typeof offsetParam === 'string' ? Number.parseInt(offsetParam, 10) : undefined;

    const logs = await service.listAuditLogs(userId, { limit, offset });
    res.json(logs);
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const listMySessions = async (req: Request, res: Response) => {
  const userId = ensureAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Usuário não autenticado.' });
    return;
  }

  try {
    const sessions = await service.listSessions(userId);
    res.json(sessions);
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const revokeMySession = async (req: Request, res: Response) => {
  const userId = ensureAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Usuário não autenticado.' });
    return;
  }

  const sessionIdParam = req.params.sessionId;
  const sessionId = Number.parseInt(sessionIdParam, 10);

  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    res.status(400).json({ error: 'Sessão inválida.' });
    return;
  }

  try {
    const performer = extractPerformer(req);
    const session = await service.revokeSession(userId, sessionId, performer);

    if (!session) {
      res.status(404).json({ error: 'Sessão não encontrada ou já revogada.' });
      return;
    }

    res.json(session);
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const revokeAllMySessions = async (req: Request, res: Response) => {
  const userId = ensureAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Usuário não autenticado.' });
    return;
  }

  try {
    const performer = extractPerformer(req);
    const revokedCount = await service.revokeAllSessions(userId, performer);
    res.json({ revokedCount });
  } catch (error) {
    handleControllerError(res, error);
  }
};
