import type { UserInfo } from './types.js';
import { OAuthError, NetworkError, TokenError } from './errors.js';

export interface UserInfoClientOptions {
  userinfoEndpoint: string;
  timeoutMs?: number;
}

export class UserInfoClient {
  private readonly userinfoEndpoint: string;
  private readonly timeoutMs: number;

  constructor(options: UserInfoClientOptions) {
    this.userinfoEndpoint = options.userinfoEndpoint;
    this.timeoutMs = options.timeoutMs ?? 10000;
  }

  /**
   * Fetch authenticated user information using an active access token.
   *
   * @param accessToken The Bearer access token issued by Pramaan.
   * @returns Strongly-typed UserInfo claims.
   */
  async getUserInfo(accessToken: string): Promise<UserInfo> {
    if (!accessToken || typeof accessToken !== 'string') {
      throw new TokenError('Access token is required to fetch UserInfo');
    }

    let response: Response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      response = await fetch(this.userinfoEndpoint, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken.trim()}`,
          Accept: 'application/json',
          'User-Agent': 'pramaan-node-sdk/1.0',
        },
        signal: controller.signal,
      });

      clearTimeout(timer);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new NetworkError(`UserInfo request timed out after ${this.timeoutMs}ms`);
      }
      throw new NetworkError(`Failed to connect to UserInfo endpoint at ${this.userinfoEndpoint}`, err);
    }

    const rawText = await response.text().catch(() => '');
    let json: unknown;
    try {
      json = rawText ? JSON.parse(rawText) : {};
    } catch (err) {
      throw new TokenError(
        `Failed to parse UserInfo response as JSON (HTTP ${response.status}): ${rawText}`,
        response.status,
        err,
      );
    }

    if (!response.ok) {
      const errObj = json as Record<string, unknown>;
      const code = typeof errObj.error === 'string' ? errObj.error : 'invalid_token';
      const description =
        typeof errObj.error_description === 'string'
          ? errObj.error_description
          : typeof errObj.message === 'string'
            ? errObj.message
            : undefined;

      throw new OAuthError(code, description, undefined, response.status);
    }

    const data = json as Record<string, unknown>;
    if (!data.sub || typeof data.sub !== 'string') {
      throw new TokenError('UserInfo response is missing required "sub" claim', response.status);
    }

    return {
      sub: data.sub,
      email: typeof data.email === 'string' ? data.email : undefined,
      email_verified: typeof data.email_verified === 'boolean' ? data.email_verified : undefined,
      emailVerified: typeof data.emailVerified === 'boolean' ? data.emailVerified : undefined,
      name: typeof data.name === 'string' ? data.name : undefined,
      picture: typeof data.picture === 'string' ? data.picture : undefined,
      avatar: typeof data.avatar === 'string' ? data.avatar : undefined,
      ...data,
    };
  }
}
