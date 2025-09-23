import { getApiUrl } from "@/lib/api";

export interface ClienteAttributeType {
  id: number;
  name: string;
}

export interface ClienteAttribute {
  id: number;
  clienteId: number;
  documentTypeId: number;
  documentTypeName: string;
  value: string;
  createdAt: string | null;
}

const DEFAULT_ERROR_MESSAGE =
  "Não foi possível carregar os dados de atributos personalizados. Tente novamente.";

let cachedTypePromise: Promise<ClienteAttributeType[]> | null = null;
let cachedTypes: ClienteAttributeType[] | null = null;

const toIntegerOrNull = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isInteger(parsed)) {
      return parsed;
    }
  }
  return null;
};

const toStringOrNull = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
};

const extractErrorMessage = (status: number, body: string): string => {
  const trimmed = body.trim();

  if (!trimmed) {
    return status === 404
      ? "Cliente não encontrado. Verifique o vínculo da conversa."
      : `${DEFAULT_ERROR_MESSAGE} (HTTP ${status})`;
  }

  try {
    const data = JSON.parse(trimmed) as Record<string, unknown> | string;
    if (typeof data === "string" && data.trim().length > 0) {
      return data.trim();
    }

    const message = data?.message ?? data?.error;
    if (typeof message === "string" && message.trim().length > 0) {
      return message.trim();
    }
  } catch (error) {
    // ignore JSON parse errors and fall back to returning the raw text
  }

  if (trimmed.startsWith("<")) {
    return DEFAULT_ERROR_MESSAGE;
  }

  return trimmed;
};

const parseJsonBody = <T,>(text: string): T => {
  if (!text.trim()) {
    return {} as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error(
      "A resposta do servidor não pôde ser interpretada. Recarregue a página e tente novamente.",
    );
  }
};

const requestJson = async <T,>(input: RequestInfo, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, init);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(extractErrorMessage(response.status, text));
  }

  if (!text.trim()) {
    return [] as T;
  }

  return parseJsonBody<T>(text);
};

const mapRawAttributeType = (value: unknown): ClienteAttributeType | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = toIntegerOrNull(record.id ?? record.ID ?? record.tipo_documento_id);
  const name = toStringOrNull(record.nome ?? record.name ?? record.descricao);

  if (id === null || !name) {
    return null;
  }

  return { id, name };
};

const mapRawAttribute = (value: unknown): ClienteAttribute | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = toIntegerOrNull(record.id);
  const clienteId = toIntegerOrNull(record.cliente_id ?? record.idclientes ?? record.clienteId);
  const documentTypeId =
    toIntegerOrNull(record.tipo_documento_id ?? record.idtipodocumento ?? record.document_type_id);
  const documentTypeName =
    toStringOrNull(record.tipo_documento_nome ?? record.nome_tipo ?? record.tipo_documento) ??
    `Tipo ${documentTypeId ?? "desconhecido"}`;
  const valueText = toStringOrNull(record.valor ?? record.value ?? record.conteudo) ?? "";
  const createdAt = toStringOrNull(record.datacadastro ?? record.created_at ?? record.createdAt);

  if (id === null || clienteId === null || documentTypeId === null) {
    return null;
  }

  return {
    id,
    clienteId,
    documentTypeId,
    documentTypeName,
    value: valueText,
    createdAt,
  };
};

const normalizeAttributeCollection = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const candidates = ["rows", "data", "items", "values", "atributos"];
    for (const key of candidates) {
      const collection = record[key];
      if (Array.isArray(collection)) {
        return collection;
      }
    }
  }

  return [];
};

const sortAttributeTypes = (types: ClienteAttributeType[]): ClienteAttributeType[] =>
  [...types].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

export const fetchClienteAttributeTypes = async (): Promise<ClienteAttributeType[]> => {
  if (cachedTypes) {
    return cachedTypes;
  }

  if (!cachedTypePromise) {
    cachedTypePromise = (async () => {
      try {
        const url = getApiUrl("clientes/atributos/tipos");
        const payload = await requestJson<unknown>(url, { headers: { Accept: "application/json" } });
        const rawItems = normalizeAttributeCollection(payload);
        const types = rawItems
          .map(mapRawAttributeType)
          .filter((item): item is ClienteAttributeType => item !== null);
        cachedTypes = sortAttributeTypes(types);
        return cachedTypes;
      } catch (error) {
        cachedTypes = null;
        throw error;
      } finally {
        cachedTypePromise = null;
      }
    })();
  }

  return cachedTypePromise;
};

export const invalidateClienteAttributeTypesCache = () => {
  cachedTypes = null;
  cachedTypePromise = null;
};

export const fetchClienteAttributes = async (
  clienteId: number | string,
): Promise<ClienteAttribute[]> => {
  const url = getApiUrl(`clientes/${clienteId}/atributos`);
  const payload = await requestJson<unknown>(url, { headers: { Accept: "application/json" } });
  const rawItems = normalizeAttributeCollection(payload);
  return rawItems
    .map(mapRawAttribute)
    .filter((item): item is ClienteAttribute => item !== null)
    .sort((a, b) => a.documentTypeName.localeCompare(b.documentTypeName, "pt-BR"));
};

export const createClienteAttribute = async (
  clienteId: number | string,
  documentTypeId: number,
  value: string,
): Promise<ClienteAttribute> => {
  const url = getApiUrl(`clientes/${clienteId}/atributos`);
  const payload = await requestJson<unknown>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idtipodocumento: documentTypeId, valor: value }),
  });
  const attribute = mapRawAttribute(payload);
  if (!attribute) {
    throw new Error("O servidor retornou um atributo em formato inesperado.");
  }
  return attribute;
};

export const updateClienteAttribute = async (
  clienteId: number | string,
  attributeId: number,
  documentTypeId: number,
  value: string,
): Promise<ClienteAttribute> => {
  const url = getApiUrl(`clientes/${clienteId}/atributos/${attributeId}`);
  const payload = await requestJson<unknown>(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idtipodocumento: documentTypeId, valor: value }),
  });
  const attribute = mapRawAttribute(payload);
  if (!attribute) {
    throw new Error("O servidor retornou um atributo em formato inesperado.");
  }
  return attribute;
};

export const deleteClienteAttribute = async (
  clienteId: number | string,
  attributeId: number,
): Promise<void> => {
  const url = getApiUrl(`clientes/${clienteId}/atributos/${attributeId}`);
  const response = await fetch(url, { method: "DELETE" });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(extractErrorMessage(response.status, body));
  }
};
