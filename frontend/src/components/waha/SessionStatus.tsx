import {
  RefreshCw,
  Wifi,
  WifiOff,
  AlertCircle,
  CheckCircle,
  Clock,
  LogOut,
  QrCode,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SessionStatus as SessionStatusType } from '@/types/waha';

interface SessionStatusProps {
  status: SessionStatusType | null;
  onRefresh: () => void;
  onDisconnect?: () => void;
  isDisconnecting?: boolean;
  onManageDevice?: () => void;
  sessionName?: string | null;
}

const normalizeSessionName = (value?: string | null): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const SessionStatus = ({
  status,
  onRefresh,
  onDisconnect,
  isDisconnecting = false,
  onManageDevice,
  sessionName,
}: SessionStatusProps) => {
  const getStatusIcon = () => {
    if (!status) return <WifiOff className="w-4 h-4" />;

    switch (status.status) {
      case 'WORKING':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'STARTING':
      case 'SCAN_QR_CODE':
        return <Clock className="w-4 h-4 text-warning" />;
      case 'FAILED':
      case 'STOPPED':
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      default:
        return <WifiOff className="w-4 h-4" />;
    }
  };

  const getStatusText = () => {
    if (!status) return 'Disconnected';
    
    switch (status.status) {
      case 'WORKING':
        return 'Conectado';
      case 'STARTING':
        return 'Iniciando...';
      case 'SCAN_QR_CODE':
        return 'Escanear QR Code';
      case 'FAILED':
        return 'Conexão Falhou';
      case 'STOPPED':
        return 'Parado';
      default:
        return 'Unknown';
    }
  };

  const getStatusColor = () => {
    if (!status) return 'text-muted-foreground';
    
    switch (status.status) {
      case 'WORKING':
        return 'text-success';
      case 'STARTING':
      case 'SCAN_QR_CODE':
        return 'text-warning';
      case 'FAILED':
      case 'STOPPED':
        return 'text-destructive';
      default:
        return 'text-muted-foreground';
    }
  };

  const resolvedSessionName =
    normalizeSessionName(status?.name) ?? normalizeSessionName(sessionName);

  return (
    <div className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-4 bg-whatsapp px-4 py-2 text-foreground shadow-soft dark:text-white">
      <div className="flex min-w-0 flex-col gap-1 text-xs sm:text-sm">
        <div className="flex items-center gap-2 text-sm">
          {getStatusIcon()}
          <span className={`font-semibold tracking-wide ${getStatusColor()}`}>{getStatusText()}</span>
        </div>
        {resolvedSessionName ? (
          <p className="text-xs text-foreground/80 sm:text-sm">
            Sessão vinculada:{' '}
            <span className="font-semibold text-foreground">{resolvedSessionName}</span>
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/*{onManageDevice && (*/}
        {/*  <Button*/}
        {/*    variant="outline"*/}
        {/*    size="sm"*/}
        {/*    onClick={onManageDevice}*/}
        {/*    className="h-8 px-3 text-foreground hover:bg-accent/60 hover:text-foreground dark:border-white/30 dark:text-white dark:hover:bg-white/10"*/}
        {/*  >*/}
        {/*    <QrCode className="h-4 w-4" />*/}
        {/*    <span className="text-xs font-medium sm:text-sm">ver QR Code</span>*/}
        {/*  </Button>*/}
        {/*)}*/}

        {onDisconnect && (
          <Button
            variant="outline"
            size="sm"
            onClick={onDisconnect}
            disabled={isDisconnecting}
            className="h-8 px-3 text-foreground hover:bg-accent/60 hover:text-foreground dark:border-white/30 dark:text-white dark:hover:bg-white/10"
          >
            {isDisconnecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            <span className="text-xs font-medium sm:text-sm">desconectar</span>
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          className="h-8 px-3 text-foreground hover:bg-accent/60 hover:text-foreground dark:text-white dark:hover:bg-white/10 dark:hover:text-white"
        >
          <RefreshCw className="h-4 w-4" />
          <span className="text-xs font-medium sm:text-sm">sincronizar conversas</span>
        </Button>
      </div>
    </div>
  );
};