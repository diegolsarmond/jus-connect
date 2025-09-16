import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Users,
  Target,
  Calendar,
  CheckSquare,
  MessageCircle,
  Gavel,
  BellRing,
  FileText,
  DollarSign,
  BarChart3,
  CreditCard,
  LifeBuoy,
  Scale,
  Settings,
  LogOut,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar as SidebarUI,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { getApiBaseUrl } from "@/lib/api";

interface NavItem {
  name: string;
  href?: string;
  icon?: LucideIcon;
  children?: NavItem[];
}

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isMobile, setOpenMobile } = useSidebar();
  const [pipelineMenus, setPipelineMenus] = useState<NavItem[]>([]);

  useEffect(() => {
    const fetchMenus = async () => {
      try {
        const apiUrl = getApiBaseUrl();
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

  const navigation = useMemo<NavItem[]>(
    () => [
      { name: "Dashboard", href: "/", icon: LayoutDashboard },
      { name: "Conversas", href: "/conversas", icon: MessageCircle },
      { name: "Clientes", href: "/clientes", icon: Users },
      { name: "Pipeline", href: "/pipeline", icon: Target, children: pipelineMenus },
      { name: "Agenda", href: "/agenda", icon: Calendar },
      { name: "Tarefas", href: "/tarefas", icon: CheckSquare },
      { name: "Processos", href: "/processos", icon: Gavel },
      { name: "Intimações", href: "/intimacoes", icon: BellRing },
      { name: "Documentos Padrões", href: "/documentos", icon: FileText },
      { name: "Financeiro", href: "/financeiro/lancamentos", icon: DollarSign },
      { name: "Relatórios", href: "/relatorios", icon: BarChart3 },
      { name: "Meu Plano", href: "/meu-plano", icon: CreditCard },
      { name: "Suporte", href: "/suporte", icon: LifeBuoy },
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
            name: "Integrações",
            href: "/configuracoes/integracoes",
          },
          {
            name: "Parâmetros",
            children: [
              {
                name: "Perfis",
                href: "/configuracoes/parametros/perfis",
              },
              {
                name: "Setores",
                href: "/configuracoes/parametros/setores",
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
                name: "Situação da Proposta",
                href: "/configuracoes/parametros/situacao-proposta",
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
    ],
    [pipelineMenus],
  );

  const isPathActive = (href?: string) => {
    if (!href) return false;
    if (href === "/") return location.pathname === "/";
    return location.pathname === href || location.pathname.startsWith(`${href}/`);
  };

  const isItemActive = (item: NavItem): boolean => {
    if (isPathActive(item.href)) return true;
    return item.children ? item.children.some(isItemActive) : false;
  };

  const handleNavigate = (item: NavItem) => {
    if (item.href && isMobile) {
      setOpenMobile(false);
    }
  };

  const renderNavItems = (items: NavItem[], depth = 0): ReactNode[] =>
    items.map((navItem) => {
      const key = `${depth}-${navItem.href ?? navItem.name}`;
      const content = (
        <NavItemContent
          item={navItem}
          depth={depth}
          isItemActive={isItemActive}
          onNavigate={handleNavigate}
          renderChildren={renderNavItems}
        />
      );

      return depth === 0 ? (
        <SidebarMenuItem key={key}>{content}</SidebarMenuItem>
      ) : (
        <SidebarMenuSubItem key={key}>{content}</SidebarMenuSubItem>
      );
    });

  const handleLogout = () => {
    navigate("/login");
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <SidebarUI>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-3 px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Scale className="h-5 w-5" />
          </div>
          <div className="space-y-1 group-data-[collapsible=icon]:hidden">
            <p className="text-base font-semibold leading-none text-sidebar-foreground">
              CRM Jurídico
            </p>
            <p className="text-xs text-sidebar-foreground/70">Gestão Advocacia</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2">
        <SidebarMenu>{renderNavItems(navigation)}</SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border px-2 py-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} className="justify-start gap-2">
              <LogOut className="h-4 w-4" />
              <span className="truncate group-data-[collapsible=icon]:hidden">Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <p className="px-2 text-xs text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
          © 2025 CRM Jurídico
        </p>
      </SidebarFooter>
      <SidebarRail />
    </SidebarUI>
  );
}

type NavItemContentProps = {
  item: NavItem;
  depth: number;
  isItemActive: (item: NavItem) => boolean;
  onNavigate: (item: NavItem) => void;
  renderChildren: (items: NavItem[], depth: number) => ReactNode[];
};

function NavItemContent({
  item,
  depth,
  isItemActive,
  onNavigate,
  renderChildren,
}: NavItemContentProps) {
  const hasChildren = Boolean(item.children && item.children.length > 0);
  const active = isItemActive(item);
  const [open, setOpen] = useState(active);

  useEffect(() => {
    if (hasChildren && active) {
      setOpen(true);
    }
  }, [active, hasChildren]);

  const Icon = item.icon;
  const handleClick = () => {
    if (item.href) {
      onNavigate(item);
    }
  };

  if (hasChildren) {
    if (depth === 0) {
      return (
        <Collapsible open={open} onOpenChange={setOpen} className="group/collapsible">
          <CollapsibleTrigger asChild>
            <SidebarMenuButton isActive={active} className="justify-between">
              <span className="flex items-center gap-2">
                {Icon && <Icon className="h-4 w-4" />}
                <span className="truncate">{item.name}</span>
              </span>
              <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90 group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>{renderChildren(item.children ?? [], depth + 1)}</SidebarMenuSub>
          </CollapsibleContent>
        </Collapsible>
      );
    }

    return (
      <Collapsible open={open} onOpenChange={setOpen} className="group/collapsible">
        <CollapsibleTrigger asChild>
          <SidebarMenuSubButton isActive={active} size="sm" className="justify-between">
            <span className="truncate">{item.name}</span>
            <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuSubButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub className="ml-3 border-l border-sidebar-border/40">
            {renderChildren(item.children ?? [], depth + 1)}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  if (depth === 0) {
    return (
      <SidebarMenuButton asChild isActive={active}>
        <NavLink to={item.href ?? "#"} className="flex w-full items-center gap-2" onClick={handleClick}>
          {Icon && <Icon className="h-4 w-4" />}
          <span className="truncate">{item.name}</span>
        </NavLink>
      </SidebarMenuButton>
    );
  }

  return (
    <SidebarMenuSubButton asChild isActive={active} size="sm">
      <NavLink to={item.href ?? "#"} className="flex w-full items-center gap-2" onClick={handleClick}>
        {Icon && <Icon className="h-4 w-4" />}
        <span className="truncate">{item.name}</span>
      </NavLink>
    </SidebarMenuSubButton>
  );
}
