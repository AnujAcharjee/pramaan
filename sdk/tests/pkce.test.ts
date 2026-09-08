import { describe, it } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import { generatePKCE, computeChallenge } from '../src/pkce.js';
import { PKCEError } from '../src/errors.js';

describe('PKCE Module', () => {
  it('should generate a valid S256 PKCE pair with minimum 43 base64url characters', () => {
    const pkce = generatePKCE('S256');

    assert.strictEqual(typeof pkce.codeVerifier, 'string');
    assert.strictEqual(typeof pkce.codeChallenge, 'string');
    assert.strictEqual(pkce.codeChallengeMethod, 'S256');

    // RFC 7636: verifier must be at least 43 characters
    assert.ok(pkce.codeVerifier.length >= 43, 'Verifier should be >= 43 characters');
    assert.ok(pkce.codeVerifier.length <= 128, 'Verifier should be <= 128 characters');

    // Verify S256 math: SHA256(verifier) base64url
    const expectedChallenge = crypto
      .createHash('sha256')
      .update(pkce.codeVerifier)
      .digest('base64url');

    assert.strictEqual(pkce.codeChallenge, expectedChallenge);
  });

  it('should support plain PKCE when requested', () => {
    const pkce = generatePKCE('plain');

    assert.strictEqual(pkce.codeChallengeMethod, 'plain');
    assert.strictEqual(pkce.codeVerifier, pkce.codeChallenge);
  });

  it('should compute challenge accurately using computeChallenge()', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = computeChallenge(verifier, 'S256');

    const expected = crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64url');

    assert.strictEqual(challenge, expected);
  });

  it('should throw PKCEError for invalid verifier lengths in computeChallenge', () => {
    assert.throws(
      () => computeChallenge('short'),
      (err) => err instanceof PKCEError,
    );
  });
});
