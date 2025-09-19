import { Suspense, useCallback } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Building2,
  Package,
  CreditCard,
  Users,
  BarChart3,
  HeadphonesIcon,
  Loader2,
  Settings,
} from "lucide-react";
import { HeaderActions } from "@/components/layout/HeaderActions";

import { isActiveRoute, routes } from "@/config/routes";

const navigation = [
  {
    name: "Dashboard",
    href: routes.admin.dashboard,
    icon: LayoutDashboard,
  },
  {
    name: "Empresas",
    href: routes.admin.companies,
    icon: Building2,
  },
  {
    name: "Planos",
    href: routes.admin.plans,
    icon: Package,
  },
  {
    name: "Assinaturas",
    href: routes.admin.subscriptions,
    icon: CreditCard,
  },
  {
    name: "Usuários",
    href: routes.admin.users,
    icon: Users,
  },
  {
    name: "Relatórios",
    href: routes.admin.analytics,
    icon: BarChart3,
  },
  {
    name: "Suporte",
    href: routes.admin.support,
    icon: HeadphonesIcon,
  },
  {
    name: "Configurações",
    href: routes.admin.settings,
    icon: Settings,
  },
];

export default function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleNavigate = useCallback(
    (target: string) => {
      navigate(target);
    },
    [navigate],
  );

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar>
          <SidebarHeader className="border-b border-sidebar-border px-6 py-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
                <LayoutDashboard className="h-4 w-4 text-sidebar-primary-foreground" />
              </div>
              <span className="font-bold text-sidebar-foreground">CRM SaaS</span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              {navigation.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton
                    isActive={isActiveRoute(location.pathname, item.href)}
                    onClick={() => handleNavigate(item.href)}
                    className="flex items-center gap-3"
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>

        <div className="flex-1">
          <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-14 items-center gap-4 px-4">
              <SidebarTrigger />
              <div className="flex-1" />
              <span className="text-sm text-muted-foreground">Admin CRM SaaS</span>
              <HeaderActions />
            </div>
          </header>

          <main className="flex-1 space-y-4 p-6">
            <Suspense fallback={<AdminContentFallback />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

const AdminContentFallback = () => (
  <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center" role="status" aria-live="polite">
    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
    <p className="text-sm text-muted-foreground">Carregando conteúdo administrativo...</p>
  </div>
);
