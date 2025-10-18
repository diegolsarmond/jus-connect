import { ReactNode } from "react";
import { Loader2, ShieldAlert } from "lucide-react";

import { useAuth } from "./AuthProvider";

interface RequireAdminUserProps {
  children: ReactNode;
}

export const RequireAdminUser = ({ children }: RequireAdminUserProps) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        className="flex min-h-full flex-col items-center justify-center gap-3 p-6 text-center"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Validando permissões administrativas...</p>
      </div>
    );

  }

  if (user && ( user.id === 1)) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 p-6 text-center" role="alert">

      <ShieldAlert className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Acesso restrito</h1>
        <p className="text-sm text-muted-foreground">
          Você não possui permissão para acessar o ambiente administrativo. Solicite a um administrador que habilite seu acesso.
        </p>
      </div>
    </div>
  );
};
