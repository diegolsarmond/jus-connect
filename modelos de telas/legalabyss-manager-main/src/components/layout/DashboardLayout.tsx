import { Outlet, useLocation } from "react-router-dom";
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { 
  LayoutDashboard, 
  Building2, 
  Package, 
  CreditCard, 
  Users, 
  BarChart3, 
  HeadphonesIcon,
  Settings
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const navigation = [
  {
    name: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    name: "Empresas",
    href: "/companies",
    icon: Building2,
  },
  {
    name: "Planos",
    href: "/plans",
    icon: Package,
  },
  {
    name: "Assinaturas",
    href: "/subscriptions",
    icon: CreditCard,
  },
  {
    name: "Usuários",
    href: "/users",
    icon: Users,
  },
  {
    name: "Relatórios",
    href: "/analytics",
    icon: BarChart3,
  },
  {
    name: "Suporte",
    href: "/support",
    icon: HeadphonesIcon,
  },
  {
    name: "Configurações",
    href: "/settings",
    icon: Settings,
  },
];

export default function DashboardLayout() {
  const location = useLocation();

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
                    asChild
                    isActive={location.pathname === item.href}
                  >
                    <Link to={item.href} className="flex items-center gap-3">
                      <item.icon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </Link>
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
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">Admin CRM SaaS</span>
              </div>
            </div>
          </header>
          
          <main className="flex-1 space-y-4 p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}