import { useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { ArrowLeftRight, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { IntimacaoMenu } from "@/components/notifications/IntimacaoMenu";
import { useAuth } from "@/features/auth/AuthProvider";
import { routes } from "@/config/routes";
import { usePlan } from "@/features/plans/PlanProvider";
import { cn } from "@/lib/utils";

const getPlanDisplayName = (name: string | null | undefined, id: number | null | undefined) => {
  const normalizedName = typeof name === "string" ? name.trim() : "";
  if (normalizedName.length > 0) {
    return normalizedName;
  }

  if (typeof id === "number" && Number.isFinite(id)) {
    return `Plano ${id}`;
  }

  return "Plano não definido";
};

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

export function HeaderActions() {
  const navigate = useNavigate();
  const location = useLocation();

  const { user, logout } = useAuth();
  const { plan, isLoading, error } = usePlan();
  const canAccessConfiguracoes =
    user?.modulos?.some((moduleId) => moduleId === "configuracoes" || moduleId.startsWith("configuracoes-")) ?? false;

  const isOnAdminArea = useMemo(() => {
    const adminRoot = routes.admin.root;
    return location.pathname === adminRoot || location.pathname.startsWith(`${adminRoot}/`);
  }, [location.pathname]);

  const profileToggleLabel = isOnAdminArea ? "Alternar para CRM" : "Alternar para admin";

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

  const planName = useMemo(
    () => getPlanDisplayName(plan?.nome, plan?.id),
    [plan?.id, plan?.nome],
  );

  const planStatusLabel = useMemo(() => {
    if (isLoading) {
      return "Carregando plano...";
    }

    if (error) {
      return "Não foi possível carregar o plano";
    }

    return planName;
  }, [error, isLoading, planName]);

  const planStatusTone = error
    ? "text-destructive border-destructive/40 bg-destructive/10"
    : "text-primary border-primary/30 bg-primary/10";

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 sm:gap-3">
      <ModeToggle />
      <IntimacaoMenu />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex min-w-0 items-center gap-2 px-2 py-1.5 sm:px-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary text-primary-foreground">
                {getInitials(user?.nome_completo)}
              </AvatarFallback>
            </Avatar>
            <div className="hidden min-w-0 text-left sm:block">
              <p className="max-w-[160px] truncate text-sm font-medium">
                {user?.nome_completo ?? "Usuário"}
              </p>
              <p className="max-w-[160px] truncate text-xs text-muted-foreground">
                {user?.email ?? "Conta"}
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
          {user?.id === 3 && (
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
          <div className="px-2 pb-1 pt-2 text-left">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Plano atual</p>
            <span
              className={cn(
                "mt-1 inline-flex max-w-full items-center gap-2 truncate rounded-full border px-3 py-1 text-xs font-semibold",
                planStatusTone,
              )}
              title={planStatusLabel}
            >
              {planStatusLabel}
            </span>
          </div>
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
