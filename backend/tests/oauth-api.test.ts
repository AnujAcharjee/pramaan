import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import * as jose from 'jose';

import app from '../src/app.js';
import prisma from '../src/config/database.js';
import redis from '../src/config/redis.js';
import { ENV } from '../src/config/env.js';
import { AppCrypto } from '../src/utils/crypto.js';
import { SCOPES, CRYPTO_ALGORITHMS } from '../src/utils/constant.js';
import { AppError } from '../src/utils/appError.js';
import { ErrorCode } from '../src/utils/errorCodes.js';
import { AuthZSchema } from '../src/validators/auth.validators.js';
import { discoveryService } from '../src/services/discovery.service.js';
import { joseService } from '../src/services/jose.service.js';
import { oauthService, type AuthorizationCacheType, type AuthCodeReqCacheType } from '../src/services/oauth.service.js';
import { clientService } from '../src/services/client.service.js';
import { emailService } from '../src/services/email.service.js';

describe('OAuth 2.0 & OIDC Core API Test Suite', () => {
  let server: Server;
  let baseUrl: string;

  // Stored original methods for mock restoration
  const originalFindUnique = prisma.oAuthClient.findUnique;
  const originalVerifyClient = clientService.verifyClient;

  const mockClientId = 'client_pramaan_test_12345';
  const mockClientSecret = 'sec_pramaan_test_secret_67890';
  const mockRedirectUri = 'https://app.example.com/oauth/callback';
  const mockUserId = 'usr_pramaan_test_user_abc';

  before(async () => {
    // Start ephemeral HTTP server for live route assertions
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://localhost:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    // Restore prisma & service mocks
    prisma.oAuthClient.findUnique = originalFindUnique;
    clientService.verifyClient = originalVerifyClient;

    // Gracefully close server
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  // -------------------------------------------------------------
  // 1. OpenID Connect Discovery & JWKS (RFC 8414 & OIDC Core 1.0)
  // -------------------------------------------------------------
  describe('OIDC Discovery & JWKS Specification', () => {
    it('should generate valid OpenID Provider Configuration matching RFC 8414', () => {
      const config = discoveryService.getOpenIdConfiguration();

      assert.ok(config.issuer, 'Issuer must be defined');
      assert.ok(config.authorization_endpoint.includes('/oauth/authorize') || config.authorization_endpoint.includes('/api/oauth/authorize'));
      assert.ok(config.token_endpoint.includes('/oauth/token') || config.token_endpoint.includes('/api/oauth/token'));
      assert.ok(config.jwks_uri.includes('/.well-known/jwks.json'));
      assert.ok(config.userinfo_endpoint.includes('/userinfo'));

      // Validate supported response types and grant types
      assert.deepStrictEqual(config.response_types_supported, ['code']);
      assert.deepStrictEqual(config.grant_types_supported, ['authorization_code']);

      // Validate PKCE methods (S256 is mandatory per OAuth 2.1 / security BCP)
      assert.ok(config.code_challenge_methods_supported.includes('S256'));
      assert.ok(config.code_challenge_methods_supported.includes('plain'));

      // Validate supported scopes
      assert.ok(config.scopes_supported.includes('openid'));
      assert.ok(config.scopes_supported.includes('profile'));
      assert.ok(config.scopes_supported.includes('email'));

      // Validate signing algorithms
      assert.ok(config.id_token_signing_alg_values_supported.includes('RS256'));
    });

    it('should serve live GET /.well-known/openid-configuration with CORS and JSON headers', async () => {
      const res = await fetch(`${baseUrl}/.well-known/openid-configuration`);
      assert.strictEqual(res.status, 200);

      const contentType = res.headers.get('content-type') || '';
      assert.ok(contentType.includes('application/json'));

      const data = await res.json();
      assert.strictEqual(data.issuer, ENV.AUTH_ISSUER.replace(/\/+$/, ''));
      assert.ok(Array.isArray(data.scopes_supported));
      assert.ok(data.scopes_supported.includes('openid'));
    });

    it('should serve live GET /.well-known/jwks.json with valid RSA public keys', async () => {
      const res = await fetch(`${baseUrl}/.well-known/jwks.json`);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.ok(Array.isArray(data.keys), 'JWKS response must have a keys array');
      assert.ok(data.keys.length > 0, 'JWKS keys array must not be empty');

      const primaryKey = data.keys[0];
      assert.strictEqual(primaryKey.kty, 'RSA');
      assert.strictEqual(primaryKey.use, 'sig');
      assert.strictEqual(primaryKey.alg, 'RS256');
      assert.ok(primaryKey.kid, 'Key must contain kid identifier');
      assert.ok(primaryKey.n, 'RSA key must contain modulus n');
      assert.ok(primaryKey.e, 'RSA key must contain exponent e');
    });
  });

  // -------------------------------------------------------------
  // 2. PKCE Protocol Verification (RFC 7636)
  // -------------------------------------------------------------
  describe('PKCE (Proof Key for Code Exchange - RFC 7636)', () => {
    it('should verify S256 code challenge with high-entropy code_verifier', () => {
      const codeVerifier = crypto.randomBytes(32).toString('base64url');
      const expectedChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

      const verified = AppCrypto.verifyPKCE({
        codeVerifier,
        codeChallenge: expectedChallenge,
        algorithm: CRYPTO_ALGORITHMS.sha256,
      });

      assert.strictEqual(verified, true, 'Valid verifier must pass PKCE check');
    });

    it('should reject tampered or mismatched code_verifier for S256', () => {
      const codeVerifier = crypto.randomBytes(32).toString('base64url');
      const tamperedVerifier = codeVerifier.slice(0, -2) + 'zz';
      const expectedChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

      const verified = AppCrypto.verifyPKCE({
        codeVerifier: tamperedVerifier,
        codeChallenge: expectedChallenge,
        algorithm: CRYPTO_ALGORITHMS.sha256,
      });

      assert.strictEqual(verified, false, 'Tampered verifier must fail PKCE check');
    });

    it('should safely return false when verifier or challenge is missing', () => {
      assert.strictEqual(AppCrypto.verifyPKCE({ codeVerifier: '', codeChallenge: 'abc' }), false);
      assert.strictEqual(AppCrypto.verifyPKCE({ codeVerifier: 'abc', codeChallenge: '' }), false);
    });

    it('should verify plain transformation using timingSafeCompare', () => {
      const plainSecret = 'a-super-secret-plain-code-verifier';
      assert.strictEqual(AppCrypto.timingSafeCompare(plainSecret, plainSecret), true);
      assert.strictEqual(AppCrypto.timingSafeCompare(plainSecret, 'wrong-plain-secret'), false);
    });
  });

  // -------------------------------------------------------------
  // 3. Scope Parsing & Validation
  // -------------------------------------------------------------
  describe('OAuth Scope Evaluation', () => {
    it('should parse and normalize valid OAuth/OIDC scopes', () => {
      const parsed = oauthService.validateScopes('  openid   profile  email  ');
      assert.deepStrictEqual(parsed, [SCOPES.OPENID, SCOPES.PROFILE, SCOPES.EMAIL]);
    });

    it('should filter out unknown/unsupported scopes while keeping valid ones', () => {
      const parsed = oauthService.validateScopes('openid unsupported_scope email');
      assert.deepStrictEqual(parsed, [SCOPES.OPENID, SCOPES.EMAIL]);
    });

    it('should throw AppError with 403 INVALID_SCOPE when no valid scopes remain', () => {
      assert.throws(
        () => oauthService.validateScopes('invalid_foo invalid_bar'),
        (err: AppError) => {
          assert.strictEqual(err.statusCode, 403);
          assert.strictEqual(err.code, ErrorCode.INVALID_SCOPE);
          return true;
        },
      );
    });

    it('should throw AppError when scope is not a string', () => {
      assert.throws(
        () => oauthService.validateScopes(undefined as unknown as string),
        (err: AppError) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, ErrorCode.INVALID_SCOPE);
          return true;
        },
      );
    });
  });

  // -------------------------------------------------------------
  // 4. Authorization Request Caching & Validation
  // -------------------------------------------------------------
  describe('Authorize Request Lifecycle', () => {
    it('should reject authorize request if client does not exist or is inactive', async () => {
      prisma.oAuthClient.findUnique = (async () => null) as unknown as typeof prisma.oAuthClient.findUnique;

      await assert.rejects(
        () =>
          oauthService.validateAndCacheAuthorizeRequest(
            {
              client_id: 'non_existent_client',
              redirect_uri: mockRedirectUri,
              response_type: 'code',
              scope: 'openid profile',
              nonce: 'nonce_123',
            },
            'req_test_001',
          ),
        (err: AppError) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, ErrorCode.INVALID_CLIENT);
          return true;
        },
      );
    });

    it('should reject authorize request if redirect_uri is not registered for the client', async () => {
      prisma.oAuthClient.findUnique = (async () => ({
        id: mockClientId,
        isActive: true,
        redirectURIs: ['https://legitimate.example.com/callback'],
        enforcePKCE: false,
      })) as unknown as typeof prisma.oAuthClient.findUnique;

      await assert.rejects(
        () =>
          oauthService.validateAndCacheAuthorizeRequest(
            {
              client_id: mockClientId,
              redirect_uri: 'https://attacker.com/malicious/callback',
              response_type: 'code',
              scope: 'openid',
              nonce: 'nonce_123',
            },
            'req_test_002',
          ),
        (err: AppError) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, ErrorCode.INVALID_REDIRECT_URI);
          return true;
        },
      );
    });

    it('should require nonce when openid scope is requested', async () => {
      prisma.oAuthClient.findUnique = (async () => ({
        id: mockClientId,
        isActive: true,
        redirectURIs: [mockRedirectUri],
        enforcePKCE: false,
      })) as unknown as typeof prisma.oAuthClient.findUnique;

      await assert.rejects(
        () =>
          oauthService.validateAndCacheAuthorizeRequest(
            {
              client_id: mockClientId,
              redirect_uri: mockRedirectUri,
              response_type: 'code',
              scope: 'openid',
              // nonce omitted
            },
            'req_test_003',
          ),
        (err: AppError) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, ErrorCode.INVALID_REQUEST);
          assert.ok(err.message.includes('nonce is required'));
          return true;
        },
      );
    });

    it('should enforce PKCE when client has enforcePKCE enabled', async () => {
      prisma.oAuthClient.findUnique = (async () => ({
        id: mockClientId,
        isActive: true,
        redirectURIs: [mockRedirectUri],
        enforcePKCE: true,
      })) as unknown as typeof prisma.oAuthClient.findUnique;

      await assert.rejects(
        () =>
          oauthService.validateAndCacheAuthorizeRequest(
            {
              client_id: mockClientId,
              redirect_uri: mockRedirectUri,
              response_type: 'code',
              scope: 'profile',
              // code_challenge omitted
            },
            'req_test_004',
          ),
        (err: AppError) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, ErrorCode.INVALID_REQUEST);
          assert.ok(err.message.includes('PKCE is required'));
          return true;
        },
      );
    });
  });

  // -------------------------------------------------------------
  // 5. Authorization Code Issuance & Token Exchange (RFC 6749)
  // -------------------------------------------------------------
  describe('Authorization Code Issuance & Token Exchange', () => {
    it('should issue a secure authorization code and cache it in Redis with one-time use', async () => {
      const authReq: AuthorizationCacheType = {
        id: 'req_auth_test_999',
        clientId: mockClientId,
        redirectUri: mockRedirectUri,
        scopes: [SCOPES.OPENID, SCOPES.PROFILE, SCOPES.EMAIL],
        nonce: 'nonce_crypto_secure_abc',
        createdAt: Date.now(),
      };

      const code = await oauthService.issueAuthorizationCode(authReq, mockUserId);
      assert.ok(typeof code === 'string');
      assert.ok(code.length >= 32, 'Authorization code must have sufficient entropy');

      // Verify the code exists in Redis under sha256 hash
      const hash = AppCrypto.hash(code, CRYPTO_ALGORITHMS.sha256, 'hex');
      const raw = await redis.get(`OAuth:authCode:${hash}`);
      assert.ok(raw, 'Auth code must be stored in Redis');

      const cached = JSON.parse(raw) as AuthCodeReqCacheType;
      assert.strictEqual(cached.userId, mockUserId);
      assert.strictEqual(cached.clientId, mockClientId);
    });

    it('should exchange valid authorization code for Access Token and signed ID Token', async () => {
      const codeVerifier = crypto.randomBytes(32).toString('base64url');
      const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
      const nonce = 'nonce_oidc_handshake_val';

      const authReq: AuthorizationCacheType = {
        id: 'req_auth_code_flow_1',
        clientId: mockClientId,
        redirectUri: mockRedirectUri,
        scopes: [SCOPES.OPENID, SCOPES.PROFILE],
        nonce,
        codeChallenge,
        codeChallengeAlgo: CRYPTO_ALGORITHMS.sha256,
        createdAt: Date.now(),
      };

      // 1. Issue code
      const code = await oauthService.issueAuthorizationCode(authReq, mockUserId);

      // 2. Mock client verification
      clientService.verifyClient = async ({ clientId, clientSecret }) => {
        return clientId === mockClientId && clientSecret === mockClientSecret;
      };

      // 3. Exchange code for tokens
      const tokenResponse = await oauthService.issueTokens({
        grantType: 'authorization_code',
        code,
        codeVerifier,
        clientId: mockClientId,
        clientSecret: mockClientSecret,
      });

      assert.ok(tokenResponse.access_token, 'Response must contain access_token');
      assert.strictEqual(tokenResponse.token_type, 'Bearer');
      assert.ok(tokenResponse.expires_in > 0, 'Token must have expires_in');
      assert.ok(tokenResponse.id_token, 'Response must contain signed id_token for openid scope');

      // 4. Verify ID Token cryptographically using the Jose Service public key
      const jwks = (await joseService.getJwks()) as unknown as jose.JSONWebKeySet;
      const JWKS = jose.createLocalJWKSet(jwks);

      const { payload } = await jose.jwtVerify(tokenResponse.id_token, JWKS, {
        issuer: ENV.AUTH_ISSUER,
        audience: mockClientId,
      });

      assert.strictEqual(payload.sub, mockUserId, 'ID token sub must equal userId');
      assert.strictEqual(payload.nonce, nonce, 'ID token nonce must match original request nonce');

      // 5. Code must be one-time use (second attempt must be rejected)
      await assert.rejects(
        () =>
          oauthService.issueTokens({
            grantType: 'authorization_code',
            code,
            codeVerifier,
            clientId: mockClientId,
            clientSecret: mockClientSecret,
          }),
        (err: AppError) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, ErrorCode.INVALID_GRANT);
          return true;
        },
      );
    });

    it('should reject token exchange when PKCE code_verifier fails', async () => {
      const codeVerifier = crypto.randomBytes(32).toString('base64url');
      const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

      const authReq: AuthorizationCacheType = {
        id: 'req_auth_pkce_fail',
        clientId: mockClientId,
        redirectUri: mockRedirectUri,
        scopes: [SCOPES.OPENID],
        nonce: 'nonce_abc',
        codeChallenge,
        codeChallengeAlgo: CRYPTO_ALGORITHMS.sha256,
        createdAt: Date.now(),
      };

      const code = await oauthService.issueAuthorizationCode(authReq, mockUserId);

      clientService.verifyClient = async () => true;

      // Provide wrong verifier
      await assert.rejects(
        () =>
          oauthService.issueTokens({
            grantType: 'authorization_code',
            code,
            codeVerifier: 'wrong_code_verifier_1234567890_abcdef',
            clientId: mockClientId,
            clientSecret: mockClientSecret,
          }),
        (err: AppError) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, ErrorCode.INVALID_GRANT);
          assert.ok(err.message.includes('PKCE verification failed'));
          return true;
        },
      );
    });

    it('should reject token exchange when client_id does not match authorization code request', async () => {
      const authReq: AuthorizationCacheType = {
        id: 'req_auth_client_mismatch',
        clientId: mockClientId,
        redirectUri: mockRedirectUri,
        scopes: [SCOPES.OPENID],
        nonce: 'nonce_abc',
        createdAt: Date.now(),
      };

      const code = await oauthService.issueAuthorizationCode(authReq, mockUserId);

      await assert.rejects(
        () =>
          oauthService.issueTokens({
            grantType: 'authorization_code',
            code,
            clientId: 'different_client_id_456',
            clientSecret: mockClientSecret,
          }),
        (err: AppError) => {
          assert.strictEqual(err.statusCode, 401);
          assert.strictEqual(err.code, ErrorCode.INVALID_CLIENT);
          return true;
        },
      );
    });

    it('should reject unsupported grant_type', async () => {
      await assert.rejects(
        () =>
          oauthService.issueTokens({
            grantType: 'client_credentials',
            code: 'any_code',
            clientId: mockClientId,
          }),
        (err: AppError) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, ErrorCode.UNSUPPORTED_GRANT_TYPE);
          return true;
        },
      );
    });
  });

  // -------------------------------------------------------------
  // 6. Live HTTP Route Endpoints (RFC 6749 Section 5.2 Error Format)
  // -------------------------------------------------------------
  describe('Live Express HTTP OAuth Endpoints', () => {
    it('should reject POST /api/oauth/token with 400 and RFC 6749 JSON error when body is invalid', async () => {
      const res = await fetch(`${baseUrl}/api/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({}),
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error, 'invalid_request');
      assert.ok(data.error_description);
    });

    it('should support /oauth/token route alias identically with RFC 6749 JSON error', async () => {
      const res = await fetch(`${baseUrl}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({}),
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error, 'invalid_request');
      assert.ok(data.error_description);
    });

    it('should return 401 for GET /userinfo when bearer token is missing', async () => {
      const res = await fetch(`${baseUrl}/userinfo`, {
        headers: { Accept: 'application/json' },
      });
      assert.strictEqual(res.status, 401);
    });

    it('should respond with 200 OK for GET /health check', async () => {
      const res = await fetch(`${baseUrl}/health`);
      assert.strictEqual(res.status, 200);
      const text = await res.text();
      assert.strictEqual(text, 'OK');
    });
  });

  // -------------------------------------------------------------
  // 7. Auth Flow Validation (Normal User vs OAuth User)
  // -------------------------------------------------------------
  describe('Auth Flow Validation (Normal User vs OAuth User)', () => {
    it('should validate normal user signin with flow=null, undefined, or empty string', () => {
      const payloads = [
        { body: { email: 'user@example.com', password: 'password123' } },
        { body: { email: 'user@example.com', password: 'password123', flow: null } },
        { body: { email: 'user@example.com', password: 'password123', flow: '' } },
        { body: { email: 'user@example.com', password: 'password123', flow: 'default' } },
      ];

      for (const p of payloads) {
        const result = AuthZSchema.signinSchema.safeParse(p);
        assert.strictEqual(result.success, true, `Payload with flow=${p.body.flow} must pass validation`);
        if (result.success) {
          assert.strictEqual(result.data.body.flow, 'default');
        }
      }
    });

    it('should validate normal user signup without confirmPassword or with flow=null', () => {
      const payloads = [
        {
          body: {
            name: 'Normal User',
            email: 'normal@example.com',
            gender: 'MALE',
            password: 'SecurePassword123!',
            flow: null,
          },
        },
        {
          body: {
            name: 'Normal User',
            email: 'normal@example.com',
            gender: 'OTHER',
            password: 'SecurePassword123!',
          },
        },
      ];

      for (const p of payloads) {
        const result = AuthZSchema.signupSchema.safeParse(p);
        const flowValue = (p.body as Record<string, unknown>).flow;
        assert.strictEqual(result.success, true, `Signup payload with flow=${flowValue} must pass validation`);
        if (result.success) {
          assert.strictEqual(result.data.body.flow, 'default');
        }
      }
    });

    it('should reject OAuth flow when request_id is missing', () => {
      const result = AuthZSchema.signinSchema.safeParse({
        body: {
          email: 'user@example.com',
          password: 'password123',
          flow: 'oauth',
        },
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.error?.issues.some((i) => i.message.includes('Missing request_id for OAuth flow')));
    });

    it('should accept OAuth flow with valid request_id or requestId', () => {
      const result = AuthZSchema.signinSchema.safeParse({
        body: {
          email: 'user@example.com',
          password: 'password123',
          flow: 'oauth',
          request_id: 'req_12345',
        },
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.body.flow, 'oauth');

      const result2 = AuthZSchema.signinSchema.safeParse({
        body: {
          email: 'user@example.com',
          password: 'password123',
          flow: 'oauth',
          requestId: 'req_12345',
        },
      });

      assert.strictEqual(result2.success, true);
      assert.strictEqual(result2.data.body.flow, 'oauth');
    });
  });

  // -------------------------------------------------------------
  // 8. OAuth Client User Sign-Up Flow & Edge Cases
  // -------------------------------------------------------------
  describe('OAuth Client User Sign-Up Flow & Edge Case Error Handling', () => {
    const originalSendVerificationEmail = emailService.sendVerificationEmail;
    const originalUserFindUnique = prisma.user.findUnique;
    const originalUserCreate = prisma.user.create;
    const originalUserUpdateMany = prisma.user.updateMany;
    const originalConsentFindFirst = prisma.oAuthConsent.findFirst;
    const originalIdentitySessionCreate = prisma.identitySession.create;
    let dispatchedVerificationEmail: {
      to: string;
      flow: string;
      requestId?: string;
      token: string;
    } | null = null;

    before(() => {
      // Mock identity session creation to avoid foreign key errors on ephemeral test users
      (prisma.identitySession.create as any) = async () => ({ id: 'mock_identity_sess_id' });

      // Mock emailService to capture verification email dispatches without network calls
      (emailService as any).sendVerificationEmail = async (
        to: string,
        _name: string,
        token: string,
        flow: string,
        requestId?: string,
      ) => {
        dispatchedVerificationEmail = { to, flow, requestId, token };
      };
    });

    after(() => {
      // Restore emailService & prisma mocks
      emailService.sendVerificationEmail = originalSendVerificationEmail;
      prisma.user.findUnique = originalUserFindUnique;
      prisma.user.create = originalUserCreate;
      prisma.user.updateMany = originalUserUpdateMany;
      prisma.oAuthConsent.findFirst = originalConsentFindFirst;
      prisma.identitySession.create = originalIdentitySessionCreate;
    });

    // 1. Zod Validation Edge Cases
    it('should reject signup payload when flow=oauth but request_id is empty or missing', () => {
      const invalidPayloads = [
        {
          body: {
            name: 'Alice',
            email: 'alice@example.com',
            gender: 'FEMALE',
            password: 'Password123!',
            flow: 'oauth',
          },
        },
        {
          body: {
            name: 'Alice',
            email: 'alice@example.com',
            gender: 'FEMALE',
            password: 'Password123!',
            flow: 'oauth',
            request_id: '   ',
          },
        },
      ];

      for (const p of invalidPayloads) {
        const result = AuthZSchema.signupSchema.safeParse(p);
        assert.strictEqual(result.success, false);
        assert.ok(result.error?.issues.some((i) => i.message.includes('Missing request_id for OAuth flow')));
      }
    });

    it('should accept signup payload when flow=oauth with request_id or requestId', () => {
      const result1 = AuthZSchema.signupSchema.safeParse({
        body: {
          name: 'Bob',
          email: 'bob@example.com',
          gender: 'MALE',
          password: 'Password123!',
          confirmPassword: 'Password123!',
          flow: 'oauth',
          request_id: 'req_oauth_signup_123',
        },
      });
      assert.strictEqual(result1.success, true);
      assert.strictEqual(result1.data.body.flow, 'oauth');

      const result2 = AuthZSchema.signupSchema.safeParse({
        body: {
          name: 'Bob',
          email: 'bob@example.com',
          gender: 'MALE',
          password: 'Password123!',
          confirmPassword: 'Password123!',
          flow: 'oauth',
          requestId: 'req_oauth_signup_123',
        },
      });
      assert.strictEqual(result2.success, true);
      assert.strictEqual(result2.data.body.flow, 'oauth');
    });

    it('should reject signup when password complexity is not met or passwords mismatch', () => {
      // Missing uppercase / number / special char
      const weakPassword = AuthZSchema.signupSchema.safeParse({
        body: {
          name: 'Charlie',
          email: 'charlie@example.com',
          gender: 'OTHER',
          password: 'password',
          flow: 'oauth',
          request_id: 'req_123',
        },
      });
      assert.strictEqual(weakPassword.success, false);

      // Confirm password mismatch
      const mismatch = AuthZSchema.signupSchema.safeParse({
        body: {
          name: 'Charlie',
          email: 'charlie@example.com',
          gender: 'OTHER',
          password: 'Password123!',
          confirmPassword: 'DifferentPassword456!',
          flow: 'oauth',
          request_id: 'req_123',
        },
      });
      assert.strictEqual(mismatch.success, false);
      assert.ok(mismatch.error?.issues.some((i) => i.message.includes('Both password fields must match')));
    });

    // 2. Live HTTP POST /api/v1/auth/signup
    it('should reject POST /api/v1/auth/signup when flow=oauth without request_id (HTTP 400)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test OAuth User',
          email: 'test-oauth@example.com',
          gender: 'OTHER',
          password: 'SecurePassword123!',
          flow: 'oauth',
        }),
      });

      assert.strictEqual(res.status, 400);
      const json = (await res.json()) as any;
      assert.ok(
        json.error?.message?.includes('Missing request_id') ||
          json.message?.includes('Missing request_id') ||
          json.issues,
      );
    });

    it('should reject POST /api/v1/auth/signup when email already exists with HTTP 409', async () => {
      (prisma.user.findUnique as any) = async () => ({ id: 'existing_user_id' });

      const res = await fetch(`${baseUrl}/api/v1/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Existing User',
          email: 'duplicate@example.com',
          gender: 'MALE',
          password: 'SecurePassword123!',
          confirmPassword: 'SecurePassword123!',
          flow: 'oauth',
          request_id: 'req_oauth_dup',
        }),
      });

      assert.strictEqual(res.status, 409);
      const json = (await res.json()) as any;
      assert.strictEqual(json.code, ErrorCode.EMAIL_ALREADY_EXISTS);
    });

    it('should register OAuth client user, dispatch verification email with flow context, and return redirectUrl to /verify', async () => {
      const newUserId = 'usr_new_oauth_reg_999';
      const testEmail = 'newoauthuser@example.com';
      const testReqId = 'req_live_oauth_flow_777';

      // Mock DB: user does not exist yet, then returns created user
      (prisma.user.findUnique as any) = async () => null;
      (prisma.user.create as any) = async ({ data }: any) => ({
        id: newUserId,
        email: data.email,
        name: data.name,
        roles: data.roles,
        createdAt: new Date(),
      });

      dispatchedVerificationEmail = null;

      const res = await fetch(`${baseUrl}/api/v1/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'New OAuth Member',
          email: testEmail,
          gender: 'FEMALE',
          password: 'SecurePassword123!',
          confirmPassword: 'SecurePassword123!',
          flow: 'oauth',
          request_id: testReqId,
        }),
      });

      assert.strictEqual(res.status, 201);
      const json = (await res.json()) as any;
      assert.strictEqual(json.success, true);
      assert.ok(json.redirectUrl.includes('/verify'));
      assert.ok(json.redirectUrl.includes(`flow=oauth`));
      assert.ok(json.redirectUrl.includes(`request_id=${testReqId}`));

      // Verify email was dispatched with OAuth flow & request_id
      assert.ok(dispatchedVerificationEmail !== null);
      assert.strictEqual(dispatchedVerificationEmail.to, testEmail);
      assert.strictEqual(dispatchedVerificationEmail.flow, 'oauth');
      assert.strictEqual(dispatchedVerificationEmail.requestId, testReqId);
      assert.ok(dispatchedVerificationEmail.token.length > 0);
    });

    // 3. Email Verification & OAuth Resume
    it('should verify email, activate user, and direct new OAuth user to /oauth/consent when consent is not yet granted', async () => {
      const testUserId = 'usr_verified_oauth_user_111';
      const testToken = crypto.randomBytes(16).toString('hex');
      const hashedToken = AppCrypto.hash(testToken, CRYPTO_ALGORITHMS.sha256, 'hex');
      const testRequestId = 'req_consent_resume_222';

      // Cache verification token in Redis using the internal authService key
      await redis.set(
        `email-verify:token:${hashedToken}`,
        JSON.stringify({
          userId: testUserId,
          roles: ['USER'],
        }),
        'EX',
        300,
      );
      await redis.set(`email-verify:user:${testUserId}`, hashedToken, 'EX', 300);

      // Cache valid OAuth authorization request in Redis
      const authReq: AuthorizationCacheType = {
        id: testRequestId,
        clientId: mockClientId,
        redirectUri: mockRedirectUri,
        scopes: [SCOPES.OPENID, SCOPES.EMAIL, SCOPES.PROFILE],
        state: 'oauth_flow_state_xyz',
        nonce: 'oauth_flow_nonce_123',
        createdAt: Date.now(),
      };
      await redis.set(`OAuth:req:${testRequestId}`, JSON.stringify(authReq), 'EX', 300);

      // Mock prisma: user is activated, no prior consent exists
      (prisma.user.updateMany as any) = async () => ({ count: 1 });
      (prisma.user.findUnique as any) = async () => ({
        id: testUserId,
        isEmailVerified: true,
        isActive: true,
      });
      (prisma.oAuthConsent.findFirst as any) = async () => null;

      const res = await fetch(
        `${baseUrl}/api/v1/auth/verify-email?token=${testToken}&flow=oauth&request_id=${testRequestId}`,
      );

      assert.strictEqual(res.status, 200);
      const json = (await res.json()) as any;
      assert.strictEqual(json.success, true);
      // Because user hasn't consented yet, redirectUrl must direct to consent screen
      assert.strictEqual(json.redirectUrl, `/oauth/consent?request_id=${testRequestId}`);
    });

    it('should fallback gracefully to /account when OAuth request in Redis has expired during verification', async () => {
      const testUserId = 'usr_expired_oauth_user_333';
      const testToken = crypto.randomBytes(16).toString('hex');
      const hashedToken = AppCrypto.hash(testToken, CRYPTO_ALGORITHMS.sha256, 'hex');
      const expiredRequestId = 'req_expired_nonexistent_444';

      // Cache verification token in Redis
      await redis.set(
        `email-verify:token:${hashedToken}`,
        JSON.stringify({
          userId: testUserId,
          roles: ['USER'],
        }),
        'EX',
        300,
      );
      await redis.set(`email-verify:user:${testUserId}`, hashedToken, 'EX', 300);

      (prisma.user.updateMany as any) = async () => ({ count: 1 });
      (prisma.user.findUnique as any) = async () => ({
        id: testUserId,
        isEmailVerified: true,
        isActive: true,
      });

      const res = await fetch(
        `${baseUrl}/api/v1/auth/verify-email?token=${testToken}&flow=oauth&request_id=${expiredRequestId}`,
      );

      assert.strictEqual(res.status, 200);
      const json = (await res.json()) as any;
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.redirectUrl, '/account');
    });
  });

  // -------------------------------------------------------------
  // 9. Official Pramaan SDK Compatibility with Headless Backend
  // -------------------------------------------------------------
  describe('Official Pramaan SDK Compatibility Verification', () => {
    const originalGetConfig = discoveryService.getOpenIdConfiguration;

    before(() => {
      discoveryService.getOpenIdConfiguration = () => ({
        ...originalGetConfig.call(discoveryService),
        issuer: baseUrl,
        authorization_endpoint: `${baseUrl}/api/oauth/authorize`,
        token_endpoint: `${baseUrl}/api/oauth/token`,
        userinfo_endpoint: `${baseUrl}/userinfo`,
        jwks_uri: `${baseUrl}/.well-known/jwks.json`,
      });
    });

    after(() => {
      discoveryService.getOpenIdConfiguration = originalGetConfig;
    });

    it('should successfully discover metadata using SDK DiscoveryClient against live backend', async () => {
      const { DiscoveryClient } = await import('../../sdk/src/discovery.js');
      const discovery = new DiscoveryClient({ issuer: baseUrl });
      const doc = await discovery.getDiscoveryDocument();

      assert.strictEqual(doc.issuer, baseUrl);
      assert.strictEqual(doc.authorization_endpoint, `${baseUrl}/api/oauth/authorize`);
      assert.strictEqual(doc.token_endpoint, `${baseUrl}/api/oauth/token`);
      assert.strictEqual(doc.userinfo_endpoint, `${baseUrl}/userinfo`);
      assert.strictEqual(doc.jwks_uri, `${baseUrl}/.well-known/jwks.json`);
      assert.ok(doc.scopes_supported.includes('openid'));
      assert.ok(doc.scopes_supported.includes('profile'));
      assert.ok(doc.scopes_supported.includes('email'));
    });

    it('should create valid authorization request using SDK PramaanClient and match backend validation', async () => {
      const { PramaanClient } = await import('../../sdk/src/client.js');
      const pramaan = new PramaanClient({
        issuer: baseUrl,
        clientId: mockClientId,
        redirectUri: mockRedirectUri,
      });

      const req = await pramaan.createAuthorizationRequest({
        scope: ['openid', 'profile', 'email'],
      });

      assert.ok(req.url.startsWith(`${baseUrl}/api/oauth/authorize?`));
      const parsedUrl = new URL(req.url);
      assert.strictEqual(parsedUrl.searchParams.get('client_id'), mockClientId);
      assert.strictEqual(parsedUrl.searchParams.get('redirect_uri'), mockRedirectUri);
      assert.strictEqual(parsedUrl.searchParams.get('response_type'), 'code');
      assert.strictEqual(parsedUrl.searchParams.get('scope'), 'openid profile email');
      assert.strictEqual(parsedUrl.searchParams.get('code_challenge_method'), 'S256');
      assert.ok(parsedUrl.searchParams.get('code_challenge'));
      assert.ok(parsedUrl.searchParams.get('state'));
      assert.ok(parsedUrl.searchParams.get('nonce'));

      assert.strictEqual(req.transaction.state, parsedUrl.searchParams.get('state'));
      assert.strictEqual(req.transaction.nonce, parsedUrl.searchParams.get('nonce'));
      assert.ok(req.transaction.codeVerifier.length >= 43);
    });

    it('should exchange code for tokens and fetch UserInfo using SDK against live backend', async () => {
      const { TokenClient } = await import('../../sdk/src/token.js');
      const { UserInfoClient } = await import('../../sdk/src/userinfo.js');

      // Issue code on live backend
      const codeVerifier = 'integration_sdk_verifier_123456789012345678901234567890';
      const codeChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');

      const authReq: AuthorizationCacheType = {
        id: 'req_sdk_exchange_test',
        clientId: mockClientId,
        redirectUri: mockRedirectUri,
        scopes: [SCOPES.OPENID, SCOPES.EMAIL, SCOPES.PROFILE],
        state: 'sdk_state',
        nonce: 'sdk_nonce',
        codeChallenge,
        codeChallengeAlgo: CRYPTO_ALGORITHMS.sha256,
        createdAt: Date.now(),
      };

      const authCode = await oauthService.issueAuthorizationCode(authReq, mockUserId);

      // Mock user in DB for UserInfo endpoint
      (prisma.user.findUnique as any) = async () => ({
        id: mockUserId,
        name: 'SDK Test User',
        email: 'sdk@example.com',
        isEmailVerified: true,
        isActive: true,
        avatar: 'https://cdn.example.com/avatar.png',
      });

      // Exchange using SDK TokenClient
      const tokenClient = new TokenClient();
      const tokens = await tokenClient.exchangeCode({
        tokenEndpoint: `${baseUrl}/api/oauth/token`,
        clientId: mockClientId,
        clientSecret: mockClientSecret,
        code: authCode,
        codeVerifier,
        redirectUri: mockRedirectUri,
      });

      assert.ok(tokens.accessToken);
      assert.ok(tokens.idToken);
      assert.strictEqual(tokens.tokenType, 'Bearer');

      // Fetch UserInfo using SDK UserInfoClient with the returned access token
      const userInfoClient = new UserInfoClient({
        userinfoEndpoint: `${baseUrl}/userinfo`,
      });
      const userInfo = await userInfoClient.getUserInfo(tokens.accessToken);

      assert.ok(userInfo.sub);
      assert.strictEqual(userInfo.sub, mockUserId);
    });
  });
});
