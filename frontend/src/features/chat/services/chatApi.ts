import type {
  ConversationSummary,
  Message,
  MessagePage,
  NewConversationInput,
  SendMessageInput,
  UpdateConversationPayload,
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

export const updateConversation = async (
  conversationId: string,
  payload: UpdateConversationPayload,
): Promise<ConversationSummary> => {
  const response = await fetch(`/api/conversations/${conversationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson<ConversationSummary>(response);
};

interface ApiUser {
  id: number | string;
  nome_completo?: string | null;
  perfil?: string | number | null;
}

export interface ChatResponsibleOption {
  id: string;
  name: string;
  role?: string;
}

export const fetchChatResponsibles = async (): Promise<ChatResponsibleOption[]> => {
  const response = await fetch(`/api/usuarios`);
  const data = await parseJson<ApiUser[]>(response);
  const options: ChatResponsibleOption[] = [];
  const seen = new Set<string>();

  for (const user of data) {
    if (!user || user.id === undefined || user.id === null) {
      continue;
    }
    const id = String(user.id);
    if (!id || seen.has(id)) {
      continue;
    }
    const name = typeof user.nome_completo === 'string' ? user.nome_completo.trim() : '';
    if (!name) {
      continue;
    }

    const roleValue = user.perfil;
    const role =
      typeof roleValue === 'string' && roleValue.trim()
        ? roleValue.trim()
        : typeof roleValue === 'number' && Number.isFinite(roleValue)
          ? String(roleValue)
          : undefined;

    seen.add(id);
    options.push({ id, name, role });
  }

  return options.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
};

interface ApiEtiqueta {
  id: number | string;
  nome?: string | null;
}

export const fetchChatTags = async (): Promise<string[]> => {
  const response = await fetch(`/api/etiquetas`);
  const data = await parseJson<ApiEtiqueta[]>(response);
  const tags = new Set<string>();

  for (const item of data) {
    if (!item) {
      continue;
    }
    const name = typeof item.nome === 'string' ? item.nome.trim() : '';
    if (!name) {
      continue;
    }
    tags.add(name);
  }

  return Array.from(tags).sort((a, b) => a.localeCompare(b, 'pt-BR'));
};
