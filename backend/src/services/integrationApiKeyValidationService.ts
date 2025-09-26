import IntegrationApiKeyService, {
  IntegrationApiKey,
  ValidationError,
} from './integrationApiKeyService';
import {
  ASAAS_DEFAULT_BASE_URLS,
  AsaasEnvironment,
  normalizeAsaasBaseUrl,
} from './asaas/urlNormalization';

export interface ValidateAsaasIntegrationResult {
  success: boolean;
  message?: string;
}

type FetchFn = (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

function resolveAsaasApiUrl(environment: string, apiUrl: string | null): string {
  const normalizedEnvironment = typeof environment === 'string' ? environment.trim().toLowerCase() : '';
  if (!normalizedEnvironment) {
    throw new ValidationError('Unable to determine Asaas API URL for this integration');
  }

  if (!Object.prototype.hasOwnProperty.call(ASAAS_DEFAULT_BASE_URLS, normalizedEnvironment)) {
    throw new ValidationError('Unable to determine Asaas API URL for this integration');
  }

  const trimmedApiUrl = typeof apiUrl === 'string' ? apiUrl.trim() : '';
  if (trimmedApiUrl) {
    try {
      new URL(trimmedApiUrl);
    } catch (error) {
      throw new ValidationError('Invalid Asaas API URL configured');
    }
  }

  return normalizeAsaasBaseUrl(
    normalizedEnvironment as AsaasEnvironment,
    trimmedApiUrl ? trimmedApiUrl : null,
  );
}

function buildValidationUrl(baseUrl: string): string {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

  try {
    const url = new URL('customers?limit=1', normalizedBase);
    return url.toString();
  } catch (error) {
    throw new ValidationError('Invalid Asaas API URL configured');
  }
}

function parseErrorMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') {
    if (typeof payload === 'string' && payload.trim()) {
      return payload.trim();
    }
    return undefined;
  }

  if ('message' in payload && typeof (payload as any).message === 'string' && (payload as any).message.trim()) {
    return ((payload as any).message as string).trim();
  }

  if ('error' in payload && typeof (payload as any).error === 'string' && (payload as any).error.trim()) {
    return ((payload as any).error as string).trim();
  }

  if (Array.isArray((payload as any).errors)) {
    for (const item of (payload as any).errors) {
      if (!item) {
        continue;
      }
      if (typeof item === 'string' && item.trim()) {
        return item.trim();
      }
      if (typeof item === 'object') {
        if ('description' in item && typeof (item as any).description === 'string' && (item as any).description.trim()) {
          return ((item as any).description as string).trim();
        }
        if ('message' in item && typeof (item as any).message === 'string' && (item as any).message.trim()) {
          return ((item as any).message as string).trim();
        }
        if ('error' in item && typeof (item as any).error === 'string' && (item as any).error.trim()) {
          return ((item as any).error as string).trim();
        }
      }
    }
  }

  return undefined;
}

export default class IntegrationApiKeyValidationService {
  constructor(
    private readonly apiKeyService: Pick<IntegrationApiKeyService, 'findById'> = new IntegrationApiKeyService(),
    private readonly fetchImpl: FetchFn = (globalThis.fetch as FetchFn) ?? (async () => {
      throw new Error('Fetch API is not available');
    })
  ) {}

  async validateAsaas(
    apiKeyId: number,
    scope: { empresaId: number },
  ): Promise<ValidateAsaasIntegrationResult> {
    if (!Number.isInteger(apiKeyId) || apiKeyId <= 0) {
      throw new ValidationError('Invalid API key id');
    }

    const apiKey = await this.apiKeyService.findById(apiKeyId, scope);
    if (!apiKey) {
      throw new ValidationError('Asaas API key not found');
    }

    if (apiKey.provider !== 'asaas') {
      throw new ValidationError('API key provider must be Asaas');
    }

    const baseUrl = resolveAsaasApiUrl(apiKey.environment, apiKey.apiUrl);
    const requestUrl = buildValidationUrl(baseUrl);

    const headers = {
      Accept: 'application/json',
      access_token: typeof apiKey.key === 'string' ? apiKey.key : '',
    } as Record<string, string>;

    try {
      const response = await this.fetchImpl(requestUrl, {
        method: 'GET',
        headers,
      });

      if (response.ok) {
        return { success: true };
      }

      try {
        const payload = await response.json();
        const message = parseErrorMessage(payload);
        if (message) {
          return { success: false, message };
        }
      } catch (error) {
        // Ignore body parsing issues and fall back to default message
      }

      return {
        success: false,
        message: `Asaas API request failed with status ${response.status}`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        message: `Unable to connect to Asaas API: ${message}`,
      };
    }
  }
}

export type { IntegrationApiKey };
