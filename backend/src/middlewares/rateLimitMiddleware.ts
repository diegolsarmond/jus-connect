import { Request, Response, NextFunction } from 'express';

type RateLimitOptions = {
  /**
   * Intervalo de análise, em milissegundos.
   */
  windowMs: number;
  /**
   * Número máximo de tentativas permitidas por janela.
   */
  maxAttempts: number;
  /**
   * Função responsável por gerar a chave de identificação.
   * Se não fornecida, o endereço IP do requisitante será utilizado.
   */
  keyGenerator?: (req: Request) => string;
  /**
   * Mensagem devolvida quando o limite é atingido.
   */
  message?: string;
  /**
   * Permite customizar o comportamento quando o limite é atingido.
   */
  onLimitReached?: (details: { key: string; req: Request; remainingMs: number }) => void;
};

type RateLimitState = {
  count: number;
  expiresAt: number;
  notified: boolean;
};

const defaultMessage =
  'Muitas tentativas realizadas em sequência. Tente novamente em alguns instantes.';

export const createRateLimiter = ({
  windowMs,
  maxAttempts,
  keyGenerator,
  message = defaultMessage,
  onLimitReached,
}: RateLimitOptions) => {
  const attempts = new Map<string, RateLimitState>();

  const cleanupIfExpired = (key: string, now: number) => {
    const entry = attempts.get(key);
    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt <= now) {
      attempts.delete(key);
      return undefined;
    }

    return entry;
  };

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator ? keyGenerator(req) : req.ip || 'global';
    const now = Date.now();
    const expiresAt = now + windowMs;
    const retryAfterSeconds = (remainingMs: number) => Math.ceil(remainingMs / 1000);

    let entry = cleanupIfExpired(key, now);

    if (!entry) {
      attempts.set(key, { count: 1, expiresAt, notified: false });
      res.setHeader('X-RateLimit-Limit', String(maxAttempts));
      res.setHeader('X-RateLimit-Remaining', String(maxAttempts - 1));
      return next();
    }

    if (entry.count >= maxAttempts) {
      const remainingMs = entry.expiresAt - now;
      res.setHeader('Retry-After', String(retryAfterSeconds(remainingMs)));
      res.setHeader('X-RateLimit-Limit', String(maxAttempts));
      res.setHeader('X-RateLimit-Remaining', '0');

      if (!entry.notified) {
        entry.notified = true;
        const observer =
          onLimitReached ||
          ((details: { key: string; req: Request; remainingMs: number }) => {
            const { req: request, key: identifier } = details;
            console.warn(
              '[SECURITY] Limite de tentativas excedido',
              JSON.stringify({
                identifier,
                method: request.method,
                path: request.originalUrl,
                ip: request.ip,
                remainingMs: details.remainingMs,
              })
            );
          });

        observer({ key, req, remainingMs });
      }

      return res.status(429).json({ message });
    }

    entry.count += 1;
    attempts.set(key, entry);

    res.setHeader('X-RateLimit-Limit', String(maxAttempts));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(maxAttempts - entry.count, 0)));

    next();
  };
};

export default createRateLimiter;
