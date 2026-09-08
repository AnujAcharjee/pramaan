import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import * as jose from 'jose';
import { JWKSClient } from '../src/jwks.js';
import { IDTokenValidator } from '../src/id-token.js';
import { TokenValidationError, NonceMismatchError } from '../src/errors.js';

describe('ID Token & JWKS Module', () => {
  let server: http.Server;
  let serverUrl: string;
  let keyPair: jose.GenerateKeyPairResult;
  let publicJwk: jose.JWK;
  const kid = 'test-signing-key-1';
  const issuer = 'https://pramaan.anujacharjee.com';
  const clientId = 'test-client-id';

  before(async () => {
    // Generate RSA key pair for testing
    keyPair = await jose.generateKeyPair('RS256', { modulusLength: 2048 });
    publicJwk = await jose.exportJWK(keyPair.publicKey);
    publicJwk.kid = kid;
    publicJwk.use = 'sig';
    publicJwk.alg = 'RS256';

    await new Promise<void>((resolve) => {
      server = http.createServer((req, res) => {
        if (req.url === '/.well-known/jwks.json') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ keys: [publicJwk] }));
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

  it('should successfully verify a valid RS256 ID token', async () => {
    const jwksClient = new JWKSClient({ jwksUri: `${serverUrl}/.well-known/jwks.json` });
    const validator = new IDTokenValidator({
      issuer,
      clientId,
      jwksClient,
    });

    const nonce = 'secure-nonce-12345';
    const jwt = await new jose.SignJWT({
      sub: 'user-id-abc',
      nonce,
      email: 'user@example.com',
    })
      .setProtectedHeader({ alg: 'RS256', kid })
      .setIssuer(issuer)
      .setAudience(clientId)
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(keyPair.privateKey);

    const claims = await validator.verify(jwt, nonce);

    assert.strictEqual(claims.sub, 'user-id-abc');
    assert.strictEqual(claims.iss, issuer);
    assert.strictEqual(claims.aud, clientId);
    assert.strictEqual(claims.nonce, nonce);
  });

  it('should reject ID token if nonce does not match', async () => {
    const jwksClient = new JWKSClient({ jwksUri: `${serverUrl}/.well-known/jwks.json` });
    const validator = new IDTokenValidator({
      issuer,
      clientId,
      jwksClient,
    });

    const jwt = await new jose.SignJWT({
      sub: 'user-id-abc',
      nonce: 'wrong-nonce',
    })
      .setProtectedHeader({ alg: 'RS256', kid })
      .setIssuer(issuer)
      .setAudience(clientId)
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(keyPair.privateKey);

    await assert.rejects(
      async () => {
        await validator.verify(jwt, 'expected-nonce');
      },
      (err) => err instanceof NonceMismatchError,
    );
  });

  it('should reject ID token with wrong issuer', async () => {
    const jwksClient = new JWKSClient({ jwksUri: `${serverUrl}/.well-known/jwks.json` });
    const validator = new IDTokenValidator({
      issuer,
      clientId,
      jwksClient,
    });

    const jwt = await new jose.SignJWT({
      sub: 'user-id-abc',
      nonce: 'nonce-123',
    })
      .setProtectedHeader({ alg: 'RS256', kid })
      .setIssuer('https://rogue-issuer.com')
      .setAudience(clientId)
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(keyPair.privateKey);

    await assert.rejects(
      async () => {
        await validator.verify(jwt, 'nonce-123');
      },
      (err) => err instanceof TokenValidationError,
    );
  });

  it('should reject ID token with wrong audience', async () => {
    const jwksClient = new JWKSClient({ jwksUri: `${serverUrl}/.well-known/jwks.json` });
    const validator = new IDTokenValidator({
      issuer,
      clientId,
      jwksClient,
    });

    const jwt = await new jose.SignJWT({
      sub: 'user-id-abc',
      nonce: 'nonce-123',
    })
      .setProtectedHeader({ alg: 'RS256', kid })
      .setIssuer(issuer)
      .setAudience('wrong-client-id')
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(keyPair.privateKey);

    await assert.rejects(
      async () => {
        await validator.verify(jwt, 'nonce-123');
      },
      (err) => err instanceof TokenValidationError,
    );
  });

  it('should reject expired ID tokens', async () => {
    const jwksClient = new JWKSClient({ jwksUri: `${serverUrl}/.well-known/jwks.json` });
    const validator = new IDTokenValidator({
      issuer,
      clientId,
      jwksClient,
      clockToleranceSeconds: 0,
    });

    const jwt = await new jose.SignJWT({
      sub: 'user-id-abc',
      nonce: 'nonce-123',
    })
      .setProtectedHeader({ alg: 'RS256', kid })
      .setIssuer(issuer)
      .setAudience(clientId)
      .setIssuedAt(Math.floor(Date.now() / 1000) - 100)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 10)
      .sign(keyPair.privateKey);

    await assert.rejects(
      async () => {
        await validator.verify(jwt, 'nonce-123');
      },
      (err) => err instanceof TokenValidationError,
    );
  });

  it('should reject tokens signed with unallowed algorithm (e.g. none)', async () => {
    const jwksClient = new JWKSClient({ jwksUri: `${serverUrl}/.well-known/jwks.json` });
    const validator = new IDTokenValidator({
      issuer,
      clientId,
      jwksClient,
    });

    // Unsigned token with alg: none
    const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        sub: 'user-id-abc',
        iss: issuer,
        aud: clientId,
        nonce: 'nonce-123',
      }),
    ).toString('base64url');
    const insecureToken = `${header}.${payload}.`;

    await assert.rejects(
      async () => {
        await validator.verify(insecureToken, 'nonce-123');
      },
      (err) => err instanceof TokenValidationError && err.message.includes('none'),
    );
  });
});
