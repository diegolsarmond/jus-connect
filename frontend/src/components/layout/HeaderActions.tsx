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
  const canAccessConfiguracoes =
    user?.modulos?.some((moduleId) => moduleId === "configuracoes" || moduleId.startsWith("configuracoes-")) ?? false;

  const isOnAdminArea = useMemo(() => {
    const adminRoot = routes.admin.root;
    return location.pathname === adminRoot || location.pathname.startsWith(`${adminRoot}/`);
  }, [location.pathname]);

  const profileToggleLabel = isOnAdminArea ? "Alternar para CRM" : "Alternar para admin";

  const handleProfileToggle = useCallback(() => {
    if (isOnAdminArea) {
      navigate(routes.home, { replace: true });
      return;
    }

    navigate(routes.admin.dashboard, { replace: true });
  }, [isOnAdminArea, navigate]);

  const handleLogout = useCallback(() => {
    logout();
    navigate(routes.login, { replace: true });
  }, [logout, navigate]);

  return (
    <div className="flex items-center gap-3">
      <ModeToggle />
      <IntimacaoMenu />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary text-primary-foreground">
                {getInitials(user?.nome_completo)}
              </AvatarFallback>
            </Avatar>
            <div className="text-left">
              <p className="text-sm font-medium truncate max-w-[160px]">
                {user?.nome_completo ?? "Usuário"}
              </p>
              <p className="text-xs text-muted-foreground truncate max-w-[160px]">
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
