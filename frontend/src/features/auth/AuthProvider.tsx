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
import { getApiBaseUrl } from "@/lib/api";
import { DEFAULT_TIMEOUT_MS, LAST_ACTIVITY_KEY } from "@/hooks/useAutoLogout";
import { ApiError, fetchCurrentUser, loginRequest, refreshTokenRequest } from "./api";
import type { AuthUser, LoginCredentials, LoginResponse } from "./types";

interface StoredAuthData {
  token: string;
  user?: AuthUser;
  timestamp: number;
  expiresAt?: number;
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

const sanitizeAuthUser = (user: AuthUser | undefined | null): AuthUser | null => {
  if (!user) {
    return null;
  }

  const candidate = user as AuthUser & { modulos?: unknown };
  const modules = Array.isArray(candidate.modulos)
    ? candidate.modulos.filter((module): module is string => typeof module === "string")
    : [];

  return {
    ...candidate,
    modulos: modules,
  } satisfies AuthUser;
};

const TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000;
const TOKEN_REFRESH_RETRY_DELAY_MS = 30 * 1000;

const decodeBase64Url = (value: string): string | null => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4;
  const padded = normalized + "=".repeat((4 - padding) % 4);

  if (typeof atob === "function") {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    if (typeof TextDecoder === "function") {
      return new TextDecoder().decode(bytes);
    }

    let result = "";
    for (let index = 0; index < bytes.length; index += 1) {
      result += String.fromCharCode(bytes[index]);
    }
    return result;
  }

  const globalBuffer = (globalThis as { Buffer?: { from: (data: string, encoding: string) => { toString: (encoding: string) => string } } }).Buffer;
  if (globalBuffer) {
    try {
      return globalBuffer.from(padded, "base64").toString("utf-8");
    } catch (error) {
      console.warn("Falha ao decodificar base64 utilizando Buffer", error);
    }
  }

  return null;
};

const decodeTokenExpiration = (token: string): number | null => {
  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }

  try {
    const decoded = decodeBase64Url(parts[1]);
    if (!decoded) {
      return null;
    }

    const payload = JSON.parse(decoded) as { exp?: unknown };
    if (typeof payload.exp === "number" && Number.isFinite(payload.exp)) {
      return payload.exp * 1000;
    }
  } catch (error) {
    console.warn("Falha ao decodificar expiração do token", error);
  }

  return null;
};

const resolveTokenExpiration = (
  token: string,
  expiresIn?: number,
  baseTimestamp = Date.now(),
): number | null => {
  if (typeof expiresIn === "number" && Number.isFinite(expiresIn) && expiresIn > 0) {
    return baseTimestamp + expiresIn * 1000;
  }

  return decodeTokenExpiration(token);
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

    const expiresAt =
      typeof parsed.expiresAt === "number" && Number.isFinite(parsed.expiresAt)
        ? parsed.expiresAt
        : decodeTokenExpiration(parsed.token) ?? undefined;

    return {
      ...parsed,
      user: sanitizedUser,
      expiresAt,
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
  const expiresAt =
    typeof data.expiresAt === "number" && Number.isFinite(data.expiresAt)
      ? data.expiresAt
      : undefined;
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...data, user, expiresAt }),
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
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);
  const tokenRef = useRef<string | null>(null);
  const userRef = useRef<AuthUser | null>(null);
  const hasUnauthorizedErrorRef = useRef(false);
  const apiBaseUrlRef = useRef(getApiBaseUrl());
  const refreshTimeoutIdRef = useRef<number>();
  const isRefreshingTokenRef = useRef(false);
  const scheduleRefreshCallbackRef = useRef<() => void>(() => {});

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const clearRefreshTimeout = useCallback(() => {
    if (typeof window === "undefined") {
      refreshTimeoutIdRef.current = undefined;
      return;
    }

    if (refreshTimeoutIdRef.current !== undefined) {
      window.clearTimeout(refreshTimeoutIdRef.current);
      refreshTimeoutIdRef.current = undefined;
    }
  }, []);

  const handleLogout = useCallback(() => {
    setUser(null);
    setToken(null);
    setSessionExpiresAt(null);
    setIsLoading(false);
    hasUnauthorizedErrorRef.current = false;
    tokenRef.current = null;
    userRef.current = null;
    clearRefreshTimeout();
    writeStoredAuth(null);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(LAST_ACTIVITY_KEY);
      } catch (error) {
        console.warn("Falha ao limpar registro de atividade", error);
      }
    }
  }, [clearRefreshTimeout]);

  const logoutRef = useRef(handleLogout);
  useEffect(() => {
    logoutRef.current = handleLogout;
  }, [handleLogout]);

  useEffect(() => {
    const stored = readStoredAuth();
    if (!stored) {
      setIsLoading(false);
      return;
    }

    setToken(stored.token);
    tokenRef.current = stored.token;
    const initialExpiresAt = stored.expiresAt ?? decodeTokenExpiration(stored.token);
    setSessionExpiresAt(initialExpiresAt ?? null);
    if (stored.user) {
      setUser(stored.user);
    }

    const validateToken = async () => {
      try {
        const currentUser = await fetchCurrentUser(stored.token);
        setUser(currentUser);
        userRef.current = currentUser;
        const persistedExpiresAt = stored.expiresAt ?? decodeTokenExpiration(stored.token);
        writeStoredAuth({
          token: stored.token,
          user: currentUser,
          timestamp: Date.now(),
          expiresAt: persistedExpiresAt ?? undefined,
        });
      } catch (error) {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          console.warn("Stored authentication token is no longer valid", error);
          handleLogout();
          return;
        }

        console.warn("Failed to validate stored token", error);
      } finally {
        setIsLoading(false);
      }
    };

    void validateToken();
  }, [handleLogout]);

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

  const refreshAuthToken = useCallback(async () => {
    if (!tokenRef.current || isRefreshingTokenRef.current) {
      return;
    }

    const lastActivity = readLastActivityTimestamp();
    const now = Date.now();

    if (lastActivity !== null && now - lastActivity >= DEFAULT_TIMEOUT_MS) {
      handleLogout();
      return;
    }

    isRefreshingTokenRef.current = true;
    let handledScheduling = false;

    try {
      const response = await refreshTokenRequest(tokenRef.current);
      const refreshTimestamp = Date.now();
      const newExpiresAt = resolveTokenExpiration(response.token, response.expiresIn, refreshTimestamp);

      setToken(response.token);
      tokenRef.current = response.token;
      setSessionExpiresAt(newExpiresAt ?? null);
      writeStoredAuth({
        token: response.token,
        user: userRef.current ?? undefined,
        timestamp: refreshTimestamp,
        expiresAt: newExpiresAt ?? undefined,
      });
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        console.warn("Token de autenticação expirado durante a renovação", error);
        handleLogout();
        handledScheduling = true;
      } else {
        console.error("Falha ao renovar token de autenticação", error);
        if (typeof window !== "undefined") {
          const retryDelay = (() => {
            if (sessionExpiresAt === null) {
              return TOKEN_REFRESH_RETRY_DELAY_MS;
            }
            const timeUntilExpiration = sessionExpiresAt - Date.now();
            if (!Number.isFinite(timeUntilExpiration) || timeUntilExpiration <= 1_000) {
              return 1_000;
            }
            return Math.max(
              1_000,
              Math.min(TOKEN_REFRESH_RETRY_DELAY_MS, timeUntilExpiration - 1_000),
            );
          })();
          clearRefreshTimeout();
          refreshTimeoutIdRef.current = window.setTimeout(() => {
            void refreshAuthToken();
          }, retryDelay);
          handledScheduling = true;
        }
      }
    } finally {
      isRefreshingTokenRef.current = false;
      if (!handledScheduling) {
        scheduleRefreshCallbackRef.current();
      }
    }
  }, [handleLogout, clearRefreshTimeout, sessionExpiresAt]);

  const scheduleTokenRefresh = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    clearRefreshTimeout();

    if (!tokenRef.current || !sessionExpiresAt) {
      return;
    }

    const now = Date.now();
    const refreshAt = sessionExpiresAt - TOKEN_REFRESH_THRESHOLD_MS;
    const delay = refreshAt - now;

    if (delay <= 0) {
      void refreshAuthToken();
      return;
    }

    refreshTimeoutIdRef.current = window.setTimeout(() => {
      void refreshAuthToken();
    }, delay);
  }, [sessionExpiresAt, clearRefreshTimeout, refreshAuthToken]);

  useEffect(() => {
    scheduleRefreshCallbackRef.current = scheduleTokenRefresh;
  }, [scheduleTokenRefresh]);

  useEffect(() => {
    scheduleTokenRefresh();
    return () => {
      clearRefreshTimeout();
    };
  }, [scheduleTokenRefresh, clearRefreshTimeout]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const response = await loginRequest(credentials);
    const loginTimestamp = Date.now();
    const expiresAt = resolveTokenExpiration(response.token, response.expiresIn, loginTimestamp);
    setToken(response.token);
    setUser(response.user);
    tokenRef.current = response.token;
    userRef.current = response.user;
    setSessionExpiresAt(expiresAt ?? null);
    writeStoredAuth({
      token: response.token,
      user: response.user,
      timestamp: loginTimestamp,
      expiresAt: expiresAt ?? undefined,
    });
    return response;
  }, []);

  const logout = useCallback(() => {
    handleLogout();
  }, [handleLogout]);

  const refreshUser = useCallback(async () => {
    const currentUser = await fetchCurrentUser(tokenRef.current ?? undefined);
    setUser(currentUser);
    userRef.current = currentUser;
    if (tokenRef.current) {
      writeStoredAuth({
        token: tokenRef.current,
        user: currentUser,
        timestamp: Date.now(),
        expiresAt: sessionExpiresAt ?? undefined,
      });
    }
    return currentUser;
  }, [sessionExpiresAt]);

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
