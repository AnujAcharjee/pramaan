import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import * as jose from 'jose';
import { PramaanClient } from '../src/client.js';
import {
  ConfigurationError,
  StateMismatchError,
  UnsupportedFeatureError,
} from '../src/errors.js';

describe('PramaanClient Integration & Orchestration', () => {
  let server: http.Server;
  let serverUrl: string;
  let keyPair: jose.GenerateKeyPairResult;
  let publicJwk: jose.JWK;
  const kid = 'integration-key-1';
  const clientId = 'my-client-app';
  const clientSecret = 'super-secret-123';

  before(async () => {
    keyPair = await jose.generateKeyPair('RS256', { modulusLength: 2048 });
    publicJwk = await jose.exportJWK(keyPair.publicKey);
    publicJwk.kid = kid;
    publicJwk.use = 'sig';
    publicJwk.alg = 'RS256';

    await new Promise<void>((resolve) => {
      server = http.createServer(async (req, res) => {
        if (req.url === '/.well-known/openid-configuration') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              issuer: serverUrl,
              authorization_endpoint: `${serverUrl}/api/oauth/authorize`,
              token_endpoint: `${serverUrl}/api/oauth/token`,
              userinfo_endpoint: `${serverUrl}/userinfo`,
              jwks_uri: `${serverUrl}/.well-known/jwks.json`,
              response_types_supported: ['code'],
              subject_types_supported: ['public'],
              id_token_signing_alg_values_supported: ['RS256'],
              scopes_supported: ['openid', 'profile', 'email'],
              token_endpoint_auth_methods_supported: ['client_secret_post'],
              claims_supported: ['sub', 'email', 'name'],
              code_challenge_methods_supported: ['S256', 'plain'],
              grant_types_supported: ['authorization_code'],
            }),
          );
        } else if (req.url === '/.well-known/jwks.json') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ keys: [publicJwk] }));
        } else if (req.url === '/api/oauth/token') {
          let body = '';
          req.on('data', (c) => (body += c));
          req.on('end', async () => {
            const nonce = 'expected-integration-nonce';

            const idToken = await new jose.SignJWT({
              sub: 'user-42',
              nonce,
              email: 'test@pramaan.com',
            })
              .setProtectedHeader({ alg: 'RS256', kid })
              .setIssuer(serverUrl)
              .setAudience(clientId)
              .setIssuedAt()
              .setExpirationTime('10m')
              .sign(keyPair.privateKey);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                access_token: 'active-access-token-42',
                token_type: 'Bearer',
                expires_in: 3600,
                id_token: idToken,
                scope: 'openid profile email',
              }),
            );
          });
        } else if (req.url === '/userinfo') {
          if (req.headers.authorization === 'Bearer active-access-token-42') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                sub: 'user-42',
                email: 'test@pramaan.com',
                email_verified: true,
                name: 'Alice Wonder',
              }),
            );
          } else {
            res.writeHead(401);
            res.end(JSON.stringify({ error: 'invalid_token' }));
          }
        } else {
          res.writeHead(404);
          res.end();
        }
      });

      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as { port: number };
        serverUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after((_, done) => {
    server.close(done);
  });

  it('should validate client configuration on initialization', () => {
    // Missing issuer
    assert.throws(
      () => new PramaanClient({ issuer: '', clientId: 'client' }),
      (err) => err instanceof ConfigurationError,
    );

    // Missing clientId
    assert.throws(
      () => new PramaanClient({ issuer: 'https://pramaan.com', clientId: '' }),
      (err) => err instanceof ConfigurationError,
    );

    // Insecure HTTP non-localhost URL in production
    assert.throws(
      () => new PramaanClient({ issuer: 'http://pramaan.anujacharjee.com', clientId: 'client' }),
      (err) => err instanceof ConfigurationError && err.message.includes('HTTPS'),
    );

    // Valid localhost HTTP config
    assert.doesNotThrow(() => {
      new PramaanClient({ issuer: 'http://localhost:8000', clientId: 'client' });
    });
  });

  it('should complete full OAuth/OIDC authorization flow seamlessly', async () => {
    const client = new PramaanClient({
      issuer: serverUrl,
      clientId,
      clientSecret,
      redirectUri: 'http://localhost:3000/callback',
    });

    // 1. Discovery
    const discovery = await client.discover();
    assert.strictEqual(discovery.issuer, serverUrl);

    // 2. Create authorization request
    const auth = await client.createAuthorizationRequest({
      scope: ['openid', 'profile', 'email'],
      nonce: 'expected-integration-nonce', // use matching nonce for mock token
    });

    assert.ok(auth.url.startsWith(`${serverUrl}/api/oauth/authorize?`));
    assert.strictEqual(auth.transaction.redirectUri, 'http://localhost:3000/callback');

    // 3. Handle Callback
    const tokens = await client.handleCallback({
      code: 'auth-code-valid',
      state: auth.transaction.state,
      transaction: auth.transaction,
    });

    assert.strictEqual(tokens.accessToken, 'active-access-token-42');
    assert.ok(tokens.idToken);
    assert.strictEqual(tokens.claims?.sub, 'user-42');
    assert.strictEqual(tokens.claims?.nonce, 'expected-integration-nonce');

    // 4. Get UserInfo
    const user = await client.getUserInfo(tokens.accessToken);
    assert.strictEqual(user.sub, 'user-42');
    assert.strictEqual(user.email, 'test@pramaan.com');
    assert.strictEqual(user.name, 'Alice Wonder');
  });

  it('should reject callback when state does not match transaction', async () => {
    const client = new PramaanClient({
      issuer: serverUrl,
      clientId,
      clientSecret,
      redirectUri: 'http://localhost:3000/callback',
    });

    const auth = await client.createAuthorizationRequest();

    await assert.rejects(
      async () => {
        await client.handleCallback({
          code: 'valid-code',
          state: 'tampered-state',
          transaction: auth.transaction,
        });
      },
      (err) => err instanceof StateMismatchError,
    );
  });

  it('should throw OAuthError when callback contains error (e.g. access_denied)', async () => {
    const client = new PramaanClient({
      issuer: serverUrl,
      clientId,
      redirectUri: 'http://localhost:3000/callback',
    });

    const auth = await client.createAuthorizationRequest();

    await assert.rejects(
      async () => {
        await client.handleCallback({
          error: 'access_denied',
          errorDescription: 'The resource owner denied the request',
          state: auth.transaction.state,
          transaction: auth.transaction,
        });
      },
      (err) => {
        assert.strictEqual(err.name, 'OAuthError');
        assert.ok(err.message.includes('access_denied'));
        assert.ok(err.message.includes('The resource owner denied the request'));
        return true;
      },
    );
  });

  it('should throw UnsupportedFeatureError when getLogoutUrl is called', () => {
    const client = new PramaanClient({
      issuer: serverUrl,
      clientId,
    });

    assert.throws(
      () => client.getLogoutUrl(),
      (err) => err instanceof UnsupportedFeatureError,
    );
  });
});
