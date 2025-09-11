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
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  name: string;
  href?: string;
  icon?: LucideIcon;
  children?: NavItem[];
}

const navigation: NavItem[] = [
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
    children: [
      {
        name: "Parâmetros",
        children: [
          {
            name: "Área de Atuação",
            href: "/configuracoes/parametros/area-de-atuacao",
          },
          {
            name: "Situação do Processo",
            href: "/configuracoes/parametros/situacao-processo",
          },
          {
            name: "Tipo de Evento",
            href: "/configuracoes/parametros/tipo-evento",
          },
          {
            name: "Situação do Cliente",
            href: "/configuracoes/parametros/situacao-cliente",
          },
        ],
      },
    ],
  },
];

export function Sidebar() {
  const location = useLocation();

  const isItemActive = (item: NavItem): boolean => {
    if (item.href && location.pathname === item.href) return true;
    return item.children ? item.children.some(isItemActive) : false;
  };

  const renderNavItems = (items: NavItem[]) =>
    items.map((item) => {
      const active = isItemActive(item);
      const classes = cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
        active
          ? "bg-primary text-primary-foreground shadow-md"
          : "text-muted-foreground hover:text-foreground hover:bg-accent",
      );

      const content = item.href ? (
        <NavLink to={item.href} className={classes}>
          {item.icon && <item.icon className="h-5 w-5" />}
          {item.name}
        </NavLink>
      ) : (
        <div className={classes}>
          {item.icon && <item.icon className="h-5 w-5" />}
          {item.name}
        </div>
      );

      return (
        <div key={item.name} className="space-y-1">
          {content}
          {item.children && (
            <div className="ml-6 space-y-1">{renderNavItems(item.children)}</div>
          )}
        </div>
      );
    });

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
      <nav className="flex-1 p-4 space-y-2">{renderNavItems(navigation)}</nav>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <div className="text-xs text-muted-foreground text-center">
          © 2024 CRM Jurídico
        </div>
      </div>
    </div>
  );
}
