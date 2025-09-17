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
        return 'Connected';
      case 'STARTING':
        return 'Starting...';
      case 'SCAN_QR_CODE':
        return 'Scan QR Code';
      case 'FAILED':
        return 'Failed';
      case 'STOPPED':
        return 'Stopped';
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
    <div className="absolute top-0 left-0 right-0 z-50 bg-whatsapp text-white px-4 py-2 flex items-center justify-between shadow-soft">
      <div className="flex items-center gap-2">
        {getStatusIcon()}
        <span className="text-sm font-medium">
          WAHA WhatsApp API - {getStatusText()}
        </span>
      </div>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={onRefresh}
        className="text-white hover:bg-white/10 h-8 px-2"
      >
        <RefreshCw className="w-4 h-4" />
      </Button>
    </div>
  );
};