export interface EditorJsonNode {
  type: string;
  text?: string;
  attrs?: Record<string, string>;
  children?: EditorJsonNode[];
}

export type EditorJsonContent = EditorJsonNode[];

export interface TemplateMetadata {
  type: string;
  area: string;
  complexity: 'Baixa' | 'Média' | 'Alta' | string;
  autoCreateClient: boolean;
  autoCreateProcess: boolean;
  visibility: 'privado' | 'equipe' | 'publico' | string;
}

export interface TemplateDTO {
  id: number;
  title: string;
  content: string;
}

export interface Template extends TemplateDTO {
  content_html: string;
  content_editor_json: EditorJsonContent | null;
  metadata: TemplateMetadata;
}

export interface TemplatePayload {
  id?: number;
  title: string;
  content_html: string;
  content_editor_json: EditorJsonContent | null;
  metadata: TemplateMetadata;
}

export const defaultTemplateMetadata: TemplateMetadata = {
  type: 'Documento',
  area: 'Geral',
  complexity: 'Média',
  autoCreateClient: false,
  autoCreateProcess: false,
  visibility: 'privado',
};
