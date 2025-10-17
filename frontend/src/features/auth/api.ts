import { supabase } from "@/integrations/supabase/client";
import { getApiUrl } from "@/lib/api";
import type { Session as SupabaseSession, User as SupabaseUser } from "@supabase/supabase-js";
import type {
  AuthSubscription,
  AuthUser,
  LoginCredentials,
  LoginResponse,
  SubscriptionStatus,
} from "./types";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const parseModules = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
};

const parseInteger = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string") {
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
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return null;
    }

    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    if (["1", "true", "t", "yes", "y", "sim", "on", "ativo", "ativa"].includes(normalized)) {
      return true;
    }

    if (["0", "false", "f", "no", "n", "nao", "não", "off", "inativo", "inativa"].includes(normalized)) {
      return false;
    }
  }

  return null;
};

const parseStringField = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return null;
};

const parseIsoDate = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed.toISOString();
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }

    return value.toISOString();
  }

  return null;
};

const parseSubscriptionStatus = (value: unknown, fallback: SubscriptionStatus): SubscriptionStatus => {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "trial") {
    return "trialing";
  }

  if (
    normalized === "active" ||
    normalized === "trialing" ||
    normalized === "inactive" ||
    normalized === "grace_period" ||
    normalized === "past_due" ||
    normalized === "expired"
  ) {
    return normalized;
  }

  return fallback;
};

const parseSubscription = (value: unknown): AuthSubscription | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const planId = parseInteger(record.planId ?? record.plan_id ?? record.plano ?? record.plan);
  const isActive = parseBooleanFlag(record.isActive ?? record.active ?? record.ativo);
  const statusFallback: SubscriptionStatus = planId === null || isActive === false ? "inactive" : "active";
  const status = parseSubscriptionStatus(record.status, statusFallback);
  const startedAt =
    parseIsoDate(record.startedAt ?? record.startDate ?? record.start_at ?? record.datacadastro) ?? null;
  const trialEndsAt =
    parseIsoDate(record.trialEndsAt ?? record.trial_end ?? record.trialEnd ?? record.endsAt ?? record.endDate) ?? null;
  const currentPeriodEnd =
    parseIsoDate(
      record.currentPeriodEnd ??
        record.current_period_end ??
        record.currentPeriodEndAt ??
        record.periodEnd ??
        record.subscriptionCurrentPeriodEnd,
    ) ?? null;
  const graceEndsAt =
    parseIsoDate(
      record.graceEndsAt ??
        record.grace_ends_at ??
        record.graceEnds ??
        record.gracePeriodEnd ??
        record.gracePeriodEndsAt ??
        record.grace_deadline,
    ) ?? null;

  return {
    planId,
    status,
    startedAt,
    trialEndsAt,
    currentPeriodEnd,
    graceEndsAt,
  };
};

const resolveMustChangePassword = (record: Record<string, unknown>): boolean =>
  parseBooleanFlag(
    record.mustChangePassword ??
      record.must_change_password ??
      record.must_change ??
      record.must_change_pass ??
      record.must_change_password_flag,
  ) ?? false;

const parseViewAllConversations = (record: Record<string, unknown>): boolean =>
  parseBooleanFlag(
    record.viewAllConversations ??
      record.visualizarTodasConversas ??
      record.verTodasConversas ??
      record.perfilVerTodasConversas ??
      record.perfil_ver_todas_conversas,
  ) ?? true;

const resolveSupabaseMetadata = (
  user: SupabaseUser,
  fallbackEmail: string,
): AuthUser | null => {
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const record: Record<string, unknown> = { ...metadata };

  const email = parseStringField(record.email) ?? parseStringField(user.email) ?? fallbackEmail;
  const nomeCompleto =
    parseStringField(record.nome_completo ?? record.nomeCompleto ?? record.full_name ?? record.name) ??
    email ??
    fallbackEmail;

  const id =
    parseInteger(
      record.id ?? record.userId ?? record.user_id ?? record.profileId ?? record.profile_id ?? record.usuario_id,
    ) ?? null;

  if (id === null) {
    console.warn("Usuário autenticado sem metadados de identificação", {
      userId: user.id,
      email,
    });
    return null;
  }

  const perfil = parseInteger(record.perfil ?? record.profile ?? record.perfil_id ?? record.profileId) ?? null;
  const status = parseBooleanFlag(record.status ?? record.ativo ?? record.active);
  const empresaId =
    parseInteger(record.empresa_id ?? record.empresaId ?? record.companyId ?? record.empresa ?? record.company_id) ?? null;
  const empresaNome =
    parseStringField(record.empresa_nome ?? record.empresaNome ?? record.companyName ?? record.empresaNomeCompleto) ?? null;
  const empresaResponsavelId =
    parseInteger(
      record.empresa_responsavel_id ??
        record.empresaResponsavelId ??
        record.companyManagerId ??
        record.companyResponsibleId ??
        record.responsavel_empresa ??
        record.company_responsavel,
    ) ?? null;
  const setorId = parseInteger(record.setor_id ?? record.setorId ?? record.departmentId ?? record.departamento_id) ?? null;
  const setorNome =
    parseStringField(record.setor_nome ?? record.setorNome ?? record.departmentName ?? record.departamento_nome) ?? null;
  const modulos = parseModules(record.modulos);
  const subscription = parseSubscription(record.subscription);
  const mustChangePassword = resolveMustChangePassword(record);
  const viewAllConversations = parseViewAllConversations(record);

  return {
    id,
    nome_completo: nomeCompleto,
    email: email ?? fallbackEmail,
    perfil,
    status,
    modulos,
    empresa_id: empresaId,
    empresa_nome: empresaNome,
    empresa_responsavel_id: empresaResponsavelId,
    setor_id: setorId,
    setor_nome: setorNome,
    subscription,
    mustChangePassword,
    viewAllConversations,
  } satisfies AuthUser;
};

const parseErrorMessage = async (response: Response) => {
  try {
    const data = await response.json();
    if (typeof data?.error === "string" && data.error.trim().length > 0) {
      return data.error;
    }
    if (typeof data?.message === "string" && data.message.trim().length > 0) {
      return data.message;
    }
  } catch (error) {
    console.warn("Failed to parse error response", error);
  }

  if (response.status === 403) {
    return "Confirme seu e-mail antes de acessar. Verifique sua caixa de entrada.";
  }

  return response.status === 401
    ? "Credenciais inválidas. Verifique seu e-mail e senha."
    : "Não foi possível concluir a solicitação. Tente novamente.";
};

const buildApiError = async (response: Response) =>
  new ApiError(await parseErrorMessage(response), response.status);

export const loginRequest = async (
  credentials: LoginCredentials,
): Promise<LoginResponse> => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.senha,
  });

  if (error) {
    throw new ApiError(error.message ?? "Falha ao autenticar.", error.status ?? 401);
  }

  const session = data.session as SupabaseSession | null;
  const user = data.user as SupabaseUser | null;

  if (!session?.access_token || !user) {
    throw new Error("Resposta de autenticação inválida.");
  }

  const authUser = resolveSupabaseMetadata(user, credentials.email);

  return {
    token: session.access_token,
    expiresIn: session.expires_in ?? undefined,
    user: authUser,
    session,
  };
};

export const fetchCurrentUser = async (token?: string): Promise<AuthUser> => {
  const headers = new Headers({
    Accept: "application/json",
  });

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(getApiUrl("auth/me"), {
    headers,
  });

  if (!response.ok) {
    throw await buildApiError(response);
  }

  const data = (await response.json()) as (AuthUser & { modulos?: unknown }) &
    Record<string, unknown>;
  if (typeof data?.id !== "number") {
    throw new Error("Não foi possível carregar os dados do usuário.");
  }

  return {
    ...data,
    modulos: parseModules(data.modulos),
    subscription: parseSubscription((data as { subscription?: unknown }).subscription),
    mustChangePassword: resolveMustChangePassword(data),
    viewAllConversations: parseViewAllConversations(data),
  } satisfies AuthUser;
};

export const refreshTokenRequest = async (
  token: string,
): Promise<{ token: string; expiresIn?: number }> => {
  const response = await fetch(getApiUrl("auth/refresh"), {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw await buildApiError(response);
  }

  const data = (await response.json()) as { token?: unknown; expiresIn?: unknown };
  if (typeof data?.token !== "string" || data.token.trim().length === 0) {
    throw new Error("Resposta de renovação inválida.");
  }

  return {
    token: data.token,
    expiresIn: typeof data.expiresIn === "number" ? data.expiresIn : undefined,
  };
};

export interface ChangePasswordPayload {
  temporaryPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export const changePasswordRequest = async (
  payload: ChangePasswordPayload,
): Promise<{ message: string }> => {
  const response = await fetch(getApiUrl("auth/change-password"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw await buildApiError(response);
  }

  const data = (await response.json()) as { message?: unknown };
  return {
    message:
      typeof data?.message === "string" && data.message.trim().length > 0
        ? data.message
        : "Senha atualizada com sucesso.",
  };
};

export const requestPasswordReset = async (
  email: string,
): Promise<{ message: string }> => {
  const response = await fetch(getApiUrl("auth/request-password-reset"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    throw await buildApiError(response);
  }

  const data = (await response.json()) as { message?: unknown };
  return {
    message:
      typeof data?.message === "string" && data.message.trim().length > 0
        ? data.message
        : "Se o e-mail informado estiver cadastrado, enviaremos as instruções para redefinir a senha.",
  };
};

export const resendEmailConfirmationRequest = async (email: string): Promise<string> => {
  const response = await fetch(getApiUrl("auth/resend-email-confirmation"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    throw await buildApiError(response);
  }

  try {
    const data = (await response.json()) as { message?: unknown };
    if (typeof data?.message === "string" && data.message.trim().length > 0) {
      return data.message;
    }
  } catch (error) {
    console.warn("Failed to parse resend confirmation response", error);
  }

  return "Um novo e-mail de confirmação foi enviado.";
};

export const confirmEmailRequest = async (
  token: string,
  signal?: AbortSignal,
): Promise<{ message: string; confirmedAt?: string }> => {
  const normalizedToken = token.trim();

  if (!normalizedToken) {
    throw new ApiError("Token de confirmação inválido.", 400);
  }

  const response = await fetch(getApiUrl("auth/confirm-email"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ token: normalizedToken }),
    signal,
  });

  if (!response.ok) {
    throw await buildApiError(response);
  }

  const data = (await response.json()) as {
    message?: unknown;
    confirmedAt?: unknown;
    confirmed_at?: unknown;
  };

  const confirmedAtRaw = typeof data?.confirmedAt === "string"
    ? data.confirmedAt
    : typeof data?.confirmed_at === "string"
      ? data.confirmed_at
      : null;

  let confirmedAt: string | undefined;

  if (confirmedAtRaw) {
    const parsed = new Date(confirmedAtRaw);
    if (!Number.isNaN(parsed.getTime())) {
      confirmedAt = parsed.toISOString();
    }
  }

  return {
    message:
      typeof data?.message === "string" && data.message.trim().length > 0
        ? data.message
        : "E-mail confirmado com sucesso.",
    confirmedAt,
  };
};
