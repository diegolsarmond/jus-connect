import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthProvider";
import {
  fetchConversations,
  createConversation,
  markConversationRead,
  setTypingState,
  updateConversation as updateConversationRequest,
  fetchChatResponsibles,
  type ChatResponsibleOption,
} from "./services/chatApi";
import type {
  ConversationSummary,
  Message,
  MessageStatus,
  SendMessageInput,
  UpdateConversationPayload,
} from "./types";
import { ChatSidebar } from "./components/ChatSidebar";
import { ChatWindow } from "./components/ChatWindow";
import { NewConversationModal } from "./components/NewConversationModal";
import { useChatMessages } from "./hooks/useChatMessages";
import { useChatRealtime } from "./hooks/useChatRealtime";
import styles from "./ChatPage.module.css";

type PendingConversation = {
  name: string;
  description?: string;
  hasAttemptedCreate: boolean;
};

type TypingUser = { id: string; name?: string };

export const ChatPage = () => {
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>();
  const [searchValue, setSearchValue] = useState("");
  const [responsibleFilter, setResponsibleFilter] = useState<string>("all");
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [pendingConversation, setPendingConversation] = useState<PendingConversation | null>(
    null,
  );
  const [responsibleOptions, setResponsibleOptions] = useState<ChatResponsibleOption[]>([]);
  const [isLoadingResponsibles, setIsLoadingResponsibles] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastContactQueryRef = useRef<string | null>(null);
  const typingActivityRef = useRef<{ conversationId?: string; isTyping: boolean; lastSentAt: number }>({
    conversationId: undefined,
    isTyping: false,
    lastSentAt: 0,
  });
  const previousTypingConversationRef = useRef<string | null>(null);
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentUserId = user ? String(user.id) : null;
  const [typingUsersByConversation, setTypingUsersByConversation] = useState<
    Record<string, TypingUser[]>
  >({});

  useEffect(() => {
    const state = (location.state ?? null) as
      | {
          contactName?: string;
          contactDescription?: string;
          contactEmail?: string;
          contactPhone?: string;
        }
      | null;

    const searchParams = new URLSearchParams(location.search);
    const queryName = searchParams.get("contato");
    const normalizedName = (state?.contactName ?? queryName ?? "").trim();

    if (!normalizedName) {
      setPendingConversation(null);
      if (!location.search) {
        lastContactQueryRef.current = null;
      }
      return;
    }

    const normalizedLower = normalizedName.toLowerCase();

    if (!state && lastContactQueryRef.current === normalizedLower) {
      return;
    }

    const descriptionCandidates = [
      state?.contactDescription,
      state?.contactEmail,
      state?.contactPhone,
      searchParams.get("descricao") ?? undefined,
    ].filter((item): item is string => !!item && item.trim().length > 0);

    const uniqueDescription =
      Array.from(new Set(descriptionCandidates.map((item) => item.trim()))).join(" · ") ||
      undefined;

    setPendingConversation((prev) => {
      if (
        prev &&
        prev.name.toLowerCase() === normalizedLower &&
        prev.description === uniqueDescription &&
        !prev.hasAttemptedCreate
      ) {
        return prev;
      }

      return {
        name: normalizedName,
        description: uniqueDescription,
        hasAttemptedCreate: false,
      };
    });

    lastContactQueryRef.current = normalizedLower;

    if (state) {
      navigate(location.pathname + location.search, { replace: true });
    }
  }, [location.pathname, location.search, location.state, navigate]);

  const conversationsQuery = useQuery({
    queryKey: ["conversations"],
    queryFn: fetchConversations,
    staleTime: 30_000,
  });

  const conversations = useMemo(
    () => conversationsQuery.data ?? [],
    [conversationsQuery.data],
  );

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

  useEffect(() => {
    if (!selectedConversationId && conversations.length > 0) {
      setSelectedConversationId(conversations[0]!.id);
    }
  }, [conversations, selectedConversationId]);

  const markReadMutation = useMutation({
    mutationFn: (conversationId: string) => markConversationRead(conversationId),
    onSuccess: (_, conversationId) => {
      queryClient.setQueryData<ConversationSummary[]>(["conversations"], (old) => {
        if (!old) return old;
        return old.map((item) =>
          item.id === conversationId ? { ...item, unreadCount: 0 } : item,
        );
      });
    },
  });

  const createConversationMutation = useMutation({
    mutationFn: createConversation,
    onSuccess: (createdConversation) => {
      queryClient.setQueryData<ConversationSummary[]>(["conversations"], (old) => {
        const list = old ? old.filter((item) => item.id !== createdConversation.id) : [];
        return [createdConversation, ...list];
      });
      setSelectedConversationId(createdConversation.id);
      setSearchValue("");
      setPendingConversation(null);
    },
  });

  const applyConversationUpdate = useCallback(
    (conversation: ConversationSummary) => {
      queryClient.setQueryData<ConversationSummary[]>(["conversations"], (old) => {
        if (!old) {
          return [conversation];
        }
        const filtered = old.filter((item) => item.id !== conversation.id);
        return [conversation, ...filtered];
      });
    },
    [queryClient],
  );

  const {
    messages,
    hasMore,
    isLoading: messagesLoading,
    isLoadingMore,
    loadOlder,
    sendMessage,
    mergeMessage,
    updateMessageStatus,
  } = useChatMessages(selectedConversationId);

  const updateConversationMutation = useMutation({
    mutationFn: ({ conversationId, changes }: { conversationId: string; changes: UpdateConversationPayload }) =>
      updateConversationRequest(conversationId, changes),
    onSuccess: (updated) => {
      queryClient.setQueryData<ConversationSummary[]>(["conversations"], (old) => {
        if (!old) return old;
        return old.map((item) => (item.id === updated.id ? updated : item));
      });
    },
  });

  const handleConversationReadEvent = useCallback(
    (conversationId: string) => {
      queryClient.setQueryData<ConversationSummary[]>(["conversations"], (old) => {
        if (!old) return old;
        return old.map((item) =>
          item.id === conversationId
            ? { ...item, unreadCount: 0 }
            : item,
        );
      });
    },
    [queryClient],
  );

  const handleRealtimeTyping = useCallback(
    ({ conversationId, userId, userName, isTyping }: { conversationId: string; userId: string; userName?: string; isTyping: boolean }) => {
      if (currentUserId && userId === currentUserId) {
        return;
      }

      setTypingUsersByConversation((current) => {
        const existing = current[conversationId] ?? [];
        const filtered = existing.filter((entry) => entry.id !== userId);

        if (isTyping) {
          return {
            ...current,
            [conversationId]: [...filtered, { id: userId, name: userName }],
          };
        }

        if (filtered.length === 0) {
          const { [conversationId]: _removed, ...rest } = current;
          return rest;
        }

        return {
          ...current,
          [conversationId]: filtered,
        };
      });
    },
    [currentUserId],
  );

  const handleRealtimeMessageCreated = useCallback(
    ({ conversationId, message }: { conversationId: string; message: Message }) => {
      if (conversationId === selectedConversationId) {
        mergeMessage(message);
      }
    },
    [mergeMessage, selectedConversationId],
  );

  const handleRealtimeMessageStatus = useCallback(
    ({ conversationId, messageId, status }: { conversationId: string; messageId: string; status: MessageStatus }) => {
      if (conversationId === selectedConversationId) {
        updateMessageStatus(messageId, status);
      }
    },
    [selectedConversationId, updateMessageStatus],
  );

  const handleRealtimeConversationReadEvent = useCallback(
    ({ conversationId }: { conversationId: string }) => {
      if (conversationId) {
        handleConversationReadEvent(conversationId);
      }
    },
    [handleConversationReadEvent],
  );

  useChatRealtime({
    onConversationUpdated: applyConversationUpdate,
    onConversationRead: handleRealtimeConversationReadEvent,
    onMessageCreated: handleRealtimeMessageCreated,
    onMessageStatusUpdated: handleRealtimeMessageStatus,
    onTyping: handleRealtimeTyping,
    onConnectionChange: (connected) => {
      if (!connected) {
        setTypingUsersByConversation({});
      }
    },
  });

  const emitTypingState = useCallback(async (conversationId: string, isTyping: boolean) => {
    try {
      await setTypingState(conversationId, isTyping);
    } catch (error) {
      console.warn("Falha ao atualizar estado de digitação", error);
    }
  }, []);

  const handleTypingActivity = useCallback(
    (isTyping: boolean) => {
      if (!selectedConversationId) {
        return;
      }

      const state = typingActivityRef.current;
      const now = Date.now();

      if (state.conversationId && state.conversationId !== selectedConversationId) {
        void emitTypingState(state.conversationId, false);
      }

      if (state.conversationId !== selectedConversationId) {
        state.conversationId = selectedConversationId;
        state.isTyping = false;
        state.lastSentAt = 0;
      }

      if (isTyping) {
        const shouldSend = !state.isTyping || now - state.lastSentAt > 1500;
        if (!shouldSend) {
          state.isTyping = true;
          return;
        }
      } else if (!state.isTyping) {
        return;
      }

      state.isTyping = isTyping;
      state.lastSentAt = now;
      void emitTypingState(selectedConversationId, isTyping);
    },
    [emitTypingState, selectedConversationId],
  );

  useEffect(() => {
    const previous = previousTypingConversationRef.current;
    if (previous && previous !== selectedConversationId) {
      void emitTypingState(previous, false);
    }
    previousTypingConversationRef.current = selectedConversationId ?? null;
    typingActivityRef.current = {
      conversationId: selectedConversationId,
      isTyping: false,
      lastSentAt: 0,
    };
  }, [emitTypingState, selectedConversationId]);

  useEffect(() => {
    return () => {
      const previous = typingActivityRef.current.conversationId;
      if (previous) {
        void emitTypingState(previous, false);
      }
    };
  }, [emitTypingState]);

  const handleSelectConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    markReadMutation.mutate(conversationId);
  };

  const handleSendMessage = async (payload: SendMessageInput) => {
    await sendMessage(payload);
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
  };

  const handleUpdateConversation = async (conversationId: string, changes: UpdateConversationPayload) => {
    if (!conversationId) return;
    await updateConversationMutation.mutateAsync({ conversationId, changes });
  };

  useEffect(() => {
    const handleShortcuts = (event: KeyboardEvent) => {
      if (event.ctrlKey && (event.key === "k" || event.key === "K")) {
        event.preventDefault();
        setNewConversationOpen(false);
        searchInputRef.current?.focus();
      }
      if (event.ctrlKey && (event.key === "n" || event.key === "N")) {
        event.preventDefault();
        setNewConversationOpen(true);
      }
      if (event.key === "Escape") {
        setNewConversationOpen(false);
      }
    };
    window.addEventListener("keydown", handleShortcuts);
    return () => window.removeEventListener("keydown", handleShortcuts);
  }, []);

  const activeTypingUsers = useMemo(() => {
    if (!selectedConversationId) {
      return [] as TypingUser[];
    }
    return typingUsersByConversation[selectedConversationId] ?? [];
  }, [selectedConversationId, typingUsersByConversation]);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId),
    [conversations, selectedConversationId],
  );

  useEffect(() => {
    if (!pendingConversation) {
      return;
    }

    const normalized = pendingConversation.name.toLowerCase();
    const existing = conversations.find(
      (conversation) => conversation.name.toLowerCase() === normalized,
    );

    if (existing) {
      setSelectedConversationId(existing.id);
      markReadMutation.mutate(existing.id);
      setPendingConversation(null);
      return;
    }

    if (
      !pendingConversation.hasAttemptedCreate &&
      !createConversationMutation.isPending
    ) {
      setPendingConversation((prev) =>
        prev ? { ...prev, hasAttemptedCreate: true } : prev,
      );
      createConversationMutation.mutate({
        name: pendingConversation.name,
        description: pendingConversation.description,
      });
    }
  }, [
    pendingConversation,
    conversations,
    markReadMutation,
    createConversationMutation,
    createConversationMutation.isPending,
  ]);

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        <ChatSidebar
          conversations={conversations}
          activeConversationId={selectedConversationId}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          responsibleFilter={responsibleFilter}
          responsibleOptions={sidebarResponsibleOptions}
          onResponsibleFilterChange={setResponsibleFilter}
          onSelectConversation={handleSelectConversation}
          onNewConversation={() => setNewConversationOpen(true)}
          searchInputRef={searchInputRef}
          loading={conversationsQuery.isLoading}
        />
        <ChatWindow
          conversation={selectedConversation}
          messages={messages}
          hasMore={hasMore}
          isLoading={messagesLoading}
          isLoadingMore={isLoadingMore}
          onSendMessage={handleSendMessage}
          onLoadOlder={loadOlder}
          onUpdateConversation={handleUpdateConversation}
          isUpdatingConversation={updateConversationMutation.isPending}
          typingUsers={activeTypingUsers}
          onTypingActivity={handleTypingActivity}
          responsibleOptions={responsibleOptions}
          isLoadingResponsibles={isLoadingResponsibles}
        />
      </div>
      <NewConversationModal
        open={newConversationOpen}
        suggestions={conversations}
        onClose={() => setNewConversationOpen(false)}
        onSelectConversation={(conversationId) => {
          handleSelectConversation(conversationId);
          setNewConversationOpen(false);
        }}
        onCreateConversation={async (name) => {
          const trimmed = name.trim();
          if (!trimmed) return null;
          const created = await createConversationMutation.mutateAsync({ name: trimmed });
          return created.id;
        }}
      />
    </div>
  );
};
