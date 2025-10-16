import { useState, useRef, useEffect } from 'react';
import { Menu, Phone, Video, MoreVertical, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { ChatOverview, Message } from '@/types/waha';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';

import { WelcomeScreen } from './WelcomeScreen';

interface ChatAreaProps {
  activeChat: ChatOverview | null;
  messages: Message[];
  onSendMessage: (chatId: string, text: string) => Promise<void>;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  onMarkAsUnread?: (chatId: string) => Promise<void> | void;
  onDeleteChat?: (chatId: string) => Promise<void> | void;
  onOpenDetails?: (chatId: string) => Promise<void> | void;
}

export const ChatArea = ({
  activeChat,
  messages,
  onSendMessage,
  onToggleSidebar,
  sidebarOpen,
  onMarkAsUnread,
  onDeleteChat,
  onOpenDetails
}: ChatAreaProps) => {
  const [sendingMessage, setSendingMessage] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    'markAsUnread' | 'deleteChat' | 'openDetails' | null
  >(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
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

  const handleMenuAction = async (
    action: 'markAsUnread' | 'deleteChat' | 'openDetails',
    callback?: (chatId: string) => Promise<void> | void
  ) => {
    if (!activeChat || !callback) {
      setIsOptionsOpen(false);
      return;
    }

    setIsOptionsOpen(false);
    setPendingAction(action);
    try {
      await Promise.resolve(callback(activeChat.id));
    } catch (error) {
      console.error('Falha ao executar ação do menu da conversa', error);
    } finally {
      setPendingAction(null);
    }
  };

  if (!activeChat) {
    return <WelcomeScreen />;
  }

  const formatLastSeen = (timestamp?: number) => {
    if (typeof timestamp !== 'number') {
      return null;
    }
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(date);
  };

  const statusText = activeChat.isGroup
    ? 'Group chat'
    : activeChat.isOnline
      ? 'Online'
      : (() => {
          const formattedLastSeen = formatLastSeen(activeChat.lastSeen);
          if (formattedLastSeen) {
            return `Visto por último às ${formattedLastSeen}`;
          }
          if (activeChat.presence && activeChat.presence.trim().length > 0) {
            return activeChat.presence;
          }
          return 'Status indisponível';
        })();

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
              {statusText}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-sidebar-foreground hover:bg-sidebar-hover"
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
          <DropdownMenu open={isOptionsOpen} onOpenChange={setIsOptionsOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-sidebar-foreground hover:bg-sidebar-hover"
                disabled={pendingAction !== null}
              >
                <MoreVertical className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                disabled={!onMarkAsUnread || pendingAction !== null}
                onSelect={event => {
                  event.preventDefault();
                  void handleMenuAction('markAsUnread', onMarkAsUnread);
                }}
              >
                Marcar como não lida
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!onDeleteChat || pendingAction !== null}
                onSelect={event => {
                  event.preventDefault();
                  void handleMenuAction('deleteChat', onDeleteChat);
                }}
              >
                Excluir conversa
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!onOpenDetails || pendingAction !== null}
                onSelect={event => {
                  event.preventDefault();
                  void handleMenuAction('openDetails', onOpenDetails);
                }}
              >
                Ver detalhes
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
            {messages.map((message, index) => (
              <MessageBubble
                key={`${message.id}-${index}`}
                message={message}
                isFirst={index === 0 || messages[index - 1].fromMe !== message.fromMe}
                isLast={index === messages.length - 1 || messages[index + 1]?.fromMe !== message.fromMe}
              />
            ))}
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
    </div>
  );
};