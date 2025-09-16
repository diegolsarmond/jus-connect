import { Request, Response } from 'express';
import { Buffer } from 'node:buffer';
import SupportService, {
  CreateSupportMessageAttachmentInput,
  CreateSupportMessageInput,
  CreateSupportRequestInput,
  ListSupportRequestsOptions,
  SupportAttachmentFile,
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

function buildContentDisposition(filename: string): string {
  const fallback = filename
    .replace(/["\\\r\n]/g, '_')
    .replace(/[^\x20-\x7E]/g, '_');
  const safeFallback = fallback.length > 0 ? fallback : 'arquivo';
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${safeFallback}"; filename*=UTF-8''${encoded}`;
}

function parseMessageAttachments(payload: unknown): CreateSupportMessageAttachmentInput[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new ValidationError(`Attachment at index ${index} is invalid`);
    }

    const { filename, contentType, data, size } = item as {
      filename?: string;
      contentType?: string | null;
      data?: string;
      size?: number | null;
    };

    const normalizedFilename = typeof filename === 'string' ? filename.trim() : '';
    if (!normalizedFilename) {
      throw new ValidationError(`Attachment filename is required (index ${index})`);
    }

    if (typeof data !== 'string' || data.length === 0) {
      throw new ValidationError(`Attachment data is required for "${normalizedFilename}"`);
    }

    const base64Payload = data.includes(',') ? data.slice(data.indexOf(',') + 1) : data;

    let buffer: Buffer;
    try {
      buffer = Buffer.from(base64Payload, 'base64');
    } catch (error) {
      throw new ValidationError(`Attachment data for "${normalizedFilename}" is not valid base64`);
    }

    if (buffer.length === 0) {
      throw new ValidationError(`Attachment "${normalizedFilename}" is empty`);
    }

    const attachment: CreateSupportMessageAttachmentInput = {
      filename: normalizedFilename,
      contentType:
        typeof contentType === 'string' && contentType.trim().length > 0
          ? contentType.trim()
          : undefined,
      size:
        typeof size === 'number' && Number.isFinite(size)
          ? Math.max(0, Math.floor(size))
          : buffer.length,
      content: buffer,
    };

    return attachment;
  });
}

function sendAttachmentResponse(res: Response, attachment: SupportAttachmentFile) {
  const contentType =
    typeof attachment.contentType === 'string' && attachment.contentType.trim().length > 0
      ? attachment.contentType
      : 'application/octet-stream';

  res.setHeader('Content-Type', contentType);
  const length = attachment.fileSize ?? attachment.content.length;
  if (Number.isFinite(length)) {
    res.setHeader('Content-Length', String(length));
  }
  res.setHeader('Content-Disposition', buildContentDisposition(attachment.filename));
  res.setHeader('Cache-Control', 'private, max-age=0');

  return res.status(200).send(attachment.content);
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

export async function listSupportRequestMessages(req: Request, res: Response) {
  const requestId = parseIdParam(req.params.id);

  if (!requestId) {
    return res.status(400).json({ error: 'Invalid support request id' });
  }

  try {
    const messages = await supportService.listMessagesForRequest(requestId);
    if (messages === null) {
      return res.status(404).json({ error: 'Support request not found' });
    }
    return res.json({ items: messages });
  } catch (error) {
    console.error('Failed to list support request messages:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createSupportRequestMessage(req: Request, res: Response) {
  const requestId = parseIdParam(req.params.id);

  if (!requestId) {
    return res.status(400).json({ error: 'Invalid support request id' });
  }

  const { message, sender } = req.body as { message?: string; sender?: string };

  let attachments: CreateSupportMessageAttachmentInput[] = [];
  try {
    attachments = parseMessageAttachments((req.body as { attachments?: unknown }).attachments);
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Failed to parse support message attachments:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }

  const input: CreateSupportMessageInput = {
    message: typeof message === 'string' ? message : undefined,
    attachments,
  };

  if (typeof sender === 'string' && sender.trim()) {
    input.sender = sender.trim().toLowerCase() as CreateSupportMessageInput['sender'];
  }

  try {
    const created = await supportService.createMessage(requestId, input);
    if (!created) {
      return res.status(404).json({ error: 'Support request not found' });
    }
    return res.status(201).json(created);
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Failed to create support request message:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function downloadSupportRequestAttachment(req: Request, res: Response) {
  const messageId = parseIdParam(req.params.messageId);
  const attachmentId = parseIdParam(req.params.attachmentId);

  if (!messageId || !attachmentId) {
    return res.status(400).json({ error: 'Invalid attachment reference' });
  }

  try {
    const attachment = await supportService.getAttachment(messageId, attachmentId);
    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }
    return sendAttachmentResponse(res, attachment);
  } catch (error) {
    console.error('Failed to download support attachment:', error);
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
