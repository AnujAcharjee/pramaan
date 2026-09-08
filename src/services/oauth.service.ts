import prisma from '../config/database.js';
import redis from '../config/redis.js';
import z from 'zod';
import { OAuthZSchema } from '../validators/oauth.validator.js';
import { ENV } from '../config/env.js';
import { AppError } from '../utils/appError.js';
import { ErrorCode } from '../utils/errorCodes.js';
import { AppCrypto } from '../utils/crypto.js';
import { joseService, type JoseService } from './jose.service.js';
import { SCOPES, CRYPTO_ALGORITHMS, type CryptoAlgorithm, type Scope } from '../utils/constant.js';
import { clientService, type ClientService } from './client.service.js';

export type AuthorizeParamsType = z.input<typeof OAuthZSchema.authorizeSchema>['query'];

export interface AuthorizationCacheType {
  id: string;
  clientId: string;
  redirectUri: string;
  scopes: Scope[];
  state?: string;
  nonce?: string;
  codeChallenge?: string;
  codeChallengeAlgo?: CryptoAlgorithm;
  codeChallengeMethod?: 'plain';
  createdAt: number;
}

export interface AuthCodeReqCacheType extends AuthorizationCacheType {
  userId: string;
}

export type OAuthConsentView = {
  client: {
    id: string;
    domain: string;
  };
  scopes: string[];
  date: Date;
  revokedAt: Date | null;
};

type AccessTokenPayload = {
  sub: string;
  scope: string;
};

type IdTokenPayload = {
  sub: string;
  nonce: string;
};

export class OAuthService {
  private readonly authCodeTTL = ENV.NODE_ENV === 'production' ? ENV.AUTH_CODE_EX : 300;
  private readonly authTokensTTL = ENV.NODE_ENV === 'production' ? ENV.AUTH_TOKENS_EX : '10m';
  private readonly authRequestTTL = ENV.NODE_ENV === 'production' ? ENV.AUTH_REQUEST_EX : 300;

  constructor(
    private joseService: JoseService,
    private clientService: ClientService,
  ) {}

  private authCodeKey = (hashedToken: string): string => `OAuth:authCode:${hashedToken}`;
  private authRequestKey = (id: string): string => `OAuth:req:${id}`;

  validateScopes(scope: string): Scope[] {
    if (typeof scope !== 'string') {
      throw new AppError('Scope should be of type string', 400, ErrorCode.INVALID_SCOPE);
    }

    const scopes: Scope[] = scope
      .split(' ')
      .map((s) => s.trim())
      .filter((s): s is Scope => Object.values(SCOPES).includes(s as Scope));

    if (scopes.length === 0) throw new AppError(`Insufficient scope: ${scope}`, 403, ErrorCode.INVALID_SCOPE);

    return scopes;
  }

  // ---------- AUTH REQUEST ----------

  // used in middleware
  async validateAndCacheAuthorizeRequest(params: AuthorizeParamsType, requestId: string): Promise<void> {
    /**
     * Zod already validated
     *  - response_type = code
     *  - code_challenge_algo if provided
     */

    // client validation
    const client = await prisma.oAuthClient.findUnique({ where: { id: params.client_id } });
    if (!client || !client.isActive) {
      throw new AppError('Invalid client', 400, ErrorCode.INVALID_CLIENT);
    }

    // redirect uri validation
    if (!client.redirectURIs.includes(params.redirect_uri)) {
      throw new AppError('Invalid redirect_uri', 400, ErrorCode.INVALID_REDIRECT_URI);
    }

    // scope validation
    const scopes: Scope[] = this.validateScopes(params.scope);

    // openid - nonce requirement check
    if (scopes.includes(SCOPES.OPENID) && !params.nonce) {
      throw new AppError('nonce is required for open_id connect', 400, ErrorCode.INVALID_REQUEST);
    }

    // enforce PKCE
    const codeChallengeAlgo =
      params.code_challenge_algo ??
      (params.code_challenge_method === 'S256' ? CRYPTO_ALGORITHMS.sha256 : undefined);
    const codeChallengeMethod = params.code_challenge_method === 'plain' ? 'plain' : undefined;

    if (client.enforcePKCE && (!params.code_challenge || (!codeChallengeAlgo && !codeChallengeMethod))) {
      throw new AppError('PKCE is required', 400, ErrorCode.INVALID_REQUEST);
    }

    // Cache
    const req: AuthorizationCacheType = {
      id: requestId,
      clientId: params.client_id,
      redirectUri: params.redirect_uri,
      scopes,
      state: params.state,
      nonce: params.nonce,
      codeChallenge: params.code_challenge,
      codeChallengeAlgo,
      codeChallengeMethod,
      createdAt: Date.now(),
    };

    await redis.set(this.authRequestKey(req.id), JSON.stringify(req), 'EX', this.authRequestTTL);
  }

  async getAuthorizationRequest(id: string): Promise<AuthorizationCacheType> {
    const raw = await redis.get(this.authRequestKey(id));
    if (!raw) throw new AppError('Authorization request not found', 400, ErrorCode.INVALID_INPUT);
    return JSON.parse(raw) as AuthorizationCacheType;
  }

  async deleteAuthorizationRequest(id: string): Promise<void> {
    await redis.del(this.authRequestKey(id));
  }

  // ---------- AUTHORIZE ----------

  async issueAuthorizationCode(authReq: AuthorizationCacheType, userId: string): Promise<string> {
    const code = AppCrypto.randomToken(32);
    const hash = AppCrypto.hash(code, CRYPTO_ALGORITHMS.sha256, 'hex');
    const authCodeReq: AuthCodeReqCacheType = { ...authReq, userId };

    await redis.set(this.authCodeKey(hash), JSON.stringify(authCodeReq), 'EX', this.authCodeTTL);
    await this.deleteAuthorizationRequest(authReq.id);
    return code;
  }

  async authorize(requestId: string, userId: string): Promise<string> {
    const authReq = await this.getAuthorizationRequest(requestId);

    const hasConsent = await this.hasConsent(userId, authReq.clientId, authReq.scopes);
    if (!hasConsent) {
      return `/oauth/consent?request_id=${encodeURIComponent(requestId)}`;
    }

    const authCode = await this.issueAuthorizationCode(authReq, userId);

    const redirectURL = new URL(authReq.redirectUri);
    redirectURL.searchParams.set('code', authCode);
    if (authReq.state) redirectURL.searchParams.set('state', authReq.state);

    return redirectURL.toString();
  }

  // ---------- CONSENT CHECK ----------

  async hasConsent(userId: string, clientId: string, scopes: Scope[]): Promise<boolean> {
    const consent = await prisma.oAuthConsent.findFirst({
      where: { userId, clientId, revokedAt: null },
    });

    return !!consent && scopes.every((s) => consent.scopes.includes(s));
  }

  async storeConsent(userId: string, clientId: string, scopes: string[]) {
    if (scopes.length === 0) return;

    await prisma.oAuthConsent.upsert({
      where: {
        userId_clientId: {
          userId,
          clientId,
        },
      },
      create: {
        userId,
        clientId,
        scopes,
      },
      update: {
        scopes,
        updatedAt: new Date(),
        revokedAt: null,
      },
    });
  }

  // ---------- TOKENS ----------

  private async generateAccessToken(userId: string, scopes: string[]): Promise<string> {
    const accessTokenPayload: AccessTokenPayload = {
      sub: userId,
      scope: scopes.join(' '), // 'openid profile email',
    };

    return await this.joseService.signJwt(accessTokenPayload, {
      issuer: ENV.AUTH_ISSUER,
      audience: 'userinfo',
      expiresIn: this.authTokensTTL,
    });
  }

  private async generateIdToken(
    userId: string,
    nonce: string | undefined,
    clientId: string,
  ): Promise<string> {
    if (!nonce) {
      throw new AppError('Nonce is required for ID token generation', 400, ErrorCode.INVALID_INPUT);
    }

    const idTokenPayload: IdTokenPayload = {
      sub: userId,
      nonce,
    };

    return await this.joseService.signJwt(idTokenPayload, {
      issuer: ENV.AUTH_ISSUER,
      audience: clientId,
      expiresIn: this.authTokensTTL,
    });
  }

  async issueTokens(input: {
    grantType: string;
    code: string;
    codeVerifier?: string;
    clientId: string;
    clientSecret: string;
  }) {
    if (input.grantType !== 'authorization_code') {
      throw new AppError('Unsupported grant_type', 400, ErrorCode.INVALID_INPUT);
    }

    // get cache
    const hash = AppCrypto.hash(input.code, CRYPTO_ALGORITHMS.sha256, 'hex');
    const raw = await redis.get(this.authCodeKey(hash));
    if (!raw) throw new AppError('Invalid grant', 400, ErrorCode.UNAUTHORIZED_CLIENT);
    const authReq = JSON.parse(raw) as AuthCodeReqCacheType;

    // Client validation
    if (authReq.clientId !== input.clientId) {
      throw new AppError('Invalid client', 401, ErrorCode.INVALID_CLIENT);
    }

    const isValidClient = await this.clientService.verifyClient({
      clientId: input.clientId,
      clientSecret: input.clientSecret,
    });
    if (!isValidClient) throw new AppError('Invalid client', 401, ErrorCode.INVALID_CLIENT);

    // PKCE validation
    if (authReq.codeChallenge) {
      if (!input.codeVerifier) {
        throw new AppError('PKCE codeVerifier missing.', 400, ErrorCode.INVALID_INPUT);
      }

      let ok = false;
      if (authReq.codeChallengeMethod === 'plain') {
        ok = AppCrypto.timingSafeCompare(input.codeVerifier, authReq.codeChallenge);
      } else {
        if (!authReq.codeChallengeAlgo) {
          throw new AppError('PKCE codeChallengeAlgo missing.', 400, ErrorCode.INVALID_INPUT);
        }
        ok = AppCrypto.verifyPKCE({
          codeVerifier: input.codeVerifier,
          codeChallenge: authReq.codeChallenge,
          algorithm: authReq.codeChallengeAlgo,
        });
      }

      if (!ok) {
        throw new AppError('Invalid grant', 400, ErrorCode.UNAUTHORIZED_CLIENT);
      }
    }

    // delete auth code: authz cache
    await redis.del(this.authCodeKey(hash));

    // access token
    const accessToken = await this.generateAccessToken(authReq.userId, authReq.scopes);

    let idToken = undefined;
    // generate only if scopes contain openid
    if (authReq.scopes.includes(SCOPES.OPENID)) {
      idToken = await this.generateIdToken(authReq.userId, authReq.nonce, authReq.clientId);
    }

    return { accessToken, idToken };
  }

  // ---------- GET ALL CONSENTS FROM A USER ----------

  async getUserConsents(userId: string): Promise<OAuthConsentView[]> {
    const consents = await prisma.oAuthConsent.findMany({
      where: {
        userId,
      },
      select: {
        scopes: true,
        createdAt: true,
        revokedAt: true,
        client: {
          select: {
            id: true,
            domain: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return consents.map((consent) => ({
      client: {
        id: consent.client.id,
        domain: consent.client.domain,
      },
      scopes: consent.scopes,
      date: consent.createdAt,
      revokedAt: consent.revokedAt,
    }));
  }

  // ---------- UPDATE CONSENT ----------

  async revokeConsent(userId: string, clientId: string): Promise<void> {
    const consent = await prisma.oAuthConsent.findFirst({
      where: {
        userId,
        clientId,
      },
      select: { id: true },
    });

    if (!consent) {
      throw new AppError('Consent not found', 404, ErrorCode.INVALID_INPUT);
    }

    await prisma.oAuthConsent.update({
      where: {
        userId_clientId: { userId, clientId },
      },
      data: {
        revokedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  async reissueConsent(userId: string, clientId: string): Promise<void> {
    const consent = await prisma.oAuthConsent.findFirst({
      where: {
        userId,
        clientId,
      },
      select: { id: true },
    });

    if (!consent) {
      throw new AppError('Consent not found', 404, ErrorCode.INVALID_INPUT);
    }

    await prisma.oAuthConsent.update({
      where: {
        userId_clientId: { userId, clientId },
      },
      data: {
        revokedAt: null,
        updatedAt: new Date(),
      },
    });
  }

  // ---------- OIDC USERINFO CLAIMS ----------

  async getUserInfoClaims(userId: string, scopes: Scope[]): Promise<Record<string, unknown>> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        avatar: true,
        email: true,
        isEmailVerified: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new AppError('User not found or disabled', 404, ErrorCode.NOT_FOUND);
    }

    const claims: Record<string, unknown> = {};

    // openid scope -> sub
    if (scopes.includes(SCOPES.OPENID)) {
      claims.sub = user.id;
    }

    // email scope -> email, email_verified, emailVerified
    if (scopes.includes(SCOPES.EMAIL)) {
      claims.email = user.email;
      claims.email_verified = user.isEmailVerified ?? false;
      claims.emailVerified = user.isEmailVerified ?? false;
    }

    // profile scope -> name, picture
    if (scopes.includes(SCOPES.PROFILE)) {
      claims.name = user.name;
      if (user.avatar) {
        claims.picture = user.avatar;
      }
    }

    // avatar scope -> avatar, picture
    if (scopes.includes(SCOPES.AVATAR)) {
      claims.avatar = user.avatar;
      if (user.avatar && !claims.picture) {
        claims.picture = user.avatar;
      }
    }

    return claims;
  }
}

export const oauthService = new OAuthService(joseService, clientService);
