import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Users,
  Package,
  Target,
  Calendar,
  CheckSquare,
  MessageCircle,
  Gavel,
  BellRing,
  FileText,
  Folder,
  DollarSign,
  BarChart3,
  CreditCard,
  LifeBuoy,
  Scale,
  Settings,
  LogOut,
  ChevronRight,
  Lock,
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
  SidebarMenuBadge,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { routes } from "@/config/routes";
import { getApiBaseUrl } from "@/lib/api";
import { useAuth } from "@/features/auth/AuthProvider";
import { useSidebarCounters, type SidebarCounterKey, type SidebarCountersMap } from "@/hooks/useSidebarCounters";
import { cn } from "@/lib/utils";

interface NavItem {
  name: string;
  href?: string;
  icon?: LucideIcon;
  children?: NavItem[];
  moduleId?: string;
  badgeKey?: SidebarCounterKey;
  locked?: boolean;
}

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isMobile, setOpenMobile } = useSidebar();
  const { user, logout: authLogout } = useAuth();
  const allowedModules = useMemo(() => new Set(user?.modulos ?? []), [user?.modulos]);
  const [pipelineMenus, setPipelineMenus] = useState<NavItem[]>([]);
  const hasPipelineAccess = allowedModules.has("pipeline");

  useEffect(() => {
    const fetchMenus = async () => {
      if (!hasPipelineAccess) {
        setPipelineMenus([]);
        return;
      }

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
  }, [hasPipelineAccess]);

  const navigation = useMemo<NavItem[]>(
    () => [
      { name: "Dashboard", href: routes.dashboard, icon: LayoutDashboard, moduleId: "dashboard" },
      {
        name: "Conversas",
        href: "/conversas",
        icon: MessageCircle,
        moduleId: "conversas",
        badgeKey: "messages",
      },
      { name: "Clientes", href: "/clientes", icon: Users, moduleId: "clientes" },
      { name: "Fornecedores", href: "/fornecedores", icon: Package, moduleId: "fornecedores" },
      { name: "Pipeline", href: "/pipeline", icon: Target, children: pipelineMenus, moduleId: "pipeline" },
      {
        name: "Agenda",
        href: "/agenda",
        icon: Calendar,
        moduleId: "agenda",
        badgeKey: "agenda",
      },
      {
        name: "Tarefas",
        href: "/tarefas",
        icon: CheckSquare,
        moduleId: "tarefas",
        badgeKey: "tasks",
      },
      { name: "Processos", href: "/processos", icon: Gavel, moduleId: "processos" },
      { name: "Intimações", href: "/intimacoes", icon: BellRing, moduleId: "intimacoes" },
      { name: "Documentos Padrões", href: "/documentos", icon: FileText, moduleId: "documentos" },
      { name: "Meus Arquivos", href: "/arquivos", icon: Folder, moduleId: "arquivos" },
      { name: "Financeiro", href: "/financeiro/lancamentos", icon: DollarSign, moduleId: "financeiro" },
      { name: "Relatórios", href: "/relatorios", icon: BarChart3, moduleId: "relatorios" },
      { name: "Meu Plano", href: "/meu-plano", icon: CreditCard, moduleId: "meu-plano" },
      { name: "Suporte", href: "/suporte", icon: LifeBuoy, moduleId: "suporte" },
      {
        name: "Configurações",
        href: "/configuracoes",
        icon: Settings,
        moduleId: "configuracoes",
        children: [
          {
            name: "Usuários",
            href: "/configuracoes/usuarios",
            moduleId: "configuracoes-usuarios",
          },
          {
            name: "Integrações",
            href: "/configuracoes/integracoes",
            moduleId: "configuracoes-integracoes",
          },
          {
            name: "Parâmetros",
            moduleId: "configuracoes-parametros",
            children: [
              {
                name: "Perfis",
                href: "/configuracoes/parametros/perfis",
                moduleId: "configuracoes-parametros-perfis",
              },
              {
                name: "Setores",
                href: "/configuracoes/parametros/setores",
                moduleId: "configuracoes-parametros-escritorios",
              },
              {
                name: "Área de Atuação",
                href: "/configuracoes/parametros/area-de-atuacao",
                moduleId: "configuracoes-parametros-area-atuacao",
              },
              //{
              //  name: "Situação do Processo",
              //  href: "/configuracoes/parametros/situacao-processo",
              //  moduleId: "configuracoes-parametros-situacao-processo",
              //},
              {
                name: "Tipo de Processo",
                href: "/configuracoes/parametros/tipo-processo",
                moduleId: "configuracoes-parametros-tipo-processo",
              },
              {
                name: "Tipo de Evento",
                href: "/configuracoes/parametros/tipo-evento",
                moduleId: "configuracoes-parametros-tipo-evento",
              },
              //{
              //  name: "Situação da Proposta",
              //  href: "/configuracoes/parametros/situacao-proposta",
              //  moduleId: "configuracoes-parametros-situacao-proposta",
              //},
              {
                name: "Etiquetas",
                href: "/configuracoes/parametros/etiquetas",
                moduleId: "configuracoes-parametros-etiquetas",
              },
              {
                name: "Tipos de Documento",
                href: "/configuracoes/parametros/tipo-documento",
                moduleId: "configuracoes-parametros-tipos-documento",
              },
              {
                name: "Fluxo de Trabalho",
                href: "/configuracoes/parametros/fluxo-de-trabalho",
                moduleId: "configuracoes-parametros-fluxo-trabalho",
              },
            ],
          },
        ],
      },
    ],
    [pipelineMenus],
  );

  const {
    counters: sidebarCounters,
  } = useSidebarCounters();

  const navigationWithLockState = useMemo<NavItem[]>(() => {
    const annotate = (items: NavItem[]): NavItem[] =>
      items.map((item) => {
        const annotatedChildren = item.children ? annotate(item.children) : undefined;
        const hasAccessibleChild = annotatedChildren?.some((child) => !child.locked) ?? false;
        const isModuleAllowed = item.moduleId ? allowedModules.has(item.moduleId) : true;

        return {
          ...item,
          children: annotatedChildren,
          locked: !isModuleAllowed && !hasAccessibleChild,
        } satisfies NavItem;
      });

    return annotate(navigation);
  }, [navigation, allowedModules]);

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
          counters={sidebarCounters}
        />
      );

      return depth === 0 ? (
        <SidebarMenuItem key={key}>{content}</SidebarMenuItem>
      ) : (
        <SidebarMenuSubItem key={key}>{content}</SidebarMenuSubItem>
      );
    });

  const handleLogout = useCallback(() => {
    authLogout();
    navigate("/login");
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [authLogout, isMobile, navigate, setOpenMobile]);

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
        {navigationWithLockState.length > 0 ? (
          <SidebarMenu>{renderNavItems(navigationWithLockState)}</SidebarMenu>
        ) : (
          <div className="px-4 py-6 text-sm text-sidebar-foreground/60">
            Nenhum módulo disponível para o seu perfil.
          </div>
        )}
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
  counters: SidebarCountersMap;
};

function NavItemContent({
  item,
  depth,
  isItemActive,
  onNavigate,
  renderChildren,
  counters,
}: NavItemContentProps) {
  const hasChildren = Boolean(item.children && item.children.length > 0);
  const active = isItemActive(item);
  const [open, setOpen] = useState(active);

  const locked = item.locked ?? false;
  const counter = item.badgeKey ? counters[item.badgeKey] : undefined;
  const shouldRenderBadge = Boolean(
    counter && !counter.isError && (counter.isLoading || typeof counter.count === "number"),
  );
  const displayValue = typeof counter?.count === "number" ? formatCounterValue(counter.count) : undefined;
  const badgeAriaLabel = counter
    ? `Contador de ${item.name}: ${
        displayValue ?? (counter.isLoading ? "carregando" : "indisponível")
      }`
    : undefined;
  const badge = shouldRenderBadge ? (
    <SidebarMenuBadge
      aria-label={badgeAriaLabel}
      aria-live="polite"
      data-state={counter?.isLoading ? "loading" : "ready"}
    >
      {displayValue ?? null}
    </SidebarMenuBadge>
  ) : null;
  const trailingIndicator = locked ? (
    <Lock className="h-3.5 w-3.5 text-sidebar-foreground/50" aria-hidden="true" />
  ) : (
    badge
  );

  const lockedTitle = locked ? "Disponível em planos superiores" : undefined;
  const lockedClassName = locked ? "text-sidebar-foreground/60 hover:text-sidebar-foreground" : undefined;

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
            <SidebarMenuButton
              isActive={active}
              title={lockedTitle}
              className={cn("group justify-between", lockedClassName)}
            >
              <span className="flex items-center gap-2">
                {Icon && <Icon className="h-4 w-4" />}
                <span className="truncate">{item.name}</span>
              </span>
              <span className="flex items-center gap-2">
                {trailingIndicator}
                <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90 group-data-[collapsible=icon]:hidden" />
              </span>
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
          <SidebarMenuSubButton
            isActive={active}
            size="sm"
            title={lockedTitle}
            className={cn("justify-between", lockedClassName)}
          >
            <span className="truncate">{item.name}</span>
            <span className="flex items-center gap-2">
              {trailingIndicator}
              <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
            </span>
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
        <NavLink
          to={item.href ?? "#"}
          className={cn("group flex w-full items-center gap-2", lockedClassName)}
          onClick={handleClick}
          title={lockedTitle}
        >
          <span className="flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4" />}
            <span className="truncate">{item.name}</span>
          </span>
          {trailingIndicator ? <span className="ml-auto flex items-center">{trailingIndicator}</span> : null}
        </NavLink>
      </SidebarMenuButton>
    );
  }

  return (
    <SidebarMenuSubButton asChild isActive={active} size="sm">
      <NavLink
        to={item.href ?? "#"}
        className={cn("group flex w-full items-center gap-2", lockedClassName)}
        onClick={handleClick}
        title={lockedTitle}
      >
        <span className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4" />}
          <span className="truncate">{item.name}</span>
        </span>
        {trailingIndicator ? <span className="ml-auto flex items-center">{trailingIndicator}</span> : null}
      </NavLink>
    </SidebarMenuSubButton>
  );
}

function formatCounterValue(value: number): string {
  if (!Number.isFinite(value) || value < 0) {
    return "0";
  }
  if (value > 99) {
    return "99+";
  }
  return String(value);
}
