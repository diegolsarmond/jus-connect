import { RefreshCw, Wifi, WifiOff, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SessionStatus as SessionStatusType } from '@/types/waha';

interface SessionStatusProps {
  status: SessionStatusType | null;
  onRefresh: () => void;
}

export const SessionStatus = ({ status, onRefresh }: SessionStatusProps) => {
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

  return (
    <div className="sticky top-0 z-40 flex items-center justify-between gap-3 bg-whatsapp px-4 py-2 text-foreground shadow-soft dark:text-white">
      <div className="flex items-center gap-2 text-sm">
        {getStatusIcon()}
        <span className={`font-semibold tracking-wide ${getStatusColor()}`}>{getStatusText()}</span>
      </div>

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
  );
};