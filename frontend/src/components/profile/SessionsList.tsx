import { useMemo, useState } from "react";
import { AlertTriangle, Clock, Loader2, MapPin, Monitor, Shield, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserSession } from "@/types/user";
import { Card, CardContent } from "@/components/ui/card";

interface SessionsListProps {
  sessions: UserSession[];
  onRevokeSession?: (sessionId: string) => Promise<void> | void;
  onRevokeAllSessions?: () => Promise<void> | void;
  isLoading?: boolean;
  error?: string | null;
  onReload?: () => Promise<void> | void;
}

const formatDateTime = (date: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

const getDeviceIcon = (device: string) => {
  if (device.toLowerCase().includes("iphone") || device.toLowerCase().includes("android")) {
    return Smartphone;
  }
  return Monitor;
};

const getDeviceType = (device: string) => {
  const normalized = device.toLowerCase();
  if (normalized.includes("iphone")) return "iPhone";
  if (normalized.includes("android")) return "Android";
  if (normalized.includes("ipad")) return "iPad";
  if (normalized.includes("mac") || normalized.includes("safari")) return "Desktop (Safari)";
  if (normalized.includes("firefox")) return "Desktop (Firefox)";
  if (normalized.includes("edge")) return "Desktop (Edge)";
  if (normalized.includes("chrome")) return "Desktop (Chrome)";
  return "Dispositivo";
};

export function SessionsList({
  sessions,
  onRevokeSession,
  onRevokeAllSessions,
  isLoading,
  error,
  onReload,
}: SessionsListProps) {
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [isRevokingAll, setIsRevokingAll] = useState(false);

  const activeSessions = useMemo(() => sessions.filter((session) => session.isActive), [sessions]);
  const inactiveSessions = useMemo(() => sessions.filter((session) => !session.isActive), [sessions]);

  const handleRevokeSession = async (sessionId: string) => {
    if (!onRevokeSession) {
      return;
    }

    try {
      setPendingSessionId(sessionId);
      await onRevokeSession(sessionId);
    } finally {
      setPendingSessionId(null);
    }
  };

  const handleRevokeAllSessions = async () => {
    if (!onRevokeAllSessions) {
      return;
    }

    try {
      setIsRevokingAll(true);
      await onRevokeAllSessions();
    } finally {
      setIsRevokingAll(false);
    }
  };

  const renderSessionCard = (session: UserSession) => {
    const DeviceIcon = getDeviceIcon(session.device);
    const isCurrent = session.isCurrent === true;
    const isPending = pendingSessionId === session.id;

    return (
      <Card
        key={session.id}
        className={`transition-colors ${session.isActive ? "border-success/20 bg-success-light/5" : "border-border"}`}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <div className={`p-2 rounded-lg ${session.isActive ? "bg-success-light" : "bg-muted"}`}>
                <DeviceIcon className={`h-5 w-5 ${session.isActive ? "text-success" : "text-muted-foreground"}`} />
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-medium text-foreground">{getDeviceType(session.device)}</h4>

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
                    <span>{session.location ?? "Localização não informada"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    <span>
                      {session.isActive ? "Última atividade" : "Finalizada"}: {formatDateTime(session.lastActivity)}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground font-mono break-all">{session.device}</p>
              </div>
            </div>

            {onRevokeSession && session.isActive && !isCurrent && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRevokeSession(session.id)}
                className="text-destructive hover:text-destructive-foreground hover:bg-destructive"
                disabled={isPending || isRevokingAll}
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Revogar"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Carregando sessões...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
        <Shield className="h-8 w-8 text-destructive" />
        <p className="text-sm text-muted-foreground max-w-xs">{error}</p>
        {onReload && (
          <Button variant="outline" size="sm" onClick={() => void onReload()}>
            Tentar novamente
          </Button>
        )}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8 text-muted-foreground">
        <Monitor className="h-8 w-8" />
        <p className="text-sm">Nenhuma sessão encontrada.</p>
        {onReload && (
          <Button variant="outline" size="sm" onClick={() => void onReload()}>
            Atualizar lista
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <span className="font-medium">Gerenciar Sessões</span>
        </div>

        {onRevokeAllSessions && activeSessions.length > 1 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRevokeAllSessions}
            className="text-destructive hover:text-destructive-foreground hover:bg-destructive"
            disabled={isRevokingAll}
          >
            {isRevokingAll ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 mr-2" /> Revogar Todas
              </>
            )}
          </Button>
        )}
      </div>

      {activeSessions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-foreground">Sessões Ativas</h3>
            <Badge variant="default" className="bg-success text-success-foreground">
              {activeSessions.length}
            </Badge>
          </div>

          <div className="space-y-3">{activeSessions.map(renderSessionCard)}</div>
        </div>
      )}

      {inactiveSessions.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-medium text-foreground">Sessões Recentes</h3>

          <div className="space-y-3">{inactiveSessions.slice(0, 5).map(renderSessionCard)}</div>

          {inactiveSessions.length > 5 && (
            <div className="text-center">
              <Badge variant="outline">+{inactiveSessions.length - 5} sessões anteriores</Badge>
            </div>
          )}
        </div>
      )}

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