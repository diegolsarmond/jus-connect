import { getApiUrl } from "@/lib/api";
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
  const response = await fetch(getApiUrl("auth/login"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    throw await buildApiError(response);
  }

  const data = (await response.json()) as LoginResponse;
  if (!data?.token || !data?.user) {
    throw new Error("Resposta de autenticação inválida.");
  }

  const userRecord = data.user as AuthUser & Record<string, unknown>;

  return {
    token: data.token,
    expiresIn: data.expiresIn,
    user: {
      ...data.user,
      modulos: parseModules(userRecord.modulos),
      subscription: parseSubscription(userRecord.subscription),
      mustChangePassword: resolveMustChangePassword(userRecord),
      viewAllConversations: parseViewAllConversations(userRecord),
    },
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
