import { BaseController } from './base.controller.js';
import type { Request, Response, NextFunction } from 'express';
import type { JoseService } from '../services/jose.service.js';

export class JoseController extends BaseController {
  constructor(private joseService: JoseService) {
    super();
  }

  getJwks = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const jwks = await this.joseService.getJwks();
      res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
      res.status(200).json({ keys: jwks.keys });
    } catch (error) {
      next(error);
    }
  };
}
