import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { getApiBaseUrl } from "@/lib/api";
import { DEFAULT_TIMEOUT_MS, LAST_ACTIVITY_KEY } from "@/hooks/useAutoLogout";
import type { SupabaseSession } from "@supabase/supabase-js";
import { ApiError, fetchCurrentUser, loginRequest } from "./api";
import { sanitizeModuleList } from "./moduleUtils";
import type {
  AuthSubscription,
  AuthUser,
  LoginCredentials,
  LoginResponse,
  SubscriptionStatus,
} from "./types";

interface StoredAuthData {
  token: string;
  user?: AuthUser;
  timestamp: number;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<LoginResponse>;
  logout: () => void;
  refreshUser: () => Promise<AuthUser>;
}

const STORAGE_KEY = "jus-connect:auth";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const parseOptionalInteger = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    const normalized = Math.trunc(value);
    return Number.isNaN(normalized) ? null : normalized;
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

const sanitizeSubscriptionStatus = (
  value: unknown,
  fallback: SubscriptionStatus,
): SubscriptionStatus => {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "trial") {
    return "trialing";
  }

  if (
    normalized === "active" ||
    normalized === "pending" ||
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

const sanitizeAuthSubscription = (value: unknown): AuthSubscription | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const planId = parseOptionalInteger(record.planId ?? record.plan_id ?? record.plano ?? record.plan);
  const isActive = parseBooleanFlag(record.isActive ?? record.active ?? record.ativo);
  const fallback: SubscriptionStatus = planId === null || isActive === false ? "inactive" : "active";
  const status = sanitizeSubscriptionStatus(record.status, fallback);
  const startedAt = parseIsoDate(record.startedAt ?? record.startDate ?? record.datacadastro ?? null);
  const trialEndsAt = parseIsoDate(
    record.trialEndsAt ?? record.trial_end ?? record.trialEnd ?? record.endsAt ?? record.endDate ?? null,
  );
  const currentPeriodEnd = parseIsoDate(
    record.currentPeriodEnd ??
      record.current_period_end ??
      record.currentPeriodEndAt ??
      record.periodEnd ??
      record.subscriptionCurrentPeriodEnd ??
      null,
  );
  const graceEndsAt = parseIsoDate(
    record.graceEndsAt ??
      record.grace_ends_at ??
      record.graceEnds ??
      record.gracePeriodEnd ??
      record.gracePeriodEndsAt ??
      record.grace_deadline ??
      null,
  );

  return {
    planId,
    status,
    startedAt,
    trialEndsAt,
    currentPeriodEnd,
    graceEndsAt,
  };
};

const sanitizeAuthUser = (user: AuthUser | undefined | null): AuthUser | null => {
  if (!user) {
    return null;
  }

  const candidate = user as AuthUser & { modulos?: unknown; subscription?: unknown };
  const modules = sanitizeModuleList(candidate.modulos);
  const subscription = sanitizeAuthSubscription(candidate.subscription ?? null);
  const record = candidate as Record<string, unknown>;
  const companyManagerId =
    parseOptionalInteger(
      record.empresa_responsavel_id ??
        record.empresaResponsavelId ??
        record.companyManagerId ??
        record.companyResponsibleId ??
        record.responsavel_empresa ??
        record.company_responsavel ??
        null,
    ) ?? null;
  const mustChangePassword =
    parseBooleanFlag(
      record.mustChangePassword ??
        record.must_change_password ??
        record.must_change ??
        record.must_change_pass ??
        record.must_change_password_flag,
    ) ?? false;
  const viewAllConversations =
    parseBooleanFlag(
      record.viewAllConversations ??
        record.visualizarTodasConversas ??
        record.verTodasConversas ??
        record.perfilVerTodasConversas ??
        record.perfil_ver_todas_conversas,
    ) ?? true;

  return {
    ...candidate,
    modulos: modules,
    subscription: subscription ?? null,
    mustChangePassword,
    empresa_responsavel_id: companyManagerId,
    viewAllConversations,
  } satisfies AuthUser;
};

const readLastActivityTimestamp = (): number | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(LAST_ACTIVITY_KEY);
    if (!raw) {
      return null;
    }

    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) {
      return null;
    }

    return parsed;
  } catch (error) {
    console.warn("Falha ao ler registro de atividade", error);
    return null;
  }
};

const readStoredAuth = (): StoredAuthData | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as StoredAuthData;
    if (!parsed?.token) {
      return null;
    }

    const sanitizedUser = sanitizeAuthUser(parsed.user ?? null) ?? undefined;

    return {
      token: parsed.token,
      user: sanitizedUser,
      timestamp:
        typeof parsed.timestamp === "number" && Number.isFinite(parsed.timestamp)
          ? parsed.timestamp
          : Date.now(),
    };
  } catch (error) {
    console.warn("Failed to parse stored auth data", error);
    return null;
  }
};

const writeStoredAuth = (data: StoredAuthData | null) => {
  if (typeof window === "undefined") {
    return;
  }

  if (!data) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  const user = sanitizeAuthUser(data.user ?? null) ?? undefined;

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      token: data.token,
      user,
      timestamp: data.timestamp,
    }),
  );
};

const shouldAttachAuthHeader = (requestUrl: string, apiBaseUrl: string): boolean => {
  if (!requestUrl) {
    return false;
  }

  if (requestUrl.startsWith("/api")) {
    return true;
  }

  if (requestUrl.startsWith("http://") || requestUrl.startsWith("https://")) {
    const normalizedBase = apiBaseUrl.replace(/\/+$/, "");
    const normalizedUrl = requestUrl.replace(/\/+$/, "");
    if (normalizedUrl.startsWith(`${normalizedBase}/api`) || normalizedUrl === `${normalizedBase}/api`) {
      return true;
    }
  }

  return false;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const tokenRef = useRef<string | null>(null);
  const userRef = useRef<AuthUser | null>(null);
  const hasUnauthorizedErrorRef = useRef(false);
  const apiBaseUrlRef = useRef(getApiBaseUrl());
  const logoutRef = useRef<() => void>(() => {});
  const isSyncingSessionRef = useRef(false);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const performLocalLogout = useCallback(() => {
    setUser(null);
    setToken(null);
    setIsLoading(false);
    hasUnauthorizedErrorRef.current = false;
    tokenRef.current = null;
    userRef.current = null;
    writeStoredAuth(null);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(LAST_ACTIVITY_KEY);
      } catch (error) {
        console.warn("Falha ao limpar registro de atividade", error);
      }
    }
  }, []);

  const syncUserFromToken = useCallback(
    async (accessToken: string) => {
      const currentUser = await fetchCurrentUser(accessToken);
      const sanitizedUser = sanitizeAuthUser(currentUser) ?? currentUser;
      setUser(sanitizedUser);
      userRef.current = sanitizedUser;
      writeStoredAuth({
        token: accessToken,
        user: sanitizedUser,
        timestamp: Date.now(),
      });
      return sanitizedUser;
    },
    [],
  );

  const applySession = useCallback(
    async (session: SupabaseSession | null, fallbackUser?: AuthUser | null) => {
      if (!session?.access_token) {
        performLocalLogout();
        return;
      }

      const lastActivity = readLastActivityTimestamp();
      if (lastActivity !== null && Date.now() - lastActivity >= DEFAULT_TIMEOUT_MS) {
        await supabase.auth.signOut().catch(() => {});
        performLocalLogout();
        return;
      }

      const sanitizedFallback = fallbackUser ? sanitizeAuthUser(fallbackUser) ?? fallbackUser : null;

      tokenRef.current = session.access_token;
      setToken(session.access_token);

      if (sanitizedFallback) {
        setUser(sanitizedFallback);
        userRef.current = sanitizedFallback;
      }

      writeStoredAuth({
        token: session.access_token,
        user: userRef.current ?? undefined,
        timestamp: Date.now(),
      });

      isSyncingSessionRef.current = true;
      try {
        await syncUserFromToken(session.access_token);
      } catch (error) {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          performLocalLogout();
        } else {
          console.warn("Failed to synchronize user from Supabase session", error);
        }
      } finally {
        isSyncingSessionRef.current = false;
        setIsLoading(false);
      }
    },
    [performLocalLogout, syncUserFromToken],
  );

  useEffect(() => {
    logoutRef.current = performLocalLogout;
  }, [performLocalLogout]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.fetch !== "function") {
      return;
    }

    const originalFetch = window.fetch.bind(window);
    const apiBaseUrl = apiBaseUrlRef.current;

    const enhancedFetch: typeof window.fetch = async (input, init) => {
      const request = new Request(input as RequestInfo, init);
      const requestUrl = request.url;
      const shouldAttach = tokenRef.current && shouldAttachAuthHeader(requestUrl, apiBaseUrl);

      let finalRequest = request;

      if (shouldAttach && tokenRef.current) {
        const headers = new Headers(request.headers);
        headers.set("Authorization", `Bearer ${tokenRef.current}`);
        finalRequest = new Request(request, { headers });
      }

      const response = await originalFetch(finalRequest);

      if (
        response.status === 401 &&
        shouldAttachAuthHeader(response.url, apiBaseUrl) &&
        tokenRef.current &&
        !response.url.endsWith("/auth/login")
      ) {
        if (!hasUnauthorizedErrorRef.current) {
          hasUnauthorizedErrorRef.current = true;
          window.setTimeout(() => {
            logoutRef.current();
          }, 0);
        }
      }

      return response;
    };

    window.fetch = enhancedFetch;

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        performLocalLogout();
        return;
      }

      if (event === "SIGNED_IN" && isSyncingSessionRef.current) {
        return;
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        await applySession(session);
      }
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, [applySession, performLocalLogout]);

  useEffect(() => {
    const initialize = async () => {
      const stored = readStoredAuth();

      if (stored?.user) {
        setUser(stored.user);
        userRef.current = stored.user;
      }

      if (stored?.token) {
        setToken(stored.token);
        tokenRef.current = stored.token;
      }

      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          await applySession(data.session, stored?.user ?? null);
          return;
        }

        if (stored?.token) {
          try {
            await syncUserFromToken(stored.token);
          } catch {
            performLocalLogout();
          }
        }
      } catch (error) {
        console.warn("Failed to initialize Supabase session", error);
      } finally {
        setIsLoading(false);
      }
    };

    void initialize();
  }, [applySession, performLocalLogout, syncUserFromToken]);

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      const response = await loginRequest(credentials);
      const sanitizedUser = sanitizeAuthUser(response.user) ?? response.user;
      await applySession(response.session, sanitizedUser);
      return { ...response, user: sanitizedUser };
    },
    [applySession],
  );

  const logout = useCallback(() => {
    void supabase.auth.signOut().catch(() => {});
    performLocalLogout();
  }, [performLocalLogout]);

  const refreshUser = useCallback(async () => {
    if (!tokenRef.current) {
      throw new Error("Token de autenticação inexistente.");
    }
    const sanitizedUser = await syncUserFromToken(tokenRef.current);
    return sanitizedUser;
  }, [syncUserFromToken]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token),
      isLoading,
      login,
      logout,
      refreshUser,
    }),
    [user, token, isLoading, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
