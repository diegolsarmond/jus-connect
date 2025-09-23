import { Request, Response } from 'express';
import pool from '../services/db';
import { verifyPassword } from '../utils/passwordUtils';
import { signToken } from '../utils/tokenUtils';
import { authConfig } from '../constants/auth';
import { fetchPerfilModules } from '../services/moduleService';

const TRIAL_DURATION_DAYS = 14;

const parseOptionalInteger = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const normalized = Math.trunc(value);
    return Number.isNaN(normalized) ? null : normalized;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const parseBooleanFlag = (value: unknown): boolean | null => {
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

    if (['1', 'true', 't', 'yes', 'y', 'sim', 'on', 'ativo', 'ativa'].includes(normalized)) {
      return true;
    }

    if (['0', 'false', 'f', 'no', 'n', 'nao', 'não', 'off', 'inativo', 'inativa'].includes(normalized)) {
      return false;
    }
  }

  return null;
};

const parseDateValue = (value: unknown): Date | null => {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }

    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed;
  }

  return null;
};

const calculateTrialEnd = (startDate: Date | null): Date | null => {
  if (!startDate) {
    return null;
  }

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + TRIAL_DURATION_DAYS);
  return endDate;
};

const resolveSubscriptionPayload = (row: {
  empresa_plano?: unknown;
  empresa_ativo?: unknown;
  empresa_datacadastro?: unknown;
}) => {
  const planId = parseOptionalInteger(row.empresa_plano);
  const isActive = parseBooleanFlag(row.empresa_ativo);
  const startedAtDate = parseDateValue(row.empresa_datacadastro);

  if (planId === null) {
    return {
      planId: null,
      status: 'inactive' as const,
      startedAt: startedAtDate ? startedAtDate.toISOString() : null,
      trialEndsAt: null,
    };
  }

  if (isActive === false) {
    return {
      planId,
      status: 'inactive' as const,
      startedAt: startedAtDate ? startedAtDate.toISOString() : null,
      trialEndsAt: null,
    };
  }

  const trialEndsAtDate = calculateTrialEnd(startedAtDate);
  const now = new Date();
  const isTrialing =
    startedAtDate !== null &&
    trialEndsAtDate !== null &&
    now.getTime() < trialEndsAtDate.getTime();

  return {
    planId,
    status: isTrialing ? ('trialing' as const) : ('active' as const),
    startedAt: startedAtDate ? startedAtDate.toISOString() : null,
    trialEndsAt: trialEndsAtDate ? trialEndsAtDate.toISOString() : null,
  };
};

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export const login = async (req: Request, res: Response) => {
  const { email, senha } = req.body as { email?: unknown; senha?: unknown };

  if (typeof email !== 'string' || typeof senha !== 'string') {
    res.status(400).json({ error: 'Credenciais inválidas.' });
    return;
  }

  try {
    const normalizedEmail = normalizeEmail(email);

    const userResult = await pool.query(
      `SELECT u.id,
              u.nome_completo,
              u.email,
              u.senha,
              u.status,
              u.perfil,
              u.empresa AS empresa_id,
              emp.nome_empresa AS empresa_nome,
              u.setor AS setor_id,
              esc.nome AS setor_nome,
              emp.plano AS empresa_plano,
              emp.ativo AS empresa_ativo,
              emp.datacadastro AS empresa_datacadastro
         FROM public.usuarios u
         LEFT JOIN public.empresas emp ON emp.id = u.empresa
         LEFT JOIN public.escritorios esc ON esc.id = u.setor
        WHERE LOWER(u.email) = $1
        LIMIT 1`,
      [normalizedEmail]
    );

    if (userResult.rowCount === 0) {
      res.status(401).json({ error: 'E-mail ou senha incorretos.' });
      return;
    }

    const user = userResult.rows[0] as {
      id: number;
      nome_completo: string;
      email: string;
      senha: string | null;
      status: boolean | null;
      perfil: number | string | null;
      empresa_id: number | null;
      empresa_nome: string | null;
      setor_id: number | null;
      setor_nome: string | null;
      empresa_plano?: unknown;
      empresa_ativo?: unknown;
      empresa_datacadastro?: unknown;
    };

    if (user.status === false) {
      res.status(403).json({ error: 'Usuário inativo.' });
      return;
    }

    const passwordMatches = await verifyPassword(senha, user.senha);

    if (!passwordMatches) {
      res.status(401).json({ error: 'E-mail ou senha incorretos.' });
      return;
    }

    const token = signToken(
      {
        sub: user.id,
        email: user.email,
        name: user.nome_completo,
      },
      authConfig.secret,
      authConfig.expirationSeconds
    );

    const modulos = await fetchPerfilModules(user.perfil);

    const subscription =
      user.empresa_id != null
        ? resolveSubscriptionPayload(user)
        : null;

    res.json({
      token,
      expiresIn: authConfig.expirationSeconds,
      user: {
        id: user.id,
        nome_completo: user.nome_completo,
        email: user.email,
        perfil: user.perfil,
        modulos,
        empresa_id: user.empresa_id,
        empresa_nome: user.empresa_nome,
        setor_id: user.setor_id,
        setor_nome: user.setor_nome,
        subscription,
      },
    });
  } catch (error) {
    console.error('Erro ao realizar login', error);
    res.status(500).json({ error: 'Não foi possível concluir a autenticação.' });
  }
};

export const refreshToken = (req: Request, res: Response) => {
  if (!req.auth) {
    res.status(401).json({ error: 'Token inválido.' });
    return;
  }

  try {
    const payload = (req.auth.payload ?? {}) as Record<string, unknown>;
    const refreshedToken = signToken(
      {
        sub: req.auth.userId,
        email: typeof payload.email === 'string' ? payload.email : undefined,
        name: typeof payload.name === 'string' ? payload.name : undefined,
      },
      authConfig.secret,
      authConfig.expirationSeconds
    );

    res.json({
      token: refreshedToken,
      expiresIn: authConfig.expirationSeconds,
    });
  } catch (error) {
    console.error('Erro ao renovar token de autenticação', error);
    res.status(500).json({ error: 'Não foi possível renovar o token de acesso.' });
  }
};

export const getCurrentUser = async (req: Request, res: Response) => {
  if (!req.auth) {
    res.status(401).json({ error: 'Token inválido.' });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT u.id,
              u.nome_completo,
              u.email,
              u.perfil,
              u.status,
              u.empresa AS empresa_id,
              emp.nome_empresa AS empresa_nome,
              u.setor AS setor_id,
              esc.nome AS setor_nome,
              emp.plano AS empresa_plano,
              emp.ativo AS empresa_ativo,
              emp.datacadastro AS empresa_datacadastro
         FROM public.usuarios u
         LEFT JOIN public.empresas emp ON emp.id = u.empresa
         LEFT JOIN public.escritorios esc ON esc.id = u.setor
        WHERE u.id = $1
        LIMIT 1`,
      [req.auth.userId]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }

    const user = result.rows[0];

    const modulos = await fetchPerfilModules(user.perfil);

    const subscription =
      user.empresa_id != null
        ? resolveSubscriptionPayload(user as {
            empresa_plano?: unknown;
            empresa_ativo?: unknown;
            empresa_datacadastro?: unknown;
          })
        : null;

    res.json({
      id: user.id,
      nome_completo: user.nome_completo,
      email: user.email,
      perfil: user.perfil,
      status: user.status,
      empresa_id: user.empresa_id,
      empresa_nome: user.empresa_nome,
      setor_id: user.setor_id,
      setor_nome: user.setor_nome,
      modulos,
      subscription,
    });
  } catch (error) {
    console.error('Erro ao carregar usuário autenticado', error);
    res.status(500).json({ error: 'Não foi possível carregar os dados do usuário.' });
  }
};
