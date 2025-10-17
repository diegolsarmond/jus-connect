const getSupabaseUrl = () =>
  (import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.NEXT_PUBLIC_SUPABASE_URL) as string | undefined;
const getSupabaseKey = () =>
  (import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) as string | undefined;

type InvokeOptions = {
  body?: unknown;
  method?: string;
  headers?: Record<string, string>;
};

type InvokeResult<T> = {
  data: T | null;
  error: Error | null;
};

const invoke = async <T = unknown>(functionName: string, options: InvokeOptions = {}): Promise<InvokeResult<T>> => {
  const url = getSupabaseUrl();
  const key = getSupabaseKey();

  if (!url || !key) {
    return {
      data: null,
      error: new Error("Configurações do Supabase não encontradas"),
    };
  }

  const response = await fetch(`${url}/functions/v1/${functionName}`, {
    method: options.method ?? "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const contentType = response.headers.get("Content-Type") ?? "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json().catch(() => null) : await response.text();

  if (!response.ok) {
    const message = typeof payload === "string" ? payload : payload?.message || "Erro ao chamar função";
    return {
      data: payload as T,
      error: new Error(message),
    };
  }

  return {
    data: payload as T,
    error: null,
  };
};

export const supabase = {
  functions: {
    invoke,
  },
};
