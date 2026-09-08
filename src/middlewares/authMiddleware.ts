import prisma from '../config/database.js';
import redis from '../config/redis.js';
import { joseService } from '../services/jose.service.js';
import { sessionService } from '../services/session.service.js';
import { oauthService } from '../services/oauth.service.js';
import { AppError } from '../utils/appError.js';
import { ErrorCode } from '../utils/errorCodes.js';
import { AppCrypto } from '../utils/crypto.js';
import { COOKIE_NAMES, setSessionCookies } from '../utils/cookies.js';
import { CRYPTO_ALGORITHMS, SCOPES } from '../utils/constant.js';
import type { Role, Scope } from '../utils/constant.js';
import type { Request, Response, NextFunction } from 'express';
import type { AuthenticationFlow } from '../services/auth.service.js';

/**
 * AUTHENTICATE
 *  1. api: check for active session; if no return UNAUTHORIZED
 *  2. ssr: check for active session; if no refresh it if a valid id session present; else return UNAUTHORIZE
 *  3. client: check for client JWT access token issued by OAuth
 *
 * AUTHORIZE
 *  1. role: validate user for all the roles required (USER, DEVELOPER, ADMIN)
 *  2. clientOwnership: validate is client belong to user or not
 */

export class Authentication {
  private static activeSession_RK = (sid: string) => `session:active:${sid}`;
  private static resolveOAuthRequestId(req: Request): string | undefined {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const query = (req.query ?? {}) as Record<string, unknown>;

    return (body.request_id as string) ?? (query.request_id as string) ?? req.requestId;
  }

  private constructor() {}

  static ssr = (flow: AuthenticationFlow = 'default') => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const asid = req.signedCookies[COOKIE_NAMES.ACTIVE_SESSION];
        const isid = req.signedCookies[COOKIE_NAMES.IDENTITY_SESSION];

        // Try Active Session
        if (asid) {
          const hashedAsid = AppCrypto.hash(asid, CRYPTO_ALGORITHMS.sha256, 'hex');

          const cached = await redis.get(Authentication.activeSession_RK(hashedAsid));

          if (cached) {
            const { userId, roles, createdAt } = JSON.parse(cached);

            if (userId && roles && createdAt) {
              req.user = { id: userId, roles };
              return next();
            }
          }
        }

        // Fallback -> Refresh using Identity Session
        if (isid) {
          const data = await sessionService.refreshActiveSession(isid);

          await setSessionCookies(res, null, data.activeSessId);

          req.user = {
            id: data.userId,
            roles: data.roles,
          };

          return next();
        }

        // No valid session
        if (flow === 'oauth') {
          const requestId = Authentication.resolveOAuthRequestId(req);

          const params = new URLSearchParams({
            flow: 'oauth',
            error: 'Session_expired',
          });

          if (requestId) params.set('request_id', requestId);

          return res.redirect(303, `/signin?${params.toString()}`);
        }

        return res.redirect(303, '/signin?error=Session_expired');
      } catch (error) {
        return next(error);
      }
    };
  };

  static async client(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auth = req.headers.authorization;

      // get access token from client req header
      if (!auth?.startsWith('Bearer ')) {
        res.setHeader(
          'WWW-Authenticate',
          'Bearer error="invalid_token", error_description="Missing or malformed access token"',
        );
        throw new AppError('Missing access token', 401, ErrorCode.UNAUTHORIZED);
      }

      const token = auth.slice(7).trim();
      if (!token) {
        res.setHeader(
          'WWW-Authenticate',
          'Bearer error="invalid_token", error_description="Access token is empty"',
        );
        throw new AppError('Missing access token', 401, ErrorCode.UNAUTHORIZED);
      }

      let payload;
      try {
        payload = await joseService.verifyJwt(token, 'userinfo');
      } catch {
        res.setHeader(
          'WWW-Authenticate',
          'Bearer error="invalid_token", error_description="The access token is invalid or expired"',
        );
        throw new AppError('Invalid or expired token', 401, ErrorCode.UNAUTHORIZED);
      }

      const scopes: Scope[] = oauthService.validateScopes(payload.scope);

      // OpenID Connect UserInfo requires the openid scope
      if (!scopes.includes(SCOPES.OPENID)) {
        res.setHeader('WWW-Authenticate', 'Bearer error="insufficient_scope", scope="openid"');
        throw new AppError(
          'Insufficient scope: openid scope is required for UserInfo',
          403,
          ErrorCode.INVALID_SCOPE,
        );
      }

      req.client = {
        id: String(payload.aud),
        userId: String(payload.sub),
        scopes,
      };

      next();
    } catch (error) {
      next(error);
    }
  }
}

export class Authorize {
  static role(roles: Role[]) {
    return (req: Request, _res: Response, next: NextFunction): void => {
      try {
        const userRoles = req.user?.roles ?? [];
        const allowed = roles.some((role) => userRoles.includes(role));
        if (!allowed) {
          throw new AppError('Forbidden - Insufficient permissions', 403, ErrorCode.FORBIDDEN);
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  }

  static async clientOwnership(req: Request, _res: Response, next: NextFunction) {
    const clientId = req.params.client_id || req.body.client_id;

    if (!clientId) {
      throw new AppError('Client ID missing', 400, ErrorCode.INVALID_REQUEST);
    }

    const client = await prisma.oAuthClient.findFirst({
      where: {
        id: clientId,
        userId: req.user.id,
      },
    });

    if (!client) {
      throw new AppError('Forbidden', 403, ErrorCode.FORBIDDEN);
    }

    next();
  }
}
