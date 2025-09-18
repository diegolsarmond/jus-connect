import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { SidebarProvider } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAutoLogout } from "@/hooks/useAutoLogout";
import { useCallback } from "react";
import { routes } from "@/config/routes";
import { useAuth } from "@/features/auth/AuthProvider";

export function CRMLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { logout } = useAuth();
  const handleAutoLogout = useCallback(() => {
    toast({
      title: "Sessão encerrada",
      description: "Você foi desconectado por inatividade. Faça login novamente para continuar.",
      variant: "destructive",
    });
    logout();
    navigate(routes.login, { replace: true });
  }, [logout, navigate, toast]);

  useAutoLogout(handleAutoLogout);
  const isConversationsRoute = location.pathname.startsWith("/conversas");
  const rootClassName = cn(
    "flex w-full",
    isConversationsRoute ? "h-dvh overflow-hidden" : "min-h-screen bg-background",
  );
  const containerClassName = cn(
    "flex-1 flex min-h-0 flex-col",
    isConversationsRoute && "h-full",
  );
  const mainClassName = cn(
    "flex-1 flex flex-col min-h-0",
    isConversationsRoute ? "h-full overflow-hidden" : "overflow-auto",
  );

  return (
    <SidebarProvider>
      <div className={rootClassName}>
        <Sidebar />
        <div className={containerClassName}>

          <Header />
          <main className={mainClassName}>
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
