import { useState, KeyboardEvent, useRef, useEffect } from 'react';
import { Send, Paperclip, Mic, Smile } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface MessageInputProps {
  onSendMessage: (text: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

export const MessageInput = ({ 
  onSendMessage, 
  disabled = false, 
  placeholder = "Type a message" 
}: MessageInputProps) => {
  const [message, setMessage] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  }, [message]);

  const handleSend = async () => {
    if (!message.trim() || disabled) return;
    
    const messageToSend = message.trim();
    setMessage('');
    
    try {
      await onSendMessage(messageToSend);
    } catch (error) {
      // On error, restore the message
      setMessage(messageToSend);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = () => {
    setIsComposing(false);
  };

  const canSend = message.trim().length > 0 && !disabled;

  return (
    <div className="flex items-end gap-2 p-2 bg-input rounded-lg border border-input-border focus-within:border-input-focus transition-colors">
      {/* Attachment Button */}
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-foreground p-2 h-auto"
        disabled={disabled}
      >
        <Paperclip className="w-5 h-5" />
      </Button>

      {/* Message Input */}
      <div className="flex-1 relative">
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          placeholder={placeholder}
          disabled={disabled}
          className="min-h-[40px] max-h-[120px] resize-none border-0 bg-transparent p-2 focus-visible:ring-0 focus-visible:ring-offset-0"
          rows={1}
        />
      </div>

      {/* Emoji Button */}
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-foreground p-2 h-auto"
        disabled={disabled}
      >
        <Smile className="w-5 h-5" />
      </Button>

      {/* Send Button or Microphone */}
      {canSend ? (
        <Button
          onClick={handleSend}
          disabled={disabled}
          className="bg-whatsapp hover:bg-whatsapp-dark text-white p-2 h-auto rounded-full transition-all duration-200"
        >
          <Send className="w-5 h-5" />
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground p-2 h-auto"
          disabled={disabled}
        >
          <Mic className="w-5 h-5" />
        </Button>
      )}
    </div>
  );
};