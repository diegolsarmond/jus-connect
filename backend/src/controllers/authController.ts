import { Request, Response } from 'express';
import type { PoolClient } from 'pg';
import pool from '../services/db';
import { hashPassword, verifyPassword } from '../utils/passwordUtils';
import { signToken } from '../utils/tokenUtils';
import { authConfig } from '../constants/auth';
import { fetchPerfilModules } from '../services/moduleService';
import { SYSTEM_MODULES, normalizeModuleId, sortModules } from '../constants/modules';
import {
  calculateTrialEnd,
  resolvePlanCadence,
  resolveSubscriptionPayloadFromRow,
  type SubscriptionCadence,
} from '../services/subscriptionService';

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

const resolveSubscriptionPayload = (row: {
  empresa_plano?: unknown;
  empresa_ativo?: unknown;
  trial_started_at?: unknown;
  trial_ends_at?: unknown;
  current_period_start?: unknown;
  current_period_end?: unknown;
  grace_expires_at?: unknown;
  subscription_cadence?: unknown;
}) => resolveSubscriptionPayloadFromRow(row);

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PHONE_LENGTH = 32;
const DEFAULT_PROFILE_NAME = 'Administrador';
const DEFAULT_MODULE_IDS = sortModules(SYSTEM_MODULES.map((module) => module.id));

const parseInteger = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }

  return null;
};

const sanitizePlanModules = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const unique = new Set<string>();
  const sanitized: string[] = [];

  for (const entry of value) {
    if (typeof entry !== 'string') {
      continue;
    }

    const normalized = normalizeModuleId(entry);
    if (!normalized || unique.has(normalized)) {
      continue;
    }

    unique.add(normalized);
    sanitized.push(normalized);
  }

  return sortModules(sanitized);
};

const fetchDefaultPlanDetails = async (
  client: PoolClient
): Promise<{ planId: number | null; modules: string[] }> => {
  const result = await client.query(
    `SELECT id, modulos
       FROM public.planos
      WHERE ativo IS DISTINCT FROM FALSE
   ORDER BY id
      LIMIT 1`
  );

  if (result.rowCount === 0) {
    return { planId: null, modules: DEFAULT_MODULE_IDS };
  }

  const row = result.rows[0] as { id?: unknown; modulos?: unknown };
  const planId = parseInteger(row.id);
  const modules = sanitizePlanModules(row.modulos);

  return {
    planId,
    modules: modules.length > 0 ? modules : DEFAULT_MODULE_IDS,
  };
};

export const register = async (req: Request, res: Response) => {
  const nameValue = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const emailValue = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
  const companyValue = typeof req.body?.company === 'string' ? req.body.company.trim() : '';
  const passwordValue = typeof req.body?.password === 'string' ? req.body.password : '';
  const phoneValueRaw = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
  const phoneDigits = phoneValueRaw.replace(/\D+/g, '');
  const phoneValue = phoneValueRaw ? phoneValueRaw : null;

  if (!nameValue) {
    res.status(400).json({ error: 'O nome completo é obrigatório.' });
    return;
  }

  if (!companyValue) {
    res.status(400).json({ error: 'O nome da empresa é obrigatório.' });
    return;
  }

  if (!emailValue || !EMAIL_REGEX.test(emailValue)) {
    res.status(400).json({ error: 'Informe um e-mail válido.' });
    return;
  }

  if (passwordValue.length < MIN_PASSWORD_LENGTH) {
    res
      .status(400)
      .json({ error: `A senha deve conter ao menos ${MIN_PASSWORD_LENGTH} caracteres.` });
    return;
  }

  if (phoneValue && phoneValue.length > MAX_PHONE_LENGTH) {
    res
      .status(400)
      .json({ error: `O telefone deve conter no máximo ${MAX_PHONE_LENGTH} caracteres.` });
    return;
  }

  if (phoneValue && phoneDigits.length > 0 && phoneDigits.length < 10) {
    res.status(400).json({ error: 'Informe um telefone válido com DDD.' });
    return;
  }

  const normalizedEmail = normalizeEmail(emailValue);

  try {
    const duplicateCheck = await pool.query(
      'SELECT 1 FROM public.usuarios WHERE LOWER(email) = $1 LIMIT 1',
      [normalizedEmail]
    );

    if ((duplicateCheck.rowCount ?? 0) > 0) {
      res.status(409).json({ error: 'E-mail já cadastrado.' });
      return;
    }

    const client = await pool.connect();
    let transactionActive = false;

    try {
      await client.query('BEGIN');
      transactionActive = true;

      const duplicateCheckTx = await client.query(
        'SELECT 1 FROM public.usuarios WHERE LOWER(email) = $1 LIMIT 1',
        [normalizedEmail]
      );

      if ((duplicateCheckTx.rowCount ?? 0) > 0) {
        await client.query('ROLLBACK');
        transactionActive = false;
        res.status(409).json({ error: 'E-mail já cadastrado.' });
        return;
      }

      const { planId, modules } = await fetchDefaultPlanDetails(client);

      let defaultCadence: SubscriptionCadence = 'monthly';
      if (planId != null) {
        try {
          defaultCadence = await resolvePlanCadence(planId, null);
        } catch (cadenceError) {
          console.warn('Falha ao determinar recorrência padrão do plano durante cadastro.', cadenceError);
        }
      }

      const trialStartedAt = new Date();
      const trialEndsAt = calculateTrialEnd(trialStartedAt);
      const graceExpiresAt = trialEndsAt;

      const companyLookup = await client.query(
        `SELECT id, nome_empresa, plano
           FROM public.empresas
          WHERE LOWER(nome_empresa) = LOWER($1)
          LIMIT 1`,
        [companyValue]
      );

      let companyId: number;
      let companyName: string;
      let companyPlanId: number | null;

      if ((companyLookup.rowCount ?? 0) > 0) {
        const row = companyLookup.rows[0] as {
          id?: unknown;
          nome_empresa?: unknown;
          plano?: unknown;
        };

        const parsedId = parseInteger(row.id);
        if (parsedId == null) {
          throw new Error('ID de empresa inválido retornado do banco de dados.');
        }

        companyId = parsedId;
        companyName = typeof row.nome_empresa === 'string' ? row.nome_empresa : companyValue;
        companyPlanId = parseInteger(row.plano);
      } else {
        const insertResult = await client.query(
          `INSERT INTO public.empresas (
             nome_empresa,
             cnpj,
             telefone,
             email,
             plano,
             responsavel,
             ativo,
             datacadastro,
             trial_started_at,
             trial_ends_at,
             current_period_start,
             current_period_end,
             grace_expires_at,
             subscription_cadence
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9, $10, $11, $12, $13)
        RETURNING id, nome_empresa, plano, trial_started_at, trial_ends_at, current_period_start, current_period_end, grace_expires_at, subscription_cadence`,
          [
            companyValue,
            null,
            phoneValue,
            normalizedEmail,
            planId,
            nameValue,
            true,
            trialStartedAt,
            trialEndsAt,
            trialStartedAt,
            trialEndsAt,
            graceExpiresAt,
            defaultCadence,
          ]
        );

        const inserted = insertResult.rows[0] as {
          id?: unknown;
          nome_empresa?: unknown;
          plano?: unknown;
          trial_started_at?: unknown;
          trial_ends_at?: unknown;
          current_period_start?: unknown;
          current_period_end?: unknown;
          grace_expires_at?: unknown;
          subscription_cadence?: unknown;
        };

        const parsedId = parseInteger(inserted.id);
        if (parsedId == null) {
          throw new Error('Falha ao criar a empresa.');
        }

        companyId = parsedId;
        companyName = typeof inserted.nome_empresa === 'string' ? inserted.nome_empresa : companyValue;
        companyPlanId = planId ?? parseInteger(inserted.plano);
      }

      const existingPerfil = await client.query(
        `SELECT id, nome, ativo, datacriacao
           FROM public.perfis
          WHERE idempresa IS NOT DISTINCT FROM $1
            AND LOWER(nome) = LOWER($2)
          LIMIT 1`,
        [companyId, DEFAULT_PROFILE_NAME]
      );

      let perfilId: number;
      let perfilNome: string;

      if ((existingPerfil.rowCount ?? 0) > 0) {
        const perfilRow = existingPerfil.rows[0] as {
          id?: unknown;
          nome?: unknown;
        };

        const parsedPerfilId = parseInteger(perfilRow.id);
        if (parsedPerfilId == null) {
          throw new Error('ID de perfil inválido retornado do banco de dados.');
        }

        perfilId = parsedPerfilId;
        perfilNome = typeof perfilRow.nome === 'string' ? perfilRow.nome : DEFAULT_PROFILE_NAME;

        await client.query('DELETE FROM public.perfil_modulos WHERE perfil_id = $1', [perfilId]);
      } else {
        const perfilInsert = await client.query(
          `INSERT INTO public.perfis (nome, ativo, datacriacao, idempresa)
           VALUES ($1, $2, NOW(), $3)
        RETURNING id, nome`,
          [DEFAULT_PROFILE_NAME, true, companyId]
        );

        const perfilRow = perfilInsert.rows[0] as { id?: unknown; nome?: unknown };
        const parsedPerfilId = parseInteger(perfilRow.id);
        if (parsedPerfilId == null) {
          throw new Error('Falha ao criar o perfil administrador.');
        }

        perfilId = parsedPerfilId;
        perfilNome = typeof perfilRow.nome === 'string' ? perfilRow.nome : DEFAULT_PROFILE_NAME;
      }

      if (modules.length > 0) {
        await client.query(
          'INSERT INTO public.perfil_modulos (perfil_id, modulo) SELECT $1, unnest($2::text[])',
          [perfilId, modules]
        );
      }

      const hashedPassword = hashPassword(passwordValue);

      const userInsert = await client.query(
        `INSERT INTO public.usuarios (nome_completo, cpf, email, perfil, empresa, setor, oab, status, senha, telefone, ultimo_login, observacoes, datacriacao)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      RETURNING id, nome_completo, email, perfil, empresa, status, telefone, datacriacao`,
        [
          nameValue,
          null,
          normalizedEmail,
          perfilId,
          companyId,
          null,
          null,
          true,
          hashedPassword,
          phoneValue,
          null,
          null,
        ]
      );

      const createdUser = userInsert.rows[0];

      await client.query('COMMIT');
      transactionActive = false;

      res.status(201).json({
        user: {
          id: createdUser?.id,
          nome_completo: createdUser?.nome_completo,
          email: createdUser?.email,
          perfil: createdUser?.perfil,
          empresa: createdUser?.empresa,
          status: createdUser?.status,
          telefone: createdUser?.telefone,
          datacriacao: createdUser?.datacriacao,
        },
        empresa: {
          id: companyId,
          nome: companyName,
          plano: companyPlanId,
        },
        perfil: {
          id: perfilId,
          nome: perfilNome,
          modulos: modules,
        },
      });
    } catch (error) {
      if (transactionActive) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          console.error('Falha ao reverter transação de cadastro', rollbackError);
        }
      }
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Erro ao registrar usuário', error);

    if (!res.headersSent) {
      res.status(500).json({ error: 'Não foi possível concluir o cadastro.' });
    }
  }
};

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
              emp.trial_started_at AS empresa_trial_started_at,
              emp.trial_ends_at AS empresa_trial_ends_at,
              emp.current_period_start AS empresa_current_period_start,
              emp.current_period_end AS empresa_current_period_end,
              emp.grace_expires_at AS empresa_grace_expires_at,
              emp.subscription_cadence AS empresa_subscription_cadence
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
      empresa_trial_started_at?: unknown;
      empresa_trial_ends_at?: unknown;
      empresa_current_period_start?: unknown;
      empresa_current_period_end?: unknown;
      empresa_grace_expires_at?: unknown;
      empresa_subscription_cadence?: unknown;
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
        ? resolveSubscriptionPayload({
            empresa_plano: user.empresa_plano,
            empresa_ativo: user.empresa_ativo,
            trial_started_at: user.empresa_trial_started_at,
            trial_ends_at: user.empresa_trial_ends_at,
            current_period_start: user.empresa_current_period_start,
            current_period_end: user.empresa_current_period_end,
            grace_expires_at: user.empresa_grace_expires_at,
            subscription_cadence: user.empresa_subscription_cadence,
          })
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
              emp.trial_started_at AS empresa_trial_started_at,
              emp.trial_ends_at AS empresa_trial_ends_at,
              emp.current_period_start AS empresa_current_period_start,
              emp.current_period_end AS empresa_current_period_end,
              emp.grace_expires_at AS empresa_grace_expires_at,
              emp.subscription_cadence AS empresa_subscription_cadence
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
        ? resolveSubscriptionPayload({
            empresa_plano: user.empresa_plano,
            empresa_ativo: user.empresa_ativo,
            trial_started_at: user.empresa_trial_started_at,
            trial_ends_at: user.empresa_trial_ends_at,
            current_period_start: user.empresa_current_period_start,
            current_period_end: user.empresa_current_period_end,
            grace_expires_at: user.empresa_grace_expires_at,
            subscription_cadence: user.empresa_subscription_cadence,
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
