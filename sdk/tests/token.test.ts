import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { TokenClient } from '../src/token.js';
import { OAuthError } from '../src/errors.js';

describe('Token Module', () => {
  let server: http.Server;
  let tokenEndpoint: string;
  let lastRequestBody = '';

  before((_, done) => {
    server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        lastRequestBody = body;
        if (req.url === '/token/success') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              access_token: 'mock-access-token',
              token_type: 'Bearer',
              expires_in: 3600,
              id_token: 'mock-id-token',
              scope: 'openid profile email',
            }),
          );
        } else if (req.url === '/token/envelope') {
          // Test backward-compatible data envelope
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: true,
              data: {
                accessToken: 'envelope-access-token',
                tokenType: 'Bearer',
                expiresIn: 600,
                idToken: 'envelope-id-token',
              },
            }),
          );
        } else if (req.url === '/token/invalid-grant') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              error: 'invalid_grant',
              error_description: 'The authorization code has expired or is invalid',
            }),
          );
        } else {
          res.writeHead(404);
          res.end();
        }
      });
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      tokenEndpoint = `http://127.0.0.1:${addr.port}`;
      done();
    });
  });

  after((_, done) => {
    server.close(done);
  });

  it('should successfully exchange code for tokens', async () => {
    const client = new TokenClient();
    const tokens = await client.exchangeCode({
      tokenEndpoint: `${tokenEndpoint}/token/success`,
      clientId: 'client-id',
      clientSecret: 'client-secret',
      code: 'auth-code-123',
      codeVerifier: 'verifier-4567890123456789012345678901234567890',
      redirectUri: 'http://localhost:3000/callback',
    });

    assert.strictEqual(tokens.accessToken, 'mock-access-token');
    assert.strictEqual(tokens.idToken, 'mock-id-token');
    assert.strictEqual(tokens.tokenType, 'Bearer');
    assert.strictEqual(tokens.expiresIn, 3600);

    // Verify form body sent
    const params = new URLSearchParams(lastRequestBody);
    assert.strictEqual(params.get('grant_type'), 'authorization_code');
    assert.strictEqual(params.get('code'), 'auth-code-123');
    assert.strictEqual(params.get('client_id'), 'client-id');
    assert.strictEqual(params.get('client_secret'), 'client-secret');
    assert.strictEqual(params.get('code_verifier'), 'verifier-4567890123456789012345678901234567890');
  });

  it('should handle legacy data envelope responses gracefully', async () => {
    const client = new TokenClient();
    const tokens = await client.exchangeCode({
      tokenEndpoint: `${tokenEndpoint}/token/envelope`,
      clientId: 'client-id',
      code: 'auth-code',
      codeVerifier: 'verifier-4567890123456789012345678901234567890',
      redirectUri: 'http://localhost:3000/callback',
    });

    assert.strictEqual(tokens.accessToken, 'envelope-access-token');
    assert.strictEqual(tokens.idToken, 'envelope-id-token');
  });

  it('should parse OAuth error response and throw typed OAuthError', async () => {
    const client = new TokenClient();

    await assert.rejects(
      async () => {
        await client.exchangeCode({
          tokenEndpoint: `${tokenEndpoint}/token/invalid-grant`,
          clientId: 'client-id',
          code: 'bad-code',
          codeVerifier: 'verifier-4567890123456789012345678901234567890',
          redirectUri: 'http://localhost:3000/callback',
        });
      },
      (err) => {
        assert.ok(err instanceof OAuthError);
        assert.strictEqual(err.code, 'invalid_grant');
        assert.strictEqual(err.statusCode, 400);
        assert.ok(err.description?.includes('expired or is invalid'));
        return true;
      },
    );
  });
});
