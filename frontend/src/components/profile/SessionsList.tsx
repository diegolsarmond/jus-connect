import { Monitor, Smartphone, MapPin, Clock, Shield, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserSession } from "@/types/user";
import { Card, CardContent } from "@/components/ui/card";

interface SessionsListProps {
  sessions: UserSession[];
  onRevokeSession: (sessionId: string) => void;
  onRevokeAllSessions: () => void;
}

export function SessionsList({ sessions, onRevokeSession, onRevokeAllSessions }: SessionsListProps) {
  const activeSessions = sessions.filter(s => s.isActive);
  const inactiveSessions = sessions.filter(s => !s.isActive);

  const formatDateTime = (date: Date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getDeviceIcon = (device: string) => {
    if (device.toLowerCase().includes('iphone') || device.toLowerCase().includes('android')) {
      return Smartphone;
    }
    return Monitor;
  };

  const getDeviceType = (device: string) => {
    if (device.toLowerCase().includes('iphone')) return 'iPhone';
    if (device.toLowerCase().includes('android')) return 'Android';
    if (device.toLowerCase().includes('chrome')) return 'Desktop (Chrome)';
    if (device.toLowerCase().includes('safari')) return 'Desktop (Safari)';
    if (device.toLowerCase().includes('firefox')) return 'Desktop (Firefox)';
    return 'Desktop';
  };

  const isCurrentSession = (session: UserSession) => {
    // Mock logic - in real app, you'd compare with current session ID
    return session.isActive && session.device.includes('Chrome');
  };

  const SessionCard = ({ session }: { session: UserSession }) => {
    const DeviceIcon = getDeviceIcon(session.device);
    const isCurrent = isCurrentSession(session);
    
    return (
      <Card className={`transition-colors ${session.isActive ? 'border-success/20 bg-success-light/5' : 'border-border'}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <div className={`p-2 rounded-lg ${session.isActive ? 'bg-success-light' : 'bg-muted'}`}>
                <DeviceIcon className={`h-5 w-5 ${session.isActive ? 'text-success' : 'text-muted-foreground'}`} />
              </div>
              
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-medium text-foreground">
                    {getDeviceType(session.device)}
                  </h4>
                  
                  {session.isActive && (
                    <Badge variant="default" className="bg-success text-success-foreground">
                      Ativa
                    </Badge>
                  )}
                  
                  {isCurrent && (
                    <Badge variant="outline" className="border-primary text-primary">
                      Sessão Atual
                    </Badge>
                  )}
                </div>
                
                <div className="text-sm text-muted-foreground space-y-1">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3 w-3" />
                    <span>{session.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    <span>
                      {session.isActive ? 'Última atividade' : 'Finalizada'}: {formatDateTime(session.lastActivity)}
                    </span>
                  </div>
                </div>
                
                <p className="text-xs text-muted-foreground font-mono">
                  {session.device}
                </p>
              </div>
            </div>
            
            <div className="flex flex-col gap-2 ml-4">
              {session.isActive && !isCurrent && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRevokeSession(session.id)}
                  className="text-destructive hover:text-destructive-foreground hover:bg-destructive"
                >
                  Revogar
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Actions Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <span className="font-medium">Gerenciar Sessões</span>
        </div>
        
        {activeSessions.length > 1 && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRevokeAllSessions}
            className="text-destructive hover:text-destructive-foreground hover:bg-destructive"
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Revogar Todas
          </Button>
        )}
      </div>

      {/* Active Sessions */}
      {activeSessions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-foreground">Sessões Ativas</h3>
            <Badge variant="default" className="bg-success text-success-foreground">
              {activeSessions.length}
            </Badge>
          </div>
          
          <div className="space-y-3">
            {activeSessions.map(session => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        </div>
      )}

      {/* Inactive Sessions */}
      {inactiveSessions.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-medium text-foreground">Sessões Recentes</h3>
          
          <div className="space-y-3">
            {inactiveSessions.slice(0, 5).map(session => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
          
          {inactiveSessions.length > 5 && (
            <div className="text-center">
              <Badge variant="outline">
                +{inactiveSessions.length - 5} sessões anteriores
              </Badge>
            </div>
          )}
        </div>
      )}

      {/* Security Tips */}
      <Card className="border-warning/20 bg-warning-light/5">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Shield className="h-5 w-5 text-warning mt-0.5" />
            <div className="space-y-2">
              <h4 className="font-medium text-foreground">Dicas de Segurança</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Revogue sessões de dispositivos que você não reconhece</li>
                <li>• Faça logout ao usar computadores públicos</li>
                <li>• Ative a autenticação de dois fatores para maior segurança</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}