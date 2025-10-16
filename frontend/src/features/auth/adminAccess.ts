import type { AuthUser } from "./types";
import { createNormalizedModuleSet } from "./moduleUtils";

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.toLowerCase();
};

const resolveProfileId = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

export const hasAdminAccess = (user: AuthUser | null | undefined): boolean => {
  if (!user) {
    return false;
  }

  const candidateModules = (user as { modulos?: unknown }).modulos;
  const modules = createNormalizedModuleSet(
    Array.isArray(candidateModules) ? candidateModules : []
  );
  for (const moduleId of modules) {
    if (moduleId.includes("admin")) {
      return true;
    }
  }

  const candidate = user as { perfil_nome?: unknown; role?: unknown; perfil?: unknown };
  const profileName = normalizeString(candidate.perfil_nome);
  if (profileName && profileName.includes("admin")) {
    return true;
  }

  const roleName = normalizeString(candidate.role);
  if (roleName && roleName.includes("admin")) {
    return true;
  }

  const profileId = resolveProfileId(candidate.perfil);
  if (profileId === 1) {
    return true;
  }

  return false;
};
