import { useState } from "react";
import { ArrowLeft, Shield, Clock, Activity, MapPin, Smartphone, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { User, AuditLog, UserSession } from "@/types/user";

// Mock data
const mockUser: User = {
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
};

const mockAuditLogs: AuditLog[] = [
  {
    id: "1",
    userId: "1",
    action: "LOGIN",
    description: "Login realizado com sucesso",
    timestamp: new Date("2024-01-15T10:30:00"),
    performedBy: "Sistema"
  },
  {
    id: "2",
    userId: "1",
    action: "PROFILE_UPDATE",
    description: "Telefone atualizado",
    timestamp: new Date("2024-01-14T14:20:00"),
    performedBy: "Admin (Maria Santos)"
  },
  {
    id: "3",
    userId: "1",
    action: "ROLE_CHANGE",
    description: "Role alterado de 'estagiario' para 'advogado'",
    timestamp: new Date("2024-01-10T09:15:00"),
    performedBy: "Admin (Carlos Oliveira)"
  }
];

const mockSessions: UserSession[] = [
  {
    id: "1",
    userId: "1",
    device: "Chrome 120.0 - Windows 10",
    location: "São Paulo, SP - Brasil",
    lastActivity: new Date("2024-01-15T10:30:00"),
    isActive: true
  },
  {
    id: "2",
    userId: "1",
    device: "Safari 17.2 - iPhone",
    location: "São Paulo, SP - Brasil",
    lastActivity: new Date("2024-01-14T18:45:00"),
    isActive: false
  }
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

export default function PerfilUsuario() {
  const [user] = useState<User>(mockUser);
  const [auditLogs] = useState<AuditLog[]>(mockAuditLogs);
  const [sessions] = useState<UserSession[]>(mockSessions);

  const formatDateTime = (date: Date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getActionLabel = (action: string) => {
    const labels = {
      LOGIN: "Login",
      LOGOUT: "Logout",
      PROFILE_UPDATE: "Perfil Atualizado",
      PASSWORD_CHANGE: "Senha Alterada",
      ROLE_CHANGE: "Role Alterado",
      STATUS_CHANGE: "Status Alterado",
      OAB_UPDATE: "OAB Atualizada"
    };
    return labels[action as keyof typeof labels] || action;
  };

  const getActionColor = (action: string) => {
    const colors = {
      LOGIN: "text-green-600",
      LOGOUT: "text-gray-600",
      PROFILE_UPDATE: "text-blue-600",
      PASSWORD_CHANGE: "text-orange-600",
      ROLE_CHANGE: "text-purple-600",
      STATUS_CHANGE: "text-red-600",
      OAB_UPDATE: "text-blue-600"
    };
    return colors[action as keyof typeof colors] || "text-gray-600";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Perfil do Usuário</h1>
          <p className="text-muted-foreground">Visualizar detalhes e histórico</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Informações Principais */}
        <div className="lg:col-span-2 space-y-6">
          {/* Dados Básicos */}
          <Card>
            <CardHeader>
              <CardTitle>Informações Básicas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-6">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback>
                    {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 space-y-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold">{user.name}</h3>
                      <Badge variant={user.ativo ? "default" : "secondary"}>
                        {user.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <div className="grid gap-2 text-sm text-muted-foreground">
                      <p>{user.email}</p>
                      <p>{user.phone}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant={roleVariants[user.role]}>
                      {roleLabels[user.role]}
                    </Badge>
                    <Badge variant="outline">{user.escritorio}</Badge>
                    {user.oab && (
                      <Badge variant="outline">
                        OAB: {user.oab.numero}/{user.oab.uf}
                      </Badge>
                    )}
                  </div>

                  {user.especialidades.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">Especialidades:</p>
                      <div className="flex flex-wrap gap-2">
                        {user.especialidades.map((especialidade) => (
                          <Badge key={especialidade} variant="secondary">
                            {especialidade}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Criado em:</span>
                      <span>{formatDateTime(user.createdAt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Último login:</span>
                      <span>{user.ultimoLogin ? formatDateTime(user.ultimoLogin) : "Nunca"}</span>
                    </div>
                    {user.tarifaPorHora && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tarifa/hora:</span>
                        <span>R$ {user.tarifaPorHora.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sessões Ativas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                Sessões Ativas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sessions.map((session) => (
                  <div key={session.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${session.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <div>
                        <p className="font-medium">{session.device}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          <span>{session.location}</span>
                          <span>•</span>
                          <Clock className="h-3 w-3" />
                          <span>{formatDateTime(session.lastActivity)}</span>
                        </div>
                      </div>
                    </div>
                    {session.isActive && (
                      <Button variant="outline" size="sm">
                        Revogar
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Timeline de Auditoria */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Histórico de Auditoria
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {auditLogs.map((log, index) => (
                  <div key={log.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full ${getActionColor(log.action)} bg-current`} />
                      {index < auditLogs.length - 1 && (
                        <div className="w-px h-8 bg-border mt-1" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-medium ${getActionColor(log.action)}`}>
                          {getActionLabel(log.action)}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {formatDateTime(log.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">
                        {log.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Por: {log.performedBy}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar de Ações */}
        <div className="space-y-6">
          {/* Ações Rápidas */}
          <Card>
            <CardHeader>
              <CardTitle>Ações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full" size="sm">
                Editar Perfil
              </Button>
              <Button variant="outline" className="w-full" size="sm">
                Reset Senha
              </Button>
              <Button variant="outline" className="w-full" size="sm">
                Convidar por Email
              </Button>
              <Separator />
              <Button variant="outline" className="w-full" size="sm">
                {user.ativo ? "Desativar" : "Ativar"} Usuário
              </Button>
              <Button variant="destructive" className="w-full" size="sm">
                Excluir Usuário
              </Button>
            </CardContent>
          </Card>

          {/* Permissões */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Permissões
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span>Gerenciar Clientes</span>
                  <Badge variant="secondary" className="text-xs">✓</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Gerenciar Processos</span>
                  <Badge variant="secondary" className="text-xs">✓</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Agenda</span>
                  <Badge variant="secondary" className="text-xs">✓</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Relatórios</span>
                  <Badge variant="outline" className="text-xs">✗</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Configurações</span>
                  <Badge variant="outline" className="text-xs">✗</Badge>
                </div>
              </div>
              <Button variant="outline" size="sm" className="w-full">
                Gerenciar Permissões
              </Button>
            </CardContent>
          </Card>

          {/* Configurações */}
          <Card>
            <CardHeader>
              <CardTitle>Configurações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Timezone</span>
                <span>GMT-3</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Idioma</span>
                <span>Português (BR)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">2FA</span>
                <Badge variant="outline" className="text-xs">Inativo</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}