import { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "./AuthProvider";

interface RequireAdminUserProps {
  children: ReactNode;
}

export const RequireAdminUser = ({ children }: RequireAdminUserProps) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (user?.id === 3) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 p-6 text-center">
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
