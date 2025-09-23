import { Activity, Eye, EyeOff, Loader2, Lock, Mail, Shield, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AuditLog } from "@/types/user";

interface AuditTimelineProps {
  logs: AuditLog[];
  maxItems?: number;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const actionIcons = {
  LOGIN: Activity,
  LOGOUT: Activity,
  PROFILE_UPDATE: User,
  PASSWORD_CHANGE: Lock,
  ROLE_CHANGE: Shield,
  EMAIL_CHANGE: Mail,
  STATUS_CHANGE: Eye,
  ACCOUNT_LOCKED: EyeOff,
  OAB_UPDATE: User,
  PERMISSION_CHANGE: Shield,
  TWO_FACTOR_ENABLED: Shield,
  TWO_FACTOR_DISABLED: Shield,
};

const actionColors = {
  LOGIN: "text-success",
  LOGOUT: "text-muted-foreground",
  PROFILE_UPDATE: "text-primary",
  PASSWORD_CHANGE: "text-warning",
  ROLE_CHANGE: "text-primary",
  EMAIL_CHANGE: "text-primary",
  STATUS_CHANGE: "text-destructive",
  ACCOUNT_LOCKED: "text-destructive",
  OAB_UPDATE: "text-primary",
  PERMISSION_CHANGE: "text-primary",
  TWO_FACTOR_ENABLED: "text-success",
  TWO_FACTOR_DISABLED: "text-warning",
};

const actionLabels = {
  LOGIN: "Login",
  LOGOUT: "Logout",
  PROFILE_UPDATE: "Perfil Atualizado",
  PASSWORD_CHANGE: "Senha Alterada",
  ROLE_CHANGE: "Role Alterado",
  EMAIL_CHANGE: "Email Alterado",
  STATUS_CHANGE: "Status Alterado",
  ACCOUNT_LOCKED: "Conta Bloqueada",
  OAB_UPDATE: "OAB Atualizada",
  PERMISSION_CHANGE: "Permissões Alteradas",
  TWO_FACTOR_ENABLED: "2FA Ativado",
  TWO_FACTOR_DISABLED: "2FA Desativado",
};

export function AuditTimeline({ logs, maxItems = 10, isLoading, error, onRetry }: AuditTimelineProps) {
  const displayLogs = logs.slice(0, maxItems);

  const formatDateTime = (date: Date) =>
    new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);

  const getActionIcon = (action: string) => {
    const IconComponent = actionIcons[action as keyof typeof actionIcons] || Activity;
    return IconComponent;
  };

  const getActionColor = (action: string) => {
    return actionColors[action as keyof typeof actionColors] || "text-muted-foreground";
  };

  const getActionLabel = (action: string) => {
    return actionLabels[action as keyof typeof actionLabels] || action;
  };

  const getPriorityBadge = (action: string) => {
    const highPriority = ['ROLE_CHANGE', 'STATUS_CHANGE', 'ACCOUNT_LOCKED', 'PERMISSION_CHANGE'];
    const mediumPriority = ['PASSWORD_CHANGE', 'EMAIL_CHANGE', 'TWO_FACTOR_ENABLED', 'TWO_FACTOR_DISABLED'];
    
    if (highPriority.includes(action)) {
      return <Badge variant="destructive" className="text-xs ml-2">Alta</Badge>;
    }
    if (mediumPriority.includes(action)) {
      return <Badge variant="secondary" className="text-xs ml-2">Média</Badge>;
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Carregando histórico...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
        <Shield className="h-8 w-8 text-destructive" />
        <p className="text-sm text-muted-foreground max-w-xs">{error}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Tentar novamente
          </Button>
        )}
      </div>
    );
  }

  if (displayLogs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Nenhum evento registrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {displayLogs.map((log, index) => {
        const IconComponent = getActionIcon(log.action);
        const colorClass = getActionColor(log.action);
        const label = getActionLabel(log.action);
        const priorityBadge = getPriorityBadge(log.action);

        return (
          <div key={log.id} className="flex gap-4 group">
            <div className="flex flex-col items-center">
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center border-2 border-border
                bg-card group-hover:scale-110 transition-transform duration-200
                ${colorClass}
              `}>
                <IconComponent className="h-4 w-4" />
              </div>
              {index < displayLogs.length - 1 && (
                <div className="w-px h-8 bg-border mt-2" />
              )}
            </div>
            
            <div className="flex-1 min-w-0 pb-4">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`font-semibold ${colorClass}`}>
                  {label}
                </span>
                {priorityBadge}
                <span className="text-xs text-muted-foreground">{formatDateTime(log.timestamp)}</span>
              </div>

              <p className="text-sm text-foreground mb-2 leading-relaxed">
                {log.description}
              </p>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                <span>Por: {log.performedBy}</span>
              </div>
            </div>
          </div>
        );
      })}
      
      {logs.length > maxItems && (
        <div className="text-center pt-4 border-t">
          <Badge variant="outline">
            +{logs.length - maxItems} eventos anteriores
          </Badge>
        </div>
      )}
    </div>
  );
}