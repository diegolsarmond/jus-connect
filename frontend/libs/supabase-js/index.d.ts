export interface SupabaseUser {
  id: string;
  email: string;
  aud: string;
  role: string;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SupabaseSession {
  access_token: string;
  token_type: string;
  expires_in: number | null;
  expires_at: number | null;
  refresh_token: string | null;
  user: SupabaseUser;
}

export interface SignInWithPasswordCredentials {
  email: string;
  password: string;
}

export interface SignInWithPasswordData {
  user: SupabaseUser | null;
  session: SupabaseSession | null;
}

export interface SignInWithPasswordError {
  message: string;
  status?: number;
}

export interface SignInWithPasswordResponse {
  data: SignInWithPasswordData;
  error: SignInWithPasswordError | null;
}

export interface GetSessionResponse {
  data: { session: SupabaseSession | null };
  error: Error | null;
}

export interface OnAuthStateChangeSubscription {
  unsubscribe: () => void;
}

export interface OnAuthStateChangeResponse {
  data: { subscription: OnAuthStateChangeSubscription };
  error: Error | null;
}

export interface SupabaseAuthClient {
  signInWithPassword(credentials: SignInWithPasswordCredentials): Promise<SignInWithPasswordResponse>;
  getSession(): Promise<GetSessionResponse>;
  signOut(): Promise<{ error: Error | null }>;
  onAuthStateChange(callback: (event: string, session: SupabaseSession | null) => void): OnAuthStateChangeResponse;
  refreshSession(): Promise<GetSessionResponse>;
}

export interface SupabaseFunctionInvokeOptions {
  body?: unknown;
  method?: string;
  headers?: Record<string, string>;
}

export interface SupabaseFunctionInvokeResult<T = unknown> {
  data: T;
  error: Error | null;
}

export interface SupabaseFunctionsClient {
  invoke<T = unknown>(functionName: string, options?: SupabaseFunctionInvokeOptions): Promise<SupabaseFunctionInvokeResult<T>>;
}

export interface SupabaseClient {
  auth: SupabaseAuthClient;
  functions: SupabaseFunctionsClient;
}

export declare const createClient: (url: string, key?: string) => SupabaseClient;
