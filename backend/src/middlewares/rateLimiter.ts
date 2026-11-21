import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import redis from '../config/redis.js';

const createRedisStore = (prefix: string) =>
  new RedisStore({
    sendCommand: (command: string, ...args: string[]) =>
      redis.call(command, ...args) as Promise<RedisReply>,
    prefix: `rl:${prefix}:`,
  });

export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 signups per IP per hour
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  store: createRedisStore('signup'),

  message: {
    success: false,
    message: 'Too many signup attempts, please try again later',
  },

  // Count ALL attempts (success + failure)
  skipSuccessfulRequests: false,

  keyGenerator: (req) => {
    const email = req.body?.email;
    if (email) {
      return String(email).toLowerCase();
    }
    return ipKeyGenerator(req.ip ?? '');
  },
});

export const signinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('signin'),

  message: {
    success: false,
    message: 'Too many login attempts, please try again later',
  },

  skipSuccessfulRequests: true, // Only count failed attempts

  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
});

export const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  store: createRedisStore('forgot'),
  message: {
    success: false,
    message: 'Too many password reset attempts, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,

  // Count ALL attempts
  skipSuccessfulRequests: false,

  keyGenerator: (req) => {
    const email = req.body?.email;
    if (email) {
      return String(email).toLowerCase();
    }
    return ipKeyGenerator(req.ip ?? '');
  },
});

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  store: createRedisStore('api'),
  message: {
    success: false,
    message: 'Too many requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const emailVerificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  store: createRedisStore('email-verify'),
  message: {
    success: false,
    message: 'Too many verification attempts, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => (req.query.token as string) || ipKeyGenerator(req.ip ?? ''),
});
