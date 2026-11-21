import type { Role, Scope } from '../../utils/constant.js';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user: {
        id: string;
        roles: Role[];
      };
      client: {
        id: string;
        userId: string;
        scopes: Scope[];
      };
    }
  }
}
