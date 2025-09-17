export interface WahaChatSummary {
  conversation_id: string;
  contact_name: string;
  photo_url: string | null;
}

const parseResponse = async (response: Response): Promise<WahaChatSummary[]> => {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `Erro ao consultar conversas (${response.status})`);
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

