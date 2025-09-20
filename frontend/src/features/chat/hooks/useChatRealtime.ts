import { useEffect, useRef, useState } from "react";
import { getApiUrl } from "@/lib/api";
import { useAuth } from "@/features/auth/AuthProvider";
import type {
  ConversationSummary,
  Message,
  MessageStatus,
} from "../types";

type ConversationUpdatedPayload = ConversationSummary;

interface MessageCreatedPayload {
  conversationId: string;
  message: Message;
}

interface MessageStatusPayload {
  conversationId: string;
  messageId: string;
  status: MessageStatus;
}

interface ConversationReadPayload {
  conversationId: string;
  userId?: string;
}

interface TypingPayload {
  conversationId: string;
  userId: string;
  userName?: string;
  isTyping: boolean;
}

export interface ChatRealtimeHandlers {
  onConversationUpdated?: (conversation: ConversationUpdatedPayload) => void;
  onConversationRead?: (payload: ConversationReadPayload) => void;
  onMessageCreated?: (payload: MessageCreatedPayload) => void;
  onMessageStatusUpdated?: (payload: MessageStatusPayload) => void;
  onTyping?: (payload: TypingPayload) => void;
  onConnectionChange?: (isConnected: boolean) => void;
}

export interface UseChatRealtimeResult {
  isConnected: boolean;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const parseSseEvent = (rawEvent: string): { event?: string; data?: unknown } | null => {
  if (!rawEvent) {
    return null;
  }

  const lines = rawEvent.split("\n");
  let eventName: string | undefined;
  const dataLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(":")) {
      continue;
    }
    if (trimmed.startsWith("event:")) {
      eventName = trimmed.slice(6).trim();
      continue;
    }
    if (trimmed.startsWith("data:")) {
      dataLines.push(trimmed.slice(5).trimStart());
      continue;
    }
  }

  const dataString = dataLines.join("\n");
  let data: unknown;

  if (dataString.length > 0) {
    try {
      data = JSON.parse(dataString);
    } catch (error) {
      console.warn("Failed to parse SSE payload", error, { dataString });
    }
  }

  return { event: eventName, data };
};

export const useChatRealtime = (handlers: ChatRealtimeHandlers): UseChatRealtimeResult => {
  const { token } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const handlersRef = useRef<ChatRealtimeHandlers>(handlers);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!token) {
      setIsConnected(false);
      return undefined;
    }

    let isCancelled = false;
    let retryDelay = 1000;

    const connect = async () => {
      while (!isCancelled) {
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
          const response = await fetch(getApiUrl("conversations/stream"), {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          });

          if (response.status === 401) {
            console.error("Realtime stream unauthorized. Verify authentication token.");
            break;
          }

          if (!response.ok || !response.body) {
            throw new Error(`Unexpected realtime response: ${response.status}`);
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder("utf-8");
          let buffer = "";

          setIsConnected(true);
          handlersRef.current.onConnectionChange?.(true);
          retryDelay = 1000;

          while (!isCancelled) {
            const { value, done } = await reader.read();
            if (done) {
              buffer += decoder.decode();
              break;
            }
            buffer += decoder.decode(value, { stream: true });

            let separatorIndex = buffer.indexOf("\n\n");
            while (separatorIndex !== -1) {
              const rawEvent = buffer.slice(0, separatorIndex);
              buffer = buffer.slice(separatorIndex + 2);
              const parsed = parseSseEvent(rawEvent);
              if (parsed?.event) {
                dispatchEvent(parsed.event, parsed.data);
              }
              separatorIndex = buffer.indexOf("\n\n");
            }
          }

          if (buffer.trim().length > 0) {
            const parsed = parseSseEvent(buffer.trim());
            if (parsed?.event) {
              dispatchEvent(parsed.event, parsed.data);
            }
          }
        } catch (error) {
          if (controller.signal.aborted || isCancelled) {
            break;
          }
          console.warn("Realtime stream disconnected", error);
        } finally {
          if (!isCancelled) {
            setIsConnected(false);
            handlersRef.current.onConnectionChange?.(false);
          }
        }

        if (isCancelled) {
          break;
        }

        await sleep(retryDelay);
        retryDelay = Math.min(retryDelay * 2, 15_000);
      }
    };

    const dispatchEvent = (event: string, data: unknown) => {
      switch (event) {
        case "conversation:update":
          if (data && typeof data === "object") {
            handlersRef.current.onConversationUpdated?.(data as ConversationUpdatedPayload);
          }
          break;
        case "conversation:read":
          if (data && typeof data === "object") {
            handlersRef.current.onConversationRead?.(data as ConversationReadPayload);
          }
          break;
        case "message:new":
          if (data && typeof data === "object") {
            handlersRef.current.onMessageCreated?.(data as MessageCreatedPayload);
          }
          break;
        case "message:status":
          if (data && typeof data === "object") {
            handlersRef.current.onMessageStatusUpdated?.(data as MessageStatusPayload);
          }
          break;
        case "typing":
          if (data && typeof data === "object") {
            handlersRef.current.onTyping?.(data as TypingPayload);
          }
          break;
        case "ping":
        case "connection":
        default:
          break;
      }
    };

    void connect();

    return () => {
      isCancelled = true;
      abortControllerRef.current?.abort();
    };
  }, [token]);

  return { isConnected };
};
