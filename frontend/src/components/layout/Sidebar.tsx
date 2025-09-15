import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Users,
  Target,
  Calendar,
  CheckSquare,
  Gavel,
  FileText,
  DollarSign,
  BarChart3,
  CreditCard,
  Scale,
  Settings,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  name: string;
  href?: string;
  icon?: LucideIcon;
  children?: NavItem[];
}

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [pipelineMenus, setPipelineMenus] = useState<NavItem[]>([]);

  useEffect(() => {
    const fetchMenus = async () => {
      try {
        const apiUrl =
          (import.meta.env.VITE_API_URL as string) || "http://localhost:3000";
        const res = await fetch(`${apiUrl}/api/fluxos-trabalho/menus`, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        const data = await res.json();
        type MenuApiItem = { id: number | string; nome?: string; ordem?: number };
        const parseData = (d: unknown): MenuApiItem[] => {
          if (Array.isArray(d)) return d as MenuApiItem[];
          if (d && typeof d === "object") {
            const obj = d as Record<string, unknown>;
            if (Array.isArray(obj.rows)) return obj.rows as MenuApiItem[];
            if (obj.data && typeof obj.data === "object") {
              const inner = obj.data as Record<string, unknown>;
              if (Array.isArray(inner.rows)) return inner.rows as MenuApiItem[];
            }
            if (Array.isArray(obj.data)) return obj.data as MenuApiItem[];
          }
          return [];
        };
        const parsed = parseData(data);
        const menus = parsed
          .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
          .map((item) => ({
            name: item.nome ?? "",
            href: `/pipeline/${item.id}`,
          }));
        setPipelineMenus(menus);
      } catch (e) {
        console.error(e);
      }
    };
    fetchMenus();
  }, []);

  const navigation: NavItem[] = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Clientes", href: "/clientes", icon: Users },
    { name: "Pipeline", href: "/pipeline", icon: Target, children: pipelineMenus },
    { name: "Agenda", href: "/agenda", icon: Calendar },
    { name: "Tarefas", href: "/tarefas", icon: CheckSquare },
    { name: "Processos", href: "/processos", icon: Gavel },
    { name: "Documentos", href: "/documentos", icon: FileText },
    { name: "Financeiro", href: "/financeiro/lancamentos", icon: DollarSign },
    { name: "Relatórios", href: "/relatorios", icon: BarChart3 },
    { name: "Meu Plano", href: "/meu-plano", icon: CreditCard },
    {
      name: "Configurações",
      href: "/configuracoes",
      icon: Settings,
      children: [
        {
          name: "Usuários",
          href: "/configuracoes/usuarios",
        },
        {
          name: "Parâmetros",
          children: [
            {
              name: "Perfis",
              href: "/configuracoes/parametros/perfis",
            },
            {
              name: "Escritórios",
              href: "/configuracoes/parametros/escritorios",
            },
            {
              name: "Área de Atuação",
              href: "/configuracoes/parametros/area-de-atuacao",
            },
            {
              name: "Situação do Processo",
              href: "/configuracoes/parametros/situacao-processo",
            },
            {
              name: "Tipo de Processo",
              href: "/configuracoes/parametros/tipo-processo",
            },
            {
              name: "Tipo de Evento",
              href: "/configuracoes/parametros/tipo-evento",
            },
            {
              name: "Situação do Cliente",
              href: "/configuracoes/parametros/situacao-cliente",
            },
            {
              name: "Etiquetas",
              href: "/configuracoes/parametros/etiquetas",
            },
            {
              name: "Tipos de Documento",
              href: "/configuracoes/parametros/tipo-documento",
            },
            {
              name: "Fluxo de Trabalho",
              href: "/configuracoes/parametros/fluxo-de-trabalho",
            },
          ],
        },
      ],
    },
  ];

  const isItemActive = (item: NavItem): boolean => {
    if (item.href && location.pathname === item.href) return true;
    return item.children ? item.children.some(isItemActive) : false;
  };

  const NavItemComponent = ({ item }: { item: NavItem }) => {
    const active = isItemActive(item);
    const [open, setOpen] = useState(active);
    const hasChildren = item.children && item.children.length > 0;
    useEffect(() => {
      if (active) setOpen(true);
    }, [active]);
    const classes = cn(
      "flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
      collapsed ? "justify-center" : "gap-3",
      active
        ? "bg-primary text-primary-foreground shadow-md"
        : "text-muted-foreground hover:text-foreground hover:bg-accent",
    );

    const handleClick = () => {
      if (hasChildren) {
        setOpen((prev) => !prev);
      }
    };

    const content = !hasChildren && item.href ? (
      <NavLink to={item.href} className={classes}>
        {item.icon && <item.icon className="h-5 w-5" />}
        {!collapsed && item.name}
      </NavLink>
    ) : (
      <button
        type="button"
        onClick={handleClick}
        className={cn(classes, !collapsed && "w-full justify-between")}
      >
        <span
          className={cn(
            "flex items-center",
            collapsed ? "justify-center" : "gap-3",
          )}
        >
          {item.icon && <item.icon className="h-5 w-5" />}
          {!collapsed && item.name}
        </span>
        {!collapsed && hasChildren && (
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform",
              open && "rotate-180",
            )}
          />
        )}
      </button>
    );

    return (
      <div className="space-y-1">
        {content}
        {hasChildren && open && !collapsed && (
          <div className="ml-6 space-y-1">
            {item.children!.map((child) => (
              <NavItemComponent key={child.name} item={child} />
            ))}
          </div>
        )}
      </div>
    );
  };

  const handleLogout = () => {
    navigate("/login");
  };

  return (
    <div
      className={cn(
        "bg-card border-r border-border flex flex-col transition-all duration-300",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "border-b border-border flex items-center",
          collapsed ? "p-2 justify-center" : "p-6 justify-between",
        )}
      >
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary rounded-lg">
            <Scale className="h-6 w-6 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-lg font-bold text-foreground">CRM Jurídico</h1>
              <p className="text-xs text-muted-foreground">Gestão Advocacia</p>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="p-2 rounded-md hover:bg-accent"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className={cn("flex-1 space-y-2", collapsed ? "p-2" : "p-4")}>
        {navigation.map((item) => (
          <NavItemComponent key={item.name} item={item} />
        ))}
      </nav>

      {/* Footer */}
      <div
        className={cn(
          "border-t border-border space-y-2",
          collapsed ? "p-2" : "p-4",
        )}
      >
        <button
          type="button"
          onClick={handleLogout}
          className={cn(
            "flex items-center w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
            collapsed ? "justify-center" : "gap-3",
            "text-muted-foreground hover:text-foreground hover:bg-accent",
          )}
        >
          <LogOut className="h-5 w-5" />
          {!collapsed && "Sair"}
        </button>
        {!collapsed && (
          <div className="text-xs text-muted-foreground text-center">
            © 2024 CRM Jurídico
          </div>
        )}
      </div>
    </div>
  );
}
