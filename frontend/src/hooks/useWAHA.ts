import { useState, useEffect, useCallback, useRef } from 'react';
import WAHAService, {
  wahaService,
  WAHARequestError,
  WAHA_SESSION_RECOVERY_MESSAGE,
} from '@/services/waha';
import { ChatOverview, ChatParticipant, Message, SessionStatus } from '@/types/waha';
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

const PARTICIPANT_NAME_KEYS = [
  'name',
  'pushname',
  'formattedName',
  'shortName',
  'notifyName',
  'displayName',
  'contactName',
];

const PARTICIPANT_AVATAR_KEYS = [
  'avatar',
  'img',
  'picture',
  'profilePicUrl',
  'profilePicture',
  'thumb',
  'thumbnail',
  'imageUrl',
  'previewUrl',
  'eurl',
];

const PARTICIPANT_ID_KEYS = [
  'id',
  '_serialized',
  'jid',
  'wid',
  'user',
  'userId',
  'participant',
  'number',
];

const readNestedRecord = (value: unknown, key: string): Record<string, unknown> | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const nested = value[key];
  return isRecord(nested) ? (nested as Record<string, unknown>) : undefined;
};

const readStringFromRecord = (record: Record<string, unknown> | undefined, keys: string[]): string | undefined => {
  if (!record) {
    return undefined;
  }
  for (const key of keys) {
    const candidate = pickFirstString(record[key]);
    if (candidate) {
      return candidate;
    }
  }
  return undefined;
};

const readParticipantId = (record: Record<string, unknown>, visited = new Set<Record<string, unknown>>()): string | undefined => {
  if (visited.has(record)) {
    return undefined;
  }
  visited.add(record);

  const direct = readStringFromRecord(record, PARTICIPANT_ID_KEYS);
  if (direct) {
    return direct;
  }

  for (const key of ['contact', 'user', 'participant', 'id', 'jid', 'wid']) {
    const nested = readNestedRecord(record, key);
    if (nested) {
      const nestedId = readParticipantId(nested, visited);
      if (nestedId) {
        return nestedId;
      }
    }
  }

  return undefined;
};

const parseParticipant = (value: unknown): ChatParticipant | null => {
  if (!isRecord(value)) {
    return null;
  }

  const contact = readNestedRecord(value, 'contact');
  const user = readNestedRecord(value, 'user');
  const profile = readNestedRecord(value, 'profile');
  const profileData = readNestedRecord(value, 'profileData');
  const profileThumb =
    readNestedRecord(value, 'profilePicThumbObj') ??
    readNestedRecord(contact, 'profilePicThumbObj') ??
    readNestedRecord(user, 'profilePicThumbObj') ??
    readNestedRecord(profile, 'profilePicThumbObj') ??
    readNestedRecord(profileData, 'profilePicThumbObj');

  const id =
    readParticipantId(value) ??
    readParticipantId(contact ?? {}) ??
    readParticipantId(user ?? {}) ??
    readParticipantId(profile ?? {}) ??
    readParticipantId(profileData ?? {});

  const name =
    readStringFromRecord(value, PARTICIPANT_NAME_KEYS) ??
    readStringFromRecord(contact, PARTICIPANT_NAME_KEYS) ??
    readStringFromRecord(user, PARTICIPANT_NAME_KEYS) ??
    readStringFromRecord(profile, PARTICIPANT_NAME_KEYS) ??
    readStringFromRecord(profileData, PARTICIPANT_NAME_KEYS);

  const avatar =
    readStringFromRecord(value, PARTICIPANT_AVATAR_KEYS) ??
    readStringFromRecord(contact, PARTICIPANT_AVATAR_KEYS) ??
    readStringFromRecord(user, PARTICIPANT_AVATAR_KEYS) ??
    readStringFromRecord(profile, PARTICIPANT_AVATAR_KEYS) ??
    readStringFromRecord(profileThumb, PARTICIPANT_AVATAR_KEYS);

  const normalizedId = id ?? (name ? name.trim() : undefined);
  if (!normalizedId) {
    return null;
  }

  const normalizedName = name ?? WAHAService.extractPhoneFromWhatsAppId(normalizedId);

  return {
    id: normalizedId,
    name: normalizedName ?? normalizedId,
    avatar: avatar ?? undefined,
  };
};

const collectParticipants = (info: Record<string, unknown>): ChatParticipant[] => {
  const seen = new Map<string, ChatParticipant>();

  const pushCandidate = (value: unknown) => {
    if (!value) {
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        pushCandidate(item);
      }
      return;
    }
    if (!isRecord(value)) {
      return;
    }

    const participant = parseParticipant(value);
    if (!participant) {
      return;
    }

    const existing = seen.get(participant.id);
    if (!existing) {
      seen.set(participant.id, participant);
      return;
    }

    const next: ChatParticipant = {
      id: existing.id,
      name: existing.name || participant.name,
      avatar: participant.avatar ?? existing.avatar,
    };
    seen.set(participant.id, next);
  };

  const directCandidates = [
    info['participants'],
    info['participantsInfo'],
    info['contacts'],
  ];
  for (const candidate of directCandidates) {
    pushCandidate(candidate);
  }

  const nestedSources = ['chat', 'groupMetadata', 'group', 'data'];
  for (const key of nestedSources) {
    const record = readNestedRecord(info, key);
    if (!record) {
      continue;
    }
    pushCandidate(record['participants']);
    pushCandidate(record['participantsInfo']);
    pushCandidate(record['contact']);
  }

  return Array.from(seen.values());
};

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

export const useWAHA = (sessionNameOverride?: string | null) => {
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
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const chatsRefreshIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const isMountedRef = useRef(true);
  const chatOffsetRef = useRef(0);
  const hasMoreChatsRef = useRef(true);
  const isFetchingChatsRef = useRef(false);
  const messagePaginationRef = useRef<Record<string, MessagePaginationState>>({});
  const enrichingChatsRef = useRef(new Set<string>());

  useEffect(() => {
    wahaService.setSessionOverride(sessionNameOverride ?? null);

    return () => {
      if (sessionNameOverride) {
        wahaService.setSessionOverride(null);
      }
    };
  }, [sessionNameOverride]);

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

        const participants = collectParticipants(info);

        return {
          ...chat,
          name: derivedName,
          avatar: derivedAvatar,
          participants: participants.length > 0 ? participants : chat.participants,
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
    async (options?: { reset?: boolean; silent?: boolean }) => {
      const reset = options?.reset ?? false;
      const silent = options?.silent ?? false;

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
        if (!silent) {
          setLoading(true);
          setIsLoadingMoreChats(false);
        }
      } else if (!silent) {
        setIsLoadingMoreChats(true);
      }

      isFetchingChatsRef.current = true;

      try {
        console.log('🔄 Carregando chats...', { reset, offset: chatOffsetRef.current });
        const offset = reset ? 0 : chatOffsetRef.current;
        const response = await wahaService.getChatsOverview(CHAT_PAGE_SIZE, offset);

        if (response.error) {
          throw new WAHARequestError(response.error, response.status);
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
        console.error('❌ Erro ao carregar chats:', err);

        let status: number | undefined;
        let errorMessage = 'Não foi possível carregar as conversas. Tente novamente.';

        if (err instanceof WAHARequestError) {
          status = err.status;
          if (err.message?.trim()) {
            errorMessage = err.message;
          }
        } else if (err instanceof Error && err.message.trim()) {
          errorMessage = err.message;
        }

        let resolvedSessionName: string | undefined;

        if (status === 422) {
          errorMessage = WAHA_SESSION_RECOVERY_MESSAGE;
          try {
            const config = await wahaService.getResolvedConfig();
            resolvedSessionName = config.session;
          } catch (configError) {
            console.error('Failed to resolve WAHA session after 422 response:', configError);
          }

          if (isMountedRef.current) {
            const sessionName = resolvedSessionName;
            setSessionStatus((previous) => ({
              name: previous?.name ?? sessionName ?? 'WAHA',
              status: 'FAILED',
            }));
          }
        }

        if (isMountedRef.current) {
          setError(errorMessage);
        }

        if (!silent) {
          toast({
            title: status === 422 ? 'Sessão desconectada' : 'Erro',
            description: errorMessage,
            variant: 'destructive',
          });
        }
      } finally {
        isFetchingChatsRef.current = false;
        if (isMountedRef.current) {
          if (reset && !silent) {
            setLoading(false);
          }
          if (!silent) {
            setIsLoadingMoreChats(false);
          }
        }

      }
    },
    [enrichChatWithInfo, resetChatPagination, toast],
  );

  const loadMoreChats = useCallback(async () => {
    await loadChats({ reset: false });
  }, [loadChats]);

  const ensureChatInState = useCallback(
    (chatId: string) => {
      let placeholder: ChatOverview | null = null;

      setChats((previousChats) => {
        if (previousChats.some((chat) => chat.id === chatId)) {
          return previousChats;
        }

        placeholder = normalizeChatName({
          id: chatId,
          name: WAHAService.extractPhoneFromWhatsAppId(chatId),
          isGroup: chatId.includes('@g.us'),
          avatar: undefined,
          lastMessage: undefined,
          unreadCount: 0,
        });

        return sortChatsByRecency([...previousChats, placeholder]);
      });

      if (!placeholder) {
        return;
      }

      const chatToEnrich = placeholder;
      if (enrichingChatsRef.current.has(chatToEnrich.id)) {
        return;
      }

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
        } catch (error) {
          console.error('Failed to enrich chat information', error);
        } finally {
          enrichingChatsRef.current.delete(chatToEnrich.id);
        }
      })();
    },
    [enrichChatWithInfo],
  );

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
          throw new WAHARequestError(response.error, response.status);
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
        updateMessagePaginationState(chatId, { isLoading: false });

        let status: number | undefined;
        let errorMessage = 'Não foi possível carregar as mensagens. Tente novamente.';

        if (err instanceof WAHARequestError) {
          status = err.status;
          if (err.message?.trim()) {
            errorMessage = err.message;
          }
        } else if (err instanceof Error && err.message.trim()) {
          errorMessage = err.message;
        }

        if (status === 422) {
          errorMessage = WAHA_SESSION_RECOVERY_MESSAGE;
        }

        toast({
          title: status === 422 ? 'Sessão desconectada' : 'Erro',
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
        throw new WAHARequestError(response.error, response.status);
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
      let status: number | undefined;
      let errorMessage = 'Não foi possível enviar a mensagem. Tente novamente.';

      if (err instanceof WAHARequestError) {
        status = err.status;
        if (err.message?.trim()) {
          errorMessage = err.message;
        }
      } else if (err instanceof Error && err.message.trim()) {
        errorMessage = err.message;
      }

      if (status === 422) {
        errorMessage = WAHA_SESSION_RECOVERY_MESSAGE;
      }

      toast({
        title: status === 422 ? 'Sessão desconectada' : 'Erro',
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
      const response = await wahaService.markAsRead(chatId);
      if (response.error) {
        throw new WAHARequestError(response.error, response.status);
      }

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
      ensureChatInState(chatId);
      setActiveChatId(chatId);

      const pagination = ensureMessagePaginationState(chatId);
      if (!pagination.isLoaded) {
        await loadMessages(chatId, { reset: true });
      }

      void markAsRead(chatId);
    },
    [ensureChatInState, ensureMessagePaginationState, loadMessages, markAsRead],
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

    const refreshChatsIfVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      void loadChats({ reset: true, silent: true });
    };

    if (typeof window !== 'undefined') {
      intervalRef.current = setInterval(checkSessionStatus, 30000); // Reduzido para 30 segundos
      chatsRefreshIntervalRef.current = setInterval(refreshChatsIfVisible, 15000);
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', refreshChatsIfVisible);
    }

    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
      if (chatsRefreshIntervalRef.current) {
        clearInterval(chatsRefreshIntervalRef.current);
        chatsRefreshIntervalRef.current = undefined;
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', refreshChatsIfVisible);
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