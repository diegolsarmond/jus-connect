interface FtpConfig {
  host?: string;
  port?: number;
  user?: string;
  root?: string;
  secure: boolean;
}

export interface AppConfig {
  appName: string;
  environment: string;
  isProduction: boolean;
  basePath: string;
  adminBasePath: string;
  apiBaseUrl?: string;
  enableMockData: boolean;
  ftp?: FtpConfig;
}

const sanitizeString = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const parseBoolean = (value: string | boolean | undefined, defaultValue: boolean) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (["true", "1", "yes"].includes(normalized)) {
      return true;
    }

    if (["false", "0", "no"].includes(normalized)) {
      return false;
    }
  }

  return defaultValue;
};

const normalizePath = (value: string | undefined, fallback: string) => {
  const sanitized = sanitizeString(value);
  if (!sanitized) {
    return fallback;
  }

  const withoutRelativePrefix = sanitized.replace(/^\.\/+/u, "");

  if (withoutRelativePrefix.length === 0 || withoutRelativePrefix === ".") {
    return "/";
  }

  const withLeadingSlash = withoutRelativePrefix.startsWith("/")
    ? withoutRelativePrefix
    : `/${withoutRelativePrefix}`;

  if (withLeadingSlash.length === 1) {
    return withLeadingSlash;
  }

  return withLeadingSlash.replace(/\/+$/, "");
};

const normalizeUrl = (value: string | undefined) => {
  const sanitized = sanitizeString(value);
  if (!sanitized) {
    return undefined;
  }

  return sanitized.replace(/\/+$/, "");
};

const joinPathSegments = (...segments: (string | undefined)[]) => {
  const parts = segments
    .filter((segment): segment is string => typeof segment === "string" && segment.length > 0)
    .flatMap((segment) => segment.split("/"))
    .filter(Boolean);

  if (parts.length === 0) {
    return "/";
  }

  return `/${parts.join("/")}`;
};

const parseInteger = (value: string | undefined) => {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return undefined;
  }

  return parsed;
};

export const appConfig: AppConfig = {
    appName: sanitizeString(import.meta.env.VITE_APP_NAME) ?? "Quantum Tecnologia",
  environment: import.meta.env.MODE,
  isProduction: import.meta.env.PROD,
  basePath: normalizePath(import.meta.env.VITE_APP_BASE_PATH, "/"),
  adminBasePath: normalizePath(import.meta.env.VITE_ADMIN_BASE_PATH, "/admin"),
  apiBaseUrl: normalizeUrl(import.meta.env.VITE_API_BASE_URL),
  enableMockData: parseBoolean(import.meta.env.VITE_ENABLE_MOCKS, true),
  ftp: (() => {
    const host = sanitizeString(import.meta.env.VITE_FTP_HOST);
    const user = sanitizeString(import.meta.env.VITE_FTP_USER);
    const root = sanitizeString(import.meta.env.VITE_FTP_ROOT);
    const port = parseInteger(sanitizeString(import.meta.env.VITE_FTP_PORT));
    const secure = parseBoolean(import.meta.env.VITE_FTP_SECURE, true);

    if (!host && !user && !root && typeof port === "undefined") {
      return undefined;
    }

    return {
      host,
      user,
      root,
      port,
      secure,
    } satisfies FtpConfig;
  })(),
};

export const buildAppPath = (...segments: string[]) => joinPathSegments(appConfig.basePath, ...segments);
export const buildAdminPath = (...segments: string[]) => joinPathSegments(appConfig.adminBasePath, ...segments);
