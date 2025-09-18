import { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
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

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <ShieldAlert className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Acesso restrito</h1>
        <p className="text-sm text-muted-foreground">
          Você não possui permissão para acessar esta funcionalidade. Entre em contato com o administrador do seu
          escritório para solicitar acesso.
        </p>
      </div>
    </div>
  );
};
