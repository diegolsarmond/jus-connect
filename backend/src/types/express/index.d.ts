import 'express-serve-static-core';
import { TokenPayload } from '../../utils/tokenUtils';

declare module 'express-serve-static-core' {
  interface Request {
    auth?: {
      userId: number;
      email?: string;
      payload: TokenPayload;
    };
  }
}
