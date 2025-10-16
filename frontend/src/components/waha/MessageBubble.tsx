import { useEffect, useState, type SyntheticEvent } from 'react';
import { Check, CheckCheck, Clock } from 'lucide-react';
import { Message } from '@/types/waha';
import { format } from 'date-fns';

interface MessageBubbleProps {
  message: Message;
  isFirst: boolean;
  isLast: boolean;
}

export const MessageBubble = ({ message, isFirst, isLast }: MessageBubbleProps) => {
  const [audioDuration, setAudioDuration] = useState<string | null>(null);

  const formatTime = (timestamp: number) => {
    try {
      return format(new Date(timestamp), 'HH:mm');
    } catch {
      return '';
    }
  };

  const formatDuration = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return null;
    }

    const totalSeconds = Math.round(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainingSeconds = totalSeconds % 60;

    if (hours > 0) {
      const minutesString = minutes.toString().padStart(2, '0');
      const secondsString = remainingSeconds.toString().padStart(2, '0');
      return `${hours}:${minutesString}:${secondsString}`;
    }

    const secondsString = remainingSeconds.toString().padStart(2, '0');
    return `${minutes}:${secondsString}`;
  };

  useEffect(() => {
    setAudioDuration(null);
  }, [message.id, message.mediaUrl, message.type]);

  const handleAudioMetadata = (event: SyntheticEvent<HTMLAudioElement>) => {
    const formatted = formatDuration(event.currentTarget.duration);
    if (formatted) {
      setAudioDuration(formatted);
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
    const mediaSource = message.mediaUrl ?? message.body;
    const isImage = message.type === 'image' || message.mimeType?.startsWith('image/');

    if (message.type === 'audio') {
      if (message.mediaUrl) {
        return (
          <div className="flex flex-col gap-1">
            <audio
              controls
              src={message.mediaUrl}
              className="w-64 max-w-full"
              aria-label={message.caption ?? 'Mensagem de áudio'}
              onLoadedMetadata={handleAudioMetadata}
            >
              Seu navegador não suporta a reprodução de áudio.
            </audio>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <a
                href={message.mediaUrl}
                download={message.filename ?? ''}
                className="underline"
              >
                Baixar áudio
              </a>
            </div>
            {message.caption && <span className="text-xs opacity-80">{message.caption}</span>}
          </div>
        );
      }
      return <div className="italic text-sm">🎧 Mensagem de áudio</div>;
    }

    if (message.type === 'text') {
      return (
        <div className="whitespace-pre-wrap break-words">
          {message.body}
        </div>
      );
    }

    if (isImage) {
      if (mediaSource) {
        return (
          <div className="flex flex-col gap-1">
            <img
              src={mediaSource}
              alt={message.caption ?? message.filename ?? 'Imagem'}
              className="max-w-xs rounded"
            />
            {message.caption && <span className="text-xs opacity-80">{message.caption}</span>}
          </div>
        );
      }
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
    }

    if (mediaSource) {
      const label = message.filename ?? 'Baixar arquivo';
      return (
        <div className="flex flex-col gap-1 text-sm">
          <a
            href={mediaSource}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            {label}
          </a>
          {message.caption && <span className="opacity-80">{message.caption}</span>}
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
          {audioDuration && <span>{audioDuration}</span>}
          <span>{formatTime(message.timestamp)}</span>
          {message.fromMe && getAckIcon()}
        </div>
      </div>
    </div>
  );
};