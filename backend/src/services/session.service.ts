import redis from '../config/redis.js';
import { ENV } from '../config/env.js';
import prisma from '../config/database.js';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { AppCrypto } from '../utils/crypto.js';
import { AppError } from '../utils/appError.js';
import { ErrorCode } from '../utils/errorCodes.js';
import { type Role, CRYPTO_ALGORITHMS } from '../utils/constant.js';

type refreshActiveSessionResult = {
  activeSessId: string;
  userId: string;
  roles: Role[];
};

export class SessionService {
  private readonly activeSessionExpiry = ENV.NODE_ENV === 'production' ? ENV.ACTIVE_SESSION_EX : 15 * 60;
  private readonly identitySessionExpiry =
    ENV.NODE_ENV === 'production' ? ENV.IDENTITY_SESSION_EX : 30 * 24 * 60 * 60;

  // Redis Key
  private activeSessionKey = (asidHash: string) => `session:active:${asidHash}`;

  // Long lived
  async createIdentitySession(userId: string): Promise<string> {
    if (!userId) {
      throw new AppError(
        'Invariant violation: userId is required to create identity session',
        500,
        ErrorCode.INTERNAL_SERVER_ERROR,
        false,
      );
    }

    const MAX_RETRIES = 5;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const isid = AppCrypto.randomToken(32);
      const isidHash = AppCrypto.hash(isid, CRYPTO_ALGORITHMS.sha256, 'hex');

      try {
        await prisma.identitySession.create({
          data: {
            token: isidHash,
            userId,
            issuedAt: new Date(),
            lastUsedAt: new Date(),
            expiresAt: new Date(Date.now() + this.identitySessionExpiry * 1000),
          },
        });

        return isid;
      } catch (error: unknown) {
        // Prisma unique constraint violation
        if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
          continue; // retry with a new token
        }

        throw error;
      }
    }

    throw new Error('Failed to create unique identity session');
  }

  // Short lived
  async createActiveSession(userId: string, roles: Role[]): Promise<string> {
    if (!userId || !roles) {
      throw new AppError(
        'Invariant violation: userId & role is required',
        500,
        ErrorCode.INTERNAL_SERVER_ERROR,
        false,
      );
    }

    const MAX_RETRIES = 5;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const asid = AppCrypto.randomToken(32);
      const asidHash = AppCrypto.hash(asid, CRYPTO_ALGORITHMS.sha256, 'hex');

      const payload = {
        userId,
        roles,
        createdAt: Date.now(),
      };

      const result = await redis.set(
        this.activeSessionKey(asidHash),
        JSON.stringify(payload),
        'EX',
        this.activeSessionExpiry,
        'NX',
      );

      if (result === 'OK') {
        return asid;
      }
    }

    throw new Error('Failed to create unique active session');
  }

  // REFRESH ACTIVE SESSION
  async refreshActiveSession(isid: string): Promise<refreshActiveSessionResult> {
    if (!isid) {
      throw new AppError(
        'Identity session token is missing. Sign in again.',
        401,
        ErrorCode.IDENTITY_SESSION_EXPIRED,
      );
    }

    const isidHash = AppCrypto.hash(isid, CRYPTO_ALGORITHMS.sha256, 'hex');

    const session = await prisma.identitySession.findUnique({
      where: { token: isidHash },
      include: {
        user: {
          select: {
            id: true,
            roles: true,
            isActive: true,
            isLocked: true,
            lockedUntil: true,
          },
        },
      },
    });

    if (!session || !session.user) {
      throw new AppError('Invalid session', 401, ErrorCode.UNAUTHORIZED);
    }

    // verify
    if (!session.user.isActive) {
      throw new AppError('Account disabled', 403, ErrorCode.FORBIDDEN);
    }

    if (session.user.isLocked) {
      if (session.user.lockedUntil && session.user.lockedUntil.getTime() <= Date.now()) {
        await prisma.user.update({
          where: { id: session.user.id },
          data: { isLocked: false, lockedUntil: null },
        });
      } else {
        throw new AppError('Account is locked. Try again later.', 423, ErrorCode.ACCOUNT_LOCKED);
      }
    }

    if (session.revoked || session.expiresAt.getTime() < Date.now()) {
      throw new AppError('Session expired. Sign in again', 401, ErrorCode.UNAUTHORIZED);
    }

    // create new active session
    const activeSessId = await this.createActiveSession(session.user.id, session.user.roles);

    return { activeSessId, userId: session.user.id, roles: session.user.roles };
  }

  // Revocation
  async revokeIdentitySession(isid: string) {
    if (!isid) {
      throw new AppError(
        'Invariant violation: isid is required',
        500,
        ErrorCode.INTERNAL_SERVER_ERROR,
        false,
      );
    }

    const isidHash = AppCrypto.hash(isid, CRYPTO_ALGORITHMS.sha256, 'hex');
    await prisma.identitySession.updateMany({
      where: {
        token: isidHash,
        revoked: false,
      },
      data: {
        revoked: true,
        lastUsedAt: new Date(),
      },
    });
  }

  async revokeActiveSession(asid: string) {
    if (!asid) {
      throw new AppError(
        'Invariant violation: asid is required',
        500,
        ErrorCode.INTERNAL_SERVER_ERROR,
        false,
      );
    }

    const asidHash = AppCrypto.hash(asid, CRYPTO_ALGORITHMS.sha256, 'hex');
    await redis.del(this.activeSessionKey(asidHash));
  }
}

export const sessionService = new SessionService();
