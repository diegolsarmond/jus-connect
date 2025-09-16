import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { setupMockChatServer } from "./services/mockServer";
import {
  fetchConversations,
  createConversation,
  markConversationRead,
} from "./services/chatApi";
import type { ConversationSummary, SendMessageInput } from "./types";
import { ChatSidebar } from "./components/ChatSidebar";
import { ChatWindow } from "./components/ChatWindow";
import { NewConversationModal } from "./components/NewConversationModal";
import { useChatMessages } from "./hooks/useChatMessages";
import styles from "./ChatPage.module.css";

type PendingConversation = {
  name: string;
  description?: string;
  hasAttemptedCreate: boolean;
};

export const ChatPage = () => {
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>();
  const [searchValue, setSearchValue] = useState("");
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [pendingConversation, setPendingConversation] = useState<PendingConversation | null>(
    null,
  );
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastContactQueryRef = useRef<string | null>(null);
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Inicializa o interceptador de fetch para simular uma API REST sem backend real.
    setupMockChatServer();
  }, []);

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

  const {
    messages,
    hasMore,
    isLoading: messagesLoading,
    isLoadingMore,
    loadOlder,
    sendMessage,
  } = useChatMessages(selectedConversationId);

  const handleSelectConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    markReadMutation.mutate(conversationId);
  };

  const handleSendMessage = async (payload: SendMessageInput) => {
    await sendMessage(payload);
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
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
    <div className={styles.layout}>
      <ChatSidebar
        conversations={conversations}
        activeConversationId={selectedConversationId}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
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
      />
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
