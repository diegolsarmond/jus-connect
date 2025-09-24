import { ReactElement } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { routes } from "@/config/routes";
import { useAuth } from "./AuthProvider";
import { evaluateSubscriptionAccess } from "./subscriptionStatus";

const PLAN_SELECTION_PATH = "/meu-plano";

interface ProtectedRouteProps {
  children: ReactElement;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Verificando sessão...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={routes.login} replace state={{ from: location }} />;
  }

  const mustChangePassword = user?.mustChangePassword ?? false;
  const isOnForcedPasswordRoute =
    location.pathname === "/alterar-senha" || /\/configuracoes\/usuarios\/.+\/senha$/.test(location.pathname);

  if (mustChangePassword && !isOnForcedPasswordRoute) {
    return <Navigate to="/alterar-senha" replace state={{ from: location }} />;
  }

  const { hasAccess } = evaluateSubscriptionAccess(user?.subscription ?? null);
  const requiresPlanSelection = !hasAccess;
  const isOnPlanRoute = location.pathname.startsWith(PLAN_SELECTION_PATH);

  if (requiresPlanSelection && !isOnPlanRoute) {
    return <Navigate to={PLAN_SELECTION_PATH} replace state={{ from: location }} />;
  }

  return children;
};
