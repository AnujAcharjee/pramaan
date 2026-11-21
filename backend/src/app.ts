import express, { type Express, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import ejsMate from 'ejs-mate';
import methodOverride from 'method-override';

import { ENV } from './config/env.js';
import { errorMiddleware } from './middlewares/errorMiddleware.js';
import { notFoundHandler } from './middlewares/notFound.js';
import { loggingMiddleware } from './middlewares/loggingMiddleware.js';
import { setupSecurityHeaders } from './middlewares/securityHeaders.js';
import { ensureRequestId } from './middlewares/requestId.js';
import { apiLimiter } from './middlewares/rateLimiter.js';
import { appCors } from './middlewares/corsMiddleware.js';
import apiRouter from './routes/api/index.js';
import webRouter from './routes/web/index.js';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve views directory regardless of root or backend cwd
const viewsDir = fs.existsSync(path.resolve(__dirname, 'views'))
  ? path.resolve(__dirname, 'views')
  : fs.existsSync(path.join(process.cwd(), 'src', 'views'))
    ? path.join(process.cwd(), 'src', 'views')
    : path.join(process.cwd(), 'backend', 'src', 'views');

const publicDir = fs.existsSync(path.resolve(__dirname, '..', 'public'))
  ? path.resolve(__dirname, '..', 'public')
  : fs.existsSync(path.join(process.cwd(), 'public'))
    ? path.join(process.cwd(), 'public')
    : path.join(process.cwd(), 'backend', 'public');

// ejs setup
app.engine('ejs', ejsMate);
app.set('view engine', 'ejs');
app.set('views', viewsDir);
app.set('view cache', ENV.NODE_ENV === 'production');

// Trust the first proxy in front of the app (e.g. Nginx, Caddy, load balancer, Docker)
// This is required so Express correctly reads the real client IP from
// X-Forwarded-For headers, which is critical for rate limiting, logging, and security controls.
app.set('trust proxy', 1);

const setupMiddleware = (app: express.Application) => {
  // CORS
  app.use(appCors);

  // Security
  setupSecurityHeaders(app as Express);
  app.use(ensureRequestId);

  // Performance
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser(ENV.COOKIE_SECRET));
  app.use(
    express.static(publicDir, {
      maxAge: ENV.NODE_ENV === 'production' ? '7d' : 0,
      etag: true,
      lastModified: true,
    }),
  );
  app.use(methodOverride('_method'));

  // Monitoring
  app.use(loggingMiddleware);

  // Rate Limiting
  app.use('/api', (req, res, next) => {
    if (req.path.startsWith('/auth')) return next();
    return apiLimiter(req, res, next);
  });
};

setupMiddleware(app);

// Health Check
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).send('OK');
});

// Routes
app.use('/', webRouter);
app.use('/', apiRouter);

// 404 handler
app.use(notFoundHandler);

// Global Error Handler
app.use(errorMiddleware);

export default app;
