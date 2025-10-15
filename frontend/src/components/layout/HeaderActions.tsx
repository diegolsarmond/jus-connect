import { useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowUpRight,
  Crown,
  Loader2,
  LogOut,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { IntimacaoMenu } from "@/components/notifications/IntimacaoMenu";
import { useAuth } from "@/features/auth/AuthProvider";
import { usePlan } from "@/features/plans/PlanProvider";
import { getPlanDisplayName, getPlanVisualMeta } from "@/features/plans/planVisuals";
import { routes } from "@/config/routes";
import { useQuery } from "@tanstack/react-query";
import { fetchMeuPerfil } from "@/services/meuPerfil";
import { cn } from "@/lib/utils";

const getInitials = (name: string | undefined) => {
  if (!name) {
    return "--";
  }

  const parts = name
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return name.slice(0, 2).toUpperCase();
  }

  return parts
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
};

interface PlanBadgeProps {
  plan: ReturnType<typeof usePlan>["plan"];
  isLoading: boolean;
  error: string | null;
}

const PlanBadge = ({ plan, isLoading, error }: PlanBadgeProps) => {
  const statusLabel = isLoading
    ? "Carregando plano..."
    : error
      ? "Não foi possível carregar o plano"
      : getPlanDisplayName(plan);

  const meta = getPlanVisualMeta(plan);

  const toneClassName = isLoading
    ? "border-muted-foreground/20 bg-muted text-muted-foreground"
    : error
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : "border-primary/30 bg-gradient-to-r from-primary/90 via-primary to-primary/90 text-primary-foreground shadow-sm";

  const tierLabel = isLoading || error ? "Plano atual" : meta.tier;

  return (
    <Badge
      data-testid="plan-badge"
      className={cn(
        "flex h-auto min-h-[2.5rem] min-w-0 max-w-[220px] items-stretch gap-1.5 rounded-full px-3 py-1.5 text-left shadow-sm sm:max-w-[260px]",
        toneClassName,
      )}
      title={statusLabel}
      aria-live={isLoading ? "polite" : undefined}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : error ? (
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
        ) : meta.crowns > 0 ? (
          <span className="flex items-center gap-0.5 text-amber-200">
            {Array.from({ length: meta.crowns }).map((_, index) => (
              <Crown
                key={index}
                className="h-3.5 w-3.5 drop-shadow-sm"
                aria-hidden="true"
                data-testid="plan-crown"
              />
            ))}
          </span>
        ) : null}
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
            {tierLabel}
          </span>
          <span className="truncate text-xs font-semibold" data-testid="plan-badge-label">
            {statusLabel}
          </span>
        </span>
      </span>
    </Badge>
  );
};

export function HeaderActions() {
  const navigate = useNavigate();
  const location = useLocation();

  const { user, logout } = useAuth();
  const { plan, isLoading, error } = usePlan();
  const { data: profile } = useQuery({
    queryKey: ["meu-perfil", "header"],
    queryFn: () => fetchMeuPerfil(),
    enabled: Boolean(user),
    staleTime: 5 * 60 * 1000,
  });
  const canAccessConfiguracoes =
    user?.modulos?.some((moduleId) => moduleId === "configuracoes" || moduleId.startsWith("configuracoes-")) ?? false;

  const isOnAdminArea = useMemo(() => {
    const adminRoot = routes.admin.root;
    return location.pathname === adminRoot || location.pathname.startsWith(`${adminRoot}/`);
  }, [location.pathname]);

  const profileToggleLabel = isOnAdminArea ? "Alternar para CRM" : "Alternar para admin";

  const canToggleAdmin = useMemo(() => {
    if (!user) {
      return false;
    }

    const cpfValue = user?.cpf ?? (user as { cpf?: unknown }).cpf;

    if (typeof cpfValue === "number") {
      return cpfValue.toString().padStart(11, "0") === "11545111626";
    }

    if (typeof cpfValue === "string") {
      return cpfValue.replace(/\D+/gu, "") === "11545111626";
    }

    return false;
  }, [user]);

  const handleProfileToggle = useCallback(() => {
    if (isOnAdminArea) {
      navigate(routes.dashboard, { replace: true });
      return;
    }

    navigate(routes.admin.dashboard, { replace: true });
  }, [isOnAdminArea, navigate]);

  const handleLogout = useCallback(() => {
    logout();
    navigate(routes.login, { replace: true });
  }, [logout, navigate]);

  const avatarAlt = profile?.name ?? user?.nome_completo ?? "Usuário";
  const avatarSrc = profile?.avatarUrl?.trim() ? profile.avatarUrl : undefined;

  const planMeta = useMemo(() => getPlanVisualMeta(plan), [plan]);
  const showUpgradeButton = useMemo(
    () => Boolean(plan) && !isLoading && !error && planMeta.canUpgrade,
    [plan, isLoading, error, planMeta.canUpgrade],
  );

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 sm:gap-3">
      <ModeToggle />
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
        <PlanBadge plan={plan} isLoading={isLoading} error={error} />
        {showUpgradeButton && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full border border-primary/30 bg-primary/10 text-primary transition-colors hover:bg-primary/20"
                  onClick={() => navigate(routes.meuPlano)}
                  aria-label="Upgrade do plano"
                  data-testid="plan-upgrade-button"
                  disabled={isLoading}
                >
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Upgrade</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <IntimacaoMenu />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex min-w-0 items-center gap-2 px-2 py-1.5 sm:px-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={avatarSrc} alt={avatarAlt} />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {getInitials(user?.nome_completo)}
              </AvatarFallback>
            </Avatar>
            <div className="hidden min-w-0 text-left sm:block">
              <p className="max-w-[160px] truncate text-sm font-medium">
                {profile?.name ?? user?.nome_completo ?? "Usuário"}
              </p>
              <p className="max-w-[160px] truncate text-xs text-muted-foreground">
                {profile?.email ?? user?.email ?? "Conta"}
              </p>
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              navigate("/meu-perfil");
            }}
          >
            <User className="mr-2 h-4 w-4" />
            Perfil
          </DropdownMenuItem>
          {canToggleAdmin && (
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                handleProfileToggle();
              }}
            >
              <ArrowLeftRight className="mr-2 h-4 w-4" />
              {profileToggleLabel}

            </DropdownMenuItem>
          )}
          {/*{canAccessConfiguracoes && (*/}
          {/*  <DropdownMenuItem*/}
          {/*    onSelect={(event) => {*/}
          {/*      event.preventDefault();*/}
          {/*      navigate("/configuracoes");*/}
          {/*    }}*/}
          {/*  >*/}
          {/*    Configurações*/}
          {/*  </DropdownMenuItem>*/}
          {/*)}*/}
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              handleLogout();
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
