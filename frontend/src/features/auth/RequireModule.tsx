import { ReactNode } from "react";

import { PlanUpgradePrompt } from "./PlanUpgradePrompt";
import { useAuth } from "./AuthProvider";
import { createNormalizedModuleSet, normalizeModuleId } from "./moduleUtils";

interface RequireModuleProps {
  module: string | string[];
  children: ReactNode;
}

export const RequireModule = ({ module, children }: RequireModuleProps) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  const modules = createNormalizedModuleSet(user?.modulos ?? []);
  const requiredModules = Array.isArray(module) ? module : [module];
  const normalizedRequiredModules = requiredModules
    .map((moduleId) => normalizeModuleId(moduleId))
    .filter((moduleId): moduleId is string => Boolean(moduleId));

  const hasAccess =
    normalizedRequiredModules.length === 0 ||
    normalizedRequiredModules.some((moduleId) => modules.has(moduleId));

  if (hasAccess) {
    return <>{children}</>;
  }

  if (requiredModules.includes("meu-plano")) {
    return <>{children}</>;
  }

  return <PlanUpgradePrompt module={module} />;
};
