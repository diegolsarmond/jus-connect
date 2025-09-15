import chatData from "../data/chatData.json";
import type {
  ChatDataset,
  ConversationDatasetEntry,
  ConversationLastMessage,
  ConversationSummary,
  Message,
  MessagePage,
  NewConversationInput,
  SendMessageInput,
} from "../types";
import { getMessagePreview } from "../utils/format";

const NETWORK_DELAY = 220;

type Dataset = ChatDataset & {
  conversations: (ConversationDatasetEntry & { lastActivity?: string })[];
};

const dataset: Dataset = (() => {
  // Clonamos o JSON para permitir mutações locais sem afetar o arquivo original.
  const clone: Dataset = JSON.parse(JSON.stringify(chatData));
  Object.keys(clone.messages).forEach((key) => {
    clone.messages[key]?.sort(
      (a: Message, b: Message) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
  });
  clone.conversations = clone.conversations.map((entry) => ({
    ...entry,
    lastActivity: getLastActivityTimestamp(clone.messages[entry.id]),
  }));
  return clone;
})();

const originalFetch = typeof window !== "undefined" ? window.fetch.bind(window) : undefined;

const withLatency = (body: unknown, init?: ResponseInit) =>
  new Promise<Response>((resolve) => {
    setTimeout(() => {
      resolve(
        new Response(body === undefined ? null : JSON.stringify(body), {
          status: 200,
          headers: { "Content-Type": "application/json" },
          ...init,
        }),
      );
    }, NETWORK_DELAY);
  });

const notFound = () =>
  withLatency(
    { message: "Recurso não encontrado" },
    { status: 404, headers: { "Content-Type": "application/json" } },
  );

function getLastActivityTimestamp(messages: Message[] | undefined) {
  if (!messages || messages.length === 0) {
    return new Date(0).toISOString();
  }
  return messages[messages.length - 1]!.timestamp;
}

function buildLastMessage(message: Message | undefined): ConversationLastMessage | undefined {
  if (!message) return undefined;
  return {
    id: message.id,
    content: message.content,
    preview: getMessagePreview(message.content, message.type),
    timestamp: message.timestamp,
    sender: message.sender,
    type: message.type,
    status: message.status,
  };
}

function buildSummary(entry: ConversationDatasetEntry): ConversationSummary {
  const messages = dataset.messages[entry.id] ?? [];
  const lastMessage = buildLastMessage(messages[messages.length - 1]);
  return {
    ...entry,
    lastMessage,
  };
}

function listConversations() {
  const conversations = dataset.conversations
    .map((entry) => ({
      ...entry,
      lastActivity: getLastActivityTimestamp(dataset.messages[entry.id]),
    }))
    .sort((a, b) => {
      const timeA = new Date(a.lastActivity ?? 0).getTime();
      const timeB = new Date(b.lastActivity ?? 0).getTime();
      return timeB - timeA;
    })
    .map((entry) => buildSummary(entry));
  return conversations;
}

function getMessages(
  conversationId: string,
  cursor?: string | null,
  limit = 20,
): MessagePage {
  const allMessages = dataset.messages[conversationId] ?? [];
  if (allMessages.length === 0) {
    return { messages: [], nextCursor: null };
  }
  const sorted = [...allMessages].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  if (!cursor) {
    const slice = sorted.slice(-limit);
    const nextCursor = sorted.length > slice.length ? sorted[sorted.length - slice.length - 1]!.id : null;
    return { messages: slice, nextCursor };
  }
  const cursorIndex = sorted.findIndex((message) => message.id === cursor);
  if (cursorIndex === -1) {
    const slice = sorted.slice(-limit);
    const nextCursor = sorted.length > slice.length ? sorted[sorted.length - slice.length - 1]!.id : null;
    return { messages: slice, nextCursor };
  }
  const sliceStart = Math.max(0, cursorIndex - limit);
  const slice = sorted.slice(sliceStart, cursorIndex);
  const nextCursor = sliceStart > 0 ? sorted[sliceStart - 1]!.id : null;
  return { messages: slice, nextCursor };
}

function createConversation(payload: NewConversationInput) {
  const id = `conv-${Date.now()}`;
  const newConversation: ConversationDatasetEntry & { lastActivity?: string } = {
    id,
    name: payload.name,
    avatar:
      payload.avatar ??
      "https://images.unsplash.com/photo-1523475472560-d2df97ec485c?auto=format&fit=facearea&w=80&h=80&q=80",
    shortStatus: "novo contato",
    description: payload.description,
    unreadCount: 0,
    lastActivity: new Date().toISOString(),
  };
  dataset.conversations.push(newConversation);
  dataset.messages[id] = [];
  return buildSummary(newConversation);
}

function appendMessage(
  conversationId: string,
  body: SendMessageInput,
  sender: "me" | "contact" = "me",
): Message {
  const id = `m-${conversationId}-${Date.now()}`;
  const computedContent = body.content?.trim()
    ? body.content
    : body.attachments && body.attachments.length > 0
      ? body.attachments[0]!.name
      : "";
  const message: Message = {
    id,
    conversationId,
    sender,
    content: computedContent,
    timestamp: new Date().toISOString(),
    status: sender === "me" ? "sent" : "delivered",
    type: body.type ?? "text",
    attachments: body.attachments,
  };
  if (!dataset.messages[conversationId]) {
    dataset.messages[conversationId] = [];
  }
  dataset.messages[conversationId]!.push(message);
  const conversation = dataset.conversations.find((item) => item.id === conversationId);
  if (conversation) {
    conversation.lastActivity = message.timestamp;
    if (sender === "contact") {
      conversation.unreadCount = (conversation.unreadCount ?? 0) + 1;
    }
  }
  return message;
}

function markConversationAsRead(conversationId: string) {
  const conversation = dataset.conversations.find((item) => item.id === conversationId);
  if (conversation) {
    conversation.unreadCount = 0;
  }
}

function updateConversationAfterSend(conversationId: string) {
  const conversation = dataset.conversations.find((item) => item.id === conversationId);
  if (!conversation) return;
  const summary = buildSummary(conversation);
  conversation.lastActivity = summary.lastMessage?.timestamp ?? conversation.lastActivity;
}

export const setupMockChatServer = () => {
  if (typeof window === "undefined" || !originalFetch) return;
  const globalWindow = window as typeof window & { __chatMockServer?: boolean };
  if (globalWindow.__chatMockServer) return;

  globalWindow.__chatMockServer = true;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : (input instanceof URL ? input.toString() : input.url);
    const method = (init?.method ?? (typeof input === "object" && "method" in input ? (input as Request).method : "GET")).toUpperCase();
    const requestUrl = new URL(url, window.location.origin);

    if (!requestUrl.pathname.startsWith("/api/conversations")) {
      return originalFetch(input, init);
    }

    try {
      if (requestUrl.pathname === "/api/conversations" && method === "GET") {
        const data = listConversations();
        return withLatency(data);
      }

      if (requestUrl.pathname === "/api/conversations" && method === "POST") {
        const payload = init?.body ? (JSON.parse(init.body.toString()) as NewConversationInput) : { name: "Novo contato" };
        const conversation = createConversation(payload);
        return withLatency(conversation, { status: 201 });
      }

      const match = requestUrl.pathname.match(/^\/api\/conversations\/([^/]+)(?:\/(messages|read))?$/);
      if (!match) {
        return notFound();
      }
      const conversationId = decodeURIComponent(match[1]);
      const action = match[2];

      if (method === "POST" && action === "messages") {
        const payload = init?.body
          ? (JSON.parse(init.body.toString()) as SendMessageInput)
          : { content: "" };
        const message = appendMessage(conversationId, payload, "me");
        updateConversationAfterSend(conversationId);
        return withLatency(message, { status: 201 });
      }

      if (method === "GET" && action === "messages") {
        const cursor = requestUrl.searchParams.get("cursor");
        const limitParam = requestUrl.searchParams.get("limit");
        const limit = limitParam ? Number.parseInt(limitParam, 10) : 20;
        const page = getMessages(conversationId, cursor, Number.isNaN(limit) ? 20 : limit);
        return withLatency(page);
      }

      if (method === "POST" && action === "read") {
        markConversationAsRead(conversationId);
        return withLatency({ ok: true });
      }

      return notFound();
    } catch (error) {
      console.error("Mock server error", error);
      return withLatency(
        { message: error instanceof Error ? error.message : "Erro interno" },
        { status: 500 },
      );
    }
  };
};
