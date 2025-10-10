import { getApiUrl } from './api';
import type {
  EditorJsonContent,
  Template,
  TemplateDTO,
  TemplateMetadata,
  TemplatePayload,
} from '@/types/templates';
import { defaultTemplateMetadata } from '@/types/templates';

function normalizeMetadata(input: Partial<TemplateMetadata> | null | undefined): TemplateMetadata {
  return {
    type: input?.type ?? defaultTemplateMetadata.type,
    area: input?.area ?? defaultTemplateMetadata.area,
    complexity: (input?.complexity as TemplateMetadata['complexity']) ?? defaultTemplateMetadata.complexity,
    autoCreateClient: Boolean(input?.autoCreateClient),
    autoCreateProcess: Boolean(input?.autoCreateProcess),
    visibility: input?.visibility ?? defaultTemplateMetadata.visibility,
  };
}

function isEditorJsonNode(value: unknown): value is EditorJsonContent[number] {
  return (
    !!value &&
    typeof value === 'object' &&
    'type' in (value as Record<string, unknown>) &&
    typeof (value as { type?: unknown }).type === 'string'
  );
}

function ensureJsonContent(value: unknown): EditorJsonContent | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    return value.filter(isEditorJsonNode) as EditorJsonContent;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return ensureJsonContent(parsed);
    } catch (error) {
      console.warn('Failed to parse editor JSON content', error);
      return null;
    }
  }
  if (typeof value === 'object') {
    const maybeArray = (value as { nodes?: unknown }).nodes;
    if (Array.isArray(maybeArray)) {
      return ensureJsonContent(maybeArray);
    }
  }
  return null;
}

function pickFirstNonEmpty(...values: Array<unknown>): string {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }
  return '';
}

export function parseTemplate(dto: TemplateDTO): Template {
  const rawContent = dto.content ?? '';
  let contentHtml = rawContent || '<p></p>';
  let contentJson: EditorJsonContent | null = null;
  let metadata = defaultTemplateMetadata;
  let title = pickFirstNonEmpty(dto.title);

  if (rawContent) {
    try {
      const parsed = JSON.parse(rawContent) as {
        content_html?: string;
        content_editor_json?: unknown;
        metadata?: Partial<TemplateMetadata>;
        title?: unknown;
        nome?: unknown;
      };
      contentHtml = parsed?.content_html ?? contentHtml;
      contentJson = ensureJsonContent(parsed?.content_editor_json);
      metadata = normalizeMetadata(parsed?.metadata);
      title = pickFirstNonEmpty(
        title,
        parsed?.title,
        parsed?.nome,
        (parsed?.metadata as { title?: unknown } | undefined)?.title,
        (parsed?.metadata as { nome?: unknown } | undefined)?.nome,
      );
    } catch (error) {
      console.info('Template content stored as raw HTML. Using fallback format.');
    }
  }

  return {
    id: dto.id,
    title,
    content: rawContent,
    content_html: contentHtml,
    content_editor_json: contentJson,
    metadata,
  };
}

function serializeTemplatePayload(payload: TemplatePayload): Partial<TemplateDTO> {
  const serialized = {
    content_html: payload.content_html,
    content_editor_json: payload.content_editor_json,
    metadata: normalizeMetadata(payload.metadata),
  };

  return {
    title: payload.title,
    content: JSON.stringify(serialized),
  };
}

export async function fetchTemplates(): Promise<Template[]> {
  const res = await fetch(getApiUrl('templates'));
  const data = (await res.json()) as TemplateDTO[];
  return data.map(parseTemplate);
}

export async function getTemplate(id: number): Promise<Template> {
  const res = await fetch(getApiUrl(`templates/${id}`));
  const data = (await res.json()) as TemplateDTO;
  return parseTemplate(data);
}

export async function createTemplate(template: TemplatePayload): Promise<Template> {
  const res = await fetch(getApiUrl('templates'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(serializeTemplatePayload(template)),
  });
  const data = (await res.json()) as TemplateDTO;
  return parseTemplate(data);
}

export async function updateTemplate(id: number, template: TemplatePayload): Promise<Template> {
  const res = await fetch(getApiUrl(`templates/${id}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(serializeTemplatePayload(template)),
  });
  const data = (await res.json()) as TemplateDTO;
  return parseTemplate(data);
}

export async function deleteTemplate(id: number): Promise<void> {
  await fetch(getApiUrl(`templates/${id}`), { method: 'DELETE' });
}

export async function fetchTags(): Promise<Tag[]> {
  const res = await fetch(getApiUrl('tags'));
  return res.json();
}

export interface Tag {
  id: number;
  key: string;
  label: string;
  example?: string;
  group_name?: string;
}

export async function generateWithAI(id: number): Promise<string> {
  const res = await fetch(getApiUrl(`templates/${id}/generate`), { method: 'POST' });
  const data = await res.json();
  return data.content;
}

export async function generateDocument(templateId: number, values: Record<string, string>): Promise<string> {
  const res = await fetch(getApiUrl('documents/generate'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ templateId, values }),
  });
  const data = await res.json();
  return data.content;
}

export async function exportTemplatePdf(id: number): Promise<Blob> {
  const res = await fetch(getApiUrl(`templates/${id}/export`));
  if (!res.ok) {
    throw new Error('Não foi possível exportar o template.');
  }
  return res.blob();
}
