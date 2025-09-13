export interface Template {
  id: number;
  title: string;
  content: string;
}

export interface Tag {
  id: number;
  key: string;
  label: string;
  example?: string;
  group_name?: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export async function fetchTemplates(): Promise<Template[]> {
  const res = await fetch(`${API_URL}/templates`);
  return res.json();
}

export async function getTemplate(id: number): Promise<Template> {
  const res = await fetch(`${API_URL}/templates/${id}`);
  return res.json();
}

export async function createTemplate(template: Partial<Template>): Promise<Template> {
  const res = await fetch(`${API_URL}/templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(template),
  });
  return res.json();
}

export async function updateTemplate(id: number, template: Partial<Template>): Promise<Template> {
  const res = await fetch(`${API_URL}/templates/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(template),
  });
  return res.json();
}

export async function deleteTemplate(id: number): Promise<void> {
  await fetch(`${API_URL}/templates/${id}`, { method: 'DELETE' });
}

export async function fetchTags(): Promise<Tag[]> {
  const res = await fetch(`${API_URL}/tags`);
  return res.json();
}

export async function generateWithAI(id: number): Promise<string> {
  const res = await fetch(`${API_URL}/templates/${id}/generate`, { method: 'POST' });
  const data = await res.json();
  return data.content;
}

export async function generateDocument(templateId: number, values: Record<string, string>): Promise<string> {
  const res = await fetch(`${API_URL}/documents/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ templateId, values }),
  });
  const data = await res.json();
  return data.content;
}
