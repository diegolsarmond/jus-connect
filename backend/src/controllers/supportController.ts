import { Request, Response } from 'express';

interface SupportRequest {
  id: number;
  subject: string;
  description: string;
  createdAt: string;
}

const supportRequests: SupportRequest[] = [];

export function createSupportRequest(req: Request, res: Response) {
  const { subject, description } = req.body as {
    subject?: string;
    description?: string;
  };
  if (!subject || !description) {
    return res.status(400).json({ message: 'Subject and description are required' });
  }
  const request: SupportRequest = {
    id: supportRequests.length + 1,
    subject,
    description,
    createdAt: new Date().toISOString(),
  };
  supportRequests.push(request);
  return res.status(201).json(request);
}
