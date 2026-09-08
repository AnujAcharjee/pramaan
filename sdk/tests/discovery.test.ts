import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { DiscoveryClient } from '../src/discovery.js';
import { DiscoveryError, NetworkError } from '../src/errors.js';
import type { DiscoveryDocument } from '../src/types.js';

describe('Discovery Module', () => {
  let server: http.Server;
  let serverUrl: string;
  let mockDoc: DiscoveryDocument;
  let requestCount = 0;

  before((_, done) => {
    server = http.createServer((req, res) => {
      requestCount++;
      if (req.url === '/.well-known/openid-configuration' || req.url === '/mismatch/.well-known/openid-configuration') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(mockDoc));
      } else if (req.url === '/error/.well-known/openid-configuration') {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server Error');
      } else if (req.url === '/invalid-json/.well-known/openid-configuration') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{ invalid json ');
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      serverUrl = `http://127.0.0.1:${addr.port}`;
      mockDoc = {
        issuer: serverUrl,
        authorization_endpoint: `${serverUrl}/api/oauth/authorize`,
        token_endpoint: `${serverUrl}/api/oauth/token`,
        userinfo_endpoint: `${serverUrl}/userinfo`,
        jwks_uri: `${serverUrl}/.well-known/jwks.json`,
        response_types_supported: ['code'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],
        scopes_supported: ['openid', 'profile', 'email', 'avatar'],
        token_endpoint_auth_methods_supported: ['client_secret_post'],
        claims_supported: ['sub', 'email'],
        code_challenge_methods_supported: ['S256', 'plain'],
        grant_types_supported: ['authorization_code'],
      };
      done();
    });
  });

  after((_, done) => {
    server.close(done);
  });

  it('should fetch and validate a valid discovery document', async () => {
    const client = new DiscoveryClient({ issuer: serverUrl });
    const doc = await client.getDiscoveryDocument();

    assert.strictEqual(doc.issuer, serverUrl);
    assert.strictEqual(doc.authorization_endpoint, `${serverUrl}/api/oauth/authorize`);
    assert.strictEqual(doc.token_endpoint, `${serverUrl}/api/oauth/token`);
    assert.strictEqual(doc.jwks_uri, `${serverUrl}/.well-known/jwks.json`);
    assert.strictEqual(doc.userinfo_endpoint, `${serverUrl}/userinfo`);
  });

  it('should cache discovery document and not make repeated requests within TTL', async () => {
    const client = new DiscoveryClient({ issuer: serverUrl });
    const beforeCount = requestCount;

    await client.getDiscoveryDocument();
    await client.getDiscoveryDocument();
    await client.getDiscoveryDocument();

    assert.strictEqual(requestCount, beforeCount + 1);
  });

  it('should throw DiscoveryError if issuer does not match', async () => {
    // Configured for a different issuer than what mockDoc returns
    const client = new DiscoveryClient({ issuer: `${serverUrl}/mismatch` });

    await assert.rejects(
      async () => {
        await client.getDiscoveryDocument();
      },
      (err) => err instanceof DiscoveryError && err.message.includes('issuer mismatch'),
    );
  });

  it('should throw DiscoveryError on HTTP 500 error', async () => {
    const client = new DiscoveryClient({ issuer: `${serverUrl}/error` });

    await assert.rejects(
      async () => {
        await client.getDiscoveryDocument();
      },
      (err) => err instanceof DiscoveryError && err.status === 500,
    );
  });

  it('should throw NetworkError on invalid host connection failure', async () => {
    const client = new DiscoveryClient({ issuer: 'http://127.0.0.1:1' });

    await assert.rejects(
      async () => {
        await client.getDiscoveryDocument();
      },
      (err) => err instanceof NetworkError,
    );
  });
});
