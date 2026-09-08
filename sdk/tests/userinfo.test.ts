import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { UserInfoClient } from '../src/userinfo.js';
import { OAuthError, TokenError } from '../src/errors.js';

describe('UserInfo Module', () => {
  let server: http.Server;
  let userinfoEndpoint: string;
  let lastAuthHeader = '';

  before((_, done) => {
    server = http.createServer((req, res) => {
      lastAuthHeader = req.headers.authorization || '';

      if (req.url === '/userinfo') {
        if (req.headers.authorization === 'Bearer valid-token-123') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              sub: 'user-id-789',
              email: 'jane@example.com',
              email_verified: true,
              name: 'Jane Doe',
              picture: 'https://cdn.example.com/avatar.png',
              avatar: 'https://cdn.example.com/avatar.png',
            }),
          );
        } else {
          res.writeHead(401, {
            'Content-Type': 'application/json',
            'WWW-Authenticate': 'Bearer error="invalid_token", error_description="Invalid or expired token"',
          });
          res.end(
            JSON.stringify({
              error: 'invalid_token',
              error_description: 'The access token is invalid or expired',
            }),
          );
        }
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      userinfoEndpoint = `http://127.0.0.1:${addr.port}/userinfo`;
      done();
    });
  });

  after((_, done) => {
    server.close(done);
  });

  it('should fetch UserInfo with Bearer access token', async () => {
    const client = new UserInfoClient({ userinfoEndpoint });
    const user = await client.getUserInfo('valid-token-123');

    assert.strictEqual(lastAuthHeader, 'Bearer valid-token-123');
    assert.strictEqual(user.sub, 'user-id-789');
    assert.strictEqual(user.email, 'jane@example.com');
    assert.strictEqual(user.email_verified, true);
    assert.strictEqual(user.name, 'Jane Doe');
    assert.strictEqual(user.picture, 'https://cdn.example.com/avatar.png');
    assert.strictEqual(user.avatar, 'https://cdn.example.com/avatar.png');
  });

  it('should throw OAuthError on 401 unauthorized response', async () => {
    const client = new UserInfoClient({ userinfoEndpoint });

    await assert.rejects(
      async () => {
        await client.getUserInfo('invalid-token');
      },
      (err) => {
        assert.ok(err instanceof OAuthError);
        assert.strictEqual(err.code, 'invalid_token');
        assert.strictEqual(err.statusCode, 401);
        return true;
      },
    );
  });

  it('should throw TokenError if access token is empty', async () => {
    const client = new UserInfoClient({ userinfoEndpoint });

    await assert.rejects(
      async () => {
        await client.getUserInfo('');
      },
      (err) => err instanceof TokenError,
    );
  });
});
