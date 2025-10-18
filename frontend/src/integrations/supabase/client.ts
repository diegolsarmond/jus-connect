import type {
  AuthChangeEvent,
  AuthError,
  AuthResponse,
  Session,
  SignInWithPasswordCredentials,
  SupabaseLikeClient,
} from "./types";

const getEnvValue = (key: string): string | undefined => {
  try {
    const metaEnv = (import.meta as { env?: Record<string, unknown> } | undefined)?.env;
    const candidate = metaEnv?.[key];
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate;
    }
  } catch {}

  const value = (typeof process !== "undefined" ? process.env?.[key] : undefined) ?? undefined;
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  return undefined;
};

const getSupabaseUrl = () =>
  getEnvValue("VITE_SUPABASE_URL") ?? getEnvValue("NEXT_PUBLIC_SUPABASE_URL");
const getSupabaseKey = () =>
  getEnvValue("VITE_SUPABASE_ANON_KEY") ?? getEnvValue("NEXT_PUBLIC_SUPABASE_ANON_KEY");

const storageKey = "jus-connect:supabase:session";

const parseAuthError = async (response: Response): Promise<AuthError> => {
  try {
    const data = await response.json();
    const message =
      (typeof data?.error === "string" && data.error.trim().length > 0 && data.error.trim()) ||
      (typeof data?.msg === "string" && data.msg.trim().length > 0 && data.msg.trim()) ||
      (typeof data?.message === "string" && data.message.trim().length > 0 && data.message.trim()) ||
      "Falha ao concluir a solicitação.";
    return { message, status: response.status };
  } catch {
    return { message: "Falha ao concluir a solicitação.", status: response.status };
  }
};

const parseJson = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  if (!text) {
    return {} as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    console.warn("Resposta JSON inválida do Supabase", error);
    throw error;
  }
};

interface RawSession {
  access_token?: string;
  refresh_token?: string | null;
  expires_in?: number | null;
  expires_at?: number | null;
  token_type?: string;
  user?: Record<string, unknown> | null;
}

interface RawAuthResponse {
  session?: RawSession | null;
  user?: Record<string, unknown> | null;
  access_token?: string;
  refresh_token?: string | null;
  expires_in?: number | null;
  expires_at?: number | null;
  token_type?: string;
}

const sanitizeNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const parseSession = (payload: RawSession | RawAuthResponse | null | undefined): Session | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as RawSession & RawAuthResponse;
  const accessToken = typeof record.access_token === "string" ? record.access_token : null;
  const user = record.user && typeof record.user === "object" ? (record.user as Session["user"]) : null;

  if (!accessToken || !user) {
    return null;
  }

  return {
    access_token: accessToken,
    refresh_token: typeof record.refresh_token === "string" ? record.refresh_token : null,
    expires_in: sanitizeNumber(record.expires_in),
    expires_at: sanitizeNumber(record.expires_at),
    token_type: typeof record.token_type === "string" && record.token_type ? record.token_type : "bearer",
    user,
  } satisfies Session;
};

const parseAuthResponse = (payload: RawAuthResponse): AuthResponse => {
  const session = parseSession(payload.session ?? payload);
  const user = (session?.user ?? (payload.user as Session["user"] | null)) ?? null;
  return { session, user } satisfies AuthResponse;
};

const readSessionFromStorage = (): Session | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }
    return parseSession(JSON.parse(raw) as RawSession);
  } catch (error) {
    console.warn("Falha ao ler sessão do Supabase do armazenamento", error);
    return null;
  }
};

const writeSessionToStorage = (session: Session | null) => {
  if (typeof window === "undefined") {
    return;
  }
  if (!session) {
    window.localStorage.removeItem(storageKey);
    return;
  }
  window.localStorage.setItem(storageKey, JSON.stringify(session));
};

const listeners = new Set<(event: AuthChangeEvent, session: Session | null) => void>();

const notifyListeners = (event: AuthChangeEvent, session: Session | null) => {
  listeners.forEach((listener) => {
    try {
      listener(event, session);
    } catch (error) {
      console.error("Listener de sessão do Supabase falhou", error);
    }
  });
};

const supabaseUrl = getSupabaseUrl();
const supabaseKey = getSupabaseKey();

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Configurações do Supabase não encontradas");
}

let currentSession: Session | null = readSessionFromStorage();

let refreshTimeout: ReturnType<typeof setTimeout> | null = null;

const clearAutoRefresh = () => {
  if (refreshTimeout !== null) {
    clearTimeout(refreshTimeout);
    refreshTimeout = null;
  }
};

const scheduleAutoRefresh = (session: Session | null) => {
  clearAutoRefresh();
  if (!session?.expires_at || !session.refresh_token) {
    return;
  }
  const now = Math.floor(Date.now() / 1000);
  const secondsUntilRefresh = Math.max(session.expires_at - now - 60, 5);
  refreshTimeout = setTimeout(() => {
    void refreshSession(session.refresh_token, true);
  }, secondsUntilRefresh * 1000);
};

const buildHeaders = (token?: string) => {
  const headers = new Headers({
    apikey: supabaseKey,
    Accept: "application/json",
  });
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
};

const clearSession = (event: AuthChangeEvent = "SIGNED_OUT") => {
  currentSession = null;
  writeSessionToStorage(null);
  clearAutoRefresh();
  notifyListeners(event, null);
};

const shouldRefreshSession = (session: Session | null) => {
  if (!session?.expires_at) {
    return false;
  }
  const now = Math.floor(Date.now() / 1000);
  return session.expires_at <= now + 60;
};

async function refreshSession(refreshToken: string | null, silent?: boolean): Promise<AuthResponse | null> {
  if (!refreshToken) {
    return null;
  }

  let response: Response;
  try {
    response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  } catch (error) {
    if (!silent) {
      console.warn("Falha ao comunicar com o Supabase", error);
    }
    clearSession();
    return null;
  }

  if (!response.ok) {
    const error = await parseAuthError(response);
    if (!silent) {
      console.warn("Falha ao atualizar sessão do Supabase", error);
    }
    clearSession();
    return null;
  }

  const data = parseAuthResponse(await parseJson<RawAuthResponse>(response));
  currentSession = data.session;
  writeSessionToStorage(currentSession);
  if (currentSession) {
    notifyListeners("TOKEN_REFRESHED", currentSession);
  }
  scheduleAutoRefresh(currentSession);
  return data;
}

const createAuthClient = (): SupabaseLikeClient["auth"] => ({
  async signInWithPassword(credentials: SignInWithPasswordCredentials) {
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify({ email: credentials.email, password: credentials.password }),
    });

    if (!response.ok) {
      const error = await parseAuthError(response);
      return { data: { session: null, user: null }, error };
    }

    const data = parseAuthResponse(await parseJson<RawAuthResponse>(response));
    currentSession = data.session;
    writeSessionToStorage(currentSession);
    if (currentSession) {
      notifyListeners("SIGNED_IN", currentSession);
    }

    scheduleAutoRefresh(currentSession);

    return { data, error: null };
  },
  async getSession() {
    if (!currentSession) {
      currentSession = readSessionFromStorage();
    }

    if (currentSession && shouldRefreshSession(currentSession)) {
      const refreshed = await refreshSession(currentSession.refresh_token);
      if (refreshed) {
        return { data: { session: refreshed.session }, error: null };
      }
    }

    return { data: { session: currentSession }, error: null };
  },
  async signOut() {
    const session = currentSession;

    if (session) {
      const response = await fetch(`${supabaseUrl}/auth/v1/logout`, {
        method: "POST",
        headers: buildHeaders(session.access_token),
      });

      if (!response.ok) {
        const error = await parseAuthError(response);
        clearSession();
        return { error };
      }
    }

    clearSession();
    return { error: null };
  },
  async onAuthStateChange(callback) {
    listeners.add(callback);
    callback("INITIAL_SESSION", currentSession);
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            listeners.delete(callback);
          },
        },
      },
      error: null,
    };
  },
});

const createFunctionsClient = (): SupabaseLikeClient["functions"] => ({
  async invoke(functionName, options = {}) {
    const url = `${supabaseUrl}/functions/v1/${functionName}`;
    const headers = new Headers(options.headers ?? {});
    headers.set("apikey", supabaseKey);
    if (currentSession?.access_token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${currentSession.access_token}`);
    }

    const method = options.method ?? (options.body ? "POST" : "GET");
    let body = options.body as BodyInit | undefined;

    if (body && typeof body === "object" && !(body instanceof FormData) && !(body instanceof Blob)) {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, { method, headers, body });
      if (!response.ok) {
        const error = await parseAuthError(response);
        return { data: null, error };
      }
      const resultText = await response.text();
      if (!resultText) {
        return { data: null, error: null };
      }
      try {
        return { data: JSON.parse(resultText), error: null };
      } catch {
        return { data: resultText as unknown, error: null };
      }
    } catch (error) {
      return {
        data: null,
        error: {
          message: error instanceof Error ? error.message : "Falha ao chamar função do Supabase.",
        },
      };
    }
  },
});

export const supabase: SupabaseLikeClient = {
  auth: createAuthClient(),
  functions: createFunctionsClient(),
};

scheduleAutoRefresh(currentSession);

export const invoke = async <T = unknown>(functionName: string, options: {
  body?: unknown;
  method?: string;
  headers?: Record<string, string>;
} = {}) => {
  const { data, error } = await supabase.functions.invoke(functionName, options);
  return { data: (data as T | null) ?? null, error };
};
