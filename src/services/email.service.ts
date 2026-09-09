import { Resend } from 'resend';
import { SERVER_URL } from '../utils/constant.js';
import { ENV } from '../config/env.js';
import { logger } from '../config/logger.js';
import redis from '../config/redis.js';
import { AppError } from '../utils/appError.js';
import { ErrorCode } from '../utils/errorCodes.js';
import {
  getEmailVerificationTemplate,
  getPasswordResetEmailTemplate,
  getSignInVerificationTemplate,
} from '../templates/email/index.js';
import { AuthenticationFlow } from './auth.service.js';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

// Resend error shape from the SDK
interface ResendErrorResponse {
  statusCode?: number;
  message?: string;
  name?: string;
}

// -----------------------
// BOUNCE REDIS KEYS
// -----------------------
// Tracks hard-bounced emails for 30 days so we never re-send to them.
// Tracks soft-bounce counts; after 3 soft bounces within a window we treat it as hard.
const BOUNCE_KEY_PREFIX = 'email:bounce:';
const SOFT_BOUNCE_KEY_PREFIX = 'email:softbounce:';
const HARD_BOUNCE_TTL = 30 * 24 * 60 * 60; // 30 days
const SOFT_BOUNCE_TTL = 24 * 60 * 60;       // 24-hour window for counting
const MAX_SOFT_BOUNCES = 3;

class EmailService {
  private resend!: Resend;
  private readonly fromAddress: string;
  private initialized = false;

  constructor() {
    logger.info('Using Resend API', {
      context: 'EmailService.constructor',
    });

    this.fromAddress = ENV.EMAIL_FROM ?? 'no-reply@yourdomain.com';
    this.precompileTemplates();
  }

  async init() {
    if (this.initialized) return;

    this.resend = new Resend(ENV.RESEND_API_KEY);

    logger.info('Resend initialized');
    this.initialized = true;
  }

  private precompileTemplates() {
    try {
      getEmailVerificationTemplate('test', 'test');
      getPasswordResetEmailTemplate('test', 'test');
      getSignInVerificationTemplate('test', 'test');

      logger.info('Email templates precompiled successfully');
    } catch (error) {
      logger.error('Failed to precompile email templates', { error });
    }
  }

  // -----------------------
  // REDIS RATE LIMIT
  // -----------------------
  private async checkRateLimit(key: string, limitSeconds = 3600) {
    const redisKey = `email:rate:${key}`;

    const exists = await redis.get(redisKey);

    if (exists) {
      throw new AppError(
        'Please wait before requesting another email.',
        429,
        ErrorCode.RATE_LIMITED,
      );
    }

    await redis.set(redisKey, '1', 'EX', limitSeconds);
  }

  // -----------------------
  // BOUNCE MANAGEMENT
  // -----------------------

  /**
   * Check if an email is hard-bounced (blocked from sending).
   */
  private async isHardBounced(email: string): Promise<boolean> {
    const key = `${BOUNCE_KEY_PREFIX}${email.toLowerCase()}`;
    const exists = await redis.exists(key);
    return exists === 1;
  }

  /**
   * Mark an email as hard-bounced. No emails will be sent to this
   * address for the TTL duration (30 days).
   */
  private async markHardBounce(email: string): Promise<void> {
    const key = `${BOUNCE_KEY_PREFIX}${email.toLowerCase()}`;
    await redis.set(key, Date.now().toString(), 'EX', HARD_BOUNCE_TTL);

    logger.warn('Email hard-bounced and blocked', { email });
  }

  /**
   * Record a soft bounce. After MAX_SOFT_BOUNCES within the window
   * the address is promoted to a hard bounce.
   */
  private async recordSoftBounce(email: string): Promise<void> {
    const key = `${SOFT_BOUNCE_KEY_PREFIX}${email.toLowerCase()}`;

    const count = await redis.incr(key);

    // Set expiry only on first increment
    if (count === 1) {
      await redis.expire(key, SOFT_BOUNCE_TTL);
    }

    logger.warn('Email soft-bounced', { email, count });

    if (count >= MAX_SOFT_BOUNCES) {
      await this.markHardBounce(email);
      await redis.del(key); // clean up soft-bounce counter
    }
  }

  /**
   * Guard: throws if the recipient has previously bounced.
   */
  private async checkBounceStatus(email: string): Promise<void> {
    if (await this.isHardBounced(email)) {
      throw new AppError(
        'This email address is not reachable. Please use a different email.',
        422,
        ErrorCode.EMAIL_BOUNCED,
      );
    }
  }

  /**
   * Inspect a Resend error and record bounces when applicable.
   * Returns true if the error was a bounce (so the caller can skip retries).
   */
  private async handleBounceFromError(email: string, error: unknown): Promise<boolean> {
    const resendError = error as ResendErrorResponse;
    const msg = (resendError?.message ?? '').toLowerCase();
    const name = (resendError?.name ?? '').toLowerCase();

    // Hard bounce indicators
    const isHardBounce =
      msg.includes('bounced') ||
      msg.includes('rejected') ||
      msg.includes('mailbox not found') ||
      msg.includes('does not exist') ||
      msg.includes('invalid recipient') ||
      msg.includes('user unknown') ||
      name === 'validation_error';

    if (isHardBounce) {
      await this.markHardBounce(email);
      return true;
    }

    // Soft bounce indicators (temporary failures)
    const isSoftBounce =
      msg.includes('temporarily rejected') ||
      msg.includes('mailbox full') ||
      msg.includes('try again later') ||
      msg.includes('rate limit') ||
      msg.includes('temporarily deferred');

    if (isSoftBounce) {
      await this.recordSoftBounce(email);
      return true;
    }

    return false;
  }

  // -----------------------
  // ERROR HANDLING
  // -----------------------

  private normalizeResendError(email: string, error: unknown, isBounce: boolean): AppError {
    const resendError = error as ResendErrorResponse;
    const statusCode = resendError?.statusCode;

    logger.error('Resend email delivery failed', {
      statusCode,
      message: resendError?.message,
      email,
      isBounce,
      error,
    });

    if (isBounce) {
      return new AppError(
        'This email address is not reachable. Please use a different email.',
        422,
        ErrorCode.EMAIL_BOUNCED,
      );
    }

    if (statusCode && statusCode >= 400 && statusCode < 500) {
      return new AppError(
        'We could not send an email to that address. Please check the email and try again.',
        400,
        ErrorCode.INVALID_EMAIL,
      );
    }

    return new AppError(
      'We could not send the email right now. Please try again later.',
      503,
      ErrorCode.EXTERNAL_SERVICE_ERROR,
    );
  }

  // -----------------------
  // SEND WITH RETRY
  // -----------------------

  private async sendWithRetry(options: SendEmailOptions, retries = 3) {
    // Pre-flight: reject if already bounced
    await this.checkBounceStatus(options.to);

    let lastError: unknown;
    let wasBounce = false;

    for (let i = 0; i < retries; i++) {
      try {
        const { data, error } = await this.resend.emails.send({
          from: `Pramaan <${this.fromAddress}>`,
          to: [options.to],
          subject: options.subject,
          html: options.html,
          text: options.text,
        });

        if (error) {
          throw error;
        }

        return data;
      } catch (err) {
        lastError = err;

        // Check if this is a bounce — if so, don't retry
        const bounced = await this.handleBounceFromError(options.to, err);
        if (bounced) {
          wasBounce = true;
          break;
        }

        await new Promise((res) => setTimeout(res, 500 * (i + 1)));
      }
    }

    throw this.normalizeResendError(options.to, lastError, wasBounce);
  }

  // -----------------------
  // HELPERS
  // -----------------------

  private buildUrl(path: string, token: string, flow: AuthenticationFlow, requestId?: string, email?: string) {
    const url = new URL(`${SERVER_URL}${path}`);
    url.searchParams.append('token', token);
    if (email) {
      url.searchParams.append('email', email);
    }

    if (flow === 'oauth') {
      url.searchParams.append('flow', flow);
      if (requestId) url.searchParams.append('request_id', requestId);
    }

    return url.toString();
  }

  // -----------------------
  // PUBLIC API
  // -----------------------

  async sendVerificationEmail(
    to: string,
    name: string,
    token: string,
    flow: AuthenticationFlow,
    requestId?: string,
  ) {
    await this.init();

    await this.checkRateLimit(`verify:${to}`);

    const url = this.buildUrl('/email/verify', token, flow, requestId, to);

    await this.sendWithRetry({
      to,
      subject: 'Verify your email',
      html: getEmailVerificationTemplate(name, url),
      text: `Verify your email: ${url}`,
    });

    logger.info('Verification email sent', { to });
  }

  async sendSignInVerifyEmail(
    to: string,
    name: string,
    token: string,
    flow: AuthenticationFlow,
    requestId?: string,
  ) {
    await this.init();

    await this.checkRateLimit(`signin:${to}`);

    const url = this.buildUrl('/signin/verify', token, flow, requestId, to);

    await this.sendWithRetry({
      to,
      subject: 'Verify your sign-in',
      html: getSignInVerificationTemplate(name, url),
      text: `Verify your sign-in: ${url}`,
    });

    logger.info('Sign-in email sent', { to });
  }

  async sendPasswordResetEmail(
    to: string,
    name: string,
    token: string,
    flow: AuthenticationFlow,
    requestId?: string,
  ) {
    await this.init();

    await this.checkRateLimit(`reset:${to}`);

    const url = this.buildUrl('/reset-password', token, flow, requestId, to);

    await this.sendWithRetry({
      to,
      subject: 'Reset your password',
      html: getPasswordResetEmailTemplate(name, url),
      text: `Reset your password: ${url}`,
    });

    logger.info('Password reset email sent', { to });
  }
}

export const emailService = new EmailService();
