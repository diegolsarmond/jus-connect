import { getApiUrl } from './api';

export const API_KEY_PROVIDERS = ['gemini', 'openai', 'asaas', 'judit'] as const;
export type ApiKeyProvider = (typeof API_KEY_PROVIDERS)[number];

export const API_KEY_PROVIDER_LABELS: Record<ApiKeyProvider, string> = {
  gemini: 'Gemini',
  openai: 'OpenAI',
  asaas: 'Asaas',
  judit: 'JUDIT',
};

export const API_KEY_ENVIRONMENTS = ['producao', 'homologacao'] as const;
export type ApiKeyEnvironment = (typeof API_KEY_ENVIRONMENTS)[number];

export interface IntegrationApiKey {
  id: number;
  provider: string;
  apiUrl: string | null;
  key: string;
  environment: string;
  active: boolean;
  lastUsed: string | null;
  createdAt: string;
  updatedAt: string;
}

export const API_KEY_ENVIRONMENT_LABELS: Record<ApiKeyEnvironment, string> = {
  producao: 'Produção',
  homologacao: 'Sandbox',
};

export function getApiKeyProviderLabel(provider: string): string {
  if (typeof provider !== 'string') {
    return '';
  }

  const normalized = provider.trim().toLowerCase();
  if (normalized in API_KEY_PROVIDER_LABELS) {
    return API_KEY_PROVIDER_LABELS[normalized as ApiKeyProvider];
  }

  return provider.trim() || provider;
}

export function getApiKeyEnvironmentLabel(environment: string): string {
  if (typeof environment !== 'string') {
    return '';
  }

  const normalized = environment.trim().toLowerCase();
  if (normalized in API_KEY_ENVIRONMENT_LABELS) {
    return API_KEY_ENVIRONMENT_LABELS[normalized as ApiKeyEnvironment];
  }

  return environment.trim() || environment;
}

export interface CreateIntegrationApiKeyPayload {
  provider: ApiKeyProvider;
  apiUrl?: string | null;
  key: string;
  environment: ApiKeyEnvironment;
  active?: boolean;
  lastUsed?: string | null;
}

export interface UpdateIntegrationApiKeyPayload {
  provider?: ApiKeyProvider;
  apiUrl?: string | null;
  key?: string;
  environment?: ApiKeyEnvironment;
  active?: boolean;
  lastUsed?: string | null;
}

export interface GenerateAiTextPayload {
  integrationId: number;
  documentType: string;
  prompt: string;
}

export interface GenerateAiTextResponse {
  content: string;
  documentType: string;
  provider: ApiKeyProvider;
}

const API_KEYS_ENDPOINT = getApiUrl('integrations/api-keys');
const ASAAS_VALIDATION_ENDPOINT = getApiUrl('integrations/providers/asaas/validate');

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const payload = await response.json();
    if (payload && typeof payload === 'object' && 'error' in payload) {
      const { error } = payload as { error?: unknown };
      if (typeof error === 'string' && error.trim()) {
        return error;
      }
    }
  } catch (error) {
    // ignore JSON parsing issues
  }

  return `Falha na requisição (status ${response.status})`;
}

export async function fetchIntegrationApiKeys(): Promise<IntegrationApiKey[]> {
  const response = await fetch(API_KEYS_ENDPOINT, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  const data = (await response.json()) as IntegrationApiKey[];
  return data;
}

export async function fetchIntegrationApiKey(id: number): Promise<IntegrationApiKey> {
  const response = await fetch(`${API_KEYS_ENDPOINT}/${id}`, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as IntegrationApiKey;
}

export async function createIntegrationApiKey(
  payload: CreateIntegrationApiKeyPayload,
): Promise<IntegrationApiKey> {
  const response = await fetch(API_KEYS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as IntegrationApiKey;
}

export async function updateIntegrationApiKey(
  id: number,
  updates: UpdateIntegrationApiKeyPayload,
): Promise<IntegrationApiKey> {
  const response = await fetch(`${API_KEYS_ENDPOINT}/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as IntegrationApiKey;
}

export async function deleteIntegrationApiKey(id: number): Promise<void> {
  const response = await fetch(`${API_KEYS_ENDPOINT}/${id}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
}

export interface ValidateAsaasIntegrationResponse {
  success: boolean;
  message?: string;
}

export async function validateAsaasIntegrationApiKey(
  apiKeyId: number,
): Promise<ValidateAsaasIntegrationResponse> {
  const response = await fetch(ASAAS_VALIDATION_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ apiKeyId }),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  if (response.status === 204) {
    return { success: true };
  }

  try {
    const payload = (await response.json()) as Partial<ValidateAsaasIntegrationResponse> | null;
    if (payload && typeof payload === 'object') {
      const success = typeof payload.success === 'boolean' ? payload.success : true;
      const message = typeof payload.message === 'string' ? payload.message : undefined;
      return { success, message };
    }
  } catch (error) {
    // ignore JSON parsing issues and fall back to success state
  }

  return { success: true };
}

export async function generateAiText(payload: GenerateAiTextPayload): Promise<GenerateAiTextResponse> {
  const response = await fetch(getApiUrl('integrations/ai/generate'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as GenerateAiTextResponse;
}
