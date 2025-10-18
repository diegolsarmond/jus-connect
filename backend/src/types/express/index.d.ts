declare global {
  namespace Express {
    interface SupabaseTokenPayload extends Record<string, unknown> {
      sub: string;
      iss?: string;
      aud?: string | string[];
      exp?: number;
      email?: string;
      name?: string;
    }

    interface Request {
      auth?: {
        userId: number;
        email?: string;
        payload: SupabaseTokenPayload;
        modules?: string[];
        supabaseUserId: string;
      };
    }

    interface Locals {
      empresaId?: number;
    }
  }
}

declare module 'express-serve-static-core' {
  interface Request extends Express.Request {}
}

export {};
