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

const LOCAL_HOSTNAME_PATTERNS = [
  'localhost',
  '127.0.0.1',
  '::1',
];

function isLocalhostUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    const normalizedHostname = hostname.toLowerCase();

    return (
      LOCAL_HOSTNAME_PATTERNS.includes(normalizedHostname) ||
      normalizedHostname.endsWith('.localhost')
    );
  } catch {
    return /(^|@|\b)(localhost|127\.0\.0\.1|::1)([:/]|\b)/i.test(url);
  }
}

function getWindowOrigin(): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const origin = window.location?.origin;
  return origin ? normalizeBaseUrl(origin) : undefined;
}

function stripApiSuffix(url: string): string {
  const normalized = normalizeBaseUrl(url);
  return normalized.toLowerCase().endsWith('/api')
    ? normalized.slice(0, -4)
    : normalized;
}

function resolveFallbackBaseUrl(): string {
  const normalizedEnvUrl =
    rawEnvApiUrl && rawEnvApiUrl.length > 0
      ? stripApiSuffix(rawEnvApiUrl)
      : undefined;

  const windowOrigin = getWindowOrigin();

  if (normalizedEnvUrl) {
    if (
      !isDevEnvironment &&
      windowOrigin &&
      !isLocalhostUrl(windowOrigin) &&
      isLocalhostUrl(normalizedEnvUrl)
    ) {
      return windowOrigin;
    }

    return normalizedEnvUrl;
  }

  if (isDevEnvironment) {
    // Durante o desenvolvimento o frontend roda em uma porta distinta do backend
    // (por padrão 5173), portanto precisamos garantir que as requisições sejam
    // direcionadas ao servidor de API local.
    return 'http://localhost:3001';
  }

  if (windowOrigin) {
    return windowOrigin;
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
