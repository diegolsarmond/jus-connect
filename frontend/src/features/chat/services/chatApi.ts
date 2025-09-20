import type {
  ConversationSummary,
  Message,
  MessagePage,
  NewConversationInput,
  SendMessageInput,
  UpdateConversationPayload,
} from "../types";

const extractErrorMessage = (rawBody: string, status: number): string => {
  const trimmed = rawBody.trim();
  if (!trimmed) {
    return `Erro de rede (${status})`;
  }

  if (trimmed.startsWith("<")) {
    return "O servidor retornou uma página HTML em vez de dados JSON. Faça login novamente ou recarregue a página.";
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown> | string;
    if (typeof parsed === "string") {
      return parsed;
    }
    const message = parsed?.message ?? parsed?.error;
    if (typeof message === "string" && message.trim().length > 0) {
      return message.trim();
    }
  } catch (error) {
    // Ignore JSON parse errors and fall back to returning the raw text below.
  }

  return trimmed;
};

const parseJson = async <T>(response: Response): Promise<T> => {
  const contentType = response.headers.get("content-type") ?? "";
  const isJson = /application\/json|\+json/i.test(contentType);
  const bodyText = await response.text();

  if (!response.ok) {
    throw new Error(extractErrorMessage(bodyText, response.status));
  }

  if (response.status === 204 || bodyText.trim().length === 0) {
    return {} as T;
  }

  if (!isJson) {
    throw new Error(
      "Resposta inválida do servidor: conteúdo inesperado recebido. Recarregue a página e tente novamente.",
    );
  }

  try {
    return JSON.parse(bodyText) as T;
  } catch (error) {
    throw new Error(
      "Não foi possível interpretar a resposta do servidor. Recarregue a página e tente novamente.",
    );
  }
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
