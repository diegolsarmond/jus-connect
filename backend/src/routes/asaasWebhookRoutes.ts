import { Router, type Request, type Response, type NextFunction } from 'express';
import { handleAsaasWebhook } from '../controllers/asaasIntegrationController';

const router = Router();

function normalizeIp(ip: string | null | undefined): string | null {
  if (!ip) {
    return null;
  }

  const trimmed = ip.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/^::ffff:/i, '');
}

function extractClientIp(req: Request): string | null {
  const forwardedFor = req.headers['x-forwarded-for'];

  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    const [first] = forwardedFor.split(',');
    const normalized = normalizeIp(first);
    if (normalized) {
      return normalized;
    }
  }

  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    const candidate = forwardedFor.find((item) => typeof item === 'string' && item.trim());
    const normalized = normalizeIp(candidate ?? undefined);
    if (normalized) {
      return normalized;
    }
  }

  const remoteAddress = req.socket?.remoteAddress ?? req.ip;
  return normalizeIp(remoteAddress ?? undefined);
}

function isIpAllowed(ip: string | null): boolean {
  if (!ip) {
    return false;
  }

  const rawList = process.env.ASAAS_WEBHOOK_ALLOWED_IPS ?? '';
  const allowedIps = rawList
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (allowedIps.length === 0) {
    return true;
  }

  return allowedIps.includes(ip);
}

function ensureAllowedIp(req: Request, res: Response, next: NextFunction) {
  const clientIp = extractClientIp(req);

  if (!isIpAllowed(clientIp)) {
    console.warn('[AsaasWebhook] Request blocked due to IP restriction', clientIp);
    return res.status(403).json({ error: 'Forbidden' });
  }

  next();
}

router.post('/integrations/asaas/webhook', ensureAllowedIp, handleAsaasWebhook);

export default router;

