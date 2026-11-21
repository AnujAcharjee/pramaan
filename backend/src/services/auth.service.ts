import bcrypt from 'bcrypt';
import prisma from '../config/database.js';
import redis from '../config/redis.js';
import { AppError } from '../utils/appError.js';
import { ErrorCode } from '../utils/errorCodes.js';
import { AppCrypto } from '../utils/crypto.js';
import { emailService } from '../services/email.service.js';
import { ENV } from '../config/env.js';
import { sessionService } from '../services/session.service.js';
import {
  ROLES,
  GENDERS,
  AUTH_PROVIDERS,
  CRYPTO_ALGORITHMS,
  type Role,
  type Gender,
} from '../utils/constant.js';

export type AuthenticationFlow = 'oauth' | 'default';

export type UserView = {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  isEmailVerified: boolean;
  password: string | null;
  mfaEnabled: boolean;
  isLocked: boolean;
  lockedUntil: Date | null;
  isActive: boolean;
};

export class AuthService {
  private readonly emailVerificationTokenExpiry =
    ENV.NODE_ENV === 'production' ? ENV.EMAIL_VERIFICATION_TOKEN_EX : 24 * 60 * 60;
  private readonly signinFailCountExpiry =
    ENV.NODE_ENV === 'production' ? ENV.SIGN_IN_FAIL_COUNT_EX : 24 * 60 * 60;
  private readonly signinVerificationTokenExpiry =
    ENV.NODE_ENV === 'production' ? ENV.SIGN_VERIFICATION_TOKEN_EX : 24 * 60 * 60;
  private readonly signinLockUntil = ENV.NODE_ENV === 'production' ? ENV.SIGNIN_LOCK_UNTIL : 6 * 60 * 60;
  private readonly maxSigninFailures = ENV.NODE_ENV === 'production' ? ENV.MAX_SIGNIN_FAILURES : 20;
  private readonly resetPasswordExpiry = ENV.NODE_ENV === 'production' ? ENV.RESET_PASSWORD_EX : 60 * 60;

  // Redis keys
  private emailVerificationTokenKey = (hashedToken: string): string => `email-verify:token:${hashedToken}`;
  private emailVerificationUserKey = (userId: string): string => `email-verify:user:${userId}`;
  private signinFailCountKey = (userId: string) => `signin:fail-count:${userId}`;
  private signinVerificationTokenKey = (hashedToken: string) => `signin:verify-token:${hashedToken}`;
  private resetPasswordTokenKey = (hashedToken: string) => `reset-password:${hashedToken}`;

  // REDIS methods
  private async setVerificationTokenInRedis(token: string, userId: string, roles: Role[]): Promise<void> {
    await redis
      .multi()
      .set(
        this.emailVerificationTokenKey(token),
        JSON.stringify({ userId, roles }),
        'EX',
        this.emailVerificationTokenExpiry,
      )
      .set(this.emailVerificationUserKey(userId), token, 'EX', this.emailVerificationTokenExpiry)
      .exec();
  }

  private async delVerificationTokenInRedis(tokenKey: string, userKey: string): Promise<void> {
    await redis.multi().del(tokenKey).del(userKey).exec();
  }

  private async unlockIfExpired(user: { id: string; isLocked: boolean; lockedUntil: Date | null }) {
    if (!user.isLocked) return;

    if (user.lockedUntil && user.lockedUntil.getTime() <= Date.now()) {
      await prisma.user.update({
        where: { id: user.id },
        data: { isLocked: false, lockedUntil: null },
      });
      user.isLocked = false;
      user.lockedUntil = null;
    }
  }

  private async validateUser(params: { id?: string; email?: string }): Promise<UserView> {
    const whereClause =
      params.id ? { id: params.id }
      : params.email ? { email: params.email }
      : undefined;

    if (!whereClause) {
      throw new AppError('Either id or email must be provided', 500, ErrorCode.INTERNAL_SERVER_ERROR, false);
    }

    const user = await prisma.user.findUnique({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        roles: true,
        password: true,
        mfaEnabled: true,
        isEmailVerified: true,
        isLocked: true,
        lockedUntil: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new AppError('Unauthorized', 404, ErrorCode.UNAUTHORIZED);
    }

    if (user.isLocked) {
      await this.unlockIfExpired(user);
      if (user.isLocked) {
        throw new AppError(`Account locked until: ${user.lockedUntil}`, 403, ErrorCode.ACCOUNT_LOCKED);
      }
    }

    if (user.isActive && !user.isEmailVerified) {
      throw new AppError('Email is not verified', 403, ErrorCode.EMAIL_NOT_VERIFIED);
    }

    if (!user.isActive && !user.isEmailVerified) {
      throw new AppError('Email is not verified', 403, ErrorCode.EMAIL_NOT_VERIFIED);
    }

    if (!user.isActive && user.isEmailVerified) {
      throw new AppError('User inactive', 403, ErrorCode.USER_INACTIVE);
    }

    return user;
  }

  private async validateUserForResend(email: string): Promise<UserView> {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        roles: true,
        password: true,
        mfaEnabled: true,
        isEmailVerified: true,
        isLocked: true,
        lockedUntil: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new AppError('Unauthorized', 400, ErrorCode.UNAUTHORIZED);
    }

    if (user.isLocked) {
      await this.unlockIfExpired(user);
      if (user.isLocked) {
        throw new AppError(`Account locked until: ${user.lockedUntil}`, 403, ErrorCode.ACCOUNT_LOCKED);
      }
    }

    if (user.isActive && !user.isEmailVerified) {
      // allow resend for active-but-unverified users
      return user;
    }

    if (!user.isActive && !user.isEmailVerified) {
      // allow resend for inactive-unverified users
      return user;
    }

    if (!user.isActive && user.isEmailVerified) {
      throw new AppError('User inactive', 403, ErrorCode.USER_INACTIVE);
    }

    throw new AppError('Email already verified', 409, ErrorCode.INVALID_REQUEST);
  }

  // ----------------------- SIGNUP -----------------------

  async signup(input: {
    name: string;
    email: string;
    gender: Gender;
    password: string;
    flow: AuthenticationFlow;
    requestId?: string;
  }) {
    const { name, email, gender, password, flow } = input;

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      throw new AppError('Email already exists', 409, ErrorCode.EMAIL_ALREADY_EXISTS);
    }

    if (!Object.values(GENDERS).includes(gender)) {
      throw new AppError('Invalid gender', 400, ErrorCode.INVALID_GENDER);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        gender,
        email,
        password: hashedPassword,
        roles: [ROLES.USER],
        provider: AUTH_PROVIDERS.DEFAULT,
        isActive: false,
      },
      select: {
        id: true,
        email: true,
        name: true,
        roles: true,
        createdAt: true,
      },
    });

    const token = AppCrypto.randomToken(32);
    const hashedToken = AppCrypto.hash(token, CRYPTO_ALGORITHMS.sha256, 'hex');

    await this.setVerificationTokenInRedis(hashedToken, user.id, user.roles);

    await emailService.sendVerificationEmail(email, name, token, flow, input.requestId);

    return user;
  }

  async verifyEmail(token: string) {
    const hashedToken = AppCrypto.hash(token, CRYPTO_ALGORITHMS.sha256, 'hex');

    const cached = await redis.get(this.emailVerificationTokenKey(hashedToken));
    if (!cached) {
      throw new AppError('Invalid or expired verification token', 400, ErrorCode.INVALID_VERIFICATION_TOKEN);
    }

    const { userId, roles } = JSON.parse(cached);

    const updated = await prisma.user.updateMany({
      where: { id: userId, isEmailVerified: false },
      data: {
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
        isActive: true,
      },
    });

    await this.delVerificationTokenInRedis(
      this.emailVerificationTokenKey(hashedToken),
      this.emailVerificationUserKey(userId),
    );

    if (updated.count === 0) {
      const existingUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, isEmailVerified: true },
      });
      if (!existingUser) {
        throw new AppError('User not found', 404, ErrorCode.NOT_FOUND);
      }
    }

    const identitySessionId = await sessionService.createIdentitySession(userId);

    const activeSessionId = await sessionService.createActiveSession(userId, roles);

    return { identitySessionId, activeSessionId, userId };
  }

  async resendVerificationEmail(email: string, flow: AuthenticationFlow, requestId?: string): Promise<void> {
    const user = await this.validateUserForResend(email);

    const userKey = this.emailVerificationUserKey(user.id);
    const existingToken = await redis.get(userKey);

    if (existingToken) {
      const tokenKey = this.emailVerificationTokenKey(existingToken);
      await this.delVerificationTokenInRedis(tokenKey, userKey);
    }

    const verificationToken = AppCrypto.randomToken(32);
    const hashedVerificationToken = AppCrypto.hash(verificationToken, CRYPTO_ALGORITHMS.sha256, 'hex');

    await this.setVerificationTokenInRedis(hashedVerificationToken, user.id, user.roles);

    await emailService.sendVerificationEmail(user.email, user.name, verificationToken, flow, requestId);
  }

  // ----------------------- SIGN IN -----------------------

  async validateSignin(email: string, password: string) {
    const user = await this.validateUser({ email });

    if (!user.password) {
      throw new AppError('No password in user', 500, ErrorCode.INTERNAL_SERVER_ERROR, false);
    }

    const isValid = await bcrypt.compare(password, user.password);

    const failureKey = this.signinFailCountKey(user.id);

    if (!isValid) {
      const count = await redis.incr(failureKey);

      if (count === 1) {
        await redis.expire(failureKey, this.signinFailCountExpiry);
      }

      if (count >= this.maxSigninFailures) {
        const lockedUntil = new Date(Date.now() + this.signinLockUntil * 1000);

        await prisma.user.update({
          where: { id: user.id },
          data: { isLocked: true, lockedUntil },
        });

        await redis.del(failureKey);

        throw new AppError('Account locked due to too many failed attempts', 403, ErrorCode.ACCOUNT_LOCKED);
      }

      throw new AppError('Unauthorized', 401, ErrorCode.UNAUTHORIZED);
    }

    await redis.del(failureKey);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles,
      mfaEnabled: user.mfaEnabled,
      isLocked: user.isLocked,
      lockedUntil: user.lockedUntil,
    };
  }

  async createNewSession(
    userId: string,
    roles: Role[],
  ): Promise<{ identitySessionId: string; activeSessionId: string }> {
    const identitySessionId = await sessionService.createIdentitySession(userId);
    const activeSessionId = await sessionService.createActiveSession(userId, roles);
    return { identitySessionId, activeSessionId };
  }

  async sendSigninVerificationEmail(input: {
    userId: string;
    email: string;
    name: string;
    flow: AuthenticationFlow;
    requestId?: string;
  }): Promise<void> {
    const verificationToken = AppCrypto.randomToken(32);
    const hashedVerificationToken = AppCrypto.hash(verificationToken, CRYPTO_ALGORITHMS.sha256, 'hex');

    await redis.set(
      this.signinVerificationTokenKey(hashedVerificationToken),
      input.userId,
      'EX',
      this.signinVerificationTokenExpiry,
    );

    await emailService.sendSignInVerifyEmail(
      input.email,
      input.name,
      verificationToken,
      input.flow,
      input.requestId,
    );
  }

  async verifySignIn(token: string) {
    const hashed = AppCrypto.hash(token, CRYPTO_ALGORITHMS.sha256, 'hex');

    const userId = await redis.get(this.signinVerificationTokenKey(hashed));

    if (!userId) {
      throw new AppError(
        'Invalid or expired verification token',
        400,
        ErrorCode.INVALID_SIGNIN_VERIFICATION_TOKEN,
      );
    }

    await redis.del(this.signinVerificationTokenKey(hashed));

    const user = await this.validateUser({ id: userId });

    return { id: user.id, email: user.email, roles: user.roles };
  }

  // ----------------------- SIGNOUT -----------------------

  async signout(isid: string, asid: string): Promise<void> {
    if (isid) {
      await sessionService.revokeIdentitySession(isid);
    }

    if (asid) {
      await sessionService.revokeActiveSession(asid);
    }
  }

  // ----------------------- FORGOT & RESET PASSWORD -----------------------
  // generates a token and send it via verified email
  // user get in to the reset password via that email link + token

  async initiateResetPassword(email: string, flow: AuthenticationFlow, requestId?: string): Promise<void> {
    const user = await this.validateUser({ email });

    const resetToken = AppCrypto.randomToken(32);
    const hashedToken = AppCrypto.hash(resetToken, CRYPTO_ALGORITHMS.sha256, 'hex');

    await redis.set(this.resetPasswordTokenKey(hashedToken), user.id, 'EX', this.resetPasswordExpiry);

    try {
      await emailService.sendPasswordResetEmail(email, user.name, resetToken, flow, requestId);
    } catch {
      // If email fails, clear the reset token
      await redis.del(this.resetPasswordTokenKey(hashedToken));
      throw new AppError('Email service failed', 500, ErrorCode.INTERNAL_SERVER_ERROR, false);
    }
  }

  async resetPassword(token: string, newPassword: string) {
    const hashed = AppCrypto.hash(token, CRYPTO_ALGORITHMS.sha256, 'hex');

    const userId = await redis.get(this.resetPasswordTokenKey(hashed));

    if (!userId) {
      throw new AppError('Invalid or expired reset token', 400, ErrorCode.INVALID_RESET_TOKEN);
    }

    const user = await this.validateUser({ id: userId });

    if (!user.password) {
      throw new AppError('User has no password set', 500, ErrorCode.INTERNAL_SERVER_ERROR, false);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      }),
      prisma.identitySession.updateMany({
        where: { userId },
        data: { revoked: true },
      }),
    ]);

    await redis.del(this.resetPasswordTokenKey(hashed));
  }
}

export const authService = new AuthService();
