import { AUTH_TOKEN_KEY } from "../App";

export interface TemplateSummary {
  id: string;
  name: string;
  type: string;
  area: string;
  complexity: string;
  visibility: "PUBLIC" | "PRIVATE";
  updatedAt: string;
  preview?: string;
}

export interface TemplateDetail extends TemplateSummary {
  contentHtml: string;
  contentEditorJson: string;
  autoCreateClient: boolean;
  autoCreateProcess: boolean;
}

export interface VariableNode {
  label: string;
  value: string;
  children?: VariableNode[];
}

const baseUrl = (import.meta.env.BACKEND_URL ?? import.meta.env.VITE_BACKEND_URL ?? "http://localhost:3001").replace(/\/$/, "");
const API_BASE_URL = `${baseUrl}/api`;

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const headers = new Headers(options.headers ?? {});
  if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Erro na requisição para ${endpoint}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("Content-Type");
  if (contentType?.includes("application/json")) {
    return (await response.json()) as T;
  }

  return (await response.text()) as T;
}

export async function login(email: string, password: string): Promise<string> {
  try {
    const result = await request<{ token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    return result.token;
  } catch (error) {
    console.warn("Usando token mockado: ", error);
    // Como a autenticação é mock, geramos um token temporário para armazenar no localStorage.
    return `mock-token-${Date.now()}`;
  }
}

export async function getTemplates(): Promise<TemplateSummary[]> {
  return request<TemplateSummary[]>("/templates");
}

export async function getTemplateById(id: string): Promise<TemplateDetail> {
  return request<TemplateDetail>(`/templates/${id}`);
}

export async function getVariables(): Promise<VariableNode[]> {
  // Para adicionar mais variáveis ou namespaces, basta estender a resposta deste endpoint.
  return request<VariableNode[]>("/variables");
}

export interface SaveTemplatePayload {
  name: string;
  type: string;
  area: string;
  complexity: string;
  visibility: "PUBLIC" | "PRIVATE";
  autoCreateClient: boolean;
  autoCreateProcess: boolean;
  contentHtml: string;
  contentEditorJson: string;
}

export async function createTemplate(payload: SaveTemplatePayload): Promise<TemplateDetail> {
  return request<TemplateDetail>("/templates", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateTemplate(id: string, payload: Partial<SaveTemplatePayload>): Promise<TemplateDetail> {
  return request<TemplateDetail>(`/templates/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function renameTemplate(id: string, name: string): Promise<void> {
  await request(`/templates/${id}/rename`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export async function deleteTemplate(id: string): Promise<void> {
  await request(`/templates/${id}`, {
    method: "DELETE",
  });
}

export async function exportTemplate(id: string): Promise<void> {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const response = await fetch(`${API_BASE_URL}/templates/${id}/export`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!response.ok) {
    throw new Error("Falha ao exportar o modelo");
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `template-${id}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
