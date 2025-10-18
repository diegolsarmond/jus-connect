import { Request, Response } from 'express';
import UserProfileService, {
  NotFoundError,
  UpdateProfileInput,
  ValidationError,
} from '../services/userProfileService';
import { buildErrorResponse } from '../utils/errorResponse';

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
    res
      .status(400)
      .json(
        buildErrorResponse(
          error,
          'Não foi possível atualizar os dados do perfil.',
          { expose: true }
        )
      );
    return;
  }

  if (error instanceof NotFoundError) {
    res
      .status(404)
      .json(
        buildErrorResponse(
          error,
          'Registro de perfil não encontrado.',
          { expose: true }
        )
      );
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

const extractCodeFromBody = (body: unknown): string | null => {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const value = (body as { code?: unknown }).code;
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const initiateMyTwoFactor = async (req: Request, res: Response) => {
  const userId = ensureAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Usuário não autenticado.' });
    return;
  }

  try {
    const performer = extractPerformer(req);
    const result = await service.initiateTwoFactor(userId, performer);
    res.json(result);
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const confirmMyTwoFactor = async (req: Request, res: Response) => {
  const userId = ensureAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Usuário não autenticado.' });
    return;
  }

  const code = extractCodeFromBody(req.body);
  if (!code) {
    res.status(400).json({ error: 'Informe o código de verificação.' });
    return;
  }

  try {
    const performer = extractPerformer(req);
    const result = await service.confirmTwoFactor(userId, code, performer);
    res.json(result);
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const disableMyTwoFactor = async (req: Request, res: Response) => {
  const userId = ensureAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Usuário não autenticado.' });
    return;
  }

  const code = extractCodeFromBody(req.body);
  if (!code) {
    res.status(400).json({ error: 'Informe o código para desativar o 2FA.' });
    return;
  }

  try {
    const performer = extractPerformer(req);
    await service.disableTwoFactor(userId, code, performer);
    res.status(204).send();
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const approveMyDevice = async (req: Request, res: Response) => {
  const userId = ensureAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Usuário não autenticado.' });
    return;
  }

  const sessionId = Number.parseInt(req.params.sessionId, 10);
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    res.status(400).json({ error: 'Sessão inválida.' });
    return;
  }

  try {
    const performer = extractPerformer(req);
    const session = await service.approveSession(userId, sessionId, performer);
    if (!session) {
      res.status(404).json({ error: 'Sessão não encontrada ou já aprovada.' });
      return;
    }
    res.json(session);
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const revokeMyDeviceApproval = async (req: Request, res: Response) => {
  const userId = ensureAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Usuário não autenticado.' });
    return;
  }

  const sessionId = Number.parseInt(req.params.sessionId, 10);
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    res.status(400).json({ error: 'Sessão inválida.' });
    return;
  }

  try {
    const performer = extractPerformer(req);
    const session = await service.revokeSessionApproval(userId, sessionId, performer);
    if (!session) {
      res.status(404).json({ error: 'Sessão não encontrada ou já revogada.' });
      return;
    }
    res.json(session);
  } catch (error) {
    handleControllerError(res, error);
  }
};
