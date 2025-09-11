import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Target,
  Calendar,
  Gavel,
  FileText,
  BarChart3,
  Scale,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Clientes", href: "/clientes", icon: Users },
  { name: "Pipeline", href: "/pipeline", icon: Target },
  { name: "Agenda", href: "/agenda", icon: Calendar },
  { name: "Processos", href: "/processos", icon: Gavel },
  { name: "Documentos", href: "/documentos", icon: FileText },
  { name: "Relatórios", href: "/relatorios", icon: BarChart3 },
  {
    name: "Configurações",
    href: "/configuracoes",
    icon: Settings,
    children: [{ name: "Parâmetros", href: "/configuracoes/parametros" }],
  },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <div className="w-64 bg-card border-r border-border flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary rounded-lg">
            <Scale className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">CRM Jurídico</h1>
            <p className="text-xs text-muted-foreground">Gestão Advocacia</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navigation.map((item) => {
          const isActive =
            location.pathname === item.href ||
            item.children?.some((child) =>
              location.pathname.startsWith(child.href),
            );
          return (
            <div key={item.name} className="space-y-1">
              <NavLink
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent",
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </NavLink>
              {item.children && (
                <div className="ml-6 space-y-1">
                  {item.children.map((child) => {
                    const childActive = location.pathname === child.href;
                    return (
                      <NavLink
                        key={child.name}
                        to={child.href}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200",
                          childActive
                            ? "bg-primary text-primary-foreground shadow-md"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent",
                        )}
                      >
                        {child.name}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <div className="text-xs text-muted-foreground text-center">
          © 2024 CRM Jurídico
        </div>
      </div>
    </div>
  );
}
