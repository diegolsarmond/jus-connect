import { useEffect, useMemo, useRef, useState } from "react";
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

export const ChatPage = () => {
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>();
  const [searchValue, setSearchValue] = useState("");
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    // Inicializa o interceptador de fetch para simular uma API REST sem backend real.
    setupMockChatServer();
  }, []);

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
