export const ASAAS_DEFAULT_BASE_URLS = {
  producao: 'https://www.asaas.com/api/v3',
  homologacao: 'https://sandbox.asaas.com/api/v3',
} as const;

export type AsaasEnvironment = keyof typeof ASAAS_DEFAULT_BASE_URLS;

const PRODUCAO_ALIASES = new Set(['producao', 'production', 'prod', 'live']);

export function normalizeAsaasEnvironment(value: string | null | undefined): AsaasEnvironment {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (normalized) {
      const withoutDiacritics = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      if (PRODUCAO_ALIASES.has(withoutDiacritics)) {
        return 'producao';
      }
    }
  }

  return 'homologacao';
}

export function normalizeAsaasBaseUrl(
  environment: AsaasEnvironment,
  apiUrl: string | null | undefined,
): string {
  const fallback = ASAAS_DEFAULT_BASE_URLS[environment];

  if (!apiUrl) {
    return fallback;
  }

  const trimmed = apiUrl.trim();
  if (!trimmed) {
    return fallback;
  }

  const withoutTrailingSlash = trimmed.replace(/\/+$/, '');

  try {
    const parsed = new URL(withoutTrailingSlash);
    if (parsed.hostname.endsWith('asaas.com')) {
      const pathname = parsed.pathname ?? '';

      if (/\/api\/v\d+$/i.test(pathname)) {
        return withoutTrailingSlash;
      }

      if (/\/api$/i.test(pathname)) {
        return `${withoutTrailingSlash}/v3`;
      }

      if (!pathname || pathname === '/') {
        return `${withoutTrailingSlash}/api/v3`;
      }

      if (!/\/api\//i.test(pathname)) {
        return `${withoutTrailingSlash}/api/v3`;
      }

      return withoutTrailingSlash;
    }
  } catch (error) {
    return fallback;
  }

  return withoutTrailingSlash;
}
