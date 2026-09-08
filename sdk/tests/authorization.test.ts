import { describe, it } from 'node:test';
import assert from 'node:assert';
import { AuthorizationService } from '../src/authorization.js';
import { ConfigurationError } from '../src/errors.js';

describe('Authorization Module', () => {
  const options = {
    authorizationEndpoint: 'https://pramaan.anujacharjee.com/api/oauth/authorize',
    clientId: 'test-client-123',
    defaultRedirectUri: 'http://localhost:3000/callback',
  };

  it('should generate a valid authorization request with default scopes, PKCE, state, and nonce', () => {
    const service = new AuthorizationService(options);
    const req = service.createAuthorizationRequest();

    assert.ok(req.url);
    assert.ok(req.transaction);

    const parsed = new URL(req.url);
    assert.strictEqual(parsed.origin + parsed.pathname, 'https://pramaan.anujacharjee.com/api/oauth/authorize');
    assert.strictEqual(parsed.searchParams.get('response_type'), 'code');
    assert.strictEqual(parsed.searchParams.get('client_id'), 'test-client-123');
    assert.strictEqual(parsed.searchParams.get('redirect_uri'), 'http://localhost:3000/callback');
    assert.strictEqual(parsed.searchParams.get('scope'), 'openid profile email');
    assert.strictEqual(parsed.searchParams.get('state'), req.transaction.state);
    assert.strictEqual(parsed.searchParams.get('nonce'), req.transaction.nonce);
    assert.ok(parsed.searchParams.get('code_challenge'));
    assert.strictEqual(parsed.searchParams.get('code_challenge_method'), 'S256');

    assert.strictEqual(req.transaction.redirectUri, 'http://localhost:3000/callback');
    assert.ok(req.transaction.codeVerifier.length >= 43);
  });

  it('should omit nonce if openid is not in scopes', () => {
    const service = new AuthorizationService(options);
    const req = service.createAuthorizationRequest({
      scope: ['profile', 'email'],
    });

    const parsed = new URL(req.url);
    assert.strictEqual(parsed.searchParams.has('nonce'), false);
    assert.strictEqual(parsed.searchParams.get('scope'), 'profile email');
  });

  it('should properly handle scope array containing spaces and deduplicate', () => {
    const service = new AuthorizationService(options);
    const req = service.createAuthorizationRequest({
      scope: ['openid profile', 'email openid'],
    });

    const parsed = new URL(req.url);
    assert.strictEqual(parsed.searchParams.has('nonce'), true);
    assert.strictEqual(parsed.searchParams.get('scope'), 'openid profile email');
  });

  it('should respect custom redirectUri override', () => {
    const service = new AuthorizationService(options);
    const req = service.createAuthorizationRequest({
      redirectUri: 'https://myapp.com/auth/callback',
    });

    const parsed = new URL(req.url);
    assert.strictEqual(parsed.searchParams.get('redirect_uri'), 'https://myapp.com/auth/callback');
    assert.strictEqual(req.transaction.redirectUri, 'https://myapp.com/auth/callback');
  });

  it('should throw ConfigurationError if redirectUri is missing entirely', () => {
    const service = new AuthorizationService({
      authorizationEndpoint: 'https://pramaan.anujacharjee.com/api/oauth/authorize',
      clientId: 'test-client-123',
    });

    assert.throws(
      () => service.createAuthorizationRequest(),
      (err) => err instanceof ConfigurationError,
    );
  });
});
