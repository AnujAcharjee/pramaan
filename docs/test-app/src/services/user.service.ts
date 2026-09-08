import crypto from 'crypto';
import { AppUser } from '../@types/app.types.js';

export interface CreateUserInput {
  sub: string;
  email: string;
  name: string;
  avatar?: string | null;
  picture?: string | null;
}

export class UserService {
  private users = new Map<string, AppUser>();

  getByProviderUserId(providerUserId: string): AppUser | undefined {
    return this.users.get(`oidc:${providerUserId}`);
  }

  findOrCreateUser(profile: CreateUserInput): AppUser {
    const userKey = `oidc:${profile.sub}`;
    let user = this.users.get(userKey);

    if (!user) {
      user = {
        id: crypto.randomUUID(),
        provider: 'oidc',
        providerUserId: profile.sub,
        email: profile.email,
        name: profile.name,
        avatar: profile.avatar ?? profile.picture ?? null,
        createdAt: new Date(),
      };
      this.users.set(userKey, user);
    }

    return user;
  }
}

export const userService = new UserService();
