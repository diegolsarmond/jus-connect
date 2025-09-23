import type {
  ConversationSummary,
  Message,
  MessagePage,
  NewConversationInput,
  SendMessageInput,
  UpdateConversationPayload,
} from "../types";
import { getApiUrl } from "@/lib/api";

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

const extractDataArray = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (payload && typeof payload === "object") {
    const rows = (payload as { rows?: unknown }).rows;
    if (Array.isArray(rows)) {
      return rows as T[];
    }

    const data = (payload as { data?: unknown }).data;
    if (Array.isArray(data)) {
      return data as T[];
    }

    if (data && typeof data === "object") {
      const nestedRows = (data as { rows?: unknown }).rows;
      if (Array.isArray(nestedRows)) {
        return nestedRows as T[];
      }
    }
  }

  return [];
};

const pickFirstNonEmptyString = (
  ...values: Array<string | null | undefined>
): string | undefined => {
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return undefined;
};

const getNameFromEmail = (value?: string | null): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const [localPart] = trimmed.split("@");
  if (!localPart) {
    return undefined;
  }
  const normalized = localPart.replace(/[._]+/g, " ").trim();
  return normalized.length > 0 ? normalized : undefined;
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

export const setTypingState = async (conversationId: string, isTyping: boolean) => {
  const response = await fetch(`/api/conversations/${conversationId}/typing`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isTyping }),
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
  id?: number | string | null;
  id_usuario?: number | string | null;
  idUsuario?: number | string | null;
  idusuario?: number | string | null;
  usuario_id?: number | string | null;
  usuarioId?: number | string | null;
  user_id?: number | string | null;
  userId?: number | string | null;
  codigo?: number | string | null;
  nome_completo?: string | null;
  nome?: string | null;
  nome_usuario?: string | null;
  nomeusuario?: string | null;
  nomeUsuario?: string | null;
  nome_usuario_completo?: string | null;
  email?: string | null;
  perfil?: string | number | null;
  perfil_nome?: string | null;
  perfil_nome_exibicao?: string | null;
  perfil_descricao?: string | null;
  perfilDescricao?: string | null;
  funcao?: string | null;
  cargo?: string | null;
  papel?: string | null;
}

export interface ChatResponsibleOption {
  id: string;
  name: string;
  role?: string;
}

const extractUserArray = (payload: unknown): ApiUser[] => {
  const direct = extractDataArray<ApiUser>(payload);
  if (direct.length > 0) {
    return direct;
  }

  const visited = new Set<object>();
  const queue: unknown[] = [];

  if (payload && typeof payload === "object") {
    queue.push(payload);
  }

  const candidateKeys = [
    "usuarios",
    "usuarios_empresa",
    "usuariosEmpresa",
    "usuariosEmpresaRows",
    "lista",
    "list",
    "items",
    "result",
    "results",
    "response",
    "payload",
    "content",
    "records",
    "values",
    "body",
    "data",
    "rows",
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    if (Array.isArray(current)) {
      const objects = current.filter(
        (item): item is ApiUser => Boolean(item && typeof item === "object"),
      );
      if (objects.length > 0) {
        return objects;
      }
      continue;
    }

    if (typeof current !== "object") {
      continue;
    }

    if (visited.has(current as object)) {
      continue;
    }
    visited.add(current as object);

    const extracted = extractDataArray<ApiUser>(current);
    if (extracted.length > 0) {
      return extracted;
    }

    for (const key of candidateKeys) {
      if (key in (current as Record<string, unknown>)) {
        queue.push((current as Record<string, unknown>)[key]);
      }
    }

    for (const value of Object.values(current as Record<string, unknown>)) {
      if (value && typeof value === "object") {
        queue.push(value);
      }
    }
  }

  return [];
};

const extractUserId = (user: ApiUser): string | undefined => {
  const candidates: Array<number | string | null | undefined> = [
    user.id,
    user.id_usuario,
    user.idUsuario,
    user.idusuario,
    user.usuario_id,
    user.usuarioId,
    user.user_id,
    user.userId,
    user.codigo,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return String(Math.trunc(candidate));
    }
    if (typeof candidate === "string") {
      const trimmed = candidate.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }

  return undefined;
};

export const fetchChatResponsibles = async (): Promise<ChatResponsibleOption[]> => {
  const response = await fetch(getApiUrl("usuarios/empresa"), {
    headers: { Accept: "application/json" },
  });
  const payload = await parseJson<unknown>(response);
  const data = extractUserArray(payload);
  const options: ChatResponsibleOption[] = [];
  const seen = new Set<string>();

  for (const user of data) {
    if (!user) {
      continue;
    }
    const id = extractUserId(user);
    if (!id || seen.has(id)) {
      continue;
    }
    const name =
      pickFirstNonEmptyString(
        user.nome_completo,
        user.nome,
        user.nome_usuario,
        user.nomeusuario,
        user.nomeUsuario,
        user.nome_usuario_completo,
      ) ??
      getNameFromEmail(user.email);
    if (!name) {
      continue;
    }

    const roleValue =
      pickFirstNonEmptyString(
        typeof user.perfil === "string" ? user.perfil : undefined,
        user.perfil_nome,
        user.perfil_nome_exibicao,
        user.perfil_descricao,
        user.perfilDescricao,
        user.funcao,
        user.cargo,
        user.papel,
      ) ??
      (typeof user.perfil === "number" && Number.isFinite(user.perfil)
        ? String(user.perfil)
        : undefined);

    seen.add(id);
    options.push({ id, name, role: roleValue });
  }

  return options.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
};

interface ApiEtiqueta {
  id: number | string;
  nome?: string | null;
  descricao?: string | null;
  nome_etiqueta?: string | null;
  etiqueta?: string | null;
}

export const fetchChatTags = async (): Promise<string[]> => {
  const response = await fetch(getApiUrl("etiquetas"), {
    headers: { Accept: "application/json" },
  });
  const payload = await parseJson<unknown>(response);
  const data = extractDataArray<ApiEtiqueta>(payload);
  const tags = new Set<string>();

  for (const item of data) {
    if (!item) {
      continue;
    }
    const name = pickFirstNonEmptyString(item.nome, item.descricao, item.nome_etiqueta, item.etiqueta);
    if (!name) {
      continue;
    }
    tags.add(name);
  }

  return Array.from(tags).sort((a, b) => a.localeCompare(b, 'pt-BR'));
};
