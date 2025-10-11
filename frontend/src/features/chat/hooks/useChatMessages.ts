import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchConversationMessages,
  sendConversationMessage,
} from "../services/chatApi";
import type { Message, MessagePage, MessageStatus, SendMessageInput } from "../types";

interface UseChatMessagesResult {
  messages: Message[];
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  loadOlder: () => Promise<Message[]>;
  reload: () => Promise<void>;
  sendMessage: (payload: SendMessageInput) => Promise<Message | null>;
  reset: () => void;
  mergeMessage: (message: Message) => void;
  updateMessageStatus: (messageId: string, status: MessageStatus) => void;
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
  const cacheRef = useRef(
    new Map<string, { messages: Message[]; cursor: string | null; hasMore: boolean }>(),
  );

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

  const insertMessage = useCallback((list: Message[], incoming: Message) => {
    const existingIndex = list.findIndex((item) => item.id === incoming.id);
    if (existingIndex >= 0) {
      const next = list.slice();
      next[existingIndex] = incoming;
      return next;
    }

    const incomingTime = new Date(incoming.timestamp).getTime();
    const next = list.slice();
    const insertIndex = next.findIndex(
      (item) => new Date(item.timestamp).getTime() > incomingTime,
    );
    if (insertIndex === -1) {
      next.push(incoming);
    } else {
      next.splice(insertIndex, 0, incoming);
    }
    return next;
  }, []);

  const mergeMessage = useCallback(
    (incoming: Message) => {
      setMessages((current) => insertMessage(current, incoming));
    },
    [insertMessage],
  );

  const updateMessageStatus = useCallback((messageId: string, status: MessageStatus) => {
    setMessages((current) =>
      current.map((item) =>
        item.id === messageId
          ? { ...item, status }
          : item,
      ),
    );
  }, []);

  const sendMessage = useCallback(
    async (payload: SendMessageInput) => {
      if (!conversationId) return null;
      const message = await sendConversationMessage(conversationId, payload);
      if (activeConversationRef.current !== conversationId) return null;
      setMessages((current) => insertMessage(current, message));
      setHasMore((currentHasMore) => currentHasMore);
      return message;
    },
    [conversationId, insertMessage],
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
    const cached = cacheRef.current.get(conversationId);
    if (cached) {
      setMessages(cached.messages);
      setCursor(cached.cursor);
      setHasMore(cached.hasMore);
      setIsLoading(false);
      setIsLoadingMore(false);
    } else {
      reset();
    }
    void reload();
  }, [conversationId, reload, reset]);

  useEffect(() => {
    const activeId = activeConversationRef.current;
    if (!activeId) {
      return;
    }
    cacheRef.current.set(activeId, { messages, cursor, hasMore });
  }, [messages, cursor, hasMore]);

  return {
    messages,
    hasMore,
    isLoading,
    isLoadingMore,
    loadOlder,
    reload,
    sendMessage,
    reset,
    mergeMessage,
    updateMessageStatus,
  };
};
