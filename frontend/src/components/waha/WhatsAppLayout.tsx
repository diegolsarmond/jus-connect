import { useEffect, useMemo, useRef, useState } from "react";
import { useWAHA } from "@/hooks/useWAHA";
import { SessionStatus } from "./SessionStatus";
import { ChatSidebar as CRMChatSidebar } from "@/features/chat/components/ChatSidebar";
import type { ConversationSummary } from "@/features/chat/types";
import { teamMembers } from "@/features/chat/data/teamMembers";
import type { ChatOverview } from "@/types/waha";
import WAHAService from "@/services/waha";
import { WebhookInfo } from "./WebhookInfo";

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

export const WhatsAppLayout = () => {
  const [searchValue, setSearchValue] = useState("");
  const [responsibleFilter, setResponsibleFilter] = useState("all");
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

  const conversations = useMemo(() => {
    const mapped = wahaState.chats.map((chat) => mapChatToConversation(chat));
    return mapped.sort((a, b) => {
      const timeA = a.lastMessage ? new Date(a.lastMessage.timestamp).getTime() : 0;
      const timeB = b.lastMessage ? new Date(b.lastMessage.timestamp).getTime() : 0;
      return timeB - timeA;
    });
  }, [wahaState.chats]);

  const activeConversationId = wahaState.activeChatId ?? undefined;

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId),
    [conversations, activeConversationId],
  );

  const handleSelectConversation = async (conversationId: string) => {
    await wahaState.selectChat(conversationId);
  };

  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-muted/20">

      <SessionStatus
        status={wahaState.sessionStatus}
        onRefresh={wahaState.checkSessionStatus}
      />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex h-full min-h-0 w-[30%] min-w-[300px] max-w-md flex-shrink-0 flex-col overflow-hidden border-r border-border/50 bg-sidebar shadow-[0_12px_24px_rgba(15,23,42,0.06)]">

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
        </div>

        <div className="flex h-full flex-1 min-w-0 flex-col overflow-hidden bg-background">
          <WebhookInfo />
        </div>
      </div>
    </div>
  );
};
