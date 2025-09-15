import type {
  ConversationSummary,
  Message,
  MessagePage,
  NewConversationInput,
  SendMessageInput,
} from "../types";

const parseJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Erro de rede (${response.status})`);
  }
  if (response.status === 204) {
    return {} as T;
  }
  return (await response.json()) as T;
};

export const fetchConversations = async (): Promise<ConversationSummary[]> => {
  const response = await fetch("/api/conversations");
  return parseJson<ConversationSummary[]>(response);
};

export const fetchConversationMessages = async (
  conversationId: string,
  cursor?: string | null,
  limit = 20,
): Promise<MessagePage> => {
  const url = new URL(`/api/conversations/${conversationId}/messages`, window.location.origin);
  if (cursor) {
    url.searchParams.set("cursor", cursor);
  }
  url.searchParams.set("limit", String(limit));
  const response = await fetch(url.toString());
  return parseJson<MessagePage>(response);
};

export const sendConversationMessage = async (
  conversationId: string,
  payload: SendMessageInput,
): Promise<Message> => {
  const response = await fetch(`/api/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson<Message>(response);
};

export const markConversationRead = async (conversationId: string) => {
  const response = await fetch(`/api/conversations/${conversationId}/read`, {
    method: "POST",
  });
  await parseJson(response);
};

export const createConversation = async (
  payload: NewConversationInput,
): Promise<ConversationSummary> => {
  const response = await fetch(`/api/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson<ConversationSummary>(response);
};
