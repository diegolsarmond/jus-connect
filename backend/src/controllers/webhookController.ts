import { Request, Response } from 'express';
import WebhookService, { ValidationError } from '../services/webhookService';
import { fetchAuthenticatedUserEmpresa } from '../utils/authUser';
import { buildErrorResponse } from '../utils/errorResponse';

const service = new WebhookService();

async function resolveEmpresaId(req: Request, res: Response): Promise<number | null> {
  if (!req.auth) {
    res.status(401).json({ error: 'Token inválido.' });
    return null;
  }

  try {
    const lookup = await fetchAuthenticatedUserEmpresa(req.auth.userId);

    if (!lookup.success) {
      res.status(lookup.status).json({ error: lookup.message });
      return null;
    }

    if (lookup.empresaId === null) {
      res.status(400).json({ error: 'Usuário não está vinculado a uma empresa.' });
      return null;
    }

    return lookup.empresaId;
  } catch (error) {
    console.error('Failed to resolve authenticated user empresa:', error);
    res.status(500).json({ error: 'Internal server error' });
    return null;
  }
}

function parseIdParam(param: string): number | null {
  const value = Number(param);
  if (!Number.isInteger(value) || value <= 0) {
    return null;
  }
  return value;
}

function parseActiveValue(value: unknown): boolean {
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
  throw new ValidationError('Campo active deve ser um valor booleano.');
}

const normalizeEventsInput = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item));
};

export async function listIntegrationWebhooks(req: Request, res: Response) {
  const empresaId = await resolveEmpresaId(req, res);
  if (empresaId === null) {
    return;
  }

  try {
    const items = await service.listByEmpresa(empresaId);
    return res.json(items);
  } catch (error) {
    console.error('Failed to list integration webhooks:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createIntegrationWebhook(req: Request, res: Response) {
  const empresaId = await resolveEmpresaId(req, res);
  if (empresaId === null) {
    return;
  }

  const { name, url, events, secret, active } = req.body as {
    name?: string;
    url?: string;
    events?: unknown;
    secret?: string;
    active?: unknown;
  };

  try {
    const created = await service.create({
      name: name ?? '',
      url: url ?? '',
      events: normalizeEventsInput(events),
      secret: secret ?? '',
      empresaId,
      active: active === undefined ? undefined : parseActiveValue(active),
    });

    return res.status(201).json(created);
  } catch (error) {
    if (error instanceof ValidationError) {
      return res
        .status(400)
        .json(buildErrorResponse(error, 'Não foi possível cadastrar o webhook.', { expose: true }));
    }
    console.error('Failed to create integration webhook:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateIntegrationWebhook(req: Request, res: Response) {
  const webhookId = parseIdParam(req.params.id);

  if (!webhookId) {
    return res.status(400).json({ error: 'Invalid webhook id' });
  }

  const empresaId = await resolveEmpresaId(req, res);
  if (empresaId === null) {
    return;
  }

  const { name, url, events, secret, active } = req.body as {
    name?: string;
    url?: string;
    events?: unknown;
    secret?: string;
    active?: unknown;
  };

  try {
    const parsedActive = active === undefined ? undefined : parseActiveValue(active);
    const updated = await service.update(webhookId, empresaId, {
      name,
      url,
      events: normalizeEventsInput(events),
      secret,
      active: parsedActive,
    });

    if (!updated) {
      return res.status(404).json({ error: 'Webhook não encontrado' });
    }

    return res.json(updated);
  } catch (error) {
    if (error instanceof ValidationError) {
      return res
        .status(400)
        .json(buildErrorResponse(error, 'Não foi possível atualizar o webhook.', { expose: true }));
    }
    console.error('Failed to update integration webhook:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateIntegrationWebhookStatus(req: Request, res: Response) {
  const webhookId = parseIdParam(req.params.id);

  if (!webhookId) {
    return res.status(400).json({ error: 'Invalid webhook id' });
  }

  const empresaId = await resolveEmpresaId(req, res);
  if (empresaId === null) {
    return;
  }

  const { active } = req.body as { active?: unknown };

  try {
    const parsedActive = parseActiveValue(active);
    const updated = await service.updateStatus(webhookId, empresaId, parsedActive);

    if (!updated) {
      return res.status(404).json({ error: 'Webhook não encontrado' });
    }

    return res.json(updated);
  } catch (error) {
    if (error instanceof ValidationError) {
      return res
        .status(400)
        .json(buildErrorResponse(error, 'Não foi possível atualizar o webhook.', { expose: true }));
    }
    console.error('Failed to update integration webhook:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteIntegrationWebhook(req: Request, res: Response) {
  const webhookId = parseIdParam(req.params.id);

  if (!webhookId) {
    return res.status(400).json({ error: 'Invalid webhook id' });
  }

  const empresaId = await resolveEmpresaId(req, res);
  if (empresaId === null) {
    return;
  }

  try {
    const deleted = await service.delete(webhookId, empresaId);

    if (!deleted) {
      return res.status(404).json({ error: 'Webhook não encontrado' });
    }

    return res.status(204).send();
  } catch (error) {
    console.error('Failed to delete integration webhook:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
