export type AuthChangeEvent =
  | "INITIAL_SESSION"
  | "SIGNED_IN"
  | "SIGNED_OUT"
  | "TOKEN_REFRESHED"
  | "USER_UPDATED";

export interface Identity {
  id?: string;
  identity_id?: string;
  provider?: string;
  last_sign_in_at?: string | null;
  [key: string]: unknown;
}

export interface User {
  id: string;
  email?: string | null;
  phone?: string | null;
  user_metadata: Record<string, unknown>;
  app_metadata: Record<string, unknown>;
  identities?: Identity[] | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface Session {
  access_token: string;
  refresh_token: string | null;
  expires_in: number | null;
  expires_at: number | null;
  token_type: string;
  user: User;
  [key: string]: unknown;
}

export interface AuthResponse {
  session: Session | null;
  user: User | null;
}

export interface AuthError {
  message: string;
  status?: number;
}

export interface SignInWithPasswordCredentials {
  email: string;
  password: string;
}

export interface AuthSubscription {
  unsubscribe: () => void;
}

export interface AuthChangeResponse {
  data: { subscription: AuthSubscription };
  error: AuthError | null;
}

export interface SignInWithPasswordResponse {
  data: AuthResponse;
  error: AuthError | null;
}

export interface GetSessionResponse {
  data: { session: Session | null };
  error: AuthError | null;
}

export interface SignOutResponse {
  error: AuthError | null;
}

export interface FunctionsInvokeOptions {
  body?: unknown;
  method?: string;
  headers?: Record<string, string>;
}

export interface FunctionsResponse<T = unknown> {
  data: T | null;
  error: AuthError | null;
}

export interface SupabaseLikeClient {
  auth: {
    signInWithPassword(credentials: SignInWithPasswordCredentials): Promise<SignInWithPasswordResponse>;
    getSession(): Promise<GetSessionResponse>;
    signOut(): Promise<SignOutResponse>;
    onAuthStateChange(
      callback: (event: AuthChangeEvent, session: Session | null) => void,
    ): Promise<AuthChangeResponse>;
  };
  functions: {
    invoke<T = unknown>(
      functionName: string,
      options?: FunctionsInvokeOptions,
    ): Promise<FunctionsResponse<T>>;
  };
}
