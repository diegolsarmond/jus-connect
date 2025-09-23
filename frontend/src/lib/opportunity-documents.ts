import type { EditorJsonContent, EditorJsonNode } from "@/types/templates";

export interface OpportunityDocument {
  id: number;
  oportunidade_id: number | null;
  template_id: number | null;
  title: string;
  created_at: string;
  content_html: string;
  content_editor_json: EditorJsonContent | null;
  variables?: Record<string, unknown>;
  metadata?: unknown;
}

const DEFAULT_CONTENT_HTML = "<p></p>";

const parseNumeric = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const ensureEditorJsonNode = (value: unknown): EditorJsonNode | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const rawType = record["type"];
  if (typeof rawType !== "string" || rawType.trim().length === 0) {
    return null;
  }

  const node: EditorJsonNode = { type: rawType };

  if (typeof record["text"] === "string") {
    node.text = record["text"];
  }

  if (record["attrs"] && typeof record["attrs"] === "object" && !Array.isArray(record["attrs"])) {
    const attrs = record["attrs"] as Record<string, unknown>;
    const normalized = Object.entries(attrs)
      .filter(([, value]) => value !== undefined && value !== null)
      .reduce<Record<string, string>>((acc, [key, value]) => {
        acc[key] = String(value);
        return acc;
      }, {});
    if (Object.keys(normalized).length > 0) {
      node.attrs = normalized;
    }
  }

  if (Array.isArray(record["children"])) {
    const children = record["children"]
      .map((child) => ensureEditorJsonNode(child))
      .filter((child): child is EditorJsonNode => Boolean(child));
    if (children.length > 0) {
      node.children = children;
    }
  }

  return node;
};

const ensureEditorJsonContent = (value: unknown): EditorJsonContent | null => {
  if (!value) return null;

  if (Array.isArray(value)) {
    const nodes = value
      .map((node) => ensureEditorJsonNode(node))
      .filter((node): node is EditorJsonNode => Boolean(node));
    return nodes.length > 0 ? nodes : null;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return ensureEditorJsonContent(parsed);
    } catch {
      return null;
    }
  }

  if (typeof value === "object") {
    const record = value as { nodes?: unknown };
    if (Array.isArray(record.nodes)) {
      return ensureEditorJsonContent(record.nodes);
    }
  }

  return null;
};

const parseStoredDocumentContent = (
  value: unknown,
): {
  contentHtml: string;
  contentEditorJson: EditorJsonContent | null;
  metadata: unknown;
} => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return { contentHtml: DEFAULT_CONTENT_HTML, contentEditorJson: null, metadata: null };
    }

    try {
      const parsed = JSON.parse(trimmed) as {
        content_html?: unknown;
        content_editor_json?: unknown;
        metadata?: unknown;
      };
      return {
        contentHtml:
          typeof parsed.content_html === "string" && parsed.content_html.trim().length > 0
            ? parsed.content_html
            : DEFAULT_CONTENT_HTML,
        contentEditorJson: ensureEditorJsonContent(parsed.content_editor_json),
        metadata: parsed.metadata ?? null,
      };
    } catch {
      return { contentHtml: trimmed, contentEditorJson: null, metadata: null };
    }
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const contentHtml =
      typeof record["content_html"] === "string" && record["content_html"].trim().length > 0
        ? (record["content_html"] as string)
        : DEFAULT_CONTENT_HTML;
    return {
      contentHtml,
      contentEditorJson: ensureEditorJsonContent(record["content_editor_json"]),
      metadata: record["metadata"] ?? null,
    };
  }

  return { contentHtml: DEFAULT_CONTENT_HTML, contentEditorJson: null, metadata: null };
};

const normalizeVariables = (value: unknown): Record<string, unknown> | undefined => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return undefined;
    }
  }

  return undefined;
};

export const parseOpportunityDocument = (value: unknown): OpportunityDocument | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;

  const id = parseNumeric(record["id"]);
  if (id === null) {
    return null;
  }

  const oportunidadeId = parseNumeric(record["oportunidade_id"]);
  const templateId = parseNumeric(record["template_id"]);

  const rawTitle = record["title"];
  const title =
    typeof rawTitle === "string" && rawTitle.trim().length > 0
      ? rawTitle.trim()
      : `Documento ${id}`;

  const rawCreatedAt = record["created_at"];
  const createdAt =
    typeof rawCreatedAt === "string" && rawCreatedAt.trim().length > 0
      ? rawCreatedAt.trim()
      : new Date().toISOString();

  let contentHtml =
    typeof record["content_html"] === "string" && record["content_html"].trim().length > 0
      ? (record["content_html"] as string)
      : "";
  let contentEditorJson = ensureEditorJsonContent(record["content_editor_json"]);
  let metadata = record["metadata"] ?? null;

  if ((!contentHtml || contentHtml === DEFAULT_CONTENT_HTML) && record["content"]) {
    const stored = parseStoredDocumentContent(record["content"]);
    if (!contentHtml || contentHtml === DEFAULT_CONTENT_HTML) {
      contentHtml = stored.contentHtml ?? DEFAULT_CONTENT_HTML;
    }
    if (!contentEditorJson) {
      contentEditorJson = stored.contentEditorJson;
    }
    if (metadata === null || metadata === undefined) {
      metadata = stored.metadata;
    }
  }

  if (!contentHtml || contentHtml.trim().length === 0) {
    contentHtml = DEFAULT_CONTENT_HTML;
  }

  const variables = normalizeVariables(record["variables"]);

  return {
    id,
    oportunidade_id: oportunidadeId,
    template_id: templateId,
    title,
    created_at: createdAt,
    content_html: contentHtml,
    content_editor_json: contentEditorJson,
    metadata,
    ...(variables ? { variables } : {}),
  };
};

export const parseOpportunityDocumentsList = (payload: unknown): OpportunityDocument[] => {
  const extractItems = (): unknown[] => {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (typeof payload === "object") {
      const record = payload as { documents?: unknown; data?: unknown };
      if (Array.isArray(record.documents)) return record.documents;
      if (Array.isArray(record.data)) return record.data;
    }
    return [];
  };

  return extractItems()
    .map((item) => parseOpportunityDocument(item))
    .filter((item): item is OpportunityDocument => Boolean(item));
};

export const extractOpportunityDocument = (payload: unknown): OpportunityDocument | null => {
  const direct = parseOpportunityDocument(payload);
  if (direct) return direct;

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const parsed = parseOpportunityDocument(item);
      if (parsed) return parsed;
    }
    return null;
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;

    if (record.document) {
      const parsed = extractOpportunityDocument(record.document);
      if (parsed) return parsed;
    }

    if (record.data) {
      const parsed = extractOpportunityDocument(record.data);
      if (parsed) return parsed;
    }

    if (record.result) {
      const parsed = extractOpportunityDocument(record.result);
      if (parsed) return parsed;
    }

    if (Array.isArray(record.documents)) {
      const documents = parseOpportunityDocumentsList(record.documents);
      if (documents.length > 0) {
        return documents[0];
      }
    }
  }

  return null;
};

