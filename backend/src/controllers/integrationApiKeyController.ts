import { Request, Response } from 'express';
import IntegrationApiKeyService, {
  CreateIntegrationApiKeyInput,
  UpdateIntegrationApiKeyInput,
  ValidationError,
} from '../services/integrationApiKeyService';

const service = new IntegrationApiKeyService();

function parseIdParam(param: string): number | null {
  const value = Number(param);
  if (!Number.isInteger(value) || value <= 0) {
    return null;
  }
  return value;
}

function toOptionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
  }
  throw new ValidationError(`${field} must be a boolean value`);
}

function toOptionalDate(value: unknown, field: string): string | Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value instanceof Date || typeof value === 'string') {
    return value;
  }
  throw new ValidationError(`${field} must be a string, Date or null`);
}

function toOptionalString(value: unknown, field: string): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  throw new ValidationError(`${field} must be a string or null`);
}

export async function listIntegrationApiKeys(_req: Request, res: Response) {
  try {
    const items = await service.list();
    return res.json(items);
  } catch (error) {
    console.error('Failed to list integration API keys:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createIntegrationApiKey(req: Request, res: Response) {
  const { provider, apiUrl, key, environment, active, lastUsed } = req.body as {
    provider?: string;
    apiUrl?: unknown;
    key?: string;
    environment?: string;
    active?: unknown;
    lastUsed?: unknown;
  };

  const input: CreateIntegrationApiKeyInput = {
    provider: provider ?? '',
    key: key ?? '',
    environment: environment ?? '',
  };

  try {
    const parsedApiUrl = toOptionalString(apiUrl, 'apiUrl');
    if (parsedApiUrl !== undefined) {
      input.apiUrl = parsedApiUrl;
    }

    const parsedActive = toOptionalBoolean(active, 'active');
    if (parsedActive !== undefined) {
      input.active = parsedActive;
    }

    const parsedLastUsed = toOptionalDate(lastUsed, 'lastUsed');
    if (parsedLastUsed !== undefined) {
      input.lastUsed = parsedLastUsed;
    }

    const created = await service.create(input);
    return res.status(201).json(created);
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Failed to create integration API key:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateIntegrationApiKey(req: Request, res: Response) {
  const apiKeyId = parseIdParam(req.params.id);

  if (!apiKeyId) {
    return res.status(400).json({ error: 'Invalid API key id' });
  }

  const { provider, apiUrl, key, environment, active, lastUsed } = req.body as UpdateIntegrationApiKeyInput & {
    apiUrl?: unknown;
    active?: unknown;
    lastUsed?: unknown;
  };

  const updates: UpdateIntegrationApiKeyInput = {};

  if (provider !== undefined) {
    updates.provider = provider;
  }
  if (key !== undefined) {
    updates.key = key;
  }
  if (environment !== undefined) {
    updates.environment = environment;
  }

  try {
    if (apiUrl !== undefined) {
      updates.apiUrl = toOptionalString(apiUrl, 'apiUrl') ?? null;
    }

    const parsedActive = toOptionalBoolean(active, 'active');
    if (parsedActive !== undefined) {
      updates.active = parsedActive;
    }

    const parsedLastUsed = toOptionalDate(lastUsed, 'lastUsed');
    if (parsedLastUsed !== undefined) {
      updates.lastUsed = parsedLastUsed;
    }

    const updated = await service.update(apiKeyId, updates);
    if (!updated) {
      return res.status(404).json({ error: 'API key not found' });
    }
    return res.json(updated);
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Failed to update integration API key:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteIntegrationApiKey(req: Request, res: Response) {
  const apiKeyId = parseIdParam(req.params.id);

  if (!apiKeyId) {
    return res.status(400).json({ error: 'Invalid API key id' });
  }

  try {
    const deleted = await service.delete(apiKeyId);
    if (!deleted) {
      return res.status(404).json({ error: 'API key not found' });
    }
    return res.status(204).send();
  } catch (error) {
    console.error('Failed to delete integration API key:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
