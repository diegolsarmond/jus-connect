export interface AppConfig {
  appName: string;
  environment: string;
  isProduction: boolean;
  basePath: string;
  adminBasePath: string;
  apiBaseUrl?: string;
  enableMockData: boolean;
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

export const appConfig: AppConfig = {
  appName: sanitizeString(import.meta.env.VITE_APP_NAME) ?? "Quantum Jud",
  environment: import.meta.env.MODE,
  isProduction: import.meta.env.PROD,
  basePath: normalizePath(import.meta.env.VITE_APP_BASE_PATH, "/"),
  adminBasePath: normalizePath(import.meta.env.VITE_ADMIN_BASE_PATH, "/admin"),
  apiBaseUrl: normalizeUrl(import.meta.env.VITE_API_BASE_URL),
  enableMockData: parseBoolean(import.meta.env.VITE_ENABLE_MOCKS, true),
};

export const buildAdminPath = (...segments: string[]) => joinPathSegments(appConfig.adminBasePath, ...segments);
