import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchConversationMessages,
  sendConversationMessage,
} from "../services/chatApi";
import type { Message, MessagePage, SendMessageInput } from "../types";

interface UseChatMessagesResult {
  messages: Message[];
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  loadOlder: () => Promise<Message[]>;
  reload: () => Promise<void>;
  sendMessage: (payload: SendMessageInput) => Promise<Message | null>;
  reset: () => void;
}

// Carregamos blocos pequenos para combinar com a janela virtualizada da área de mensagens.
const DEFAULT_PAGE_SIZE = 24;

export const useChatMessages = (
  conversationId?: string,
  pageSize = DEFAULT_PAGE_SIZE,
): UseChatMessagesResult => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const activeConversationRef = useRef<string | undefined>(conversationId);

  useEffect(() => {
    activeConversationRef.current = conversationId;
  }, [conversationId]);

  const applyPage = useCallback(
    (page: MessagePage, resetList = false) => {
      setMessages((current) =>
        resetList ? page.messages : [...page.messages, ...current],
      );
      setCursor(page.nextCursor ?? null);
      setHasMore(Boolean(page.nextCursor));
    },
    [],
  );

  const reload = useCallback(async () => {
    if (!conversationId) return;
    setIsLoading(true);
    try {
      const page = await fetchConversationMessages(conversationId, null, pageSize);
      if (activeConversationRef.current !== conversationId) return;
      applyPage(page, true);
    } finally {
      if (activeConversationRef.current === conversationId) {
        setIsLoading(false);
      }
    }
  }, [applyPage, conversationId, pageSize]);

  const loadOlder = useCallback(async () => {
    if (!conversationId || !cursor || isLoadingMore) return [];
    setIsLoadingMore(true);
    try {
      const page = await fetchConversationMessages(conversationId, cursor, pageSize);
      if (activeConversationRef.current !== conversationId) return [];
      applyPage(page, false);
      return page.messages;
    } finally {
      if (activeConversationRef.current === conversationId) {
        setIsLoadingMore(false);
      }
    }
  }, [applyPage, conversationId, cursor, isLoadingMore, pageSize]);

  const sendMessage = useCallback(
    async (payload: SendMessageInput) => {
      if (!conversationId) return null;
      const message = await sendConversationMessage(conversationId, payload);
      if (activeConversationRef.current !== conversationId) return null;
      setMessages((current) => [...current, message]);
      setHasMore((currentHasMore) => currentHasMore);
      return message;
    },
    [conversationId],
  );

  const reset = useCallback(() => {
    setMessages([]);
    setCursor(null);
    setHasMore(false);
    setIsLoading(false);
    setIsLoadingMore(false);
  }, []);

  useEffect(() => {
    if (!conversationId) {
      reset();
      return;
    }
    reset();
    void reload();
  }, [conversationId, reload, reset]);

  return {
    messages,
    hasMore,
    isLoading,
    isLoadingMore,
    loadOlder,
    reload,
    sendMessage,
    reset,
  };
};
