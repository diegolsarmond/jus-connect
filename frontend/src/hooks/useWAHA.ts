import { useState, useEffect, useCallback, useRef } from 'react';
import WAHAService, {
  wahaService,
  WAHARequestError,
  WAHA_SESSION_RECOVERY_MESSAGE,
  downloadMediaBlob,
} from '@/services/waha';
import { ChatOverview, ChatParticipant, Message, SessionStatus, WAHAResponse } from '@/types/waha';
import { useToast } from '@/hooks/use-toast';
import type { SendMessageInput } from '@/features/chat/types';

const CHAT_PAGE_SIZE = 50;
const MESSAGE_PAGE_SIZE = 100;

type ChatMessageDeliveryStatus = 'sent' | 'delivered' | 'read';

const statusToAckName = (
  status: ChatMessageDeliveryStatus,
): 'SENT' | 'DELIVERED' | 'READ' => {
  if (status === 'read') {
    return 'READ';
  }
  if (status === 'delivered') {
    return 'DELIVERED';
  }
  return 'SENT';
};

const statusToAckCode = (status: ChatMessageDeliveryStatus): number => {
  if (status === 'read') {
    return 3;
  }
  if (status === 'delivered') {
    return 2;
  }
  return 1;
};
type MessageAckStatus = 'SENT' | 'DELIVERED' | 'READ';

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

const isLocalMediaUrl = (value: string): boolean =>
  value.startsWith('data:') || value.startsWith('blob:');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const normalizeTimestamp = (value: unknown): number | undefined => {
  const numeric = toNumber(value);
  if (typeof numeric !== 'number') {
    return undefined;
  }
  return numeric > 1e12 ? numeric : numeric * 1000;
};

const toBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'online', 'available'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'n', 'offline', 'unavailable'].includes(normalized)) {
      return false;
    }
  }
  return undefined;
};

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

export const useWAHA = (
  sessionNameOverride?: string | null,
  options?: { enablePolling?: boolean },
) => {
  const enablePolling = options?.enablePolling ?? true;
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

  const handlePresenceUpdate = useCallback((payload: unknown) => {
    if (!isMountedRef.current) {
      return;
    }

    if (!isRecord(payload)) {
      return;
    }

    const source = isRecord(payload['payload'])
      ? (payload['payload'] as Record<string, unknown>)
      : isRecord(payload['data'])
        ? (payload['data'] as Record<string, unknown>)
        : payload;

    if (!isRecord(source)) {
      return;
    }

    const chatRecord = isRecord(source['chat']) ? (source['chat'] as Record<string, unknown>) : undefined;
    const contactRecord = isRecord(source['contact']) ? (source['contact'] as Record<string, unknown>) : undefined;
    const presenceRecord = isRecord(source['presence'])
      ? (source['presence'] as Record<string, unknown>)
      : undefined;

    const chatId = pickFirstString(
      source['chatId'],
      source['chat_id'],
      source['chatID'],
      source['id'],
      source['jid'],
      source['remoteJid'],
      source['remote'],
      source['user'],
      source['userId'],
      source['participant'],
      chatRecord ? chatRecord['id'] : undefined,
      chatRecord ? chatRecord['_serialized'] : undefined,
      contactRecord ? contactRecord['id'] : undefined,
      contactRecord ? contactRecord['_serialized'] : undefined,
    );

    if (!chatId) {
      return;
    }

    const presenceStatus = pickFirstString(
      source['presence'],
      source['presenceStatus'],
      source['status'],
      source['state'],
      presenceRecord ? presenceRecord['presence'] : undefined,
      presenceRecord ? presenceRecord['status'] : undefined,
      presenceRecord ? presenceRecord['state'] : undefined,
    );

    const isOnline =
      toBoolean(source['isOnline']) ??
      toBoolean(source['online']) ??
      toBoolean(source['is_online']) ??
      (presenceRecord
        ? toBoolean(presenceRecord['isOnline']) ?? toBoolean(presenceRecord['online'])
        : undefined);

    const lastSeenCandidates = [
      source['lastSeen'],
      source['last_seen'],
      source['lastSeenAt'],
      source['lastSeenTs'],
      source['timestamp'],
      source['lastOnline'],
      presenceRecord ? presenceRecord['lastSeen'] : undefined,
      presenceRecord ? presenceRecord['last_seen'] : undefined,
      presenceRecord ? presenceRecord['lastSeenAt'] : undefined,
      presenceRecord ? presenceRecord['timestamp'] : undefined,
    ];

    let resolvedLastSeen: number | undefined;
    for (const candidate of lastSeenCandidates) {
      const normalized = normalizeTimestamp(candidate);
      if (typeof normalized === 'number') {
        resolvedLastSeen = normalized;
        break;
      }
    }

    setChats((previousChats) => {
      const index = previousChats.findIndex((chat) => chat.id === chatId);
      if (index === -1) {
        return previousChats;
      }

      const current = previousChats[index];
      let changed = false;
      const next: ChatOverview = { ...current };

      if (typeof isOnline === 'boolean' && current.isOnline !== isOnline) {
        next.isOnline = isOnline;
        changed = true;
      }

      if (typeof resolvedLastSeen === 'number' && current.lastSeen !== resolvedLastSeen) {
        next.lastSeen = resolvedLastSeen;
        changed = true;
      }

      if (presenceStatus && current.presence !== presenceStatus) {
        next.presence = presenceStatus;
        changed = true;
      }

      if (!changed) {
        return previousChats;
      }

      const nextChats = [...previousChats];
      nextChats[index] = next;
      return nextChats;
    });
  }, []);

  const updateChatPresence = useCallback(
    (update: { chatId: string; isOnline?: boolean; lastSeen?: number | string | null; presence?: string | null }) => {
      if (!update || typeof update !== 'object') {
        return;
      }

      handlePresenceUpdate(update);
    },
    [handlePresenceUpdate],
  );

  useEffect(() => {
    wahaService.setSessionOverride(sessionNameOverride ?? null);

    return () => {
      if (sessionNameOverride) {
        wahaService.setSessionOverride(null);
      }
    };
  }, [sessionNameOverride]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const globalWindow = window as typeof window & {
      wahaPresenceUpdate?: (payload: unknown) => void;
    };

    const eventListener: EventListener = (event) => {
      const customEvent = event as CustomEvent<unknown>;
      handlePresenceUpdate(customEvent.detail);
    };

    const eventNames = ['waha.plus.presence', 'waha-plus-presence'];
    for (const eventName of eventNames) {
      window.addEventListener(eventName, eventListener);
    }

    const previous = globalWindow.wahaPresenceUpdate;
    const combined = (payload: unknown) => {
      handlePresenceUpdate(payload);
      if (previous && previous !== combined) {
        previous(payload);
      }
    };

    globalWindow.wahaPresenceUpdate = combined;

    return () => {
      for (const eventName of eventNames) {
        window.removeEventListener(eventName, eventListener);
      }

      if (globalWindow.wahaPresenceUpdate === combined) {
        if (previous) {
          globalWindow.wahaPresenceUpdate = previous;
        } else {
          delete globalWindow.wahaPresenceUpdate;
        }
      }
    };
  }, [handlePresenceUpdate]);

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

      if (response.status === 404) {
        console.warn('ℹ️ Informações do chat não encontradas, usando fallback', chat.id);
        return {
          ...chat,
          name: fallbackName,
        };
      }

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

  const resolveMessageMedia = useCallback(async (message: Message): Promise<Message> => {
    const explicitResolved = typeof message.resolvedMediaUrl === 'string'
      ? message.resolvedMediaUrl.trim()
      : '';

    if (explicitResolved && isLocalMediaUrl(explicitResolved)) {
      return message.resolvedMediaUrl === explicitResolved
        ? message
        : { ...message, resolvedMediaUrl: explicitResolved };
    }

    const rawMediaUrl = typeof message.mediaUrl === 'string' ? message.mediaUrl.trim() : '';
    if (!rawMediaUrl) {
      return message;
    }

    if (isLocalMediaUrl(rawMediaUrl)) {
      if (message.resolvedMediaUrl === rawMediaUrl) {
        return message;
      }
      return { ...message, resolvedMediaUrl: rawMediaUrl };
    }

    try {
      const resolved = await downloadMediaBlob(rawMediaUrl);
      if (!resolved) {
        return message;
      }

      if (message.resolvedMediaUrl === resolved) {
        return message;
      }

      if (resolved === rawMediaUrl && !isLocalMediaUrl(resolved)) {
        return message;
      }

      return { ...message, resolvedMediaUrl: resolved };
    } catch (error) {
      console.error('Failed to resolver mídia do WAHA', error);
      return message;
    }
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
          downloadMedia: true,
        });

        if (response.error) {
          throw new WAHARequestError(response.error, response.status);
        }

        const rawBatch = response.data ?? [];
        const batch = await Promise.all(rawBatch.map(resolveMessageMedia));

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
      resolveMessageMedia,
    ],
  );

  const refreshChatsIfVisible = useCallback(() => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      return;
    }
    void loadChats({ reset: true, silent: true });
  }, [loadChats]);

  const loadOlderMessages = useCallback(
    async (chatId: string): Promise<Message[]> => loadMessages(chatId, { reset: false }),
    [loadMessages],
  );

  // Send a message (text or media)
  const sendMessage = useCallback(
    async (payload: SendMessageInput, options?: { chatId?: string }) => {
      const chatId = options?.chatId ?? activeChatId;
      if (!chatId) {
        throw new Error('Nenhuma conversa ativa selecionada.');
      }
      const attachments = payload.attachments ?? [];
      const [primaryAttachment] = attachments;
      const trimmedContent = payload.content?.trim?.() ?? '';
      const hasTextContent = trimmedContent.length > 0;
      const hasAttachment = Boolean(primaryAttachment);

      if (!hasTextContent && !hasAttachment) {
        return;
      }

      const resolveMessageKind = (): 'text' | 'image' | 'audio' | 'file' => {
        if (!hasAttachment) {
          return 'text';
        }

        const explicitType = payload.type?.toLowerCase();
        const attachmentType = primaryAttachment?.type?.toLowerCase();

        if (explicitType === 'image' || attachmentType === 'image') {
          return 'image';
        }
        if (explicitType === 'audio' || attachmentType === 'audio') {
          return 'audio';
        }
        return 'file';
      };

      const kind = resolveMessageKind();
      const baseCaption = hasTextContent ? trimmedContent : undefined;
      const attachmentUrl = primaryAttachment?.url;
      const attachmentName = primaryAttachment?.name;

      const temporaryId =
        typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function'
          ? globalThis.crypto.randomUUID()
          : Date.now().toString();
      const temporaryTimestamp = Date.now();
      const temporaryType: Message['type'] =
        kind === 'text' ? 'text' : kind === 'image' ? 'image' : kind === 'audio' ? 'audio' : 'document';

      let temporaryBody = kind === 'text' ? trimmedContent : undefined;
      const temporaryCaption = kind !== 'text' ? baseCaption : undefined;
      const temporaryFilename = kind !== 'text' ? attachmentName : undefined;
      const temporaryMediaUrl = kind !== 'text' ? attachmentUrl : undefined;

      if (kind !== 'text' && !temporaryBody && baseCaption) {
        temporaryBody = baseCaption;
      }

      const temporaryMessage: Message = {
        id: temporaryId,
        chatId,
        timestamp: temporaryTimestamp,
        type: temporaryType,
        body: temporaryBody,
        caption: temporaryCaption,
        filename: temporaryFilename,
        mediaUrl: temporaryMediaUrl,
        resolvedMediaUrl: temporaryMediaUrl,
        fromMe: true,
        ack: 'PENDING',
      };

      let previousLastMessage: Message | undefined;

      if (isMountedRef.current) {
        setMessages((prev) => {
          const existing = prev[chatId] || [];
          previousLastMessage = existing[existing.length - 1];
          return {
            ...prev,
            [chatId]: [...existing, temporaryMessage],
          };
        });

        const pendingPreview =
          temporaryMessage.body ??
          temporaryMessage.caption ??
          temporaryMessage.filename ??
          (temporaryMessage.mediaUrl && temporaryMessage.type !== 'text' ? temporaryMessage.mediaUrl : '') ??
          '';

        const pendingAckNumber =
          typeof temporaryMessage.ack === 'number' ? temporaryMessage.ack : undefined;
        const pendingAckName =
          typeof temporaryMessage.ack === 'string' ? temporaryMessage.ack : undefined;

        setChats((prev) =>
          sortChatsByRecency(
            prev.map((chat) =>
              chat.id === chatId
                ? {
                    ...chat,
                    lastMessage: {
                      id: temporaryMessage.id,
                      body: pendingPreview,
                      timestamp: temporaryMessage.timestamp,
                      fromMe: true,
                      type: temporaryMessage.type,
                      ack: pendingAckNumber,
                      ackName: pendingAckName,
                    },
                  }
                : chat,
            ),
          ),
        );
      }

      try {
        let response: WAHAResponse<Message> | null = null;

        if (kind === 'text') {
          const messageText = trimmedContent;
          if (!messageText) {
            return;
          }
          response = await wahaService.sendTextMessage({
            chatId,
            text: messageText,
            linkPreview: true,
          });
        } else if (kind === 'image') {
          if (!attachmentUrl) {
            throw new Error('Nenhuma imagem encontrada para envio.');
          }
          response = await wahaService.sendImageMessage({
            chatId,
            image: attachmentUrl,
            caption: baseCaption,
            filename: attachmentName,
            isBase64: attachmentUrl.startsWith('data:'),
          });
        } else if (kind === 'audio') {
          if (!attachmentUrl) {
            throw new Error('Nenhum áudio encontrado para envio.');
          }
          response = await wahaService.sendVoiceMessage({
            chatId,
            voice: attachmentUrl,
            caption: baseCaption,
            filename: attachmentName,
          });
        } else {
          if (!attachmentUrl) {
            throw new Error('Nenhum arquivo encontrado para envio.');
          }
          response = await wahaService.sendFileMessage({
            chatId,
            file: attachmentUrl,
            caption: baseCaption,
            filename: attachmentName,
            isBase64: attachmentUrl.startsWith('data:'),
          });
        }

        if (!response) {
          return;
        }

        if (response.error) {
          throw new WAHARequestError(response.error, response.status);
        }

        const data = response.data;
        if (data && isMountedRef.current) {
          const normalizedBase: Message = {
            ...data,
            chatId: data.chatId ?? chatId,
            body:
              data.body ??
              (kind === 'text' && hasTextContent ? trimmedContent : data.body),
            caption:
              data.caption ??
              (kind !== 'text' && baseCaption ? baseCaption : data.caption),
            filename:
              data.filename ?? (kind !== 'text' ? attachmentName : data.filename),
            mediaUrl:
              data.mediaUrl ?? (kind !== 'text' ? attachmentUrl : data.mediaUrl),
            fromMe: true,
          };

          if (kind !== 'text' && !normalizedBase.body && baseCaption) {
            normalizedBase.body = baseCaption;
          }

          const normalized = await resolveMessageMedia(normalizedBase);

          setMessages((prev) => {
            const existing = prev[chatId] || [];
            let found = false;
            const replaced = existing.map((item) => {
              if (item.id === temporaryMessage.id) {
                found = true;
                return normalized;
              }
              return item;
            });
            const nextMessages = found ? replaced : [...existing, normalized];
            return {
              ...prev,
              [chatId]: nextMessages.sort((a, b) => a.timestamp - b.timestamp),
            };
          });

          const lastMessagePreview =
            normalized.body ??
            normalized.caption ??
            normalized.filename ??
            (normalized.mediaUrl && normalized.type !== 'text' ? normalized.mediaUrl : '') ??
            '';

          setChats((prev) =>
            sortChatsByRecency(
              prev.map((chat) =>
                chat.id === chatId
                  ? {
                      ...chat,
                      lastMessage: {
                        id: normalized.id,
                        body: lastMessagePreview,
                        timestamp: normalized.timestamp,
                        fromMe: true,
                        type: normalized.type,
                        ack:
                          typeof normalized.ack === 'number'
                            ? normalized.ack
                            : undefined,
                        ackName:
                          typeof normalized.ack === 'string'
                            ? normalized.ack
                            : undefined,
                      },
                    }
                  : chat,
              ),
            ),
          );

          toast({
            title: 'Mensagem enviada',
            description: 'Sua mensagem foi enviada com sucesso.',
          });
        }
      } catch (err) {
        if (isMountedRef.current) {
          setMessages((prev) => {
            const existing = prev[chatId] || [];
            return {
              ...prev,
              [chatId]: existing.filter((item) => item.id !== temporaryMessage.id),
            };
          });

          setChats((prev) =>
            sortChatsByRecency(
              prev.map((chat) => {
                if (chat.id !== chatId) {
                  return chat;
                }

                if (!previousLastMessage) {
                  return { ...chat, lastMessage: undefined };
                }

                const previousPreview =
                  previousLastMessage.body ??
                  previousLastMessage.caption ??
                  previousLastMessage.filename ??
                  (previousLastMessage.mediaUrl && previousLastMessage.type !== 'text'
                    ? previousLastMessage.mediaUrl
                    : '') ??
                  '';

                const previousAckNumber =
                  typeof previousLastMessage.ack === 'number' ? previousLastMessage.ack : undefined;
                const previousAckName =
                  typeof previousLastMessage.ack === 'string' ? previousLastMessage.ack : undefined;

                return {
                  ...chat,
                  lastMessage: {
                    id: previousLastMessage.id,
                    body: previousPreview,
                    timestamp: previousLastMessage.timestamp,
                    fromMe: previousLastMessage.fromMe,
                    type: previousLastMessage.type,
                    ack: previousAckNumber,
                    ackName: previousAckName,
                  },
                };
              }),
            ),
          );
        }

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

        if (status !== undefined) {
          throw new WAHARequestError(errorMessage, status);
        }

        throw new Error(errorMessage);
      }
    },
    [activeChatId, resolveMessageMedia, toast],
  );

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
      void (async () => {
        const resolvedMessage = await resolveMessageMedia(message);

        if (!isMountedRef.current) {
          return;
        }

        ensureMessagePaginationState(resolvedMessage.chatId);
        updateMessagePaginationState(resolvedMessage.chatId, { isLoaded: true });

        setMessages((prev) => {
          const existing = prev[resolvedMessage.chatId] ?? [];
          if (existing.some((item) => item.id === resolvedMessage.id)) {
            return prev;
          }

          const nextMessages = [...existing, resolvedMessage].sort((a, b) => a.timestamp - b.timestamp);
          return {
            ...prev,
            [resolvedMessage.chatId]: nextMessages,
          };
        });

        const text = resolvedMessage.body ?? resolvedMessage.caption ?? '';
        const ackNumber = typeof resolvedMessage.ack === 'number' ? resolvedMessage.ack : undefined;
        const ackName = typeof resolvedMessage.ack === 'string' ? resolvedMessage.ack : undefined;

        let placeholder: ChatOverview | null = null;

        setChats((previousChats) => {
          const existingIndex = previousChats.findIndex((chat) => chat.id === resolvedMessage.chatId);

          if (existingIndex >= 0) {
            const existingChat = previousChats[existingIndex];
            const unreadCount = resolvedMessage.fromMe
              ? existingChat.unreadCount ?? 0
              : (existingChat.unreadCount ?? 0) + 1;

            const updatedChat = normalizeChatName({
              ...existingChat,
              lastMessage: {
                id: resolvedMessage.id,
                body: text,
                timestamp: resolvedMessage.timestamp,
                fromMe: resolvedMessage.fromMe,
                type: resolvedMessage.type,
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
            id: resolvedMessage.chatId,
            name: WAHAService.extractPhoneFromWhatsAppId(resolvedMessage.chatId),
            isGroup: resolvedMessage.chatId.includes('@g.us'),
            avatar: undefined,
            lastMessage: {
              id: resolvedMessage.id,
              body: text,
              timestamp: resolvedMessage.timestamp,
              fromMe: resolvedMessage.fromMe,
              type: resolvedMessage.type,
              ack: ackNumber,
              ackName,
            },
            unreadCount: resolvedMessage.fromMe ? 0 : 1,
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
      })();
    },
    [
      ensureMessagePaginationState,
      enrichChatWithInfo,
      resolveMessageMedia,
      updateMessagePaginationState,
    ],
  );

  const updateMessageStatus = useCallback(
    (chatId: string, messageId: string, status: ChatMessageDeliveryStatus) => {
      if (!isMountedRef.current) {
        return;
      }

      const ackName = statusToAckName(status);
      const ackCode = statusToAckCode(status);

      setMessages((previousMessages) => {
        const existing = previousMessages[chatId];
        if (!existing) {
          return previousMessages;
        }

        const index = existing.findIndex((item) => item.id === messageId);
        if (index === -1) {
          return previousMessages;
        }

        const current = existing[index];
        if (current.ack === ackName) {
          return previousMessages;
        }

        const updated = { ...current, ack: ackName };
        const nextMessages = [...existing];
        nextMessages[index] = updated;

        return {
          ...previousMessages,
          [chatId]: nextMessages,
        };
      });

      setChats((previousChats) => {
        const index = previousChats.findIndex((chat) => chat.id === chatId);
        if (index === -1) {
          return previousChats;
        }

        const chat = previousChats[index];
        if (!chat.lastMessage || chat.lastMessage.id !== messageId) {
          return previousChats;
        }

        if (chat.lastMessage.ack === ackCode && chat.lastMessage.ackName === ackName) {
          return previousChats;
        }

        const nextChats = [...previousChats];
        nextChats[index] = {
          ...chat,
          lastMessage: {
            ...chat.lastMessage,
            ack: ackCode,
            ackName,
          },
        };

        return nextChats;
      });
    },
    [],
  );

  const updateMessageAck = useCallback(
    (chatId: string, messageId: string, ack: MessageAckStatus) => {
      if (!isMountedRef.current) {
        return;
      }

      const normalizedAck = (typeof ack === 'string' ? ack.toUpperCase() : 'SENT') as MessageAckStatus;
      const ackNumber = normalizedAck === 'READ' ? 3 : normalizedAck === 'DELIVERED' ? 2 : 1;

      setMessages((previousMessages) => {
        const existing = previousMessages[chatId];
        if (!existing) {
          return previousMessages;
        }

        let hasChanges = false;

        const nextMessages = existing.map((message) => {
          if (message.id !== messageId) {
            return message;
          }

          if (message.ack === normalizedAck) {
            return message;
          }

          hasChanges = true;
          return {
            ...message,
            ack: normalizedAck,
          };
        });

        if (!hasChanges) {
          return previousMessages;
        }

        return {
          ...previousMessages,
          [chatId]: nextMessages,
        };
      });

      setChats((previousChats) => {
        let hasChanges = false;

        const nextChats = previousChats.map((chat) => {
          if (chat.id !== chatId || !chat.lastMessage || chat.lastMessage.id !== messageId) {
            return chat;
          }

          const previousAckName =
            chat.lastMessage.ackName ?? (typeof chat.lastMessage.ack === 'string' ? chat.lastMessage.ack : undefined);
          const previousAckNumber = typeof chat.lastMessage.ack === 'number' ? chat.lastMessage.ack : undefined;

          if (previousAckName === normalizedAck && previousAckNumber === ackNumber) {
            return chat;
          }

          hasChanges = true;
          return {
            ...chat,
            lastMessage: {
              ...chat.lastMessage,
              ack: ackNumber,
              ackName: normalizedAck,
            },
          };
        });

        return hasChanges ? nextChats : previousChats;
      });
    },
    [],
  );

  const updateChatUnreadCount = useCallback((chatId: string, unreadCount: number) => {
    if (!isMountedRef.current) {
      return;
    }

    setChats((previousChats) => {
      const index = previousChats.findIndex((chat) => chat.id === chatId);
      if (index === -1) {
        return previousChats;
      }

      const chat = previousChats[index];
      if (chat.unreadCount === unreadCount) {
        return previousChats;
      }

      const nextChats = [...previousChats];
      nextChats[index] = {
        ...chat,
        unreadCount,
      };

      return nextChats;
    });
  }, []);

  // Initialize
  useEffect(() => {
    isMountedRef.current = true;
    loadChats({ reset: true });
    checkSessionStatus();

    if (typeof window !== 'undefined') {
      intervalRef.current = setInterval(checkSessionStatus, 30000); // Reduzido para 30 segundos
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
  }, [loadChats, checkSessionStatus, refreshChatsIfVisible]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (chatsRefreshIntervalRef.current) {
      clearInterval(chatsRefreshIntervalRef.current);
      chatsRefreshIntervalRef.current = undefined;
    }

    if (enablePolling) {
      chatsRefreshIntervalRef.current = setInterval(refreshChatsIfVisible, 15000);
    }

    return () => {
      if (chatsRefreshIntervalRef.current) {
        clearInterval(chatsRefreshIntervalRef.current);
        chatsRefreshIntervalRef.current = undefined;
      }
    };
  }, [enablePolling, refreshChatsIfVisible]);

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
    updateMessageStatus,
    updateChatUnreadCount,
    updateMessageAck,
    updateChatPresence,
    checkSessionStatus,
    
    // Utils
    formatPhoneToWhatsAppId: WAHAService.formatPhoneToWhatsAppId,
    getWebhookUrl: wahaService.getWebhookUrl,
  };
};