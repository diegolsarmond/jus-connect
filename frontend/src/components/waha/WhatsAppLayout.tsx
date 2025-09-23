import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWAHA } from "@/hooks/useWAHA";
import { SessionStatus } from "./SessionStatus";
import { ChatSidebar as CRMChatSidebar } from "@/features/chat/components/ChatSidebar";
import { ChatWindow as CRMChatWindow } from "@/features/chat/components/ChatWindow";
import { NewConversationModal } from "@/features/chat/components/NewConversationModal";
import { ConversationLoadingScreen } from "./ConversationLoadingScreen";
import type {
  ConversationSummary,
  Message as CRMMessage,
  SendMessageInput,
  UpdateConversationPayload,
} from "@/features/chat/types";
import {
  fetchChatResponsibles,
  type ChatResponsibleOption,
} from "@/features/chat/services/chatApi";
import type { ChatOverview, ChatParticipant, Message as WAHAMessage } from "@/types/waha";
import WAHAService, { WAHARequestError, WAHA_SESSION_RECOVERY_MESSAGE } from "@/services/waha";
import { useToast } from "@/hooks/use-toast";
import { DeviceLinkModal } from "@/features/chat/components/DeviceLinkModal";
import {
  deriveSessionName,
  ensureDeviceSession,
  fetchPreferredCompany,
  logoutDeviceSession,
} from "@/features/chat/services/deviceLinkingApi";
import { useAuth } from "@/features/auth/AuthProvider";
import TaskCreationDialog, { TaskCreationPrefill } from "@/components/tasks/TaskCreationDialog";
import AppointmentCreationDialog, {
  AppointmentCreationPrefill,
} from "@/components/agenda/AppointmentCreationDialog";

const ensureIsoTimestamp = (value?: number): string => {
  if (!value) {
    return new Date().toISOString();
  }
  const timestamp = value < 1_000_000_000_000 ? value * 1000 : value;
  return new Date(timestamp).toISOString();
};

const mapWahaMessageType = (message?: WAHAMessage | null): "text" | "image" | "audio" => {
  if (!message) {
    return "text";
  }

  const rawType = typeof message.type === "string" ? message.type.toLowerCase() : "";
  const mime = typeof message.mimeType === "string"
    ? message.mimeType.toLowerCase()
    : typeof (message as { mimetype?: string }).mimetype === "string"
      ? (message as { mimetype: string }).mimetype.toLowerCase()
      : "";
  const filename = typeof message.filename === "string" ? message.filename.toLowerCase() : "";

  if (rawType === "audio" || rawType === "ptt" || rawType === "voice") {
    return "audio";
  }
  if (mime.startsWith("audio/")) {
    return "audio";
  }
  if ([".ogg", ".mp3", ".m4a", ".wav", ".aac"].some((extension) => filename.endsWith(extension))) {
    return "audio";
  }

  if (rawType === "image" || mime.startsWith("image/")) {
    return "image";
  }
  if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".heic"].some((extension) => filename.endsWith(extension))) {
    return "image";
  }

  if (message.hasMedia && !mime) {
    return "image";
  }

  return "text";
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

const pickDefaultResponsible = (
  chatId: string,
  options: ChatResponsibleOption[],
): ChatResponsibleOption | null => {
  if (!options.length) {
    return null;
  }
  return options[deterministicIndex(chatId, options.length)] ?? null;
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
    participants: overrides.participants ?? base.participants,
    responsible:
      overrides.responsible !== undefined ? overrides.responsible : base.responsible ?? null,
    phoneNumber: overrides.phoneNumber ?? base.phoneNumber,
    clientId:
      overrides.clientId !== undefined
        ? overrides.clientId ?? null
        : base.clientId ?? null,
    clientName: overrides.clientName ?? base.clientName,
    isLinkedToClient: overrides.isLinkedToClient ?? base.isLinkedToClient,
    isPrivate: overrides.isPrivate ?? base.isPrivate,
  };
};

const mapParticipantToSummary = (
  participant: ChatParticipant,
  fallbackIndex: number,
) => {
  const baseName = participant.name?.trim() || WAHAService.extractPhoneFromWhatsAppId(participant.id) || `Integrante ${fallbackIndex + 1}`;
  const trimmedName = baseName.trim();
  const avatar = participant.avatar && participant.avatar.trim().length > 0
    ? participant.avatar
    : createAvatarUrl(trimmedName);

  return {
    id: participant.id,
    name: trimmedName,
    avatar,
  };
};

const mapChatToConversation = (
  chat: ChatOverview,
  overrides?: Partial<ConversationSummary>,
  responsibleOptions: ChatResponsibleOption[] = [],
): ConversationSummary => {
  const fallbackName = WAHAService.extractPhoneFromWhatsAppId(chat.id);
  const normalizedName = chat.name?.trim() || fallbackName || chat.id;
  const avatar = chat.avatar && chat.avatar.trim().length > 0
    ? chat.avatar
    : createAvatarUrl(normalizedName);

  const participants = chat.participants?.map((participant, index) =>
    mapParticipantToSummary(participant, index),
  );

  const wahaLastMessageType = chat.lastMessage ? mapWahaMessageType(chat.lastMessage as WAHAMessage) : "text";
  const lastMessage = chat.lastMessage
    ? {
        id: chat.lastMessage.id ?? `${chat.id}-last`,
        content: chat.lastMessage.body ?? "",
        preview:
          chat.lastMessage.body?.trim().length
            ? chat.lastMessage.body
            : wahaLastMessageType === "image"
              ? "Imagem"
              : wahaLastMessageType === "audio"
                ? "Mensagem de áudio"
                : "Nova conversa",
        timestamp: ensureIsoTimestamp(chat.lastMessage.timestamp),
        sender: chat.lastMessage.fromMe ? "me" : "contact",
        type: wahaLastMessageType,
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
    responsible: pickDefaultResponsible(chat.id, responsibleOptions),
    tags: pickDefaultTags(chat.id),
    isLinkedToClient: false,
    clientId: null,
    clientName: null,
    customAttributes: [],
    isPrivate: false,
    internalNotes: [],
    participants,
  };

  return mergeOverrides(base, overrides);
};

const mapMessageToCRM = (message: WAHAMessage): CRMMessage => {
  const messageType = mapWahaMessageType(message);
  const hasMedia = Boolean(message.mediaUrl && messageType !== "text");
  const attachments = hasMedia && message.mediaUrl
    ? [
        {
          id: `${message.id}-attachment`,
          type: (messageType === "audio" ? "audio" : "image") as const,
          url: message.mediaUrl,
          name: message.filename ?? (messageType === "audio" ? "Áudio" : "Anexo"),
        },
      ]
    : undefined;

  const content = hasMedia
    ? message.caption ?? message.body ?? message.filename ?? message.mediaUrl ?? ""
    : message.body ?? message.caption ?? "";

  const normalizedType = (() => {
    if (attachments) {
      return messageType;
    }
    if (messageType === "audio") {
      return "audio";
    }
    return "text";
  })();

  return {
    id: message.id,
    conversationId: message.chatId,
    sender: message.fromMe ? "me" : "contact",
    content,
    timestamp: ensureIsoTimestamp(message.timestamp),
    status: mapAckToStatus(message.ack),
    type: normalizedType,
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
  const [hasStartedLoading, setHasStartedLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [taskPrefill, setTaskPrefill] = useState<TaskCreationPrefill | undefined>(undefined);
  const [isAppointmentDialogOpen, setIsAppointmentDialogOpen] = useState(false);
  const [appointmentPrefill, setAppointmentPrefill] = useState<
    AppointmentCreationPrefill | undefined
  >(undefined);
  const [responsibleOptions, setResponsibleOptions] = useState<ChatResponsibleOption[]>([]);
  const [isLoadingResponsibles, setIsLoadingResponsibles] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastSessionStatusRef = useRef<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const companyNameFromAuth = useMemo(() => {
    const value = user?.empresa_nome;
    if (typeof value !== "string") {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, [user?.empresa_nome]);
  const sessionNameOverride = useMemo(
    () => deriveSessionName(companyNameFromAuth),
    [companyNameFromAuth],
  );
  const wahaState = useWAHA(sessionNameOverride);
  const {
    chats: rawChats,
    messages: messageMap,
    addMessage,
    selectChat,
    loadMessages,
    loadOlderMessages,
    loadChats,
    loadMoreChats,
    activeChatId,
    checkSessionStatus,
    loading,
    hasMoreChats,
    isLoadingMoreChats,
    messagePaginationState,
  } = wahaState;

  useEffect(() => {
    let canceled = false;

    const loadResponsibles = async () => {
      try {
        setIsLoadingResponsibles(true);
        const options = await fetchChatResponsibles();
        if (!canceled) {
          setResponsibleOptions(options);
        }
      } catch (error) {
        console.error("Falha ao carregar responsáveis", error);
      } finally {
        if (!canceled) {
          setIsLoadingResponsibles(false);
        }
      }
    };

    loadResponsibles();

    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    if (loading) {
      setHasStartedLoading(true);
    }
  }, [loading]);

  useEffect(() => {
    if (hasStartedLoading && !loading) {
      setHasLoadedOnce(true);
    }
  }, [hasStartedLoading, loading]);

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

    const pagination = messagePaginationState[activeId];
    if (messageMap[activeId] || !pagination?.isLoading) {
      setMessagesLoading(false);
    }
  }, [activeChatId, messageMap, messagePaginationState]);

  const conversations = useMemo(() => {
    const mapped = rawChats.map((chat) =>
      mapChatToConversation(chat, conversationOverrides[chat.id], responsibleOptions),
    );
    return mapped.sort((a, b) => {
      const timeA = a.lastMessage ? new Date(a.lastMessage.timestamp).getTime() : 0;
      const timeB = b.lastMessage ? new Date(b.lastMessage.timestamp).getTime() : 0;
      return timeB - timeA;
    });
  }, [rawChats, conversationOverrides, responsibleOptions]);

  const sidebarResponsibleOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const option of responsibleOptions) {
      map.set(option.id, { id: option.id, name: option.name });
    }
    for (const conversation of conversations) {
      const responsible = conversation.responsible;
      if (!responsible) {
        continue;
      }
      if (!map.has(responsible.id)) {
        map.set(responsible.id, { id: responsible.id, name: responsible.name });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [responsibleOptions, conversations]);

  const activeConversationId = activeChatId ?? undefined;

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId),
    [conversations, activeConversationId],
  );

  const handleOpenTaskDialog = useCallback(() => {
    if (activeConversation) {
      const descriptionParts = [
        activeConversation.phoneNumber ? `Telefone: ${activeConversation.phoneNumber}` : undefined,
        activeConversation.lastMessage?.content
          ? `Última mensagem: ${activeConversation.lastMessage.content}`
          : undefined,
      ].filter((value): value is string => Boolean(value && value.trim().length > 0));

      setTaskPrefill({
        title: activeConversation.name ? `Contato: ${activeConversation.name}` : undefined,
        description: descriptionParts.length ? descriptionParts.join("\n") : undefined,
      });
    } else {
      setTaskPrefill(undefined);
    }
    setIsTaskDialogOpen(true);
  }, [activeConversation]);

  const handleOpenAppointmentDialog = useCallback(() => {
    if (activeConversation) {
      const prefill: AppointmentCreationPrefill = {
        title: activeConversation.name ? `Contato: ${activeConversation.name}` : undefined,
        description: activeConversation.lastMessage?.content,
        clientId:
          activeConversation.clientId !== null && activeConversation.clientId !== undefined
            ? String(activeConversation.clientId)
            : undefined,
        clientName: activeConversation.clientName ?? activeConversation.name,
        clientPhone: activeConversation.phoneNumber,
      };
      setAppointmentPrefill(prefill);
    } else {
      setAppointmentPrefill(undefined);
    }
    setIsAppointmentDialogOpen(true);
  }, [activeConversation]);

  const rawMessages = useMemo(
    () => (activeConversationId ? messageMap[activeConversationId] ?? [] : []),
    [activeConversationId, messageMap],
  );

  const messages = useMemo(() => rawMessages.map(mapMessageToCRM), [rawMessages]);

  const activePagination = activeConversationId
    ? messagePaginationState[activeConversationId]
    : undefined;
  const hasMoreMessages = Boolean(activePagination?.hasMore);
  const isLoadingMoreMessages = Boolean(activePagination?.isLoading && activePagination?.isLoaded);

  const handleSelectConversation = useCallback(
    async (conversationId: string, options?: { skipNavigation?: boolean }) => {
      if (conversationId === activeConversationId && messageMap[conversationId]) {
        if (!options?.skipNavigation) {
          onConversationRouteChange?.(conversationId);
        }
        return;
      }

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
    [activeConversationId, messageMap, onConversationRouteChange, selectChat],
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

    try {
      await wahaState.sendMessage(payload);
    } catch (error) {
      let title = "Erro";
      let description = "Não foi possível enviar a mensagem. Tente novamente.";

      if (error instanceof WAHARequestError) {
        if (error.status === 422) {
          title = "Sessão desconectada";
          description = error.message?.trim() || WAHA_SESSION_RECOVERY_MESSAGE;
        } else if (error.message?.trim()) {
          description = error.message;
        }
      } else if (error instanceof Error && error.message.trim()) {
        description = error.message;
      }

      toast({
        title,
        description,
        variant: "destructive",
      });
    }
  };

  const handleUpdateConversation = async (
    conversationId: string,
    changes: UpdateConversationPayload,
  ) => {
    const existingConversation = conversations.find((item) => item.id === conversationId);
    setConversationOverrides((previous) => {
      const current = previous[conversationId] ?? {};
      const next: Partial<ConversationSummary> = { ...current };

      if ("responsibleId" in changes) {
        const member = changes.responsibleId
          ? responsibleOptions.find((item) => item.id === changes.responsibleId) ??
            existingConversation?.responsible ??
            null
          : null;
        next.responsible = member;
      }
      if ("tags" in changes) {
        next.tags = changes.tags ?? [];
      }
      if ("phoneNumber" in changes) {
        next.phoneNumber = changes.phoneNumber;
      }
      if ("clientId" in changes) {
        const rawId = changes.clientId;
        if (rawId === null || rawId === undefined || rawId === "") {
          next.clientId = null;
        } else {
          const parsed = Number.parseInt(String(rawId), 10);
          next.clientId = Number.isFinite(parsed) ? parsed : next.clientId ?? null;
        }
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
      setMessagesLoading(true);
      void (async () => {
        try {
          await loadMessages(activeConversationId, { reset: true });
        } finally {
          setMessagesLoading(false);
        }
      })();
    }
  }, [activeConversationId, checkSessionStatus, loadChats, loadMessages]);

  useEffect(() => {
    const currentStatus = wahaState.sessionStatus?.status ?? null;
    const previousStatus = lastSessionStatusRef.current;
    if (currentStatus === "WORKING" && previousStatus !== "WORKING") {
      handleReload();
    }
    lastSessionStatusRef.current = currentStatus;
  }, [wahaState.sessionStatus?.status, handleReload]);

  const handleDisconnect = useCallback(async () => {
    if (isDisconnecting) {
      return;
    }
    setIsDisconnecting(true);

    try {
      let companyName = companyNameFromAuth;
      if (!companyName) {
        try {
          const company = await fetchPreferredCompany();
          companyName = company?.name;
        } catch (error) {
          console.warn("Falha ao carregar empresa preferencial", error);
        }
      }

      const sessionName = deriveSessionName(companyName);
      const sessionInfo = await ensureDeviceSession(sessionName, companyName);

      if (sessionInfo.status !== "SCAN_QR_CODE") {
        await logoutDeviceSession(sessionInfo.name);
      }

      toast({
        title: "Dispositivo desconectado",
        description: "Geramos um novo QR Code para autenticar o WhatsApp novamente.",
      });

      setIsDeviceModalOpen(true);

      await checkSessionStatus();
      await loadChats({ reset: true });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível desconectar o dispositivo.";
      toast({
        title: "Falha ao desconectar",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsDisconnecting(false);
    }
  }, [
    isDisconnecting,
    toast,
    checkSessionStatus,
    loadChats,
    companyNameFromAuth,
  ]);

  const isInitialLoading = loading && !hasLoadedOnce;
  const shouldShowOverlayLoading = loading && hasLoadedOnce;


  if (isInitialLoading) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        <SessionStatus
          status={wahaState.sessionStatus}
          onRefresh={handleReload}
          onDisconnect={handleDisconnect}
          isDisconnecting={isDisconnecting}
          onManageDevice={() => setIsDeviceModalOpen(true)}
        />
        <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
          <ConversationLoadingScreen />
        </div>
        <DeviceLinkModal
          open={isDeviceModalOpen}
          onClose={() => setIsDeviceModalOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">

      <SessionStatus
        status={wahaState.sessionStatus}
        onRefresh={handleReload}
        onDisconnect={handleDisconnect}
        isDisconnecting={isDisconnecting}
        onManageDevice={() => setIsDeviceModalOpen(true)}
      />

      <div className="flex flex-1 min-h-0 flex-col overflow-hidden lg:flex-row">
        <div className="flex h-full min-h-0 w-full min-w-0 flex-shrink-0 flex-col overflow-hidden border-b border-border/40 bg-sidebar/90 shadow-[0_12px_24px_rgba(15,23,42,0.06)] backdrop-blur-sm lg:w-[34%] lg:min-w-[300px] lg:max-w-md lg:border-b-0 lg:border-r">
          <CRMChatSidebar
            conversations={conversations}
            activeConversationId={activeConversationId}
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            responsibleFilter={responsibleFilter}
            responsibleOptions={sidebarResponsibleOptions}
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
            hasMore={hasMoreMessages}
            isLoading={messagesLoading}
            isLoadingMore={isLoadingMoreMessages}
            onSendMessage={handleSendMessage}
            onLoadOlder={async () => {
              if (!activeConversationId) {
                return [];
              }
              const olderMessages = await loadOlderMessages(activeConversationId);
              return olderMessages.map(mapMessageToCRM);
            }}
            onUpdateConversation={handleUpdateConversation}
            isUpdatingConversation={false}
            onOpenDeviceLinkModal={() => setIsDeviceModalOpen(true)}
            onCreateTask={handleOpenTaskDialog}
            onCreateAppointment={handleOpenAppointmentDialog}
            responsibleOptions={responsibleOptions}
            isLoadingResponsibles={isLoadingResponsibles}
          />
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

      <DeviceLinkModal
        open={isDeviceModalOpen}
        onClose={() => setIsDeviceModalOpen(false)}
      />

      <TaskCreationDialog
        open={isTaskDialogOpen}
        onOpenChange={(open) => {
          setIsTaskDialogOpen(open);
          if (!open) {
            setTaskPrefill(undefined);
          }
        }}
        prefill={taskPrefill}
      />

      <AppointmentCreationDialog
        open={isAppointmentDialogOpen}
        onOpenChange={(open) => {
          setIsAppointmentDialogOpen(open);
          if (!open) {
            setAppointmentPrefill(undefined);
          }
        }}
        prefill={appointmentPrefill}
      />

      {shouldShowOverlayLoading ? (
        <div className="absolute inset-0 z-50 flex">
          <ConversationLoadingScreen />
        </div>
      ) : null}
    </div>
  );
};
