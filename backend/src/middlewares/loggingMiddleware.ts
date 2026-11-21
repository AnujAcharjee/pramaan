import type { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger.js';
// import { ENV } from '../config/env.js';

const SENSITIVE_FIELDS = ['password', 'confirmPassword', 'token', 'secret'];

const sanitizeBody = (body: Record<string, unknown>) => {
  return Object.fromEntries(
    Object.entries(body).map(([key, value]) => [key, SENSITIVE_FIELDS.includes(key) ? '[REDACTED]' : value]),
  );
};

export const loggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // if (ENV.NODE_ENV === 'production') return next();
  if (req.path === '/health') return next(); // skip health check logs

  const startTime = Date.now();

  res.on('finish', () => {
    const logData = {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${Date.now() - startTime}ms`,
      userAgent: req.get('user-agent'),
      ip: req.ip,
      context: 'HttpRequest',
      userId: req.user?.id,
      query: Object.keys(req.query).length ? req.query : undefined,
      body: Object.keys(req.body || {}).length ? sanitizeBody(req.body) : undefined,
    };

    if (res.statusCode >= 400) {
      logger.error('Request failed', logData);
    } else {
      logger.info('Request completed', logData);
    }
  });

  next();
};
