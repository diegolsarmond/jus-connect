const envApiUrlCandidates = [
  import.meta.env.VITE_API_URL as string | undefined,
  import.meta.env.VITE_API_BASE_URL as string | undefined,
];

const PRODUCTION_DEFAULT_API_URL = 'https://quantumtecnologia.com.br';

const rawEnvApiUrl = envApiUrlCandidates
  .map((value) => value?.trim())
  .find((value): value is string => Boolean(value?.length));
const isDevEnvironment = Boolean(import.meta.env.DEV);

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

  if (isDevEnvironment) {
    // Durante o desenvolvimento o frontend roda em uma porta distinta do backend
    // (por padrão 5173), portanto precisamos garantir que as requisições sejam
    // direcionadas ao servidor de API local.
    return 'http://localhost:3001';
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return normalizeBaseUrl(window.location.origin);
  }

  return PRODUCTION_DEFAULT_API_URL;
}

let cachedApiBaseUrl: string | undefined;

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

function resolveApiBaseUrl(): string {
  if (!cachedApiBaseUrl) {
    cachedApiBaseUrl = resolveFallbackBaseUrl();
  }

  return cachedApiBaseUrl;
}

export function getApiBaseUrl(): string {
  return resolveApiBaseUrl();
}

export function getApiUrl(path = ''): string {
  const apiRoot = joinPaths(resolveApiBaseUrl(), 'api');
  return path ? joinPaths(apiRoot, path) : apiRoot;
}

export function joinUrl(base: string, path = ''): string {
  return joinPaths(base, path);
}
