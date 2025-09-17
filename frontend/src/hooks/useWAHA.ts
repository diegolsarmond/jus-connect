import { useState, useEffect, useCallback, useRef } from 'react';
import { wahaService } from '@/services/waha';
import WAHAService from '@/services/waha';
import { ChatOverview, Message, SessionStatus } from '@/types/waha';
import { useToast } from '@/hooks/use-toast';

const MESSAGE_PAGE_SIZE = 100;
const MAX_MESSAGE_PAGES = 20;

const pickFirstString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const readStringProperty = (
  record: Record<string, unknown> | undefined,
  key: string,
): string | undefined => {
  if (!record) {
    return undefined;
  }
  return pickFirstString(record[key]);
};

export const useWAHA = () => {
  const [chats, setChats] = useState<ChatOverview[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const intervalRef = useRef<NodeJS.Timeout>();
  const isMountedRef = useRef(true);

  const enrichChatWithInfo = useCallback(async (chat: ChatOverview): Promise<ChatOverview> => {
    const fallbackName = chat.name ?? WAHAService.extractPhoneFromWhatsAppId(chat.id);
    const hasAvatar = typeof chat.avatar === 'string' && chat.avatar.trim().length > 0;
    const hasName = typeof chat.name === 'string' && chat.name.trim().length > 0;

    if (hasAvatar && hasName) {
      return { ...chat, name: chat.name?.trim() ?? fallbackName };
    }

    try {
      const response = await wahaService.getChatInfo(chat.id);
      if (response.error) {
        throw new Error(response.error);
      }
      const info = isRecord(response.data) ? response.data : undefined;
      if (info) {
        const contact = isRecord(info.contact) ? (info.contact as Record<string, unknown>) : undefined;
        const profileThumb = isRecord(info.profilePicThumbObj)
          ? (info.profilePicThumbObj as Record<string, unknown>)
          : isRecord(contact?.profilePicThumbObj)
            ? (contact?.profilePicThumbObj as Record<string, unknown>)
            : undefined;
        const chatInfo = isRecord(info.chat) ? (info.chat as Record<string, unknown>) : undefined;

        const derivedName =
          pickFirstString(
            chat.name,
            readStringProperty(info, 'name'),
            readStringProperty(info, 'contactName'),
            readStringProperty(info, 'formattedName'),
            readStringProperty(info, 'pushName'),
            readStringProperty(contact, 'name'),
            readStringProperty(contact, 'pushname'),
            readStringProperty(contact, 'formattedName'),
            readStringProperty(contact, 'shortName'),
            readStringProperty(chatInfo, 'name'),
          ) ?? fallbackName;

        const derivedAvatar =
          pickFirstString(
            chat.avatar,
            readStringProperty(info, 'avatar'),
            readStringProperty(info, 'picture'),
            readStringProperty(info, 'profilePicUrl'),
            readStringProperty(info, 'profilePicture'),
            readStringProperty(profileThumb, 'eurl'),
            readStringProperty(profileThumb, 'img'),
            readStringProperty(contact, 'avatar'),
            readStringProperty(contact, 'img'),
            readStringProperty(contact, 'picture'),
            readStringProperty(chatInfo, 'avatar'),
            readStringProperty(chatInfo, 'picture'),
          ) ?? chat.avatar;

        return {
          ...chat,
          name: derivedName,
          avatar: derivedAvatar,
        };
      }
    } catch (infoError) {
      console.error('❌ Erro ao carregar detalhes do chat', chat.id, infoError);
    }

    return {
      ...chat,
      name: fallbackName,
    };
  }, []);

  // Load chats
  const loadChats = useCallback(async () => {
    if (!isMountedRef.current) return;
    setLoading(true);
    setError(null); // Limpar erro anterior
    try {
      console.log('🔄 Carregando chats...');
      const response = await wahaService.getChatsOverview();
      if (response.error) {
        throw new Error(response.error);
      }
      if (response.data) {
        console.log('✅ Chats carregados:', response.data.length);
        const enriched = await Promise.all(response.data.map((chat) => enrichChatWithInfo(chat)));
        if (!isMountedRef.current) {
          return;
        }
        setChats(
          enriched.map((chat) => ({
            ...chat,
            name: chat.name ?? WAHAService.extractPhoneFromWhatsAppId(chat.id),
          })),
        );
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load chats';
      console.error('❌ Erro ao carregar chats:', err);
      if (isMountedRef.current) {
        setError(errorMessage);
      }
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [enrichChatWithInfo, toast]);

  // Load messages for a specific chat
  const loadMessages = useCallback(async (chatId: string) => {
    try {
      const allMessages: Message[] = [];
      for (let page = 0; page < MAX_MESSAGE_PAGES; page += 1) {
        const offset = page * MESSAGE_PAGE_SIZE;
        const response = await wahaService.getChatMessages(chatId, { limit: MESSAGE_PAGE_SIZE, offset });
        if (response.error) {
          throw new Error(response.error);
        }
        const batch = response.data ?? [];
        allMessages.push(...batch);
        if (batch.length < MESSAGE_PAGE_SIZE) {
          break;
        }
      }

      if (!isMountedRef.current) {
        return;
      }

      const deduped = Array.from(
        new Map(allMessages.map((message) => [message.id, message])).values(),
      ).sort((a, b) => a.timestamp - b.timestamp);

      setMessages((prev) => ({
        ...prev,
        [chatId]: deduped,
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load messages';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  }, [toast]);

  // Send a text message
  const sendMessage = useCallback(async (chatId: string, text: string) => {
    try {
      const response = await wahaService.sendTextMessage({
        chatId,
        text,
        linkPreview: true,
      });
      
      if (response.error) {
        throw new Error(response.error);
      }

      if (response.data && isMountedRef.current) {
        // Add the sent message to the local state
        setMessages(prev => ({
          ...prev,
          [chatId]: [...(prev[chatId] || []), response.data!]
        }));

        // Update the last message in the chat overview
        setChats(prev => prev.map(chat =>
          chat.id === chatId
            ? {
                ...chat,
                lastMessage: {
                  body: text,
                  timestamp: response.data!.timestamp,
                  fromMe: true,
                  type: 'text'
                }
              }
            : chat
        ));

        toast({
          title: 'Message sent',
          description: 'Your message has been sent successfully',
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  }, [toast]);

  // Check session status
  const checkSessionStatus = useCallback(async () => {
    try {
      const response = await wahaService.getSessionStatus();
      if (response.data && isMountedRef.current) {
        console.log('📡 Status da sessão:', response.data.status);
        setSessionStatus(response.data);
      }
    } catch (err) {
      console.error('❌ Erro ao verificar status da sessão:', err);
    }
  }, []);

  // Mark messages as read
  const markAsRead = useCallback(async (chatId: string) => {
    try {
      await wahaService.markAsRead(chatId);

      // Update unread count in local state
      if (isMountedRef.current) {
        setChats(prev => prev.map(chat =>
          chat.id === chatId ? { ...chat, unreadCount: 0 } : chat
        ));
      }
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  }, []);

  // Select active chat
  const selectChat = useCallback(async (chatId: string) => {
    setActiveChatId(chatId);
    
    // Load messages if not already loaded
    if (!messages[chatId]) {
      await loadMessages(chatId);
    }
    
    // Mark as read
    await markAsRead(chatId);
  }, [messages, loadMessages, markAsRead]);

  // Add a new message (for webhook integration)
  const addMessage = useCallback((message: Message) => {
    if (!isMountedRef.current) {
      return;
    }

    setMessages(prev => ({
      ...prev,
      [message.chatId]: [...(prev[message.chatId] || []), message]
    }));

    // Update chat overview
    setChats(prev => prev.map(chat =>
      chat.id === message.chatId
        ? {
            ...chat,
            lastMessage: {
              body: message.body || '',
              timestamp: message.timestamp,
              fromMe: message.fromMe,
              type: message.type
            },
            unreadCount: message.fromMe ? chat.unreadCount : (chat.unreadCount || 0) + 1
          }
        : chat
    ));
  }, []);

  // Initialize
  useEffect(() => {
    isMountedRef.current = true;
    loadChats();
    checkSessionStatus();

    // Set up periodic refresh for session status
    intervalRef.current = setInterval(checkSessionStatus, 30000); // Reduzido para 30 segundos

    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [loadChats, checkSessionStatus]);

  const activeChat = activeChatId ? chats.find(chat => chat.id === activeChatId) : null;
  const activeChatMessages = activeChatId ? messages[activeChatId] || [] : [];

  return {
    // State
    chats,
    messages,
    activeChatId,
    activeChat,
    activeChatMessages,
    sessionStatus,
    loading,
    error,
    
    // Actions
    loadChats,
    loadMessages,
    sendMessage,
    selectChat,
    markAsRead,
    addMessage,
    checkSessionStatus,
    
    // Utils
    formatPhoneToWhatsAppId: WAHAService.formatPhoneToWhatsAppId,
    getWebhookUrl: wahaService.getWebhookUrl,
  };
};