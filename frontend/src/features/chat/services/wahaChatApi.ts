export interface WahaChatSummary {
  conversation_id: string;
  contact_name: string;
  photo_url: string | null;
}

const STATUS_MESSAGES: Partial<Record<number, string>> = {
  502:
    "Não foi possível acessar o serviço de conversas (erro 502). Verifique se o WAHA está em execução.",
  503:
    "O serviço de conversas está indisponível no momento (erro 503). Tente novamente em instantes.",
  504:
    "O serviço de conversas demorou muito para responder (erro 504). Tente novamente em instantes.",
};

const sanitizeHtml = (value: string) =>
  value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const extractMessageFromJson = (payload: unknown) => {
  if (typeof payload === "string") {
    const trimmed = payload.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (payload && typeof payload === "object") {
    const data = payload as Record<string, unknown>;
    for (const key of ["message", "error", "detail"]) {
      const value = data[key];
      if (typeof value === "string" && value.trim().length > 0) {
        return value.trim();
      }
    }
  }

  return null;
};

const buildErrorMessage = (response: Response, rawBody: string) => {
  const fallback =
    STATUS_MESSAGES[response.status] ??
    (response.status
      ? `Erro ao consultar conversas (${response.status}${
          response.statusText ? ` - ${response.statusText}` : ""
        })`
      : "Erro ao consultar conversas");

  const trimmedBody = rawBody.trim();

  if (!trimmedBody) {
    return fallback;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const looksLikeJson = trimmedBody.startsWith("{") || trimmedBody.startsWith("[");

  if (contentType.includes("application/json") || looksLikeJson) {
    try {
      const parsed = JSON.parse(trimmedBody) as unknown;
      const message = extractMessageFromJson(parsed);
      if (message) {
        return message;
      }
    } catch {
      // Se não for possível interpretar como JSON, seguimos para as demais heurísticas.
    }
  }

  if (/<!doctype html/i.test(trimmedBody) || /^<html/i.test(trimmedBody)) {
    return fallback;
  }

  const sanitized = sanitizeHtml(trimmedBody);
  return sanitized.length > 0 ? sanitized : fallback;
};

const parseResponse = async (response: Response): Promise<WahaChatSummary[]> => {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(buildErrorMessage(response, text));
  }
  if (!text) {
    return [];
  }
  try {
    return JSON.parse(text) as WahaChatSummary[];
  } catch (error) {
    throw new Error(`Não foi possível interpretar a resposta do servidor: ${(error as Error).message}`);
  }
};

export const fetchWahaChats = async (options: { signal?: AbortSignal } = {}): Promise<WahaChatSummary[]> => {
  const response = await fetch("/api/chats", {
    signal: options.signal,
  });
  return parseResponse(response);
};

