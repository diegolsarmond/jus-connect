import { getApiUrl } from "@/lib/api";
import type { AuthUser, LoginCredentials, LoginResponse } from "./types";

const parseModules = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
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

  return response.status === 401
    ? "Credenciais inválidas. Verifique seu e-mail e senha."
    : "Não foi possível concluir a solicitação. Tente novamente.";
};

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
    throw new Error(await parseErrorMessage(response));
  }

  const data = (await response.json()) as LoginResponse;
  if (!data?.token || !data?.user) {
    throw new Error("Resposta de autenticação inválida.");
  }

  return {
    token: data.token,
    expiresIn: data.expiresIn,
    user: {
      ...data.user,
      modulos: parseModules((data.user as AuthUser & { modulos?: unknown }).modulos),
    },
  };
};

export const fetchCurrentUser = async (): Promise<AuthUser> => {
  const response = await fetch(getApiUrl("auth/me"), {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const data = (await response.json()) as AuthUser & { modulos?: unknown };
  if (typeof data?.id !== "number") {
    throw new Error("Não foi possível carregar os dados do usuário.");
  }

  return {
    ...data,
    modulos: parseModules(data.modulos),
  } satisfies AuthUser;
};
