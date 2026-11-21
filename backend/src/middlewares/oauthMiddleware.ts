import type { Request, Response, NextFunction } from 'express';
import { AuthorizeParamsType, oauthService } from '../services/oauth.service.js';

export class OAuthMiddleware {
  private constructor() {}

  static async validateAndCacheReq(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await oauthService.validateAndCacheAuthorizeRequest(req.query as AuthorizeParamsType, req.requestId);

      next();
    } catch (error) {
      next(error);
    }
  }
}
