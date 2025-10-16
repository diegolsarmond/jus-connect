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
  parseCadence,
  resolvePlanCadence,
  resolveSubscriptionPayloadFromRow,
  type SubscriptionCadence,
} from '../services/subscriptionService';
import {
  sendEmailConfirmationToken,
  EmailConfirmationTokenError,
  confirmEmailWithToken,
} from '../services/emailConfirmationService';
import { createPasswordResetRequest } from '../services/passwordResetService';
import { isUndefinedTableError } from '../utils/databaseErrors';
import {
  SUBSCRIPTION_DEFAULT_GRACE_DAYS,
  SUBSCRIPTION_GRACE_DAYS_ANNUAL,
  SUBSCRIPTION_GRACE_DAYS_MONTHLY,
  SUBSCRIPTION_TRIAL_DAYS,
} from '../constants/subscription';

const TRIAL_DURATION_DAYS = SUBSCRIPTION_TRIAL_DAYS;
const GRACE_PERIOD_DAYS = SUBSCRIPTION_DEFAULT_GRACE_DAYS;


let emailConfirmationSender = sendEmailConfirmationToken;
let confirmEmailTokenResolver = confirmEmailWithToken;

export const __setSendEmailConfirmationTokenForTests = (
  sender: typeof sendEmailConfirmationToken
) => {
  emailConfirmationSender = sender;
};

export const __resetSendEmailConfirmationTokenForTests = () => {
  emailConfirmationSender = sendEmailConfirmationToken;
};

export const __setConfirmEmailWithTokenForTests = (
  resolver: typeof confirmEmailWithToken
) => {
  confirmEmailTokenResolver = resolver;
};

export const __resetConfirmEmailWithTokenForTests = () => {
  confirmEmailTokenResolver = confirmEmailWithToken;
};


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

    if (
      ['1', 'true', 't', 'yes', 'y', 'sim', 'on', 'ativo', 'ativa', 'active'].includes(
        normalized
      )
    ) {
      return true;
    }

    if (
      ['0', 'false', 'f', 'no', 'n', 'nao', 'não', 'off', 'inativo', 'inativa', 'inactive'].includes(
        normalized
      )
    ) {
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

const addDays = (date: Date, days: number): Date => {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
};

const calculateLegacyTrialEnd = (startDate: Date | null): Date | null => {
  if (!startDate) {
    return null;
  }

  return addDays(startDate, TRIAL_DURATION_DAYS);
};

type SubscriptionRow = {
  empresa_plano?: unknown;
  empresa_ativo?: unknown;
  empresa_datacadastro?: unknown;
  empresa_trial_started_at?: unknown;
  empresa_trial_ends_at?: unknown;
  empresa_current_period_start?: unknown;
  empresa_current_period_end?: unknown;
  empresa_current_period_ends_at?: unknown;
  empresa_grace_expires_at?: unknown;
  empresa_grace_period_ends_at?: unknown;
  empresa_subscription_cadence?: unknown;
};

type SubscriptionStatus = 'inactive' | 'trialing' | 'active' | 'grace_period' | 'expired';

type SubscriptionBlockingReason = 'inactive' | 'trial_expired' | 'grace_period_expired' | null;

type SubscriptionResolution = {
  planId: number | null;
  status: SubscriptionStatus;
  startedAt: string | null;
  trialEndsAt: string | null;
  currentPeriodEndsAt: string | null;
  gracePeriodEndsAt: string | null;
  isInGoodStanding: boolean;
  blockingReason: SubscriptionBlockingReason;
};

type UserRowBase = SubscriptionRow & {
  id: number;
  nome_completo: string;
  email: string;
  status: boolean | null;
  perfil: number | string | null;
  empresa_id: number | null;
  empresa_nome: string | null;
  empresa_responsavel_id: number | null;
  setor_id: number | null;
  setor_nome: string | null;
  must_change_password?: unknown;
  perfil_ver_todas_conversas?: unknown;
  email_confirmed_at?: unknown;
};

type LoginUserRow = UserRowBase & {
  senha: string | null;
};

const resolveSubscriptionPayload = (row: SubscriptionRow): SubscriptionResolution => {
  const planId = parseOptionalInteger(row.empresa_plano);
  const isActive = parseBooleanFlag(row.empresa_ativo);
  const cadence = parseCadence(row.empresa_subscription_cadence);
  const startedAtDate = (() => {
    const datacadastro = parseDateValue(row.empresa_datacadastro);
    if (datacadastro) {
      return datacadastro;
    }

    return parseDateValue(row.empresa_trial_started_at);
  })();
  const persistedTrialEnd = parseDateValue(row.empresa_trial_ends_at);
  const trialEndsAtDate = persistedTrialEnd ?? calculateLegacyTrialEnd(startedAtDate);
  const currentPeriodEndsAtDate = (() => {
    const stored = parseDateValue(row.empresa_current_period_ends_at);
    if (stored) {
      return stored;
    }

    return parseDateValue(row.empresa_current_period_end);
  })();
  const persistedGracePeriodEndsAt = (() => {
    const stored = parseDateValue(row.empresa_grace_period_ends_at);
    if (stored) {
      return stored;
    }

    return parseDateValue(row.empresa_grace_expires_at);
  })();
  const fallbackGracePeriodDays =
    cadence === 'annual' ? SUBSCRIPTION_GRACE_DAYS_ANNUAL : SUBSCRIPTION_GRACE_DAYS_MONTHLY;
  const computedGracePeriodEndsAt =
    currentPeriodEndsAtDate != null ? addDays(currentPeriodEndsAtDate, fallbackGracePeriodDays) : null;
  const gracePeriodEndsAtDate = (() => {
    if (persistedGracePeriodEndsAt && computedGracePeriodEndsAt) {
      return persistedGracePeriodEndsAt.getTime() >= computedGracePeriodEndsAt.getTime()
        ? persistedGracePeriodEndsAt
        : computedGracePeriodEndsAt;
    }

    return persistedGracePeriodEndsAt ?? computedGracePeriodEndsAt ?? null;
  })();

  if (planId === null) {
    return {
      planId: null,
      status: 'inactive',
      startedAt: startedAtDate ? startedAtDate.toISOString() : null,
      trialEndsAt: null,
      currentPeriodEndsAt: null,
      gracePeriodEndsAt: null,
      isInGoodStanding: false,
      blockingReason: 'inactive',
    };
  }

  if (isActive === false) {
    return {
      planId,
      status: 'inactive',
      startedAt: startedAtDate ? startedAtDate.toISOString() : null,
      trialEndsAt: null,
      currentPeriodEndsAt: null,
      gracePeriodEndsAt: null,
      isInGoodStanding: false,
      blockingReason: 'inactive',
    };
  }

  const now = new Date();
  let status: SubscriptionStatus = 'inactive';
  let isInGoodStanding = false;

  if (trialEndsAtDate && now.getTime() < trialEndsAtDate.getTime()) {
    status = 'trialing';
    isInGoodStanding = true;
  } else if (currentPeriodEndsAtDate && now.getTime() <= currentPeriodEndsAtDate.getTime()) {
    status = 'active';
    isInGoodStanding = true;
  } else if (gracePeriodEndsAtDate && now.getTime() <= gracePeriodEndsAtDate.getTime()) {
    status = 'grace_period';
    isInGoodStanding = true;
  } else if (!trialEndsAtDate && !currentPeriodEndsAtDate && !gracePeriodEndsAtDate) {
    status = 'active';
    isInGoodStanding = true;
  } else {
    status = 'expired';
  }

  let blockingReason: SubscriptionBlockingReason = null;

  if (!isInGoodStanding) {
    if (status === 'expired') {
      const trialEnded = trialEndsAtDate ? now.getTime() >= trialEndsAtDate.getTime() : false;
      const hasCurrentPeriod = currentPeriodEndsAtDate != null;
      const pastGrace = gracePeriodEndsAtDate
        ? now.getTime() > gracePeriodEndsAtDate.getTime()
        : false;

      if (pastGrace) {
        blockingReason = 'grace_period_expired';
      } else if (trialEnded && !hasCurrentPeriod) {
        blockingReason = 'trial_expired';
      } else {
        blockingReason = 'inactive';
      }
    } else {
      blockingReason = 'inactive';
    }
  }

  return {
    planId,
    status,
    startedAt: startedAtDate ? startedAtDate.toISOString() : null,
    trialEndsAt: trialEndsAtDate ? trialEndsAtDate.toISOString() : null,
    currentPeriodEndsAt: currentPeriodEndsAtDate
      ? currentPeriodEndsAtDate.toISOString()
      : null,
    gracePeriodEndsAt: gracePeriodEndsAtDate ? gracePeriodEndsAtDate.toISOString() : null,
    isInGoodStanding,
    blockingReason,
  };
};

const evaluateSubscriptionAccess = (
  subscription: SubscriptionResolution | null
): { isAllowed: boolean; statusCode?: number; message?: string } => {
  if (!subscription) {
    return { isAllowed: true };
  }

  if (subscription.isInGoodStanding) {
    return { isAllowed: true };
  }

  switch (subscription.blockingReason) {
    case 'grace_period_expired':
      return {
        isAllowed: false,
        statusCode: 402,
        message:
          `Assinatura expirada após o período de tolerância de ${GRACE_PERIOD_DAYS} dias. Regularize o pagamento para continuar.`,
      };
    case 'trial_expired':
      return {
        isAllowed: false,
        statusCode: 403,
        message:
          'Período de teste encerrado. Realize uma assinatura para continuar acessando o sistema.',
      };
    default:
      return {
        isAllowed: false,
        statusCode: 403,
        message: 'Assinatura inativa. Entre em contato com o suporte para reativar o acesso.',
      };
  }
};

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PHONE_LENGTH = 32;
const DEFAULT_PROFILE_NAME = 'Administrador';
const DEFAULT_MODULE_IDS = sortModules(SYSTEM_MODULES.map((module) => module.id));
const DEFAULT_WORKFLOW_TEMPLATES = [
  {
    nome: 'Fluxo de Atendimento',
    exibe_menu: true,
    ordem: 1,
    etiquetas: ['Novo atendimento', 'Em análise', 'Aguardando cliente', 'Concluído'],
  },
  {
    nome: 'Fluxo de Onboarding',
    exibe_menu: true,
    ordem: 2,
    etiquetas: ['Cadastro recebido', 'Documentação pendente', 'Configuração em andamento', 'Onboarding finalizado'],
  },
  {
    nome: 'Fluxo de Suporte',
    exibe_menu: true,
    ordem: 3,
    etiquetas: ['Ticket aberto', 'Investigação', 'Solução proposta', 'Ticket encerrado'],
  },
];

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

type DatabaseError = {
  code?: unknown;
  message?: unknown;
};

const shouldFallbackToDefaultPlan = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const { code, message } = error as DatabaseError;

  if (typeof code === 'string' && ['42P01', '42703', '42501'].includes(code)) {
    return true;
  }

  if (typeof message === 'string') {
    const normalized = message.toLowerCase();
    return normalized.includes('planos') && normalized.includes('does not exist');
  }

  return false;
};

class PlanNotFoundError extends Error {
  constructor(message?: string) {
    super(message ?? 'Plano selecionado não encontrado.');
    this.name = 'PlanNotFoundError';
  }
}

const fetchPlanDetails = async (
  client: PoolClient,
  requestedPlanId: number | null
): Promise<{ planId: number | null; modules: string[] }> => {
  if (requestedPlanId != null) {
    try {
      const planResult = await client.query(
        `SELECT id, modulos
           FROM public.planos
          WHERE id = $1
            AND ativo IS DISTINCT FROM FALSE
          LIMIT 1`,
        [requestedPlanId]
      );

      if (planResult.rowCount === 0) {
        throw new PlanNotFoundError();
      }

      const planRow = planResult.rows[0] as { id?: unknown; modulos?: unknown };
      const planId = parseInteger(planRow.id);
      const modules = sanitizePlanModules(planRow.modulos);

      return {
        planId: planId ?? requestedPlanId,
        modules: modules.length > 0 ? modules : DEFAULT_MODULE_IDS,
      };
    } catch (error) {
      if (error instanceof PlanNotFoundError) {
        throw error;
      }

      if (shouldFallbackToDefaultPlan(error)) {
        console.warn(
          'Tabela de planos indisponível durante cadastro. Utilizando módulos padrão.',
          error
        );
        return { planId: null, modules: DEFAULT_MODULE_IDS };
      }

      throw error;
    }
  }

  try {
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
  } catch (error) {
    if (shouldFallbackToDefaultPlan(error)) {
      console.warn('Tabela de planos indisponível durante cadastro. Utilizando módulos padrão.', error);
      return { planId: null, modules: DEFAULT_MODULE_IDS };
    }

    throw error;
  }
};

export const register = async (req: Request, res: Response) => {
  const nameValue = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const emailValue = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
  const companyValue = typeof req.body?.company === 'string' ? req.body.company.trim() : '';
  const passwordValue = typeof req.body?.password === 'string' ? req.body.password : '';
  const phoneValueRaw = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
  const phoneDigits = phoneValueRaw.replace(/\D+/g, '');
  const phoneValue = phoneValueRaw ? phoneValueRaw : null;
  const rawPlanId =
    (req.body?.planId ?? req.body?.plan_id ?? req.body?.plan) as unknown;
  const planSelectionProvided =
    rawPlanId !== undefined && rawPlanId !== null && String(rawPlanId).trim().length > 0;
  const requestedPlanId = parseOptionalInteger(rawPlanId);

  if (!nameValue) {
    res.status(400).json({ error: 'O nome completo é obrigatório.' });
    return;
  }

  if (!companyValue) {
    res.status(400).json({ error: 'O nome da empresa é obrigatório.' });
    return;
  }

  if (!planSelectionProvided) {
    res.status(400).json({ error: 'Selecione um plano para iniciar o teste gratuito.' });
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

  if (planSelectionProvided && requestedPlanId == null) {
    res.status(400).json({ error: 'Plano selecionado inválido.' });
    return;
  }

  const normalizedEmail = normalizeEmail(emailValue);
  let confirmationTarget: { id: number; nome_completo: string; email: string } | null = null;
  let registrationResponse:
    | {
        user: Record<string, unknown>;
        empresa: Record<string, unknown>;
        perfil: Record<string, unknown>;
      }
    | null = null;

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

      let resolvedPlanId: number | null = null;
      let modules: string[] = DEFAULT_MODULE_IDS;

      try {
        const planResolution = await fetchPlanDetails(client, requestedPlanId);
        resolvedPlanId = planResolution.planId;
        modules = planResolution.modules;
      } catch (planError) {
        if (planError instanceof PlanNotFoundError) {
          await client.query('ROLLBACK');
          transactionActive = false;
          res.status(400).json({ error: 'Plano selecionado inválido.' });
          return;
        }

        throw planError;
      }

      let defaultCadence: SubscriptionCadence = 'monthly';
      if (resolvedPlanId != null) {
        try {
          defaultCadence = await resolvePlanCadence(resolvedPlanId, null);
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
          WHERE LOWER(TRIM(nome_empresa)) = LOWER(TRIM($1))
          LIMIT 1`,
        [companyValue]
      );

      let companyId: number;
      let companyName: string;
      let companyPlanId: number | null;
      let createdCompany = false;

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
        companyName =
          typeof row.nome_empresa === 'string'
            ? row.nome_empresa.trim() || companyValue
            : companyValue;
        companyPlanId = resolvedPlanId ?? parseInteger(row.plano);

        if (resolvedPlanId != null && companyPlanId !== resolvedPlanId) {
          await client.query('UPDATE public.empresas SET plano = $1 WHERE id = $2', [
            resolvedPlanId,
            companyId,
          ]);
          companyPlanId = resolvedPlanId;
        }
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
            resolvedPlanId,
            null,
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
        companyName =
          typeof inserted.nome_empresa === 'string'
            ? inserted.nome_empresa.trim() || companyValue
            : companyValue;
        companyPlanId = resolvedPlanId ?? parseInteger(inserted.plano);
        createdCompany = true;
      }

      const existingPerfil = await client.query(
        `SELECT id, nome, ativo, datacriacao
           FROM public.perfis
          WHERE idempresa IS NOT DISTINCT FROM $1
            AND LOWER(TRIM(nome)) = LOWER(TRIM($2))
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
        perfilNome =
          typeof perfilRow.nome === 'string'
            ? perfilRow.nome.trim() || DEFAULT_PROFILE_NAME
            : DEFAULT_PROFILE_NAME;

        await client.query('DELETE FROM public.perfil_modulos WHERE perfil_id = $1', [perfilId]);
      } else {
        const perfilInsert = await client.query(
          `INSERT INTO public.perfis (nome, ativo, datacriacao, idempresa, ver_todas_conversas)
           VALUES ($1, $2, NOW(), $3, $4)
        RETURNING id, nome`,
          [DEFAULT_PROFILE_NAME, true, companyId, true]
        );

        const perfilRow = perfilInsert.rows[0] as { id?: unknown; nome?: unknown };
        const parsedPerfilId = parseInteger(perfilRow.id);
        if (parsedPerfilId == null) {
          throw new Error('Falha ao criar o perfil administrador.');
        }

        perfilId = parsedPerfilId;
        perfilNome =
          typeof perfilRow.nome === 'string'
            ? perfilRow.nome.trim() || DEFAULT_PROFILE_NAME
            : DEFAULT_PROFILE_NAME;
      }

      if (modules.length > 0) {
        await client.query(
          'INSERT INTO public.perfil_modulos (perfil_id, modulo) SELECT $1, unnest($2::text[])',
          [perfilId, modules]
        );
      }

      const hashedPassword = await hashPassword(passwordValue);

      const userInsert = await client.query(
        `INSERT INTO public.usuarios (nome_completo, cpf, email, perfil, empresa, setor, oab, status, senha, telefone, ultimo_login, observacoes, welcome_email_pending, datacriacao)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, TRUE, NOW())
      RETURNING id, nome_completo, email, perfil, empresa, status, telefone, welcome_email_pending, datacriacao`,
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

      const createdUser = userInsert.rows[0] as {
        id?: unknown;
        nome_completo?: unknown;
        email?: unknown;
        perfil?: unknown;
        empresa?: unknown;
        status?: unknown;
        telefone?: unknown;
        welcome_email_pending?: unknown;
        datacriacao?: unknown;
      };

      const createdUserId = parseInteger(createdUser.id);
      if (createdCompany && createdUserId != null) {
        await client.query('UPDATE public.empresas SET responsavel = $1 WHERE id = $2', [
          createdUserId,
          companyId,
        ]);
      }

      if (createdUserId == null) {
        throw new Error('Falha ao determinar o usuário criado durante o cadastro.');
      }

      if (createdCompany) {
        for (const workflow of DEFAULT_WORKFLOW_TEMPLATES) {
          const workflowInsert = await client.query(
            `INSERT INTO public.fluxo_trabalho (nome, ativo, exibe_menu, ordem, datacriacao, idempresa)
             VALUES ($1, TRUE, $2, $3, NOW(), $4)
             RETURNING id`,
            [workflow.nome, workflow.exibe_menu, workflow.ordem, companyId]
          );

          const workflowRow = workflowInsert.rows[0] as { id?: unknown } | undefined;
          const workflowId = workflowRow ? parseInteger(workflowRow.id) : null;

          if (workflowId == null) {
            throw new Error('Falha ao criar fluxo de trabalho padrão.');
          }

          for (const [index, labelName] of workflow.etiquetas.entries()) {
            await client.query(
              `INSERT INTO public.etiquetas (nome, ativo, datacriacao, exibe_pipeline, ordem, id_fluxo_trabalho, idempresa)
               VALUES ($1, TRUE, NOW(), TRUE, $2, $3, $4)`,
              [labelName, index + 1, workflowId, companyId]
            );
          }
        }
      }

      await client.query('COMMIT');
      transactionActive = false;

      confirmationTarget = {
        id: createdUserId,
        nome_completo:
          typeof createdUser?.nome_completo === 'string' && createdUser?.nome_completo.trim().length > 0
            ? createdUser.nome_completo
            : nameValue,
        email: normalizedEmail,
      };

      registrationResponse = {
        user: {
          id: createdUser?.id,
          nome_completo: createdUser?.nome_completo,
          email: createdUser?.email,
          perfil: createdUser?.perfil,
          empresa: createdUser?.empresa,
          status: createdUser?.status,
          telefone: createdUser?.telefone,
          welcome_email_pending: createdUser?.welcome_email_pending,
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
      };
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
    return;
  }

  if (!confirmationTarget || !registrationResponse) {
    return;
  }

  try {
    await emailConfirmationSender(confirmationTarget);
    try {
      await pool.query('UPDATE public.usuarios SET welcome_email_pending = FALSE WHERE id = $1', [
        confirmationTarget.id,
      ]);
      if (registrationResponse?.user) {
        (registrationResponse.user as { welcome_email_pending?: boolean }).welcome_email_pending = false;
      }
    } catch (cleanupError) {
      console.error('Falha ao remover usuário após erro no envio de e-mail', cleanupError);
    }
  } catch (error) {
    console.error('Falha ao enviar e-mail de confirmação de cadastro', error);

    try {
      await pool.query('UPDATE public.usuarios SET welcome_email_pending = TRUE WHERE id = $1', [
        confirmationTarget.id,
      ]);
    } catch (cleanupError) {
      console.error('Falha ao remover usuário após erro no envio de e-mail', cleanupError);
    }

    if (!res.headersSent) {
      res
        .status(500)
        .json({ error: 'Não foi possível enviar o e-mail de confirmação. Tente novamente.' });
    }
    return;
  }

  res.status(201).json({
    ...registrationResponse,
    message: 'Sua conta foi criada, confirme o e-mail para ter acesso ao sistema.',
    requiresEmailConfirmation: true,
  });
};

export const resendEmailConfirmation = async (req: Request, res: Response) => {
  const emailValue = typeof req.body?.email === 'string' ? req.body.email.trim() : '';

  if (!emailValue || !EMAIL_REGEX.test(emailValue)) {
    res.status(400).json({ error: 'Informe um e-mail válido.' });
    return;
  }

  const normalizedEmail = normalizeEmail(emailValue);

  try {
    const userResult = await pool.query(
      `SELECT id, nome_completo, email, email_confirmed_at
         FROM public.usuarios
        WHERE LOWER(email) = $1
        LIMIT 1`,
      [normalizedEmail],
    );

    if (userResult.rowCount === 0) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }

    const userRow = userResult.rows[0] as {
      id: number;
      nome_completo?: unknown;
      email?: unknown;
      email_confirmed_at?: unknown;
    };

    const emailConfirmedAt = parseDateValue(userRow.email_confirmed_at);
    if (emailConfirmedAt) {
      res.status(409).json({ error: 'E-mail já confirmado.' });
      return;
    }

    const rawUserName =
      typeof userRow.nome_completo === 'string' ? userRow.nome_completo.trim() : '';
    const userName = rawUserName.length > 0 ? rawUserName : 'Usuário';
    const userEmail =
      typeof userRow.email === 'string' && userRow.email.trim().length > 0
        ? userRow.email.trim()
        : normalizedEmail;

    await emailConfirmationSender({
      id: userRow.id,
      nome_completo: userName,
      email: userEmail,
    });

    res.json({ message: 'Um novo e-mail de confirmação foi enviado.' });
  } catch (error) {
    console.error('Erro ao reenviar e-mail de confirmação', error);
    res.status(500).json({ error: 'Não foi possível reenviar o e-mail de confirmação.' });
  }
};

export const confirmEmail = async (req: Request, res: Response) => {
  const tokenValue = typeof req.body?.token === 'string' ? req.body.token.trim() : '';

  if (!tokenValue) {
    res.status(400).json({ error: 'Token de confirmação inválido.' });
    return;
  }

  try {
    const result = await confirmEmailTokenResolver(tokenValue);

    res.json({
      message: 'E-mail confirmado com sucesso.',
      confirmedAt: result.confirmedAt.toISOString(),
    });
  } catch (error) {
    const tokenError =
      error instanceof EmailConfirmationTokenError ||
      (typeof error === 'object' && error !== null && (error as { name?: string }).name === 'EmailConfirmationTokenError')
        ? (error as EmailConfirmationTokenError & { code?: string })
        : null;

    if (tokenError) {
      if (tokenError.code === 'TOKEN_INVALID') {
        res.status(400).json({ error: 'Token de confirmação inválido.' });
        return;
      }

      if (tokenError.code === 'TOKEN_EXPIRED') {
        res.status(400).json({ error: 'Token de confirmação expirado. Solicite um novo link.' });
        return;
      }

      if (tokenError.code === 'TOKEN_ALREADY_USED') {
        res.status(409).json({ error: 'Token de confirmação já utilizado.' });
        return;
      }
    }

    console.error('Erro ao confirmar e-mail', error);
    res.status(500).json({ error: 'Não foi possível confirmar o e-mail.' });
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
              u.must_change_password,
              u.email_confirmed_at,
              u.status,
              u.perfil,
              per.ver_todas_conversas AS perfil_ver_todas_conversas,
              u.empresa AS empresa_id,
              emp.nome_empresa AS empresa_nome,
              emp.responsavel AS empresa_responsavel_id,
              u.setor AS setor_id,
              esc.nome AS setor_nome,
              emp.plano AS empresa_plano,
              emp.ativo AS empresa_ativo,
              emp.trial_started_at AS empresa_trial_started_at,
              emp.trial_ends_at AS empresa_trial_ends_at,
              emp.current_period_start AS empresa_current_period_start,
              emp.current_period_end AS empresa_current_period_end,
              emp.grace_expires_at AS empresa_grace_expires_at,
              emp.datacadastro AS empresa_datacadastro,
              to_jsonb(emp) ->> 'subscription_trial_ends_at' AS empresa_subscription_trial_ends_at,
              to_jsonb(emp) ->> 'subscription_current_period_ends_at' AS empresa_subscription_current_period_ends_at,
              to_jsonb(emp) ->> 'subscription_grace_period_ends_at' AS empresa_subscription_grace_period_ends_at,
              to_jsonb(emp) ->> 'subscription_cadence' AS empresa_subscription_cadence
         FROM public.usuarios u
         LEFT JOIN public.empresas emp ON emp.id = u.empresa
         LEFT JOIN public.escritorios esc ON esc.id = u.setor
         LEFT JOIN public.perfis per ON per.id = u.perfil
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
      email_confirmed_at?: unknown;
      status: unknown;
      perfil: number | string | null;
      empresa_id: number | null;
      empresa_nome: string | null;
      empresa_responsavel_id: number | null;
      setor_id: number | null;
      setor_nome: string | null;
      empresa_plano?: unknown;
      empresa_ativo?: unknown;
      empresa_trial_started_at?: unknown;
      empresa_trial_ends_at?: unknown;
      empresa_current_period_start?: unknown;
      empresa_current_period_end?: unknown;
      empresa_current_period_ends_at?: unknown;
      empresa_grace_expires_at?: unknown;
      empresa_grace_period_ends_at?: unknown;
      empresa_datacadastro?: unknown;
      empresa_subscription_trial_ends_at?: unknown;
      empresa_subscription_current_period_ends_at?: unknown;
      empresa_subscription_grace_period_ends_at?: unknown;
      empresa_subscription_cadence?: unknown;
    };

    const isUserActive = parseBooleanFlag(user.status);
    if (isUserActive === false) {
      res.status(403).json({ error: 'Usuário inativo.' });
      return;
    }

    const emailConfirmedAt = parseDateValue(user.email_confirmed_at);
    if (!emailConfirmedAt) {
      res.status(403).json({ error: 'Confirme seu e-mail antes de acessar.' });
      return;
    }

    const passwordCheck = await verifyPassword(senha, user.senha);

    if (!passwordCheck.isValid) {
      res.status(401).json({ error: 'E-mail ou senha incorretos.' });
      return;
    }

    if (passwordCheck.migratedHash) {
      try {
        await pool.query(
          `UPDATE public.usuarios
              SET senha = $1
            WHERE id = $2`,
          [passwordCheck.migratedHash, user.id]
        );
      } catch (migrationError) {
        console.error('Falha ao atualizar hash de senha legado durante login', migrationError);
      }
    }

    const mustChangePassword =
      parseBooleanFlag((user as { must_change_password?: unknown }).must_change_password) ?? false;
    const viewAllConversations =
      parseBooleanFlag((user as { perfil_ver_todas_conversas?: unknown }).perfil_ver_todas_conversas) ?? true;

    const subscriptionRow: SubscriptionRow = {
      empresa_plano: user.empresa_plano,
      empresa_ativo: user.empresa_ativo,
      empresa_datacadastro: user.empresa_datacadastro,
      empresa_trial_started_at: user.empresa_trial_started_at,
      empresa_trial_ends_at:
        user.empresa_trial_ends_at ?? user.empresa_subscription_trial_ends_at,
      empresa_current_period_start: user.empresa_current_period_start,
      empresa_current_period_end: user.empresa_current_period_end,
      empresa_current_period_ends_at:
        user.empresa_current_period_ends_at ??
        user.empresa_subscription_current_period_ends_at ??
        user.empresa_current_period_end,
      empresa_grace_expires_at: user.empresa_grace_expires_at,
      empresa_grace_period_ends_at:
        user.empresa_grace_period_ends_at ??
        user.empresa_subscription_grace_period_ends_at ??
        user.empresa_grace_expires_at,
      empresa_subscription_cadence: user.empresa_subscription_cadence,
    };

    const subscriptionResolution =
      user.empresa_id != null ? resolveSubscriptionPayload(subscriptionRow) : null;

    const subscriptionAccess = evaluateSubscriptionAccess(subscriptionResolution);
    if (!subscriptionAccess.isAllowed) {
      res
        .status(subscriptionAccess.statusCode ?? 403)
        .json({ error: subscriptionAccess.message ?? 'Assinatura inativa.' });
      return;
    }

    try {
      await pool.query(
        `UPDATE public.usuarios
            SET ultimo_login = NOW()
          WHERE id = $1`,
        [user.id]
      );
    } catch (updateLastLoginError) {
      console.error('Falha ao atualizar ultimo_login do usuário', updateLastLoginError);
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

    const subscriptionDetails =
      user.empresa_id != null
        ? resolveSubscriptionPayloadFromRow({
            empresa_plano: subscriptionRow.empresa_plano,
            empresa_ativo: subscriptionRow.empresa_ativo,
            trial_started_at:
              subscriptionRow.empresa_trial_started_at ?? subscriptionRow.empresa_datacadastro,
            trial_ends_at: subscriptionRow.empresa_trial_ends_at,
            current_period_start:
              subscriptionRow.empresa_current_period_start ?? subscriptionRow.empresa_datacadastro,
            current_period_end:
              subscriptionRow.empresa_current_period_end ??
              subscriptionRow.empresa_current_period_ends_at,
            grace_expires_at:
              subscriptionRow.empresa_grace_expires_at ??
              subscriptionRow.empresa_grace_period_ends_at,
            subscription_cadence: subscriptionRow.empresa_subscription_cadence,
          })
        : null;

    const subscription =
      subscriptionDetails && subscriptionResolution
        ? {
            planId: subscriptionResolution.planId ?? subscriptionDetails.planId,
            status: subscriptionResolution.status,
            cadence: subscriptionDetails.cadence,
            startedAt: subscriptionResolution.startedAt ?? subscriptionDetails.startedAt,
            trialEndsAt:
              subscriptionResolution.trialEndsAt ?? subscriptionDetails.trialEndsAt,
            currentPeriodStart: subscriptionDetails.currentPeriodStart,
            currentPeriodEndsAt:
              subscriptionResolution.currentPeriodEndsAt ??
              subscriptionDetails.currentPeriodEnd,
            currentPeriodEnd: subscriptionDetails.currentPeriodEnd,
            gracePeriodEndsAt:
              subscriptionResolution.gracePeriodEndsAt ??
              subscriptionDetails.graceExpiresAt,
            graceExpiresAt: subscriptionDetails.graceExpiresAt,
            isInGoodStanding: subscriptionResolution.isInGoodStanding,
            blockingReason: subscriptionResolution.blockingReason,
          }
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
        empresa_responsavel_id: user.empresa_responsavel_id,
        setor_id: user.setor_id,
        setor_nome: user.setor_nome,
        subscription,
        mustChangePassword,
        viewAllConversations,
      },
    });
  } catch (error) {
    if (isUndefinedTableError(error)) {
      console.error('Erro ao realizar login', error);
      res.status(503).json({ error: 'Recursos de autenticação indisponíveis no momento.' });
      return;
    }

    console.error('Erro ao realizar login', error);
    res.status(500).json({ error: 'Não foi possível concluir a autenticação.' });
  }
};

export const requestPasswordReset = async (req: Request, res: Response) => {
  const emailValue = typeof req.body?.email === 'string' ? req.body.email.trim() : '';

  if (!emailValue || !EMAIL_REGEX.test(emailValue)) {
    res.status(400).json({ error: 'Informe um e-mail válido.' });
    return;
  }

  const normalizedEmail = normalizeEmail(emailValue);

  try {
    const userResult = await pool.query(
      `SELECT id, nome_completo, email
         FROM public.usuarios
        WHERE LOWER(email) = $1
        LIMIT 1`,
      [normalizedEmail],
    );

    if (userResult.rowCount === 0) {
      res.status(200).json({
        message:
          'Se o e-mail informado estiver cadastrado, enviaremos as instruções para redefinir a senha.',
      });
      return;
    }

    const userRow = userResult.rows[0] as {
      id: number;
      nome_completo: unknown;
      email: unknown;
    };

    const userEmail = typeof userRow.email === 'string' ? userRow.email.trim() : normalizedEmail;

    if (!userEmail) {
      res.status(200).json({
        message:
          'Se o e-mail informado estiver cadastrado, enviaremos as instruções para redefinir a senha.',
      });
      return;
    }

    await createPasswordResetRequest({
      id: userRow.id,
      nome_completo:
        typeof userRow.nome_completo === 'string' && userRow.nome_completo.trim()
          ? userRow.nome_completo
          : 'Usuário',
      email: userEmail,
    });

    res.status(200).json({
      message:
        'Se o e-mail informado estiver cadastrado, enviaremos as instruções para redefinir a senha.',
    });
  } catch (error) {
    console.error('Erro ao solicitar redefinição de senha', error);
    res.status(500).json({ error: 'Não foi possível redefinir a senha do usuário.' });
  }
};

export const changePassword = async (req: Request, res: Response) => {
  if (!req.auth) {
    res.status(401).json({ error: 'Token inválido.' });
    return;
  }

  const temporaryPasswordValue =
    typeof req.body?.temporaryPassword === 'string'
      ? req.body.temporaryPassword
      : typeof req.body?.currentPassword === 'string'
        ? req.body.currentPassword
        : '';
  const newPasswordValue =
    typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
  const confirmPasswordValue =
    typeof req.body?.confirmPassword === 'string'
      ? req.body.confirmPassword
      : typeof req.body?.passwordConfirmation === 'string'
        ? req.body.passwordConfirmation
        : '';

  if (!temporaryPasswordValue) {
    res.status(400).json({ error: 'Informe a senha provisória enviada por e-mail.' });
    return;
  }

  if (!newPasswordValue) {
    res.status(400).json({ error: 'Informe a nova senha.' });
    return;
  }

  if (newPasswordValue.length < MIN_PASSWORD_LENGTH) {
    res
      .status(400)
      .json({ error: `A nova senha deve conter ao menos ${MIN_PASSWORD_LENGTH} caracteres.` });
    return;
  }

  if (newPasswordValue !== confirmPasswordValue) {
    res.status(400).json({ error: 'A confirmação da nova senha não confere.' });
    return;
  }

  if (newPasswordValue === temporaryPasswordValue) {
    res
      .status(400)
      .json({ error: 'A nova senha deve ser diferente da senha provisória informada.' });
    return;
  }

  const client = await pool.connect();
  let transactionActive = false;

  try {
    await client.query('BEGIN');
    transactionActive = true;

    const userResult = await client.query(
      `SELECT senha, must_change_password
         FROM public.usuarios
        WHERE id = $1
        FOR UPDATE`,
      [req.auth.userId]
    );

    if (userResult.rowCount === 0) {
      await client.query('ROLLBACK');
      transactionActive = false;
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }

    const userRow = userResult.rows[0] as { senha: unknown; must_change_password?: unknown };

    if (typeof userRow.senha !== 'string' || userRow.senha.length === 0) {
      await client.query('ROLLBACK');
      transactionActive = false;
      res.status(400).json({ error: 'Senha provisória inválida.' });
      return;
    }

    const passwordCheck = await verifyPassword(temporaryPasswordValue, userRow.senha);
    if (!passwordCheck.isValid) {
      await client.query('ROLLBACK');
      transactionActive = false;
      res.status(400).json({ error: 'Senha provisória inválida.' });
      return;
    }

    const hashedPassword = await hashPassword(newPasswordValue);

    await client.query(
      `UPDATE public.usuarios
          SET senha = $1,
              must_change_password = FALSE
        WHERE id = $2`,
      [hashedPassword, req.auth.userId]
    );

    await client.query(
      `UPDATE public.password_reset_tokens
          SET used_at = NOW()
        WHERE user_id = $1
          AND used_at IS NULL`,
      [req.auth.userId]
    );

    await client.query('COMMIT');
    transactionActive = false;

    res.json({ message: 'Senha atualizada com sucesso.' });
  } catch (error) {
    if (transactionActive) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Falha ao reverter transação de alteração de senha', rollbackError);
      }
    }

    console.error('Erro ao atualizar senha do usuário autenticado', error);
    res.status(500).json({ error: 'Não foi possível atualizar a senha.' });
  } finally {
    client.release();
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
              per.ver_todas_conversas AS perfil_ver_todas_conversas,
              u.status,
              u.empresa AS empresa_id,
              emp.nome_empresa AS empresa_nome,
              emp.responsavel AS empresa_responsavel_id,
              u.setor AS setor_id,
              esc.nome AS setor_nome,
              emp.plano AS empresa_plano,
              emp.ativo AS empresa_ativo,
              emp.trial_started_at AS empresa_trial_started_at,
              COALESCE(emp.trial_ends_at, emp.subscription_trial_ends_at) AS empresa_trial_ends_at,
              emp.current_period_start AS empresa_current_period_start,
              COALESCE(emp.current_period_end, emp.subscription_current_period_ends_at) AS empresa_current_period_end,
              COALESCE(emp.grace_expires_at, emp.subscription_grace_period_ends_at) AS empresa_grace_expires_at,
              emp.subscription_cadence AS empresa_subscription_cadence,
              emp.datacadastro AS empresa_datacadastro,
              COALESCE(emp.subscription_current_period_ends_at, emp.current_period_end) AS empresa_current_period_ends_at,
              COALESCE(emp.subscription_grace_period_ends_at, emp.grace_expires_at) AS empresa_grace_period_ends_at
         FROM public.usuarios u
         LEFT JOIN public.empresas emp ON emp.id = u.empresa
         LEFT JOIN public.escritorios esc ON esc.id = u.setor
         LEFT JOIN public.perfis per ON per.id = u.perfil
        WHERE u.id = $1
        LIMIT 1`,
      [req.auth.userId]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }

    const user = result.rows[0] as UserRowBase;

    const subscriptionResolution =
      user.empresa_id != null ? resolveSubscriptionPayload(user) : null;

    const subscriptionAccess = evaluateSubscriptionAccess(subscriptionResolution);
    if (!subscriptionAccess.isAllowed) {
      res
        .status(subscriptionAccess.statusCode ?? 403)
        .json({ error: subscriptionAccess.message ?? 'Assinatura inativa.' });
      return;
    }

    const modulos = await fetchPerfilModules(user.perfil);

    const subscription =
      user.empresa_id != null
        ? resolveSubscriptionPayloadFromRow({
            empresa_plano: user.empresa_plano,
            empresa_ativo: user.empresa_ativo,
            trial_started_at: user.empresa_trial_started_at ?? user.empresa_datacadastro,
            trial_ends_at: user.empresa_trial_ends_at,
            current_period_start: user.empresa_current_period_start ?? user.empresa_datacadastro,
            current_period_end:
              user.empresa_current_period_end ?? user.empresa_current_period_ends_at,
            grace_expires_at: user.empresa_grace_expires_at ?? user.empresa_grace_period_ends_at,
            subscription_cadence: user.empresa_subscription_cadence,
          })
        : null;

    const mustChangePassword =
      parseBooleanFlag((user as { must_change_password?: unknown }).must_change_password) ?? false;
    const viewAllConversations =
      parseBooleanFlag((user as { perfil_ver_todas_conversas?: unknown }).perfil_ver_todas_conversas) ?? true;

    res.json({
      id: user.id,
      nome_completo: user.nome_completo,
      email: user.email,
      perfil: user.perfil,
      status: user.status,
      empresa_id: user.empresa_id,
      empresa_nome: user.empresa_nome,
      empresa_responsavel_id: user.empresa_responsavel_id,
      setor_id: user.setor_id,
      setor_nome: user.setor_nome,
      modulos,
      subscription,
      mustChangePassword,
      viewAllConversations,
    });
  } catch (error) {
    console.error('Erro ao carregar usuário autenticado', error);
    res.status(500).json({ error: 'Não foi possível carregar os dados do usuário.' });
  }
};
