import { Search, User, LogOut, ArrowLeftRight } from "lucide-react";
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

export function Header() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const canAccessConfiguracoes =
    user?.modulos?.some((moduleId) => moduleId === "configuracoes" || moduleId.startsWith("configuracoes-")) ?? false;

  const handleLogout = useCallback(() => {
    logout();
    navigate(routes.login, { replace: true });
  }, [logout, navigate]);

  return (
    <header className="h-16 bg-card border-b border-border px-6 flex items-center justify-between gap-4">
      {/* Search */}
      <div className="flex flex-1 items-center gap-3">
        <SidebarTrigger className="text-muted-foreground" />
        <div className="flex-1 max-w-md">
          <div className="relative">
            {/*<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />*/}
            {/*<Input*/}
            {/*  placeholder="Pesquisar clientes, processos..."*/}
            {/*  className="pl-9 bg-muted/50"*/}
            {/*/>*/}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <ModeToggle />
        {/* Notifications */}
        <IntimacaoMenu />

        {/* User Menu */}
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
                  navigate(routes.admin.dashboard);
                }}
              >
                <ArrowLeftRight className="mr-2 h-4 w-4" />
                Alternar perfil
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
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
            {/*<DropdownMenuSeparator />*/}
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
    </header>
  );
}
