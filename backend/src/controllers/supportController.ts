import { Request, Response } from 'express';
import SupportService, {
  CreateSupportRequestInput,
  ListSupportRequestsOptions,
  SupportStatus,
  UpdateSupportRequestInput,
  ValidationError,
} from '../services/supportService';

const supportService = new SupportService();

function parseIdParam(param: string): number | null {
  const value = Number(param);
  if (!Number.isInteger(value) || value <= 0) {
    return null;
  }
  return value;
}

function extractStatus(value: unknown): SupportStatus | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  return normalized ? (normalized as SupportStatus) : undefined;
}

export async function createSupportRequest(req: Request, res: Response) {
  const { subject, description, requesterName, requesterEmail, status } = req.body as {
    subject?: string;
    description?: string;
    requesterName?: string | null;
    requesterEmail?: string | null;
    status?: string;
  };

  const input: CreateSupportRequestInput = {
    subject: subject ?? '',
    description: description ?? '',
    requesterName: requesterName ?? undefined,
    requesterEmail: requesterEmail ?? undefined,
  };

  if (typeof status === 'string' && status.trim()) {
    input.status = status.trim().toLowerCase() as SupportStatus;
  }

  try {
    const request = await supportService.create(input);
    return res.status(201).json(request);
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Failed to create support request:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function listSupportRequests(req: Request, res: Response) {
  const options: ListSupportRequestsOptions = {};

  const pageParam = req.query.page;
  const pageSizeParam = req.query.pageSize ?? req.query.limit; // allow limit alias

  if (typeof pageParam === 'string') {
    const parsed = Number(pageParam);
    if (Number.isFinite(parsed) && parsed > 0) {
      options.page = Math.floor(parsed);
    } else {
      return res.status(400).json({ error: 'Invalid page parameter' });
    }
  }

  if (typeof pageSizeParam === 'string') {
    const parsed = Number(pageSizeParam);
    if (Number.isFinite(parsed) && parsed > 0) {
      options.pageSize = Math.floor(parsed);
    } else {
      return res.status(400).json({ error: 'Invalid pageSize parameter' });
    }
  }

  const statusFilter = extractStatus(req.query.status);
  if (statusFilter) {
    options.status = statusFilter;
  }

  if (typeof req.query.search === 'string') {
    options.search = req.query.search;
  }

  try {
    const result = await supportService.list(options);
    return res.json(result);
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Failed to list support requests:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getSupportRequest(req: Request, res: Response) {
  const requestId = parseIdParam(req.params.id);

  if (!requestId) {
    return res.status(400).json({ error: 'Invalid support request id' });
  }

  try {
    const request = await supportService.findById(requestId);
    if (!request) {
      return res.status(404).json({ error: 'Support request not found' });
    }
    return res.json(request);
  } catch (error) {
    console.error('Failed to fetch support request:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateSupportRequest(req: Request, res: Response) {
  const requestId = parseIdParam(req.params.id);

  if (!requestId) {
    return res.status(400).json({ error: 'Invalid support request id' });
  }

  const { subject, description, requesterName, requesterEmail, status } = req.body as UpdateSupportRequestInput & {
    status?: string;
  };

  const updates: UpdateSupportRequestInput = {};

  if (subject !== undefined) {
    updates.subject = subject;
  }
  if (description !== undefined) {
    updates.description = description;
  }
  if (requesterName !== undefined) {
    updates.requesterName = requesterName;
  }
  if (requesterEmail !== undefined) {
    updates.requesterEmail = requesterEmail;
  }
  if (typeof status === 'string' && status.trim()) {
    updates.status = status.trim().toLowerCase() as SupportStatus;
  }

  try {
    const updated = await supportService.update(requestId, updates);
    if (!updated) {
      return res.status(404).json({ error: 'Support request not found' });
    }
    return res.json(updated);
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Failed to update support request:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
