import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWAHA } from "@/hooks/useWAHA";
import { SessionStatus } from "./SessionStatus";
import { ChatSidebar as CRMChatSidebar } from "@/features/chat/components/ChatSidebar";
import { ChatWindow as CRMChatWindow } from "@/features/chat/components/ChatWindow";
import { NewConversationModal } from "@/features/chat/components/NewConversationModal";
import type {
  ConversationSummary,
  Message as CRMMessage,
  SendMessageInput,
  UpdateConversationPayload,
} from "@/features/chat/types";
import { teamMembers } from "@/features/chat/data/teamMembers";
import type { ChatOverview, Message as WAHAMessage } from "@/types/waha";
import WAHAService from "@/services/waha";

const ensureIsoTimestamp = (value?: number): string => {
  if (!value) {
    return new Date().toISOString();
  }
  const timestamp = value < 1_000_000_000_000 ? value * 1000 : value;
  return new Date(timestamp).toISOString();
};

const mapAckToStatus = (ack?: string | number) => {
  if (typeof ack === "string") {
    const normalized = ack.toUpperCase();
    if (normalized === "READ") return "read";
    if (normalized === "DELIVERED") return "delivered";
    return "sent";
  }
  if (typeof ack === "number") {
    if (ack >= 3) return "read";
    if (ack === 2) return "delivered";
    return "sent";
  }
  return "sent";
};

const createAvatarUrl = (name: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1D4ED8&color=FFFFFF`;

const defaultTagPalettes = [
  ["Novo lead", "WhatsApp"],
  ["Prioritário", "Processo civil"],
  ["Financeiro", "Follow-up"],
  ["Documentos", "Urgente"],
  ["Onboarding", "Cliente ativo"],
  ["Reunião", "Retorno agendado"],
  ["Atendimento", "Triagem"],
  ["Consultoria", "Revisar contrato"],
];

const deterministicIndex = (seed: string, length: number) => {
  if (length <= 0) {
    return 0;
  }
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0; // Converte para inteiro de 32 bits
  }
  return Math.abs(hash) % length;
};

const pickDefaultResponsible = (chatId: string) => {
  if (!teamMembers.length) {
    return null;
  }
  return teamMembers[deterministicIndex(chatId, teamMembers.length)] ?? null;
};

const pickDefaultTags = (chatId: string) => {
  if (!defaultTagPalettes.length) {
    return [];
  }
  const palette = defaultTagPalettes[deterministicIndex(`${chatId}-tags`, defaultTagPalettes.length)];
  return palette ? [...palette] : [];
};

const mergeOverrides = (
  base: ConversationSummary,
  overrides?: Partial<ConversationSummary>,
): ConversationSummary => {
  if (!overrides) {
    return base;
  }
  return {
    ...base,
    ...overrides,
    tags: overrides.tags ?? base.tags,
    customAttributes: overrides.customAttributes ?? base.customAttributes,
    internalNotes: overrides.internalNotes ?? base.internalNotes,
    responsible:
      overrides.responsible !== undefined ? overrides.responsible : base.responsible ?? null,
    phoneNumber: overrides.phoneNumber ?? base.phoneNumber,
    clientName: overrides.clientName ?? base.clientName,
    isLinkedToClient: overrides.isLinkedToClient ?? base.isLinkedToClient,
    isPrivate: overrides.isPrivate ?? base.isPrivate,
  };
};

const mapChatToConversation = (
  chat: ChatOverview,
  overrides?: Partial<ConversationSummary>,
): ConversationSummary => {
  const fallbackName = WAHAService.extractPhoneFromWhatsAppId(chat.id);
  const normalizedName = chat.name?.trim() || fallbackName || chat.id;
  const avatar = chat.avatar && chat.avatar.trim().length > 0
    ? chat.avatar
    : createAvatarUrl(normalizedName);

  const lastMessage = chat.lastMessage
    ? {
        id: chat.lastMessage.id ?? `${chat.id}-last`,
        content: chat.lastMessage.body ?? "",
        preview:
          chat.lastMessage.body?.trim().length
            ? chat.lastMessage.body
            : chat.lastMessage.type === "image"
              ? "Imagem"
              : "Nova conversa",
        timestamp: ensureIsoTimestamp(chat.lastMessage.timestamp),
        sender: chat.lastMessage.fromMe ? "me" : "contact",
        type: chat.lastMessage.type === "image" ? "image" : "text",
        status: mapAckToStatus(chat.lastMessage.ackName ?? chat.lastMessage.ack),
      }
    : undefined;

  const base: ConversationSummary = {
    id: chat.id,
    name: normalizedName,
    avatar,
    shortStatus: chat.isGroup ? "Conversa em grupo" : "Conversa no WhatsApp",
    description: lastMessage?.content || undefined,
    unreadCount: chat.unreadCount ?? 0,
    pinned: chat.pinned ?? false,
    lastMessage,
    phoneNumber: WAHAService.extractPhoneFromWhatsAppId(chat.id),
    responsible: pickDefaultResponsible(chat.id),
    tags: pickDefaultTags(chat.id),
    isLinkedToClient: false,
    clientName: null,
    customAttributes: [],
    isPrivate: false,
    internalNotes: [],
  };

  return mergeOverrides(base, overrides);
};

const mapMessageToCRM = (message: WAHAMessage): CRMMessage => {
  const hasMedia = Boolean(message.hasMedia && message.mediaUrl);
  const attachments = hasMedia && message.mediaUrl
    ? [
        {
          id: `${message.id}-attachment`,
          type: "image" as const,
          url: message.mediaUrl,
          name: message.filename ?? "Anexo",
        },
      ]
    : undefined;

  const content = hasMedia
    ? message.caption ?? message.body ?? message.mediaUrl ?? ""
    : message.body ?? message.caption ?? "";

  return {
    id: message.id,
    conversationId: message.chatId,
    sender: message.fromMe ? "me" : "contact",
    content,
    timestamp: ensureIsoTimestamp(message.timestamp),
    status: mapAckToStatus(message.ack),
    type: attachments ? "image" : "text",
    attachments,
  };
};

interface WhatsAppLayoutProps {
  conversationIdFromRoute?: string;
  onConversationRouteChange?: (conversationId: string | null) => void;
}

export const WhatsAppLayout = ({
  conversationIdFromRoute,
  onConversationRouteChange,
}: WhatsAppLayoutProps) => {
  const [searchValue, setSearchValue] = useState("");
  const [responsibleFilter, setResponsibleFilter] = useState("all");
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [conversationOverrides, setConversationOverrides] = useState<
    Record<string, Partial<ConversationSummary>>
  >({});
  const [isNewConversationOpen, setIsNewConversationOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const wahaState = useWAHA();
  const {
    chats: rawChats,
    messages: messageMap,
    addMessage,
    selectChat,
    loadMessages,
    loadChats,
    loadMoreChats,
    activeChatId,
    checkSessionStatus,
    loading,
    hasMoreChats,
    isLoadingMoreChats,
  } = wahaState;

  // Set up webhook receiver for demo purposes
  useEffect(() => {
    window.wahaWebhookReceived = (message) => {
      addMessage(message);
    };

    return () => {
      delete window.wahaWebhookReceived;
    };
  }, [addMessage]);

  useEffect(() => {
    const activeId = activeChatId ?? undefined;
    if (!activeId) {
      setMessagesLoading(false);
      return;
    }
    if (wahaState.messages[activeId]) {
      setMessagesLoading(false);
    }
  }, [activeChatId, wahaState.messages]);

  const conversations = useMemo(() => {
    const mapped = rawChats.map((chat) =>
      mapChatToConversation(chat, conversationOverrides[chat.id]),
    );
    return mapped.sort((a, b) => {
      const timeA = a.lastMessage ? new Date(a.lastMessage.timestamp).getTime() : 0;
      const timeB = b.lastMessage ? new Date(b.lastMessage.timestamp).getTime() : 0;
      return timeB - timeA;
    });
  }, [rawChats, conversationOverrides]);

  const activeConversationId = activeChatId ?? undefined;

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId),
    [conversations, activeConversationId],
  );

  const rawMessages = useMemo(
    () => (activeConversationId ? messageMap[activeConversationId] ?? [] : []),
    [activeConversationId, messageMap],
  );

  const messages = useMemo(() => rawMessages.map(mapMessageToCRM), [rawMessages]);

  const handleSelectConversation = useCallback(
    async (conversationId: string, options?: { skipNavigation?: boolean }) => {
      setMessagesLoading(true);
      try {
        await selectChat(conversationId);
        if (!options?.skipNavigation) {
          onConversationRouteChange?.(conversationId);
        }
      } finally {
        setMessagesLoading(false);
      }
    },
    [onConversationRouteChange, selectChat],
  );

  useEffect(() => {
    if (!conversationIdFromRoute) {
      return;
    }
    if (conversationIdFromRoute === activeChatId) {
      return;
    }
    void handleSelectConversation(conversationIdFromRoute, { skipNavigation: true });
  }, [conversationIdFromRoute, handleSelectConversation, activeChatId]);

  const handleSendMessage = async (payload: SendMessageInput) => {
    if (!activeConversationId) {
      return;
    }
    const text = payload.content.trim();
    if (!text) {
      return;
    }
    await wahaState.sendMessage(activeConversationId, text);
  };

  const handleUpdateConversation = async (
    conversationId: string,
    changes: UpdateConversationPayload,
  ) => {
    setConversationOverrides((previous) => {
      const current = previous[conversationId] ?? {};
      const next: Partial<ConversationSummary> = { ...current };

      if ("responsibleId" in changes) {
        const member = changes.responsibleId
          ? teamMembers.find((item) => item.id === changes.responsibleId) ?? null
          : null;
        next.responsible = member;
      }
      if ("tags" in changes) {
        next.tags = changes.tags ?? [];
      }
      if ("phoneNumber" in changes) {
        next.phoneNumber = changes.phoneNumber;
      }
      if ("isLinkedToClient" in changes) {
        next.isLinkedToClient = changes.isLinkedToClient ?? false;
      }
      if ("clientName" in changes) {
        next.clientName = changes.clientName ?? null;
      }
      if ("customAttributes" in changes) {
        next.customAttributes = changes.customAttributes ?? [];
      }
      if ("isPrivate" in changes) {
        next.isPrivate = Boolean(changes.isPrivate);
      }
      if ("internalNotes" in changes) {
        next.internalNotes = changes.internalNotes ?? [];
      }

      return { ...previous, [conversationId]: next };
    });
  };

  const conversationSuggestions = useMemo(
    () => conversations.slice(0, 60),
    [conversations],
  );

  const handleModalSelect = useCallback(
    async (conversationId: string) => {
      setIsNewConversationOpen(false);
      await handleSelectConversation(conversationId);
    },
    [handleSelectConversation],
  );

  const handleReload = useCallback(() => {
    void checkSessionStatus();
    void loadChats({ reset: true });
    if (activeConversationId) {
      void loadMessages(activeConversationId);
    }
  }, [activeConversationId, checkSessionStatus, loadChats, loadMessages]);

  return (
    <div
      className="flex min-h-screen flex-col items-center overflow-hidden px-3 py-6 sm:px-6"
      style={{
        background:
          "radial-gradient(circle at -20% -20%, rgba(59,130,246,0.16), transparent 55%)," +
          "radial-gradient(circle at 110% -10%, rgba(14,165,233,0.18), transparent 50%)," +
          "linear-gradient(180deg, rgba(241,245,249,0.92) 0%, rgba(226,232,240,0.75) 45%, rgba(226,232,240,0.55) 100%)",
      }}
    >
      <div
        className="flex w-full flex-1 flex-col gap-4 sm:gap-6"
        style={{ width: "min(100%, clamp(360px, 50vw, 1100px))" }}
      >
        <SessionStatus status={wahaState.sessionStatus} onRefresh={handleReload} />

        <div className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-[32px] border border-white/40 bg-white/60 shadow-[0_32px_56px_rgba(15,23,42,0.18)] backdrop-blur-xl">
          <div className="flex flex-1 min-h-0 flex-col overflow-hidden lg:flex-row">
            <div className="flex h-full min-h-0 w-full min-w-0 flex-shrink-0 flex-col overflow-hidden border-b border-border/40 bg-sidebar/90 backdrop-blur-sm lg:w-[34%] lg:min-w-[300px] lg:max-w-md lg:border-b-0 lg:border-r">
              <CRMChatSidebar
                conversations={conversations}
                activeConversationId={activeConversationId}
                searchValue={searchValue}
                onSearchChange={setSearchValue}
                responsibleFilter={responsibleFilter}
                responsibleOptions={teamMembers}
                onResponsibleFilterChange={setResponsibleFilter}
                onSelectConversation={handleSelectConversation}
                onNewConversation={() => {
                  void loadChats({ reset: true });
                  setIsNewConversationOpen(true);
                }}
                searchInputRef={searchInputRef}
                loading={loading}
                hasMore={hasMoreChats}
                isLoadingMore={isLoadingMoreChats}
                onLoadMore={() => {
                  void loadMoreChats();
                }}
              />
            </div>

            <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-transparent">
              <CRMChatWindow
                conversation={activeConversation}
                messages={messages}
                hasMore={false}
                isLoading={messagesLoading}
                isLoadingMore={false}
                onSendMessage={handleSendMessage}
                onLoadOlder={async () => []}
                onUpdateConversation={handleUpdateConversation}
                isUpdatingConversation={false}
              />
            </div>
          </div>
        </div>
      </div>

      <NewConversationModal
        open={isNewConversationOpen}
        suggestions={conversationSuggestions}
        onClose={() => setIsNewConversationOpen(false)}
        onSelectConversation={(conversationId) => {
          void handleModalSelect(conversationId);
        }}
        onCreateConversation={async () => null}
        allowCreate={false}
      />
    </div>
  );
};
