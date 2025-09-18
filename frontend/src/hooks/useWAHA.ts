import { useState, useEffect, useCallback, useRef } from 'react';
import { wahaService } from '@/services/waha';
import WAHAService from '@/services/waha';
import { ChatOverview, Message, SessionStatus } from '@/types/waha';
import { useToast } from '@/hooks/use-toast';

const CHAT_PAGE_SIZE = 50;
const MESSAGE_PAGE_SIZE = 100;

type MessagePaginationState = {
  offset: number;
  hasMore: boolean;
  isLoading: boolean;
  isLoaded: boolean;
};

const createInitialPaginationState = (): MessagePaginationState => ({
  offset: 0,
  hasMore: true,
  isLoading: false,
  isLoaded: false,
});

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

const getLastActivityTimestamp = (chat: ChatOverview): number => {
  const timestamp = chat.lastMessage?.timestamp;
  if (typeof timestamp === 'number' && Number.isFinite(timestamp)) {
    return timestamp;
  }
  return 0;
};

const sortChatsByRecency = (chatList: ChatOverview[]): ChatOverview[] =>
  [...chatList].sort((a, b) => {
    const diff = getLastActivityTimestamp(b) - getLastActivityTimestamp(a);
    if (diff !== 0) {
      return diff;
    }

    const nameA = (a.name ?? '').toLowerCase();
    const nameB = (b.name ?? '').toLowerCase();
    return nameA.localeCompare(nameB);
  });

const normalizeChatName = (chat: ChatOverview): ChatOverview => {
  const trimmedName = typeof chat.name === 'string' ? chat.name.trim() : '';
  return {
    ...chat,
    name:
      trimmedName.length > 0
        ? trimmedName
        : WAHAService.extractPhoneFromWhatsAppId(chat.id),
  };
};


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
  const [isLoadingMoreChats, setIsLoadingMoreChats] = useState(false);
  const [hasMoreChats, setHasMoreChats] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messagePaginationState, setMessagePaginationState] = useState<
    Record<string, MessagePaginationState>
  >({});
  const { toast } = useToast();
  const intervalRef = useRef<NodeJS.Timeout>();
  const isMountedRef = useRef(true);
  const chatOffsetRef = useRef(0);
  const hasMoreChatsRef = useRef(true);
  const isFetchingChatsRef = useRef(false);
  const messagePaginationRef = useRef<Record<string, MessagePaginationState>>({});
  const enrichingChatsRef = useRef(new Set<string>());

  const ensureMessagePaginationState = useCallback(
    (chatId: string): MessagePaginationState => {
      const current = messagePaginationRef.current[chatId];
      if (current) {
        return current;
      }

      const initial = createInitialPaginationState();
      messagePaginationRef.current[chatId] = initial;
      setMessagePaginationState((prev) => ({
        ...prev,
        [chatId]: initial,
      }));
      return initial;
    },
    [],
  );

  const updateMessagePaginationState = useCallback(
    (chatId: string, updates: Partial<MessagePaginationState>) => {
      const current = ensureMessagePaginationState(chatId);
      const next = { ...current, ...updates };
      messagePaginationRef.current[chatId] = next;
      setMessagePaginationState((prev) => ({
        ...prev,
        [chatId]: next,
      }));
    },
    [ensureMessagePaginationState],
  );

  const resetChatPagination = useCallback(() => {
    chatOffsetRef.current = 0;
    hasMoreChatsRef.current = true;
    setHasMoreChats(true);
  }, []);

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
  const loadChats = useCallback(
    async (options?: { reset?: boolean }) => {
      const reset = options?.reset ?? false;

      if (!isMountedRef.current) {
        return;
      }

      if (isFetchingChatsRef.current) {
        return;
      }

      if (!reset && !hasMoreChatsRef.current) {
        return;
      }

      setError(null);

      if (reset) {
        resetChatPagination();
        setLoading(true);
        setIsLoadingMoreChats(false);
      } else {
        setIsLoadingMoreChats(true);
      }

      isFetchingChatsRef.current = true;

      try {
        console.log('🔄 Carregando chats...', { reset, offset: chatOffsetRef.current });
        const offset = reset ? 0 : chatOffsetRef.current;
        const response = await wahaService.getChatsOverview(CHAT_PAGE_SIZE, offset);

        if (response.error) {
          throw new Error(response.error);
        }

        const rawChats = response.data ?? [];
        const enriched = await Promise.all(rawChats.map((chat) => enrichChatWithInfo(chat)));

        if (!isMountedRef.current) {
          return;
        }

        setChats((previousChats) => {
          const baseChats = reset ? [] : previousChats;
          const merged = new Map(baseChats.map((chat) => [chat.id, chat]));

          enriched.forEach((chat) => {
            const normalized = normalizeChatName(chat);
            const existing = merged.get(chat.id);

            merged.set(chat.id, {
              ...existing,
              ...normalized,
              unreadCount: normalized.unreadCount ?? existing?.unreadCount ?? 0,
            });
          });

          return sortChatsByRecency(Array.from(merged.values()).map(normalizeChatName));
        });

        const receivedCount = enriched.length;
        const nextOffset = offset + receivedCount;
        const nextHasMore = receivedCount === CHAT_PAGE_SIZE;

        chatOffsetRef.current = nextOffset;
        hasMoreChatsRef.current = nextHasMore;
        setHasMoreChats(nextHasMore);
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
        isFetchingChatsRef.current = false;
        if (isMountedRef.current) {
          if (reset) {
            setLoading(false);
          }
          setIsLoadingMoreChats(false);
        }

      }
    },
    [enrichChatWithInfo, resetChatPagination, toast],
  );

  const loadMoreChats = useCallback(async () => {
    await loadChats({ reset: false });
  }, [loadChats]);

  // Load messages for a specific chat
  const loadMessages = useCallback(
    async (chatId: string, options?: { reset?: boolean }): Promise<Message[]> => {
      const pagination = ensureMessagePaginationState(chatId);
      const shouldReset = options?.reset ?? !pagination.isLoaded;

      if (pagination.isLoading) {
        return [];
      }

      if (!shouldReset && !pagination.hasMore) {
        return [];
      }

      const offset = shouldReset ? 0 : pagination.offset;

      updateMessagePaginationState(chatId, {
        offset: shouldReset ? 0 : pagination.offset,
        hasMore: shouldReset ? true : pagination.hasMore,
        isLoading: true,
        isLoaded: shouldReset ? false : pagination.isLoaded,
      });

      try {
        const response = await wahaService.getChatMessages(chatId, {
          limit: MESSAGE_PAGE_SIZE,
          offset,
        });

        if (response.error) {
          throw new Error(response.error);
        }

        const batch = response.data ?? [];

        if (!isMountedRef.current) {
          return [];
        }

        const insertedMessages: Message[] = [];
        let mergedResult: Message[] = [];
        let hasChanges = shouldReset;

        setMessages((prev) => {
          const existing = shouldReset ? [] : prev[chatId] ?? [];
          const existingIds = new Set(existing.map((message) => message.id));
          const merged = shouldReset ? [] : [...existing];

          batch.forEach((message) => {
            if (!existingIds.has(message.id)) {
              merged.push(message);
              existingIds.add(message.id);
              insertedMessages.push(message);
              hasChanges = true;
            }
          });

          merged.sort((a, b) => a.timestamp - b.timestamp);
          mergedResult = merged;

          if (!hasChanges) {
            return prev;
          }

          return {
            ...prev,
            [chatId]: merged,
          };
        });

        const nextOffset = offset + batch.length;
        const hasMore = batch.length === MESSAGE_PAGE_SIZE;

        updateMessagePaginationState(chatId, {
          offset: nextOffset,
          hasMore,
          isLoading: false,
          isLoaded: true,
        });

        const sortedInserted = insertedMessages.sort((a, b) => a.timestamp - b.timestamp);

        return shouldReset ? mergedResult : sortedInserted;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load messages';
        updateMessagePaginationState(chatId, { isLoading: false });
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
        return [];
      }
    },
    [
      ensureMessagePaginationState,
      toast,
      updateMessagePaginationState,
    ],
  );

  const loadOlderMessages = useCallback(
    async (chatId: string): Promise<Message[]> => loadMessages(chatId, { reset: false }),
    [loadMessages],
  );

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
        setChats(prev =>
          sortChatsByRecency(
            prev.map(chat =>
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
            ),
          ),
        );

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
        setChats(prev =>
          sortChatsByRecency(
            prev.map(chat =>
              chat.id === chatId ? { ...chat, unreadCount: 0 } : chat
            ),
          ),
        );
      }
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  }, []);

  // Select active chat
  const selectChat = useCallback(
    async (chatId: string) => {
      setActiveChatId(chatId);

      const pagination = ensureMessagePaginationState(chatId);
      if (!pagination.isLoaded) {
        await loadMessages(chatId, { reset: true });
      }

      void markAsRead(chatId);
    },
    [ensureMessagePaginationState, loadMessages, markAsRead],
  );

  // Add a new message (for webhook integration)
  const addMessage = useCallback(
    (message: Message) => {
      if (!isMountedRef.current) {
        return;
      }

      ensureMessagePaginationState(message.chatId);
      updateMessagePaginationState(message.chatId, { isLoaded: true });

      setMessages((prev) => {
        const existing = prev[message.chatId] ?? [];
        if (existing.some((item) => item.id === message.id)) {
          return prev;
        }

        const nextMessages = [...existing, message].sort((a, b) => a.timestamp - b.timestamp);
        return {
          ...prev,
          [message.chatId]: nextMessages,
        };
      });

      const text = message.body ?? message.caption ?? '';
      const ackNumber = typeof message.ack === 'number' ? message.ack : undefined;
      const ackName = typeof message.ack === 'string' ? message.ack : undefined;

      let placeholder: ChatOverview | null = null;

      setChats((previousChats) => {
        const existingIndex = previousChats.findIndex((chat) => chat.id === message.chatId);

        if (existingIndex >= 0) {
          const existingChat = previousChats[existingIndex];
          const unreadCount = message.fromMe
            ? existingChat.unreadCount ?? 0
            : (existingChat.unreadCount ?? 0) + 1;

          const updatedChat = normalizeChatName({
            ...existingChat,
            lastMessage: {
              id: message.id,
              body: text,
              timestamp: message.timestamp,
              fromMe: message.fromMe,
              type: message.type,
              ack: ackNumber,
              ackName,
            },
            unreadCount,
          });

          const nextChats = [...previousChats];
          nextChats[existingIndex] = updatedChat;
          return sortChatsByRecency(nextChats);
        }

        const provisionalChat = normalizeChatName({
          id: message.chatId,
          name: WAHAService.extractPhoneFromWhatsAppId(message.chatId),
          isGroup: message.chatId.includes('@g.us'),
          avatar: undefined,
          lastMessage: {
            id: message.id,
            body: text,
            timestamp: message.timestamp,
            fromMe: message.fromMe,
            type: message.type,
            ack: ackNumber,
            ackName,
          },
          unreadCount: message.fromMe ? 0 : 1,
        });

        placeholder = provisionalChat;
        return sortChatsByRecency([...previousChats, provisionalChat]);
      });

      if (placeholder) {
        const chatToEnrich = placeholder;
        if (!enrichingChatsRef.current.has(chatToEnrich.id)) {
          enrichingChatsRef.current.add(chatToEnrich.id);
          void (async () => {
            try {
              const enriched = await enrichChatWithInfo(chatToEnrich);
              if (!isMountedRef.current) {
                return;
              }

              setChats((previousChats) => {
                const index = previousChats.findIndex((chat) => chat.id === enriched.id);
                if (index === -1) {
                  return previousChats;
                }

                const merged = normalizeChatName({
                  ...previousChats[index],
                  ...enriched,
                });

                const nextChats = [...previousChats];
                nextChats[index] = merged;
                return sortChatsByRecency(nextChats);
              });
            } finally {
              enrichingChatsRef.current.delete(chatToEnrich.id);
            }
          })();
        }
      }

    },
    [
      ensureMessagePaginationState,
      enrichChatWithInfo,
      updateMessagePaginationState,
    ],
  );

  // Initialize
  useEffect(() => {
    isMountedRef.current = true;
    loadChats({ reset: true });
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
    isLoadingMoreChats,
    hasMoreChats,
    error,
    messagePaginationState,

    // Actions
    loadChats,
    loadMoreChats,
    loadMessages,
    loadOlderMessages,
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