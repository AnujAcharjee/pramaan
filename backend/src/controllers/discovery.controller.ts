import { BaseController } from './base.controller.js';
import type { Request, Response, NextFunction } from 'express';
import type { DiscoveryService } from '../services/discovery.service.js';

export class DiscoveryController extends BaseController {
  constructor(private discoveryService: DiscoveryService) {
    super();
  }

  getOpenIdConfiguration = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const config = this.discoveryService.getOpenIdConfiguration();
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.status(200).json(config);
    } catch (error) {
      next(error);
    }
  };
}
