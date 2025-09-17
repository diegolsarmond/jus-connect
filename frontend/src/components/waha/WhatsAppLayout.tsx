import { useEffect, useMemo, useRef, useState } from "react";
import { useWAHA } from "@/hooks/useWAHA";
import { SessionStatus } from "./SessionStatus";
import { ChatSidebar as CRMChatSidebar } from "@/features/chat/components/ChatSidebar";
import { ChatWindow as CRMChatWindow } from "@/features/chat/components/ChatWindow";
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
    responsible: null,
    tags: [],
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

export const WhatsAppLayout = () => {
  const [searchValue, setSearchValue] = useState("");
  const [responsibleFilter, setResponsibleFilter] = useState("all");
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [conversationOverrides, setConversationOverrides] = useState<
    Record<string, Partial<ConversationSummary>>
  >({});
  const searchInputRef = useRef<HTMLInputElement>(null);
  const wahaState = useWAHA();
  const { addMessage } = wahaState;

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
    const activeId = wahaState.activeChatId ?? undefined;
    if (!activeId) {
      setMessagesLoading(false);
      return;
    }
    if (wahaState.messages[activeId]) {
      setMessagesLoading(false);
    }
  }, [wahaState.activeChatId, wahaState.messages]);

  const conversations = useMemo(() => {
    const mapped = wahaState.chats.map((chat) =>
      mapChatToConversation(chat, conversationOverrides[chat.id]),
    );
    return mapped.sort((a, b) => {
      const timeA = a.lastMessage ? new Date(a.lastMessage.timestamp).getTime() : 0;
      const timeB = b.lastMessage ? new Date(b.lastMessage.timestamp).getTime() : 0;
      return timeB - timeA;
    });
  }, [wahaState.chats, conversationOverrides]);

  const activeConversationId = wahaState.activeChatId ?? undefined;

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId),
    [conversations, activeConversationId],
  );

  const rawMessages = useMemo(
    () => (activeConversationId ? wahaState.messages[activeConversationId] ?? [] : []),
    [activeConversationId, wahaState.messages],
  );

  const messages = useMemo(() => rawMessages.map(mapMessageToCRM), [rawMessages]);

  const handleSelectConversation = async (conversationId: string) => {
    setMessagesLoading(true);
    try {
      await wahaState.selectChat(conversationId);
    } finally {
      setMessagesLoading(false);
    }
  };

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

  return (
    <div className="relative flex h-full min-h-0 bg-background overflow-hidden">
      <SessionStatus
        status={wahaState.sessionStatus}
        onRefresh={wahaState.checkSessionStatus}
      />

      <div className="flex flex-1 min-h-0 pt-14 box-border overflow-hidden">
        <aside className="flex flex-shrink-0 h-full min-h-0 overflow-hidden">
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
              void wahaState.loadChats();
            }}
            searchInputRef={searchInputRef}
            loading={wahaState.loading}
          />
        </aside>

        <section className="flex flex-1 min-w-0 min-h-0 overflow-hidden">
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
        </section>
      </div>
    </div>
  );
};
