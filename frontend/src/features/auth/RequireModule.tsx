import { ReactNode } from "react";

import { usePlan } from "@/features/plans/PlanProvider";

import { PlanUpgradePrompt } from "./PlanUpgradePrompt";
import { useAuth } from "./AuthProvider";
import { createNormalizedModuleSet, normalizeModuleId } from "./moduleUtils";

interface RequireModuleProps {
  module: string | string[];
  userFallbackModules?: string | string[];
  children: ReactNode;
}

const useOptionalPlan = (): ReturnType<typeof usePlan> | null => {
  try {
    return usePlan();
  } catch {
    return null;
  }
};

const toNormalizedModuleList = (
  moduleIds: string | string[] | undefined,
): string[] => {
  if (!moduleIds) {
    return [];
  }

  const list = Array.isArray(moduleIds) ? moduleIds : [moduleIds];
  return list
    .map((moduleId) => normalizeModuleId(moduleId))
    .filter((moduleId): moduleId is string => Boolean(moduleId));
};

export const RequireModule = ({
  module,
  userFallbackModules,
  children,
}: RequireModuleProps) => {
  const { user, isLoading } = useAuth();
  const planContext = useOptionalPlan();

  if (isLoading) {
    return null;
  }

  const modules = createNormalizedModuleSet(user?.modulos ?? []);
  const planModulesRaw = planContext?.plan?.modules;
  const planModules = Array.isArray(planModulesRaw) ? planModulesRaw : [];
  const normalizedPlanModules = createNormalizedModuleSet(planModules);
  const requiredModules = Array.isArray(module) ? module : [module];
  const normalizedRequiredModules = toNormalizedModuleList(requiredModules);
  const normalizedFallbackModules = toNormalizedModuleList(userFallbackModules);

  const hasDefinedPlanModules = planModules.length > 0;
  const userHasRequiredModule =
    normalizedRequiredModules.length === 0 ||
    normalizedRequiredModules.some((moduleId) => modules.has(moduleId)) ||
    normalizedFallbackModules.some((moduleId) => modules.has(moduleId));
  const planIncludesRequiredModule =
    normalizedRequiredModules.length === 0 ||
    normalizedRequiredModules.some((moduleId) =>
      normalizedPlanModules.has(moduleId),
    );

  const hasAccess =
    normalizedRequiredModules.length === 0 ||
    (userHasRequiredModule && (!hasDefinedPlanModules || planIncludesRequiredModule));

  if (hasAccess || requiredModules.includes("meu-plano")) {
    return <>{children}</>;
  }

  const shouldShowUpgradePrompt =
    hasDefinedPlanModules && userHasRequiredModule && !planIncludesRequiredModule;

  if (shouldShowUpgradePrompt) {
    return <PlanUpgradePrompt module={module} />;
  }

  return null;
};
