import { createClient } from "@supabase/supabase-js";

const getSupabaseUrl = () =>
  (import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.NEXT_PUBLIC_SUPABASE_URL) as string | undefined;
const getSupabaseKey = () =>
  (import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) as
    | string
    | undefined;

const supabaseUrl = getSupabaseUrl();
const supabaseKey = getSupabaseKey();

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Configurações do Supabase não encontradas");
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const invoke = async <T = unknown>(functionName: string, options: {
  body?: unknown;
  method?: string;
  headers?: Record<string, string>;
} = {}) => {
  const { data, error } = await supabase.functions.invoke<T>(functionName, options);
  return { data: (data as T | null) ?? null, error };
};
