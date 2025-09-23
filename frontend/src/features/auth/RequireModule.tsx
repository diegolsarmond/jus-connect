import { ReactNode } from "react";

import { PlanUpgradePrompt } from "./PlanUpgradePrompt";
import { useAuth } from "./AuthProvider";

interface RequireModuleProps {
  module: string | string[];
  children: ReactNode;
}

export const RequireModule = ({ module, children }: RequireModuleProps) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  const modules = user?.modulos ?? [];
  const requiredModules = Array.isArray(module) ? module : [module];
  const hasAccess = requiredModules.some((moduleId) => modules.includes(moduleId));

  if (hasAccess) {
    return <>{children}</>;
  }

  return <PlanUpgradePrompt module={module} />;
};
