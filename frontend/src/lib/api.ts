const rawEnvApiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function stripApiSuffix(url: string): string {
  const normalized = normalizeBaseUrl(url);
  return normalized.toLowerCase().endsWith('/api')
    ? normalized.slice(0, -4)
    : normalized;
}

function resolveFallbackBaseUrl(): string {
  if (rawEnvApiUrl && rawEnvApiUrl.length > 0) {
    return stripApiSuffix(rawEnvApiUrl);
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return normalizeBaseUrl(window.location.origin);
  }

  return 'http://localhost:3001';
}

const API_BASE_URL = resolveFallbackBaseUrl();

function joinPaths(base: string, path?: string): string {
  const normalizedBase = base.replace(/\/+$/, '');

  if (!path) {
    return normalizedBase;
  }

  const normalizedPath = path.replace(/^\/+/, '');

  if (!normalizedPath) {
    return normalizedBase;
  }

  return `${normalizedBase}/${normalizedPath}`;
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

export function getApiUrl(path = ''): string {
  const apiRoot = joinPaths(API_BASE_URL, 'api');
  return path ? joinPaths(apiRoot, path) : apiRoot;
}

export function joinUrl(base: string, path = ''): string {
  return joinPaths(base, path);
}
