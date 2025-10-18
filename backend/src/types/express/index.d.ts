import type { TokenPayload } from '../../utils/tokenUtils';

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: number;
        email?: string;
        payload: TokenPayload;
        modules?: string[];
      };
    }
  }
}

declare module 'express-serve-static-core' {
  interface Request extends Express.Request {}
}

export {};
