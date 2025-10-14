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
import { TrialBanner } from "@/features/auth/TrialBanner";
import { SystemTutorial } from "./SystemTutorial";

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
    "flex w-full flex-col md:flex-row",
    isConversationsRoute ? "h-dvh overflow-hidden" : "min-h-screen bg-background",
  );
  const containerClassName = cn(
    "flex min-h-0 w-full flex-1 flex-col md:min-w-0",
    isConversationsRoute && "h-full",
  );
  const mainClassName = cn(
    "flex flex-1 flex-col min-h-0 w-full min-w-0",
    isConversationsRoute ? "h-full overflow-hidden" : "overflow-auto",
  );

  return (
    <SidebarProvider>
      <div className={rootClassName}>
        <Sidebar />
        <div className={containerClassName}>
          <Header />
          <TrialBanner />
          <SystemTutorial />
          <main className={mainClassName} data-crm-scroll-container>
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
