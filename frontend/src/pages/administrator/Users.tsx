import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Shield, UserCheck, UserX, Users } from "lucide-react";

import { routes } from "@/config/routes";
import { getApiUrl } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ApiUser = {
  id?: number | string;
  nome_completo?: string | null;
  email?: string | null;
  perfil?: string | null;
  empresa?: string | null;
  status?: boolean | number | string | null;
  ultimo_login?: string | null;
};

type DisplayUser = {
  id: string;
  displayName: string;
  email: string;
  companyName: string;
  role: string;
  roleNormalized: string;
  isActive: boolean;
  lastLogin: string | null;
  searchText: string;
};

const normalizeStatus = (status: ApiUser["status"]): boolean => {
  if (typeof status === "boolean") {
    return status;
  }

  if (typeof status === "number") {
    return status !== 0;
  }

  if (typeof status === "string") {
    const normalized = status.trim().toLowerCase();
    if (["false", "0", "inativo", "inactive", "nao", "não", "no", "n"].includes(normalized)) {
      return false;
    }

    if (["true", "1", "ativo", "active", "sim", "yes", "y", "s"].includes(normalized)) {
      return true;
    }
  }

  return Boolean(status);
};

const resolveRoleBadgeVariant = (role: string): BadgeProps["variant"] => {
  const normalized = role.trim().toLowerCase();

  if (!normalized || normalized === "sem perfil") {
    return "outline";
  }

  if (normalized.includes("admin")) {
    return "default";
  }

  if (normalized.includes("suporte") || normalized.includes("support")) {
    return "outline";
  }

  if (normalized.includes("finance") || normalized.includes("gestor")) {
    return "secondary";
  }

  return "secondary";
};

export default function UsersPage() {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchUsers = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(getApiUrl("admin/usuarios"), {
        signal,
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(
          response.status === 404
            ? "Nenhum usuário encontrado."
            : `Erro ao carregar usuários (código ${response.status}).`
        );
      }

      const data = (await response.json()) as unknown;

      if (!Array.isArray(data)) {
        throw new Error("Resposta inesperada do servidor.");
      }

      const sanitizedUsers = data.filter(
        (item): item is ApiUser => typeof item === "object" && item !== null
      );

      if (!signal?.aborted) {
        setUsers(sanitizedUsers);
      }
    } catch (fetchError) {
      if (signal?.aborted) {
        return;
      }

      if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
        return;
      }

      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Não foi possível carregar os usuários.";
      setError(message);
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchUsers(controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchUsers]);

  const normalizedUsers = useMemo<DisplayUser[]>(() => {
    return users.map((user, index) => {
      const rawId = user.id;
      const fallbackId = `user-${index}`;
      const id =
        typeof rawId === "number" || typeof rawId === "string"
          ? String(rawId)
          : fallbackId;

      const nameCandidate =
        typeof user.nome_completo === "string" && user.nome_completo.trim().length > 0
          ? user.nome_completo.trim()
          : undefined;
      const emailCandidate =
        typeof user.email === "string" && user.email.trim().length > 0
          ? user.email.trim()
          : undefined;
      const displayName = nameCandidate ?? emailCandidate ?? `Usuário ${index + 1}`;

      const companyName =
        typeof user.empresa === "string" && user.empresa.trim().length > 0
          ? user.empresa.trim()
          : "—";

      const role =
        typeof user.perfil === "string" && user.perfil.trim().length > 0
          ? user.perfil.trim()
          : "Sem perfil";
      const roleNormalized = role.toLowerCase();

      const lastLogin =
        typeof user.ultimo_login === "string" && user.ultimo_login.trim().length > 0
          ? user.ultimo_login
          : null;

      const searchText = [displayName, emailCandidate ?? "", companyName, role]
        .map((part) => part.toLowerCase())
        .join(" ");

      return {
        id,
        displayName,
        email: emailCandidate ?? "",
        companyName,
        role,
        roleNormalized,
        isActive: normalizeStatus(user.status),
        lastLogin,
        searchText,
      } satisfies DisplayUser;
    });
  }, [users]);

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return normalizedUsers;
    }

    return normalizedUsers.filter((user) => user.searchText.includes(term));
  }, [normalizedUsers, searchTerm]);

  const stats = useMemo(() => {
    const total = normalizedUsers.length;
    let active = 0;
    let admin = 0;
    const roleCounts = new Map<string, number>();

    normalizedUsers.forEach((user) => {
      if (user.isActive) {
        active += 1;
      }

      if (user.roleNormalized.includes("admin")) {
        admin += 1;
      }

      const roleKey = user.role;
      roleCounts.set(roleKey, (roleCounts.get(roleKey) ?? 0) + 1);
    });

    const roleDistribution = Array.from(roleCounts.entries())
      .map(([role, count]) => ({ role, count }))
      .sort((a, b) => {
        if (b.count !== a.count) {
          return b.count - a.count;
        }

        return a.role.localeCompare(b.role, "pt-BR");
      });

    return {
      totalUsers: total,
      activeUsers: active,
      adminUsers: admin,
      inactiveUsers: total - active,
      activePercentage: total > 0 ? (active / total) * 100 : 0,
      roleDistribution,
    };
  }, [normalizedUsers]);

  const activePercentageLabel = stats.totalUsers > 0
    ? `${stats.activePercentage.toFixed(1)}% do total`
    : "0% do total";

  const handleRetry = useCallback(() => {
    void fetchUsers();
  }, [fetchUsers]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Usuários</h1>
          <p className="text-muted-foreground">Gerencie usuários e permissões do sistema</p>
        </div>
        <Button asChild>
          <Link to={routes.admin.newUser}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Usuário
          </Link>
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "..." : stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">Todos os usuários</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "..." : stats.activeUsers}</div>
            <p className="text-xs text-muted-foreground">
              {isLoading ? "--" : activePercentageLabel}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Administradores</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "..." : stats.adminUsers}</div>
            <p className="text-xs text-muted-foreground">Com privilégios admin</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuários Inativos</CardTitle>
            <UserX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "..." : stats.inactiveUsers}</div>
            <p className="text-xs text-muted-foreground">Necessitam atenção</p>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Usuários</CardTitle>
          <CardDescription>Visualize e gerencie todos os usuários do sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar usuários..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Erro ao carregar usuários</AlertTitle>
              <AlertDescription>
                {error}
                <Button variant="link" className="ml-2 h-auto p-0" onClick={handleRetry}>
                  Tentar novamente
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Último Login</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                      Carregando usuários...
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                      {searchTerm
                        ? "Nenhum usuário encontrado para os termos informados."
                        : "Nenhum usuário cadastrado até o momento."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => {
                    const lastLoginDate = user.lastLogin ? new Date(user.lastLogin) : null;
                    const hasValidLastLogin =
                      lastLoginDate instanceof Date && !Number.isNaN(lastLoginDate.getTime());

                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{user.displayName}</div>
                            <div className="text-sm text-muted-foreground">{user.email || "—"}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{user.companyName}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={resolveRoleBadgeVariant(user.role)}>{user.role}</Badge>
                        </TableCell>
                        <TableCell>
                          {user.isActive ? (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                              Ativo
                            </Badge>
                          ) : (
                            <Badge variant="destructive">Inativo</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {hasValidLastLogin ? (
                            <>
                              <div className="text-sm">
                                {lastLoginDate.toLocaleDateString("pt-BR")}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {lastLoginDate.toLocaleTimeString("pt-BR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            </>
                          ) : (
                            <div className="text-sm text-muted-foreground">Nunca acessou</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button variant="ghost" size="sm">
                              Ver Perfil
                            </Button>
                            <Button variant="outline" size="sm">
                              Editar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* User Management Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Gerenciamento de Acesso</CardTitle>
            <CardDescription>Controle permissões e níveis de acesso</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full justify-start" variant="outline">
              <Shield className="h-4 w-4 mr-2" />
              Gerenciar Permissões
            </Button>
            <Button className="w-full justify-start" variant="outline">
              <UserCheck className="h-4 w-4 mr-2" />
              Ativar Usuários em Lote
            </Button>
            <Button className="w-full justify-start" variant="outline">
              <UserX className="h-4 w-4 mr-2" />
              Revisar Usuários Inativos
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Função</CardTitle>
            <CardDescription>Breakdown dos usuários por tipo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando dados...</p>
            ) : stats.roleDistribution.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum usuário disponível.</p>
            ) : (
              stats.roleDistribution.map(({ role, count }) => (
                <div key={role} className="flex justify-between items-center">
                  <span className="text-sm">{role}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{count}</span>
                    <Badge variant={resolveRoleBadgeVariant(role)}>{role}</Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}