import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const ensureRequestId = (req: Request, res: Response, next: NextFunction) => {
  req.requestId = (req.headers['x-request-id'] as string) || uuidv4();
  res.setHeader('X-Request-ID', req.requestId);
  next();
};
