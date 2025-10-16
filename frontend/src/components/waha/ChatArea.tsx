import { useState, useRef, useEffect, useCallback } from 'react';
import { Menu, Phone, Video, MoreVertical, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChatOverview, Message } from '@/types/waha';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';

import { WelcomeScreen } from './WelcomeScreen';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface ChatAreaProps {
  activeChat: ChatOverview | null;
  messages: Message[];
  onSendMessage: (chatId: string, text: string) => Promise<void>;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
}

export const ChatArea = ({ 
  activeChat, 
  messages, 
  onSendMessage, 
  onToggleSidebar,
  sidebarOpen 
}: ChatAreaProps) => {
  const [sendingMessage, setSendingMessage] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [matchIndices, setMatchIndices] = useState<number[]>([]);
  const [currentMatch, setCurrentMatch] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleToggleSearch = useCallback((open: boolean) => {
    setIsSearchOpen(open);
    if (!open) {
      setSearchTerm('');
      setMatchIndices([]);
      setCurrentMatch(0);
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!isSearchOpen) {
      scrollToBottom();
    }
  }, [messages, isSearchOpen]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setMatchIndices([]);
      setCurrentMatch(0);
      return;
    }

    const lower = searchTerm.toLowerCase();
    const indices = messages.reduce<number[]>((acc, message, index) => {
      if (
        typeof message.body === 'string' &&
        message.body.toLowerCase().includes(lower)
      ) {
        acc.push(index);
      }
      return acc;
    }, []);

    setMatchIndices(indices);
    setCurrentMatch(indices.length ? 0 : 0);
  }, [searchTerm, messages]);

  useEffect(() => {
    if (isSearchOpen && matchIndices.length) {
      const index = matchIndices[currentMatch] ?? matchIndices[0];
      const target = messageRefs.current[index];
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentMatch, matchIndices, isSearchOpen]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setIsSearchOpen(true);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    setIsSearchOpen(false);
    setSearchTerm('');
    setMatchIndices([]);
    setCurrentMatch(0);
  }, [activeChat?.id]);

  useEffect(() => {
    messageRefs.current = [];
  }, [messages]);

  const handleSendMessage = async (text: string) => {
    if (!activeChat || !text.trim()) return;

    setSendingMessage(true);
    try {
      await onSendMessage(activeChat.id, text.trim());
    } finally {
      setSendingMessage(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (!activeChat) {
    return <WelcomeScreen />;
  }

  return (
    <div className="flex-1 flex flex-col bg-chat-background min-h-0">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 bg-sidebar border-b border-border shadow-soft">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleSidebar}
            className="text-sidebar-foreground hover:bg-sidebar-hover lg:hidden"
          >
            <Menu className="w-5 h-5" />
          </Button>
          
          <Avatar className="w-10 h-10">
            <AvatarImage src={activeChat.avatar} alt={activeChat.name} />
            <AvatarFallback className="bg-whatsapp-light text-whatsapp-dark font-semibold">
              {getInitials(activeChat.name)}
            </AvatarFallback>
          </Avatar>
          
          <div>
            <h2 className="font-medium text-sidebar-foreground">{activeChat.name}</h2>
            <p className="text-xs text-muted-foreground">
              {activeChat.isGroup ? 'Group chat' : 'Online'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-sidebar-foreground hover:bg-sidebar-hover"
            onClick={() => handleToggleSearch(true)}
          >
            <Search className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-sidebar-foreground hover:bg-sidebar-hover"
          >
            <Phone className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-sidebar-foreground hover:bg-sidebar-hover"
          >
            <Video className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-sidebar-foreground hover:bg-sidebar-hover"
          >
            <MoreVertical className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2 bg-chat-background">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <>
            {messages.map((message, index) => {
              const isCurrent =
                isSearchOpen &&
                matchIndices.length > 0 &&
                matchIndices[currentMatch] === index;

              return (
                <div
                  key={`${message.id}-${index}`}
                  ref={element => {
                    messageRefs.current[index] = element;
                  }}
                >
                  <MessageBubble
                    message={message}
                    isFirst={index === 0 || messages[index - 1].fromMe !== message.fromMe}
                    isLast={index === messages.length - 1 || messages[index + 1]?.fromMe !== message.fromMe}
                    highlight={isCurrent}
                  />
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message Input */}
      <div className="p-4 bg-sidebar border-t border-border">
        <MessageInput
          onSendMessage={handleSendMessage}
          disabled={sendingMessage}
          placeholder={`Message ${activeChat.name}`}
        />
      </div>

      <Dialog open={isSearchOpen} onOpenChange={handleToggleSearch}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Buscar mensagens</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              autoFocus
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Digite para buscar"
            />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {matchIndices.length > 0
                  ? `${currentMatch + 1} de ${matchIndices.length}`
                  : 'Nenhuma ocorrência'}
              </span>
              <span>Ctrl/⌘ + F</span>
            </div>
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setSearchTerm('')}
                disabled={!searchTerm}
              >
                Limpar
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  if (!matchIndices.length) return;
                  setCurrentMatch(prev =>
                    prev - 1 < 0 ? matchIndices.length - 1 : prev - 1
                  );
                }}
                disabled={matchIndices.length === 0}
              >
                Anterior
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (!matchIndices.length) return;
                  setCurrentMatch(prev =>
                    prev + 1 >= matchIndices.length ? 0 : prev + 1
                  );
                }}
                disabled={matchIndices.length === 0}
              >
                Próximo
              </Button>
            </div>
            <Button type="button" variant="ghost" onClick={() => handleToggleSearch(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};