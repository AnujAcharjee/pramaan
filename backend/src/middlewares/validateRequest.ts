import type { Request, Response, NextFunction } from 'express';
import { ZodType, ZodError } from 'zod';
import { ValidationError } from '../utils/errorHandler.js';

export const validateRequest = (schema: ZodType) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
        headers: req.headers,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(new ValidationError(error.issues[0]?.message ?? 'Validation failed'));
        return;
      }

      next(new ValidationError('Invalid request data'));
    }
  };
};
