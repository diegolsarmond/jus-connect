import { Request, Response } from 'express';
import WahaConfigService, {
  UpsertWahaConfigInput,
  ValidationError,
} from '../services/wahaConfigService';

const configService = new WahaConfigService();

function parseUpsertPayload(body: any): UpsertWahaConfigInput {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body must be an object');
  }
  return {
    baseUrl: typeof body.baseUrl === 'string' ? body.baseUrl : '',
    apiKey: typeof body.apiKey === 'string' ? body.apiKey : '',
    webhookSecret: typeof body.webhookSecret === 'string' ? body.webhookSecret : undefined,
    isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
  };
}

export async function getWahaConfigHandler(_req: Request, res: Response) {
  try {
    const config = await configService.getConfig();
    res.json(config ?? null);
  } catch (error) {
    console.error('Failed to load WAHA configuration', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateWahaConfigHandler(req: Request, res: Response) {
  try {
    const payload = parseUpsertPayload(req.body);
    const config = await configService.saveConfig(payload);
    res.json(config);
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Failed to save WAHA configuration', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
