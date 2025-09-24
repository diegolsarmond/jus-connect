const ACCENT_REGEX = /[\u0300-\u036f]/g;
const NON_ALPHANUMERIC_REGEX = /[^\p{L}\p{N}]+/gu;
const LEADING_HYPHENS_REGEX = /^-+|-+$/g;

const normalize = (value: string): string =>
  value
    .normalize("NFD")
    .replace(ACCENT_REGEX, "")
    .replace(NON_ALPHANUMERIC_REGEX, "-")
    .replace(LEADING_HYPHENS_REGEX, "")
    .toLowerCase();

export const normalizeModuleId = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = normalize(trimmed);
  return normalized || null;
};

export const sanitizeModuleList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const unique = new Set<string>();

  for (const entry of value) {
    const moduleId = normalizeModuleId(entry);
    if (!moduleId || unique.has(moduleId)) {
      continue;
    }

    unique.add(moduleId);
  }

  return [...unique];
};

export const createNormalizedModuleSet = (modules: Iterable<string>): Set<string> => {
  const normalized = new Set<string>();

  for (const moduleId of modules) {
    const normalizedId = normalizeModuleId(moduleId);
    if (!normalizedId) {
      continue;
    }

    normalized.add(normalizedId);
  }

  return normalized;
};

