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
import { LAST_ACTIVITY_KEY } from "@/hooks/useAutoLogout";
import { fetchCurrentUser, loginRequest } from "./api";
import type { AuthUser, LoginCredentials, LoginResponse } from "./types";

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
      ...parsed,
      user: sanitizedUser,
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
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, user }));
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
  const hasUnauthorizedErrorRef = useRef(false);
  const apiBaseUrlRef = useRef(getApiBaseUrl());

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const handleLogout = useCallback(() => {
    setUser(null);
    setToken(null);
    setIsLoading(false);
    hasUnauthorizedErrorRef.current = false;
    tokenRef.current = null;
    writeStoredAuth(null);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(LAST_ACTIVITY_KEY);
      } catch (error) {
        console.warn("Falha ao limpar registro de atividade", error);
      }
    }
  }, []);

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
    if (stored.user) {
      setUser(stored.user);
    }

    const validateToken = async () => {
      try {
        const currentUser = await fetchCurrentUser(stored.token);
        setUser(currentUser);
        writeStoredAuth({ token: stored.token, user: currentUser, timestamp: Date.now() });
      } catch (error) {
        console.warn("Failed to validate stored token", error);
        handleLogout();
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

  const login = useCallback(async (credentials: LoginCredentials) => {
    const response = await loginRequest(credentials);
    setToken(response.token);
    setUser(response.user);
    tokenRef.current = response.token;
    writeStoredAuth({ token: response.token, user: response.user, timestamp: Date.now() });
    return response;
  }, []);

  const logout = useCallback(() => {
    handleLogout();
  }, [handleLogout]);

  const refreshUser = useCallback(async () => {
    const currentUser = await fetchCurrentUser(tokenRef.current ?? undefined);
    setUser(currentUser);
    if (tokenRef.current) {
      writeStoredAuth({ token: tokenRef.current, user: currentUser, timestamp: Date.now() });
    }
    return currentUser;
  }, []);

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
