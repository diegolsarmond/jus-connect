import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Filter, Plus, Download, MoreHorizontal, Edit, UserX, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { User } from "@/types/user";

// Mock data
const mockUsers: User[] = [
  {
    id: "1",
    name: "Dr. João Silva",
    email: "joao.silva@escritorio.com.br",
    phone: "(11) 99999-9999",
    role: "advogado",
    escritorio: "Escritório Principal",
    oab: { numero: "123456", uf: "SP" },
    especialidades: ["Direito Civil", "Direito Empresarial"],
    tarifaPorHora: 350,
    timezone: "America/Sao_Paulo",
    idioma: "pt-BR",
    ativo: true,
    ultimoLogin: new Date("2024-01-15T10:30:00"),
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-15"),
  },
  {
    id: "2",
    name: "Maria Santos",
    email: "maria.santos@escritorio.com.br",
    phone: "(11) 88888-8888",
    role: "secretario",
    escritorio: "Escritório Principal",
    especialidades: [],
    timezone: "America/Sao_Paulo",
    idioma: "pt-BR",
    ativo: true,
    ultimoLogin: new Date("2024-01-15T14:20:00"),
    createdAt: new Date("2024-01-02"),
    updatedAt: new Date("2024-01-15"),
  },
];

const roleLabels = {
  admin: "Administrador",
  advogado: "Advogado",
  estagiario: "Estagiário",
  secretario: "Secretário"
};

const roleVariants = {
  admin: "destructive",
  advogado: "default",
  estagiario: "secondary",
  secretario: "outline"
} as const;

export default function Usuarios() {
  const [users] = useState<User[]>(mockUsers);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("todos");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const navigate = useNavigate();

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "todos" || user.role === roleFilter;
    const matchesStatus = statusFilter === "todos" || 
                         (statusFilter === "ativo" && user.ativo) ||
                         (statusFilter === "inativo" && !user.ativo);
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleSelectUser = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    setSelectedUsers(
      selectedUsers.length === filteredUsers.length 
        ? [] 
        : filteredUsers.map(user => user.id)
    );
  };

  const formatLastLogin = (date?: Date) => {
    if (!date) return "Nunca";
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Usuários</h1>
          <p className="text-muted-foreground">Gerencie usuários, roles e permissões</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button size="sm" onClick={() => navigate("/configuracoes/usuarios/novo")}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Usuário
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Usuários</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os roles</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="advogado">Advogado</SelectItem>
                <SelectItem value="estagiario">Estagiário</SelectItem>
                <SelectItem value="secretario">Secretário</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bulk Actions */}
          {selectedUsers.length > 0 && (
            <div className="bg-muted/50 p-4 rounded-lg mb-4 flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {selectedUsers.length} usuário(s) selecionado(s)
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Mail className="h-4 w-4 mr-2" />
                  Convidar
                </Button>
                <Button variant="outline" size="sm">
                  <UserX className="h-4 w-4 mr-2" />
                  Desativar
                </Button>
              </div>
            </div>
          )}

          {/* Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Escritório</TableHead>
                <TableHead>OAB</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Último Login</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedUsers.includes(user.id)}
                      onCheckedChange={() => handleSelectUser(user.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatar} alt={user.name} />
                        <AvatarFallback>
                          {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{user.name}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={roleVariants[user.role]}>
                      {roleLabels[user.role]}
                    </Badge>
                  </TableCell>
                  <TableCell>{user.escritorio}</TableCell>
                  <TableCell>
                    {user.oab ? `${user.oab.numero}/${user.oab.uf}` : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.ativo ? "default" : "secondary"}>
                      {user.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatLastLogin(user.ultimoLogin)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          Ver Perfil
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                          Reset Senha
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          {user.ativo ? "Desativar" : "Ativar"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredUsers.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum usuário encontrado
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}