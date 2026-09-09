import { z } from 'zod';
import 'dotenv/config';
import { parseDnsServers } from '../utils/dns.js';

// const isProd = process.env.NODE_ENV === 'production';
const isDev = process.env.NODE_ENV === 'development';

const numberFromString = (name: string) =>
  z
    .string({ error: `${name} is required` })
    .transform((v) => Number(v))
    .refine((v) => Number.isFinite(v), {
      message: `${name} must be a valid number`,
    });

const port = (name: string) =>
  numberFromString(name).refine((n) => n >= 1024 && n <= 65535, {
    message: `${name} must be between 1024 and 65535`,
  });

const seconds = (name: string) =>
  numberFromString(name)
    .refine((n) => Number.isInteger(n), {
      message: `${name} must be an integer`,
    })
    .refine((n) => n > 0, {
      message: `${name} must be greater than 0`,
    });

// const booleanFromString = (name: string) =>
//   z
//     .string({ error: `${name} is required` })
//     .transform((v) => v.trim().toLowerCase())
//     .refine((v) => v === 'true' || v === 'false', {
//       message: `${name} must be true or false`,
//     })
//     .transform((v) => v === 'true');

const url = (name: string) =>
  z.url({
    message: `${name} must be a valid URL`,
  });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test'], {
    error: 'NODE_ENV is invalid or missing',
  }),

  PORT: port('PORT'),

  LOGTAIL_SOURCE_TOKEN: z
    .string({ error: 'LOGTAIL_SOURCE_TOKEN is required' })
    .min(1, 'LOGTAIL_SOURCE_TOKEN cannot be empty'),

  APP_NAME: isDev ? z.string().optional().default('Pramaan') : z.string(),
  APP_DOMAIN: z.string({ error: 'APP_DOMAIN is required' }).min(1, 'APP_DOMAIN cannot be empty'),
  APP_DOC_URL: url('APP_DOC_URL'),

  COOKIE_SECRET: z
    .string({ error: 'COOKIE_SECRET is required' })
    .min(32, 'COOKIE_SECRET must be at least 32 characters'),

  NEON_PG_DATABASE_URL: z.string({
    error: 'NEON_PG_DATABASE_URL is required',
  }),

  /* ---------------- Cloudinary ---------------- */
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  /* ---------------- Redis ---------------- */
  // REDIS_HOST: isDev ? z.string({ error: 'REDIS_HOST is required' }) : z.string().optional(),
  // REDIS_USERNAME: isDev ? z.string({ error: 'REDIS_USERNAME is required' }) : z.string().optional(),
  // REDIS_PORT: isDev ? port('REDIS_PORT') : port('REDIS_PORT').optional(),
  // REDIS_PASSWORD:
  //   isDev ?
  //     z.string({ error: 'REDIS_PASSWORD is required' })
  //   : z.string({ error: 'REDIS_PASSWORD is required' }),
  // REDIS_TLS_ENABLED: booleanFromString('REDIS_TLS_ENABLED').optional().default(true),

  REDIS_URL: isDev ? z.string({ error: 'REDIS_URL is required' }) : z.string().optional(),

  /* ---------------- SMTP ---------------- */
  // SMTP_HOST: isDev ? z.string().optional() : z.string(),
  // SMTP_PORT: isDev ? numberFromString('SMTP_PORT').optional() : numberFromString('SMTP_PORT'),
  // SMTP_USER: isDev ? z.string().optional() : z.string(),
  // SMTP_PASSWORD: isDev ? z.string().optional() : z.string(),
  // SMTP_FROM:
  //   isDev ?
  //     z.string().min(1, 'SMTP_FROM cannot be empty').optional()
  //   : z.string().min(1, 'SMTP_FROM cannot be empty'),

  /* ---------------- Resend API ---------------- */
  RESEND_API_KEY: z.string({ error: 'RESEND_API_KEY is required' }).min(1, 'RESEND_API_KEY cannot be empty'),
  EMAIL_FROM: z.string({ error: 'EMAIL_FROM is required' }).email('EMAIL_FROM must be a valid email address'),

  /* ---------------- Auth Expiries (seconds) ---------------- */
  ACTIVE_SESSION_EX: seconds('ACTIVE_SESSION_EX').refine((n) => n >= 10 * 60 && n <= 30 * 60, {
    message: 'ACTIVE_SESSION_EX must be between 10 and 30 minutes',
  }),

  IDENTITY_SESSION_EX: seconds('IDENTITY_SESSION_EX').refine(
    (n) => n >= 180 * 24 * 60 * 60 && n <= 360 * 24 * 60 * 60,
    { message: 'IDENTITY_SESSION_EX must be between 180 and 360 days' },
  ),

  EMAIL_VERIFICATION_TOKEN_EX: seconds('EMAIL_VERIFICATION_TOKEN_EX').refine((n) => n <= 24 * 60 * 60, {
    message: 'EMAIL_VERIFICATION_TOKEN_EX must be ≤ 24 hours',
  }),

  SIGN_IN_FAIL_COUNT_EX: seconds('SIGN_IN_FAIL_COUNT_EX'),

  SIGN_VERIFICATION_TOKEN_EX: seconds('SIGN_VERIFICATION_TOKEN_EX').refine((n) => n <= 24 * 60 * 60, {
    message: 'SIGN_VERIFICATION_TOKEN_EX must be ≤ 24 hours',
  }),

  SIGNIN_LOCK_UNTIL: seconds('SIGNIN_LOCK_UNTIL'),
  MAX_SIGNIN_FAILURES: seconds('MAX_SIGNIN_FAILURES'),
  RESET_PASSWORD_EX: seconds('RESET_PASSWORD_EX'),

  /* ---------------- OAuth ---------------- */
  AUTH_ISSUER: url('AUTH_ISSUER'),
  AUTH_CODE_EX: seconds('AUTH_CODE_EX'),
  AUTH_TOKENS_EX: z.string(),
  AUTH_REQUEST_EX: seconds('AUTH_REQUEST_EX'),

  KEY_ENC_SECRET: z.string().regex(/^[0-9a-f]{64}$/, {
    message: 'KEY_ENC_SECRET must be exactly 32 bytes (64 hex characters)',
  }),

  /* ---------------- Cache ---------------- */
  PROFILE_CACHE_EX: seconds('PROFILE_CACHE_EX'),
  CLIENT_CACHE_EX: seconds('CLIENT_CACHE_EX'),

  CLIENT_SECRET_KEY:
    isDev ?
      z.string({
        error: 'CLIENT_SECRET_KEY is required',
      })
    : z
        .string({
          error: 'CLIENT_SECRET_KEY is required',
        })
        .min(32, 'CLIENT_SECRET_KEY must be at least 32 characters'),

  /* ---------------- DNS Verification ---------------- */
  PRAMAAN_DNS_SERVERS: z
    .string()
    .optional()
    .default('')
    .transform((v) => parseDnsServers(v)),
});
// .superRefine((env, ctx) => {
//   if (env.NODE_ENV === 'production') {
//     const requiredSMTP: (keyof typeof env)[] = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD'];

//     for (const key of requiredSMTP) {
//       if (!env[key]) {
//         ctx.addIssue({
//           code: 'custom',
//           path: [key],
//           message: `${key} is required in production`,
//         });
//       }
//     }
//   }
// });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('\n❌ Environment validation failed:\n');

  for (const issue of parsed.error.issues) {
    const path = issue.path.join('.') || 'root';
    console.error(`• ${path}: ${issue.message}`);
  }

  process.exit(1);
}

export const ENV = parsed.data;
