import { getApiUrl } from './api';

export interface IntegrationWebhook {
  id: number;
  name: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  lastDelivery: string | null;
  empresaId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIntegrationWebhookPayload {
  name: string;
  url: string;
  events: string[];
  secret: string;
  active?: boolean;
}

export interface UpdateIntegrationWebhookStatusPayload {
  active: boolean;
}

export interface UpdateIntegrationWebhookPayload {
  name?: string;
  url?: string;
  events?: string[];
  secret?: string;
  active?: boolean;
}

const WEBHOOKS_ENDPOINT = getApiUrl('integrations/webhooks');

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const payload = await response.json();
    if (payload && typeof payload === 'object' && 'error' in payload) {
      const { error } = payload as { error?: unknown };
      if (typeof error === 'string' && error.trim()) {
        return error;
      }
    }
  } catch (error) {}

  return `Falha na requisição (status ${response.status})`;
}

export async function fetchIntegrationWebhooks(): Promise<IntegrationWebhook[]> {
  const response = await fetch(WEBHOOKS_ENDPOINT, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as IntegrationWebhook[];
}

export async function createIntegrationWebhook(
  payload: CreateIntegrationWebhookPayload,
): Promise<IntegrationWebhook> {
  const response = await fetch(WEBHOOKS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as IntegrationWebhook;
}

export async function updateIntegrationWebhookStatus(
  id: number,
  payload: UpdateIntegrationWebhookStatusPayload,
): Promise<IntegrationWebhook> {
  const response = await fetch(`${WEBHOOKS_ENDPOINT}/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as IntegrationWebhook;
}

export async function updateIntegrationWebhook(
  id: number,
  payload: UpdateIntegrationWebhookPayload,
): Promise<IntegrationWebhook> {
  const response = await fetch(`${WEBHOOKS_ENDPOINT}/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as IntegrationWebhook;
}

export async function deleteIntegrationWebhook(id: number): Promise<void> {
  const response = await fetch(`${WEBHOOKS_ENDPOINT}/${id}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
}

export const fetchWebhooks = fetchIntegrationWebhooks;
export const createWebhook = createIntegrationWebhook;
export const updateWebhook = updateIntegrationWebhook;
export const updateWebhookStatus = updateIntegrationWebhookStatus;
export const deleteWebhook = deleteIntegrationWebhook;
