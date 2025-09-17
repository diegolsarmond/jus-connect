import { Search, MessageSquare, RefreshCw, MoreVertical } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ChatOverview } from '@/types/waha';
import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

interface ChatSidebarProps {
  chats: ChatOverview[];
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
  loading: boolean;
  onRefresh: () => void;
}

export const ChatSidebar = ({ 
  chats, 
  activeChatId, 
  onSelectChat, 
  loading, 
  onRefresh 
}: ChatSidebarProps) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredChats = chats.filter(chat =>
    chat.name && chat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatLastMessageTime = (timestamp: number) => {
    try {
      // Se timestamp estiver em segundos, converter para ms
      const date = new Date(timestamp < 10000000000 ? timestamp * 1000 : timestamp);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      console.error('Error formatting date:', error, timestamp);
      return '';
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex flex-col h-full bg-sidebar">
      {/* Header */}
      <div className="p-4 border-b border-border bg-sidebar">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-sidebar-foreground flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-whatsapp" />
            Chats
          </h1>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
              className="text-sidebar-foreground hover:bg-sidebar-hover"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-sidebar-foreground hover:bg-sidebar-hover"
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-background border-input-border focus:border-input-focus"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {loading && filteredChats.length === 0 ? (
          <div className="flex items-center justify-center p-8 text-muted-foreground">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            Loading chats...
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
            <MessageSquare className="w-12 h-12 mb-2 opacity-50" />
            {searchQuery ? 'No chats found' : 'No chats available'}
          </div>
        ) : (
          <div className="space-y-0">
            {filteredChats.map((chat) => (
              <div
                key={chat.id}
                onClick={() => onSelectChat(chat.id)}
                className={`
                  flex items-center p-4 cursor-pointer transition-all duration-200 border-b border-border/50
                  ${activeChatId === chat.id 
                    ? 'bg-sidebar-active border-l-4 border-l-whatsapp' 
                    : 'hover:bg-sidebar-hover'
                  }
                `}
              >
                {/* Avatar */}
                <Avatar className="w-12 h-12 mr-3 flex-shrink-0">
                  <AvatarImage src={chat.avatar} alt={chat.name || 'Chat'} />
                  <AvatarFallback className="bg-whatsapp-light text-whatsapp-dark font-semibold">
                    {getInitials(chat.name)}
                  </AvatarFallback>
                </Avatar>

                {/* Chat Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-medium text-sidebar-foreground truncate">
                      {chat.name || 'Unknown Chat'}
                    </h3>
                    {chat.lastMessage && (
                      <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                        {formatLastMessageTime(chat.lastMessage.timestamp)}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground truncate">
                      {chat.lastMessage ? (
                        <>
                          {chat.lastMessage.fromMe && (
                            <span className="text-whatsapp">You: </span>
                          )}
                          {chat.lastMessage.body || `${chat.lastMessage.type} message`}
                        </>
                      ) : (
                        'No messages yet'
                      )}
                    </p>
                    
                    {chat.unreadCount && chat.unreadCount > 0 && (
                      <Badge 
                        variant="default" 
                        className="bg-whatsapp text-white ml-2 rounded-full min-w-[20px] h-5 text-xs flex items-center justify-center"
                      >
                        {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};