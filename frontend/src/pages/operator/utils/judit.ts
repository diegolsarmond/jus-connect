export interface ApiProcessoJuditRequest {
  request_id?: string | null;
  status?: string | null;
  source?: string | null;
  criado_em?: string | null;
  atualizado_em?: string | null;
  result?: unknown;
}

export interface ProcessoJuditRequest {
  requestId: string;
  status: string;
  source: string;
  result: unknown;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ProcessoTrackingStep {
  name: string | null;
  label: string | null;
  description: string | null;
  updatedAt: string | null;
}

export interface ProcessoTrackingIncrement {
  id: string;
  type: string | null;
  description: string | null;
  occurredAt: string | null;
  raw: unknown;
}

export interface ProcessoTrackingSummary {
  status: string | null;
  phase: string | null;
  lastStep: ProcessoTrackingStep | null;
  tags: string[];
  updatedAt: string | null;
  increments: ProcessoTrackingIncrement[];
  raw: Record<string, unknown> | null;
}

export interface ProcessoResponseData {
  cover: Record<string, unknown> | null;
  partes: Record<string, unknown>[];
  movimentacoes: Record<string, unknown>[];
  anexos: Record<string, unknown>[];
  metadata: Record<string, unknown> | null;
  raw: Record<string, unknown> | null;
}

export const parseOptionalString = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return null;
};

export const ensureArray = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (value === null || value === undefined) {
    return [];
  }

  return [value as T];
};

export const toRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

export const parseJuditResultPayload = (
  value: unknown,
): Record<string, unknown> | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    try {
      const parsed = JSON.parse(trimmed);
      return toRecord(parsed);
    } catch (error) {
      console.error("Não foi possível interpretar o payload de tracking da Judit", error);
      return null;
    }
  }

  return toRecord(value);
};

const parseTrackingTags = (value: unknown): string[] => {
  const tags = new Set<string>();
  const entries = ensureArray<unknown>(value);

  for (const entry of entries) {
    if (typeof entry === "string") {
      const normalized = entry.trim();
      if (normalized) {
        tags.add(normalized);
      }
      continue;
    }

    if (!entry || typeof entry !== "object") {
      continue;
    }

    const record = entry as Record<string, unknown>;
    const label =
      parseOptionalString(record.label) ||
      parseOptionalString(record.nome) ||
      parseOptionalString(record.name) ||
      parseOptionalString(record.valor) ||
      parseOptionalString(record.value);

    if (label) {
      tags.add(label);
    }
  }

  return Array.from(tags);
};

const parseTrackingStep = (value: unknown): ProcessoTrackingStep | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    if (!normalized) {
      return null;
    }

    return {
      name: normalized,
      label: normalized,
      description: null,
      updatedAt: null,
    };
  }

  if (typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const name =
    parseOptionalString(record.name) ||
    parseOptionalString(record.nome) ||
    parseOptionalString(record.codigo) ||
    parseOptionalString(record.id) ||
    null;
  const label =
    parseOptionalString(record.label) ||
    parseOptionalString(record.descricao) ||
    parseOptionalString(record.description) ||
    parseOptionalString(record.nome) ||
    name;
  const description =
    parseOptionalString(record.descricao) ||
    parseOptionalString(record.description) ||
    null;
  const updatedAt =
    parseOptionalString(
      record.updated_at ??
        record.updatedAt ??
        record.last_update ??
        record.lastUpdate ??
        record.atualizado_em ??
        record.atualizadoEm ??
        record.timestamp,
    ) ?? null;

  return {
    name,
    label,
    description,
    updatedAt,
  };
};

const parseTrackingIncrements = (
  value: unknown,
): ProcessoTrackingIncrement[] => {
  const increments: ProcessoTrackingIncrement[] = [];
  const entries = ensureArray<unknown>(value);

  entries.forEach((entry, index) => {
    if (!entry) {
      return;
    }

    if (typeof entry === "object") {
      const record = entry as Record<string, unknown>;
      const id =
        parseOptionalString(record.id) ||
        parseOptionalString(record.codigo) ||
        parseOptionalString(record.reference) ||
        `${index}`;
      const type =
        parseOptionalString(record.type) ||
        parseOptionalString(record.event) ||
        parseOptionalString(record.category) ||
        parseOptionalString(record.tipo) ||
        null;
      const description =
        parseOptionalString(record.description) ||
        parseOptionalString(record.descricao) ||
        parseOptionalString(record.details) ||
        parseOptionalString(record.message) ||
        parseOptionalString(record.titulo) ||
        parseOptionalString(record.title) ||
        null;
      const occurredAt =
        parseOptionalString(
          record.occurred_at ??
            record.occurredAt ??
            record.ocorrido_em ??
            record.timestamp ??
            record.data,
        ) ?? null;

      increments.push({
        id: id ?? `${index}`,
        type,
        description,
        occurredAt,
        raw: record,
      });
      return;
    }

    const text = parseOptionalString(entry);
    if (text) {
      increments.push({
        id: `${index}`,
        type: null,
        description: text,
        occurredAt: null,
        raw: entry,
      });
    }
  });

  return increments;
};

export const mapApiJuditRequest = (
  value: ApiProcessoJuditRequest | null | undefined,
): ProcessoJuditRequest | null => {
  if (!value) {
    return null;
  }

  const requestId = parseOptionalString(value.request_id);
  if (!requestId) {
    return null;
  }

  const status = parseOptionalString(value.status) ?? "pending";
  const source = parseOptionalString(value.source) ?? "system";
  const createdAt = parseOptionalString(value.criado_em) ?? null;
  const updatedAt = parseOptionalString(value.atualizado_em) ?? createdAt ?? null;

  return {
    requestId,
    status,
    source,
    result: value.result ?? null,
    createdAt,
    updatedAt,
  };
};

export const parseTrackingSummaryFromResult = (
  result: unknown,
): ProcessoTrackingSummary | null => {
  const payload = parseJuditResultPayload(result);
  if (!payload) {
    return null;
  }

  const trackingSource =
    toRecord(payload.tracking) ??
    toRecord(payload.tracking_status) ??
    toRecord(payload.sync) ??
    payload;

  const status =
    parseOptionalString(payload.status) ||
    parseOptionalString(payload.request_status) ||
    parseOptionalString(trackingSource.status) ||
    parseOptionalString(trackingSource.state) ||
    null;

  const phase =
    parseOptionalString(trackingSource.phase) ||
    parseOptionalString(trackingSource.fase) ||
    parseOptionalString(payload.phase) ||
    parseOptionalString(payload.fase) ||
    null;

  const lastStep = parseTrackingStep(
    trackingSource.last_step ??
      trackingSource.lastStep ??
      payload.last_step ??
      payload.lastStep,
  );

  const updatedAt =
    parseOptionalString(
      trackingSource.updated_at ??
        trackingSource.updatedAt ??
        trackingSource.last_update ??
        trackingSource.atualizado_em ??
        payload.updated_at ??
        payload.updatedAt ??
        payload.last_update ??
        payload.atualizado_em ??
        payload.synced_at,
    ) ?? null;

  const tags = parseTrackingTags(
    trackingSource.tags ??
      trackingSource.etiquetas ??
      payload.tags ??
      payload.etiquetas ??
      null,
  );

  const increments = parseTrackingIncrements(
    trackingSource.increments ?? payload.increments ?? null,
  );

  return {
    status,
    phase,
    lastStep,
    tags,
    updatedAt,
    increments,
    raw: payload,
  };
};

export const parseResponseDataFromResult = (
  result: unknown,
): ProcessoResponseData | null => {
  const payload = parseJuditResultPayload(result);
  if (!payload) {
    return null;
  }

  const fallbackPayloadRecord =
    toRecord(payload.result) ?? toRecord(payload) ?? null;

  const responseData =
    toRecord(payload.response_data) ??
    toRecord(payload.responseData) ??
    toRecord(payload.data) ??
    toRecord(payload.payload) ??
    fallbackPayloadRecord;

  if (!responseData) {
    return null;
  }

  const cover = toRecord(responseData.cover ?? responseData.capa ?? null);
  const partes = ensureArray<unknown>(responseData.partes ?? responseData.parties ?? null)
    .map(toRecord)
    .filter((item): item is Record<string, unknown> => Boolean(item));
  const movimentacoes = ensureArray<unknown>(
    responseData.movimentacoes ??
      responseData.movements ??
      responseData.movs ??
      responseData.events ??
      null,
  )
    .map(toRecord)
    .filter((item): item is Record<string, unknown> => Boolean(item));
  const anexos = ensureArray<unknown>(
    responseData.anexos ?? responseData.attachments ?? responseData.documents ?? null,
  )
    .map(toRecord)
    .filter((item): item is Record<string, unknown> => Boolean(item));
  const metadataSources: Record<string, unknown>[] = [];

  const responseMetadata = toRecord(
    responseData.metadata ??
      responseData.metadados ??
      responseData.meta ??
      null,
  );

  if (responseMetadata) {
    metadataSources.push(responseMetadata);
  }

  if (fallbackPayloadRecord) {
    const sanitizedRootEntries = Object.entries(fallbackPayloadRecord).filter(
      ([key]) =>
        ![
          "response_data",
          "responseData",
          "data",
          "payload",
          "result",
          "cover",
          "capa",
          "metadata",
          "metadados",
          "meta",
          "partes",
          "parties",
          "movimentacoes",
          "movements",
          "movs",
          "events",
          "anexos",
          "attachments",
          "documents",
        ].includes(key),
    );

    if (sanitizedRootEntries.length > 0) {
      metadataSources.push(Object.fromEntries(sanitizedRootEntries));
    }
  }

  const metadata =
    metadataSources.length > 0
      ? metadataSources.reduce<Record<string, unknown>>(
          (accumulator, current) => ({ ...accumulator, ...current }),
          {},
        )
      : null;

  return {
    cover,
    partes,
    movimentacoes,
    anexos,
    metadata,
    raw: responseData,
  };
};

export const formatResponseKey = (key: string): string => {
  return key
    .replace(/[_\s]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase())
    .trim();
};

export const formatResponseValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "Não informado";
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : "Não informado";
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? value.toLocaleString("pt-BR")
      : String(value);
  }

  if (typeof value === "boolean") {
    return value ? "Sim" : "Não";
  }

  if (value instanceof Date) {
    return value.toLocaleString("pt-BR");
  }

  if (Array.isArray(value)) {
    const rendered = value
      .map((item) => formatResponseValue(item))
      .filter((item) => item && item !== "Não informado");
    return rendered.length > 0 ? rendered.join(", ") : "Não informado";
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch (error) {
      console.error("Não foi possível serializar valor de metadado", error);
      return "Não informado";
    }
  }

  return String(value);
};
