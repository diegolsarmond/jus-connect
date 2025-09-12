import { useState } from "react";
import { ArrowLeft, Monitor, Smartphone, Shield, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProfileCard } from "@/components/profile/ProfileCard";
import { SessionsList } from "@/components/profile/SessionsList";
import { UserSession } from "@/types/user";

// Mock data
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
    device: "Safari 17.2 - iPhone 15 Pro",
    location: "São Paulo, SP - Brasil",
    lastActivity: new Date("2024-01-15T08:45:00"),
    isActive: true
  },
  {
    id: "3",
    userId: "1",
    device: "Firefox 121.0 - macOS Sonoma",
    location: "Rio de Janeiro, RJ - Brasil",
    lastActivity: new Date("2024-01-14T16:20:00"),
    isActive: true
  },
  {
    id: "4",
    userId: "1",
    device: "Chrome 119.0 - Android 14",
    location: "São Paulo, SP - Brasil",
    lastActivity: new Date("2024-01-14T12:15:00"),
    isActive: false
  },
  {
    id: "5",
    userId: "1",
    device: "Edge 120.0 - Windows 11",
    location: "Belo Horizonte, MG - Brasil",
    lastActivity: new Date("2024-01-13T09:30:00"),
    isActive: false
  },
  {
    id: "6",
    userId: "1",
    device: "Safari 16.6 - iPad Pro",
    location: "Brasília, DF - Brasil",
    lastActivity: new Date("2024-01-12T14:45:00"),
    isActive: false
  }
];

export default function SessaoDispositivos() {
  const [sessions, setSessions] = useState<UserSession[]>(mockSessions);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const activeSessions = sessions.filter(s => s.isActive);
  const totalDevices = sessions.length;
  const suspiciousActivities = sessions.filter(s => 
    s.location.includes("Rio de Janeiro") || s.location.includes("Belo Horizonte")
  ).length;

  const handleRevokeSession = (sessionId: string) => {
    setSessions(prev => 
      prev.map(session => 
        session.id === sessionId 
          ? { ...session, isActive: false, lastActivity: new Date() }
          : session
      )
    );
  };

  const handleRevokeAllSessions = () => {
    setSessions(prev =>
      prev.map(session => ({
        ...session,
        isActive: session.device.includes('Chrome 120.0 - Windows 10') ? true : false, // Keep current session
        lastActivity: session.device.includes('Chrome 120.0 - Windows 10') ? session.lastActivity : new Date()
      }))
    );
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      // In real app, refetch session data
    }, 1000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Sessões e Dispositivos</h1>
            <p className="text-muted-foreground">Monitore e gerencie o acesso à sua conta</p>
          </div>
        </div>

        <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        <ProfileCard title="Sessões Ativas" variant="compact">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success-light">
              <Shield className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{activeSessions.length}</p>
              <p className="text-sm text-muted-foreground">dispositivos</p>
            </div>
          </div>
        </ProfileCard>

        <ProfileCard title="Total de Dispositivos" variant="compact">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary-light">
              <Monitor className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalDevices}</p>
              <p className="text-sm text-muted-foreground">registrados</p>
            </div>
          </div>
        </ProfileCard>

        <ProfileCard title="Dispositivos Móveis" variant="compact">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent">
              <Smartphone className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {sessions.filter(s => s.device.toLowerCase().includes('iphone') || s.device.toLowerCase().includes('android')).length}
              </p>
              <p className="text-sm text-muted-foreground">dispositivos</p>
            </div>
          </div>
        </ProfileCard>

        <ProfileCard title="Atividade Suspeita" variant="compact">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning-light">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{suspiciousActivities}</p>
              <p className="text-sm text-muted-foreground">localizações</p>
            </div>
          </div>
        </ProfileCard>
      </div>

      {/* Sessions List */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ProfileCard title="Todas as Sessões">
            <SessionsList
              sessions={sessions}
              onRevokeSession={handleRevokeSession}
              onRevokeAllSessions={handleRevokeAllSessions}
            />
          </ProfileCard>
        </div>

        {/* Security Insights */}
        <div className="space-y-6">
          <ProfileCard title="Insights de Segurança" variant="compact">
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium text-foreground">Localização Incomum</h4>
                <p className="text-sm text-muted-foreground">
                  Detectamos acessos de Rio de Janeiro e Belo Horizonte. Se não foi você, revogue essas sessões.
                </p>
                <Badge variant="outline" className="text-warning border-warning/50">
                  Atenção Necessária
                </Badge>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-foreground">Dispositivos Antigos</h4>
                <p className="text-sm text-muted-foreground">
                  Alguns dispositivos não fazem login há mais de 30 dias.
                </p>
                <Badge variant="secondary">
                  Revisar
                </Badge>
              </div>
            </div>
          </ProfileCard>

          <ProfileCard title="Configurações de Sessão" variant="compact">
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium text-foreground">Timeout de Sessão</h4>
                <p className="text-sm text-muted-foreground">
                  Sessões inativas são automaticamente encerradas após 8 horas
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-foreground">Notificações</h4>
                <p className="text-sm text-muted-foreground">
                  Receba alertas sobre novos logins por email
                </p>
                <Button variant="outline" size="sm">
                  Configurar
                </Button>
              </div>
            </div>
          </ProfileCard>

          <ProfileCard title="Ações Rápidas" variant="compact">
            <div className="space-y-2">
              <Button variant="outline" size="sm" className="w-full">
                Alterar Senha
              </Button>
              <Button variant="outline" size="sm" className="w-full">
                Ativar 2FA
              </Button>
              <Button variant="outline" size="sm" className="w-full text-destructive hover:text-destructive-foreground hover:bg-destructive">
                Revogar Todas as Sessões
              </Button>
            </div>
          </ProfileCard>
        </div>
      </div>
    </div>
  );
}