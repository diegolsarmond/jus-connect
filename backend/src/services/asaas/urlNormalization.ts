export const ASAAS_DEFAULT_BASE_URLS = {
  producao: 'https://www.asaas.com/api/v3',
  homologacao: 'https://sandbox.asaas.com/api/v3',
} as const;

export type AsaasEnvironment = keyof typeof ASAAS_DEFAULT_BASE_URLS;

const PRODUCAO_ALIASES = new Set(['producao', 'production', 'prod', 'live']);

const stripDiacritics = (value: string): string =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const isKnownEnvironment = (value: string): value is AsaasEnvironment =>
  Object.prototype.hasOwnProperty.call(ASAAS_DEFAULT_BASE_URLS, value);

const resolveKnownEnvironment = (value: string): AsaasEnvironment | null => {
  const trimmed = value.trim().toLowerCase();

  if (!trimmed) {
    return null;
  }

  if (isKnownEnvironment(trimmed)) {
    return trimmed;
  }

  const withoutDiacritics = stripDiacritics(trimmed);

  if (isKnownEnvironment(withoutDiacritics)) {
    return withoutDiacritics;
  }

  if (PRODUCAO_ALIASES.has(withoutDiacritics)) {
    return 'producao';
  }

  return null;
};

export function resolveAsaasEnvironment(
  value: string | null | undefined,
): AsaasEnvironment | null {
  if (typeof value !== 'string') {
    return null;
  }

  return resolveKnownEnvironment(value);
}

export function normalizeAsaasEnvironment(value: string | null | undefined): AsaasEnvironment {
  return resolveAsaasEnvironment(value) ?? 'homologacao';
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
