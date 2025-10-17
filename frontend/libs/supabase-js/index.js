const TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000;
const MIN_REFRESH_DELAY_MS = 1_000;
const SESSION_STORAGE_KEY = "supabase-js:session";

export class AuthError extends Error {
  constructor(message, status) {
    super(typeof message === "string" && message ? message : "Erro de autenticação");
    this.name = "AuthError";
    this.status = typeof status === "number" && Number.isFinite(status) ? status : 0;
  }
}

const readStoredSession = () => {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw);
  } catch (error) {
    console.warn("Falha ao restaurar sessão armazenada", error);
    return null;
  }
};

const writeStoredSession = (session) => {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch (error) {
    console.warn("Falha ao persistir sessão", error);
  }
};

const clearStoredSession = () => {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (error) {
    console.warn("Falha ao limpar sessão armazenada", error);
  }
};

const nowIso = () => new Date().toISOString();

const buildSupabaseUser = (payload, fallbackEmail) => {
  const metadata = payload && typeof payload === "object" ? payload : {};
  const email = typeof metadata.email === "string" && metadata.email.trim().length > 0
    ? metadata.email.trim()
    : typeof fallbackEmail === "string"
      ? fallbackEmail
      : "";
  const idValue = metadata.id ?? metadata.userId ?? metadata.user_id ?? metadata.profileId ?? metadata.profile_id;
  const id = typeof idValue === "number"
    ? idValue
    : typeof idValue === "string"
      ? Number.parseInt(idValue, 10)
      : undefined;
  const supabaseId = metadata.supabase_user_id ?? metadata.supabaseUserId ?? metadata.supabaseId;
  const normalizedId = typeof supabaseId === "string" && supabaseId ? supabaseId : (Number.isFinite(id) ? String(id) : (email ? `local-${email}` : "local-user"));
  return {
    id: normalizedId,
    email,
    aud: "authenticated",
    role: "authenticated",
    app_metadata: {},
    user_metadata: metadata,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
};

const resolveExpiresAt = (expiresInSeconds) => {
  if (typeof expiresInSeconds === "number" && Number.isFinite(expiresInSeconds) && expiresInSeconds > 0) {
    return Math.floor((Date.now() + expiresInSeconds * 1000) / 1000);
  }
  return null;
};

class SupabaseAuth {
  constructor(baseUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.session = null;
    this.refreshTimeoutId = null;
    this.listeners = new Set();
    this.restoreSession();
  }

  restoreSession() {
    const stored = readStoredSession();
    if (stored && stored.access_token) {
      this.session = stored;
      this.scheduleRefresh(stored);
    }
  }

  onAuthStateChange(callback) {
    if (typeof callback !== "function") {
      return { data: { subscription: { unsubscribe() {} } }, error: new Error("Invalid callback") };
    }

    const subscription = {
      unsubscribe: () => {
        this.listeners.delete(callback);
      },
    };

    this.listeners.add(callback);

    return { data: { subscription }, error: null };
  }

  notify(event, session) {
    for (const listener of this.listeners) {
      try {
        listener(event, session ?? null);
      } catch (error) {
        console.error("Supabase auth listener failed", error);
      }
    }
  }

  clearRefreshTimeout() {
    if (this.refreshTimeoutId !== null) {
      clearTimeout(this.refreshTimeoutId);
      this.refreshTimeoutId = null;
    }
  }

  scheduleRefresh(session) {
    this.clearRefreshTimeout();

    if (!session || typeof session.access_token !== "string") {
      return;
    }

    const expiresAtSeconds = typeof session.expires_at === "number" ? session.expires_at : null;
    const expiresInSeconds = typeof session.expires_in === "number" ? session.expires_in : null;

    let refreshDelay = null;

    if (expiresAtSeconds) {
      refreshDelay = expiresAtSeconds * 1000 - TOKEN_REFRESH_THRESHOLD_MS - Date.now();
    } else if (expiresInSeconds) {
      refreshDelay = expiresInSeconds * 1000 - TOKEN_REFRESH_THRESHOLD_MS;
    }

    if (refreshDelay === null || !Number.isFinite(refreshDelay)) {
      return;
    }

    const normalizedDelay = Math.max(MIN_REFRESH_DELAY_MS, refreshDelay);

    this.refreshTimeoutId = setTimeout(() => {
      this.refreshSession().catch((error) => {
        console.error("Falha ao atualizar sessão Supabase simulada", error);
      });
    }, normalizedDelay);
  }

  async refreshSession() {
    if (!this.session || typeof this.session.access_token !== "string") {
      return { data: { session: null }, error: new Error("Sessão inexistente") };
    }

    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.session.access_token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          this.clearSession();
          return { data: { session: null }, error: new Error("Sessão expirada") };
        }

        const message = await response.text().catch(() => "Erro ao renovar sessão");
        throw new Error(typeof message === "string" && message ? message : "Erro ao renovar sessão");
      }

      const payload = await response.json();
      const token = typeof payload?.token === "string" ? payload.token : null;
      const expiresIn = typeof payload?.expiresIn === "number" ? payload.expiresIn : null;

      if (!token) {
        throw new Error("Resposta de renovação inválida");
      }

      const expiresAt = resolveExpiresAt(expiresIn ?? this.session.expires_in ?? null);

      const updatedSession = {
        ...this.session,
        access_token: token,
        expires_in: expiresIn ?? this.session.expires_in ?? null,
        expires_at: expiresAt ?? this.session.expires_at ?? null,
        refresh_token: token,
      };

      this.session = updatedSession;
      writeStoredSession(updatedSession);
      this.scheduleRefresh(updatedSession);
      this.notify("TOKEN_REFRESHED", updatedSession);

      return { data: { session: updatedSession }, error: null };
    } catch (error) {
      console.error("Falha ao renovar sessão simulada do Supabase", error);
      return { data: { session: null }, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  clearSession() {
    this.clearRefreshTimeout();
    this.session = null;
    clearStoredSession();
    this.notify("SIGNED_OUT", null);
  }

  async signInWithPassword(credentials) {
    const email = credentials?.email ?? "";
    const password = credentials?.password ?? "";

    try {
      const response = await fetch(`${this.baseUrl}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ email, senha: password }),
      });

      if (!response.ok) {
        const message = await response.text().catch(() => "Credenciais inválidas");
        return {
          data: { user: null, session: null },
          error: new AuthError(
            typeof message === "string" && message ? message : "Credenciais inválidas",
            response.status,
          ),
        };
      }

      const payload = await response.json();
      const token = typeof payload?.token === "string" ? payload.token : null;
      const expiresIn = typeof payload?.expiresIn === "number" ? payload.expiresIn : null;
      const userPayload = payload?.user ?? null;

      if (!token) {
        return {
          data: { user: null, session: null },
          error: new AuthError("Resposta de autenticação inválida", 500),
        };
      }

      const supabaseUser = buildSupabaseUser(userPayload, email);
      const expiresAt = resolveExpiresAt(expiresIn);

      const session = {
        access_token: token,
        token_type: "bearer",
        expires_in: expiresIn ?? null,
        expires_at: expiresAt ?? null,
        refresh_token: token,
        user: supabaseUser,
      };

      this.session = session;
      writeStoredSession(session);
      this.scheduleRefresh(session);
      this.notify("SIGNED_IN", session);

      return { data: { user: supabaseUser, session }, error: null };
    } catch (error) {
      return {
        data: { user: null, session: null },
        error: new AuthError(error instanceof Error ? error.message : "Erro desconhecido", 500),
      };
    }
  }

  async getSession() {
    if (!this.session) {
      this.restoreSession();
    }
    return { data: { session: this.session }, error: null };
  }

  async signOut() {
    this.clearSession();
    return { error: null };
  }
}

class SupabaseClient {
  constructor(url, key) {
    if (!url || typeof url !== "string") {
      throw new Error("Supabase URL inválida");
    }

    this.auth = new SupabaseAuth(url);
    this.functions = {
      invoke: async (functionName, options = {}) => {
        const fetchUrl = `${url.replace(/\/$/, "")}/functions/v1/${functionName}`;
        const response = await fetch(fetchUrl, {
          method: options.method ?? "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: key ?? "",
            Authorization: `Bearer ${key ?? ""}`,
            ...options.headers,
          },
          body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        });

        const contentType = response.headers.get("Content-Type") ?? "";
        const isJson = contentType.includes("application/json");
        const data = isJson ? await response.json().catch(() => null) : await response.text();

        if (!response.ok) {
          const message = typeof data === "string" ? data : data?.message || "Erro ao chamar função";
          return { data, error: new Error(message) };
        }

        return { data, error: null };
      },
    };
  }
}

export const createClient = (url, key) => new SupabaseClient(url, key);
