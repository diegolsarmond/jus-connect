import { Request, Response } from 'express';

export const upload = async (_req: Request, res: Response) => {
  // Stub implementation for uploads. In a real scenario, this would upload to S3/MinIO.
  res.json({ key: 'stub', url: 'https://example.com/stub', name: 'file', size: 0 });
};
