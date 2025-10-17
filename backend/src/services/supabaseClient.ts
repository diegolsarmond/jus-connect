import { URLSearchParams } from 'url';

type SupabaseAdminGenerateLinkParams = {
  type: string;
  email: string;
  password?: string;
  data?: Record<string, unknown>;
  redirectTo?: string;
};

type SupabaseAdminGenerateLinkResponse = {
  action_link?: string;
  email_otp?: string;
  hashed_token?: string;
  redirect_to?: string;
  verification_type?: string;
  user?: {
    id?: string;
    email?: string | null;
    email_confirmed_at?: string | null;
  } | null;
};

type SupabaseAdminListUsersParams = {
  email?: string;
};

type SupabaseAdminUser = {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
};

type SupabaseAdminListUsersResponse = {
  users: SupabaseAdminUser[];
};

type SupabaseErrorResponse = {
  message: string;
  status?: number;
  error?: string;
};

type SupabaseResponse<T> = {
  data: T | null;
  error: SupabaseErrorResponse | null;
};

type SupabaseAdminApi = {
  generateLink: (
    params: SupabaseAdminGenerateLinkParams
  ) => Promise<SupabaseResponse<SupabaseAdminGenerateLinkResponse>>;
  listUsers: (
    params: SupabaseAdminListUsersParams
  ) => Promise<SupabaseResponse<SupabaseAdminListUsersResponse>>;
};

type SupabaseAuthApi = {
  admin: SupabaseAdminApi;
};

type SupabaseServiceRoleClient = {
  auth: SupabaseAuthApi;
};

let cachedClient: SupabaseServiceRoleClient | null = null;

const normalizeSupabaseUrl = (url: string): string => {
  const trimmed = url.trim();
  return trimmed.endsWith('/') ? trimmed.replace(/\/+$/, '') : trimmed;
};

const parseErrorPayload = (
  payload: unknown,
  status?: number
): SupabaseErrorResponse => {
  if (payload && typeof payload === 'object') {
    const messageCandidate = (payload as { message?: unknown }).message;
    if (typeof messageCandidate === 'string' && messageCandidate) {
      return { message: messageCandidate, status };
    }

    const errorCandidate = (payload as { error?: unknown }).error;
    if (typeof errorCandidate === 'string' && errorCandidate) {
      return { message: errorCandidate, status };
    }

    const errorDescription = (payload as { error_description?: unknown }).error_description;
    if (typeof errorDescription === 'string' && errorDescription) {
      return { message: errorDescription, status };
    }
  }

  if (typeof payload === 'string' && payload) {
    return { message: payload, status };
  }

  return { message: 'Falha ao comunicar com o Supabase.', status };
};

type SupabaseRequestInit = Omit<RequestInit, 'body'> & {
  body?: Record<string, unknown>;
};

const buildRequest = (baseUrl: string, serviceRoleKey: string) => {
  const headers: Record<string, string> = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const request = async <T>(
    path: string,
    init: SupabaseRequestInit = {}
  ): Promise<SupabaseResponse<T>> => {
    const { body, ...rest } = init;

    let response: Response;

    try {
      const requestInit: RequestInit = {
        ...rest,
        headers,
      };

      if (body && Object.keys(body).length > 0) {
        requestInit.body = JSON.stringify(body);
      }

      response = await fetch(`${baseUrl}${path}`, requestInit);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro inesperado.';
      return { data: null, error: { message } };
    }

    let parsed: unknown = null;

    try {
      const text = await response.text();
      parsed = text ? JSON.parse(text) : null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao interpretar resposta.';
      return { data: null, error: { message, status: response.status } };
    }

    if (!response.ok) {
      return { data: null, error: parseErrorPayload(parsed, response.status) };
    }

    return { data: (parsed as T) ?? null, error: null };
  };

  return { request };
};

const createSupabaseServiceRoleClient = (
  supabaseUrl: string,
  serviceRoleKey: string
): SupabaseServiceRoleClient => {
  const normalizedUrl = normalizeSupabaseUrl(supabaseUrl);
  const authBaseUrl = `${normalizedUrl}/auth/v1`;
  const { request } = buildRequest(authBaseUrl, serviceRoleKey);

  const generateLink: SupabaseAdminApi['generateLink'] = async (params) => {
    const body: Record<string, unknown> = {
      type: params.type,
      email: params.email,
    };

    if (params.password) {
      body.password = params.password;
    }

    if (params.data) {
      body.data = params.data;
    }

    if (params.redirectTo) {
      body.redirect_to = params.redirectTo;
    }

    return request('/admin/generate_link', {
      method: 'POST',
      body,
    });
  };

  const listUsers: SupabaseAdminApi['listUsers'] = async (params) => {
    const searchParams = new URLSearchParams();

    if (params.email) {
      searchParams.append('email', params.email);
    }

    const query = searchParams.toString();

    return request(`/admin/users${query ? `?${query}` : ''}`, {
      method: 'GET',
    });
  };

  return {
    auth: {
      admin: {
        generateLink,
        listUsers,
      },
    },
  };
};

export const getSupabaseServiceRoleClient = (): SupabaseServiceRoleClient | null => {
  if (cachedClient) {
    return cachedClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  cachedClient = createSupabaseServiceRoleClient(supabaseUrl, serviceRoleKey);
  return cachedClient;
};

export type {
  SupabaseAdminGenerateLinkResponse,
  SupabaseAdminUser,
  SupabaseResponse,
  SupabaseErrorResponse,
  SupabaseServiceRoleClient,
};
