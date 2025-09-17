import { useState, useEffect, useCallback, useRef } from 'react';
import { wahaService } from '@/services/waha';
import WAHAService from '@/services/waha';
import { ChatOverview, Message, SessionStatus } from '@/types/waha';
import { useToast } from '@/hooks/use-toast';

export const useWAHA = () => {
  const [chats, setChats] = useState<ChatOverview[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const intervalRef = useRef<NodeJS.Timeout>();

  // Load chats
  const loadChats = useCallback(async () => {
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
        setChats(response.data);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load chats';
      console.error('❌ Erro ao carregar chats:', err);
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Load messages for a specific chat
  const loadMessages = useCallback(async (chatId: string) => {
    try {
      const response = await wahaService.getChatMessages(chatId, { limit: 100 });
      if (response.error) {
        throw new Error(response.error);
      }
      if (response.data) {
        setMessages(prev => ({
          ...prev,
          [chatId]: response.data!.sort((a, b) => a.timestamp - b.timestamp)
        }));
      }
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

      if (response.data) {
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
      if (response.data) {
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
      setChats(prev => prev.map(chat => 
        chat.id === chatId ? { ...chat, unreadCount: 0 } : chat
      ));
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
    loadChats();
    checkSessionStatus();
    
    // Set up periodic refresh for session status
    intervalRef.current = setInterval(checkSessionStatus, 30000); // Reduzido para 30 segundos
    
    return () => {
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