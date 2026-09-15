import prisma from '../config/database.js';
import redis from '../config/redis.js';
import { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../utils/appError.js';
import { ENV } from '../config/env.js';
import { ErrorCode } from '../utils/errorCodes.js';
import type { Gender, Role } from '../utils/constant.js';

interface ProfileUpdateInput {
  name?: string;
  avatar?: string | null;
  roles?: Role[];
  email?: string;
  gender?: Gender;
}

export type AccountView = {
  id: string;
  name: string;
  avatar: string | null;
  email: string;
  gender: string;
  roles: Role[];
  isEmailVerified: boolean;
  emailVerifiedAt: Date | null;
  mfaEnabled: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export class AccountService {
  private readonly profileCacheEX = ENV.NODE_ENV == 'production' ? ENV.PROFILE_CACHE_EX : 15 * 60;

  private profileKey = (userId: string): string => `profile:${userId}`;

  async get(userId: string): Promise<AccountView> {
    const cachedUser = await redis.get(this.profileKey(userId));

    if (cachedUser) {
      return JSON.parse(cachedUser) as AccountView;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        avatar: true,
        email: true,
        gender: true,
        roles: true,
        isEmailVerified: true,
        emailVerifiedAt: true,
        mfaEnabled: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new AppError('User not found', 404, ErrorCode.NOT_FOUND);
    }

    await redis.set(this.profileKey(userId), JSON.stringify(user), 'EX', this.profileCacheEX);
    return user;
  }

  async update(userId: string, updates: ProfileUpdateInput): Promise<AccountView> {
    if (Object.keys(updates).length === 0) {
      throw new AppError('No updates provided', 400, ErrorCode.INVALID_GRANT);
    }

    let user: AccountView;
    try {
      user = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(updates.name !== undefined && { name: updates.name }),
          ...(updates.avatar !== undefined && { avatar: updates.avatar }),
          ...(updates.roles !== undefined && { roles: updates.roles }),
          ...(updates.email !== undefined && { email: updates.email }),
          ...(updates.gender !== undefined && { gender: updates.gender }),
        },
        select: {
          id: true,
          name: true,
          avatar: true,
          email: true,
          gender: true,
          roles: true,
          isEmailVerified: true,
          emailVerifiedAt: true,
          mfaEnabled: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError('Email already exists', 400, ErrorCode.ALREADY_EXISTS);
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new AppError('User not found', 404, ErrorCode.NOT_FOUND);
      }

      throw error;
    }

    // Invalidate cache
    await redis.del(this.profileKey(userId));
    return user;
  }

  // MANAGE MFA
  async manageMfa(userId: string, enable: boolean): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new AppError('Account disabled', 403, ErrorCode.FORBIDDEN);
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: enable,
        updatedAt: new Date(),
      },
    });

    await redis.del(`profile:${userId}`);
  }

  async deactivate(userId: string): Promise<void> {
    const result = await prisma.user.updateMany({
      where: {
        id: userId,
        isActive: true,
      },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });

    if (result.count === 0) {
      throw new AppError('User already deactivated or not found', 400, ErrorCode.INVALID_REQUEST);
    }

    await prisma.identitySession.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true, lastUsedAt: new Date() },
    });

    await redis.del(this.profileKey(userId));
  }

  async activate(userId: string): Promise<void> {
    const result = await prisma.user.updateMany({
      where: {
        id: userId,
        isActive: false,
      },
      data: {
        isActive: true,
        updatedAt: new Date(),
      },
    });

    if (result.count === 0) {
      throw new AppError('User already active or not found', 400, ErrorCode.INVALID_REQUEST);
    }

    await redis.del(this.profileKey(userId));
  }

  async delete(userId: string): Promise<void> {
    // ensure user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new AppError('User not found', 404, ErrorCode.NOT_FOUND);
    }

    // transactional delete
    await prisma.$transaction([
      prisma.identitySession.deleteMany({ where: { userId } }),
      prisma.oAuthClient.deleteMany({ where: { userId } }),
      prisma.user.delete({ where: { id: userId } }),
    ]);

    await redis.del(this.profileKey(userId));
  }
}

export const accountService = new AccountService();
