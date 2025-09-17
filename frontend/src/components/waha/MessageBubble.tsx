import { Check, CheckCheck, Clock } from 'lucide-react';
import { Message } from '@/types/waha';
import { format } from 'date-fns';

interface MessageBubbleProps {
  message: Message;
  isFirst: boolean;
  isLast: boolean;
}

export const MessageBubble = ({ message, isFirst, isLast }: MessageBubbleProps) => {
  const formatTime = (timestamp: number) => {
    try {
      return format(new Date(timestamp), 'HH:mm');
    } catch {
      return '';
    }
  };

  const getAckIcon = () => {
    switch (message.ack) {
      case 'SENT':
        return <Check className="w-4 h-4 text-muted-foreground" />;
      case 'DELIVERED':
        return <CheckCheck className="w-4 h-4 text-muted-foreground" />;
      case 'READ':
        return <CheckCheck className="w-4 h-4 text-whatsapp" />;
      case 'PENDING':
        return <Clock className="w-4 h-4 text-muted-foreground" />;
      default:
        return null;
    }
  };

  const messageContent = () => {
    if (message.type === 'text') {
      return (
        <div className="whitespace-pre-wrap break-words">
          {message.body}
        </div>
      );
    }
    
    // Handle other message types
    return (
      <div className="flex items-center gap-2 text-sm italic">
        <span>📎</span>
        <span>{message.type} message</span>
        {message.caption && (
          <div className="mt-1 font-normal not-italic">
            {message.caption}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`flex ${message.fromMe ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`
          max-w-md px-3 py-2 shadow-message transition-all duration-200
          ${message.fromMe 
            ? 'bg-message-sent text-message-sent-foreground' 
            : 'bg-message-received text-message-received-foreground'
          }
          ${isFirst && isLast ? 'rounded-lg' : ''}
          ${isFirst && !isLast ? (message.fromMe ? 'rounded-t-lg rounded-bl-lg rounded-br-sm' : 'rounded-t-lg rounded-br-lg rounded-bl-sm') : ''}
          ${!isFirst && isLast ? (message.fromMe ? 'rounded-b-lg rounded-tl-lg rounded-tr-sm' : 'rounded-b-lg rounded-tr-lg rounded-tl-sm') : ''}
          ${!isFirst && !isLast ? (message.fromMe ? 'rounded-l-lg rounded-r-sm' : 'rounded-r-lg rounded-l-sm') : ''}
        `}
      >
        {/* Message Content */}
        {messageContent()}
        
        {/* Message Footer */}
        <div className={`flex items-center justify-end gap-1 mt-1 text-xs ${
          message.fromMe ? 'text-message-sent-foreground/70' : 'text-message-received-foreground/70'
        }`}>
          <span>{formatTime(message.timestamp)}</span>
          {message.fromMe && getAckIcon()}
        </div>
      </div>
    </div>
  );
};