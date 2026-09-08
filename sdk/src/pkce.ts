import crypto from 'node:crypto';
import { PKCEError } from './errors.js';

export interface PKCEPair {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256' | 'plain';
}

/**
 * Generate a cryptographically secure PKCE code verifier and challenge per RFC 7636.
 *
 * @param method 'S256' (default, recommended) or 'plain'
 * @param length Byte length of random entropy (defaults to 32 bytes, producing 43 base64url characters)
 */
export function generatePKCE(method: 'S256' | 'plain' = 'S256', length = 32): PKCEPair {
  if (length < 32 || length > 96) {
    throw new PKCEError('PKCE verifier entropy length must be between 32 and 96 bytes');
  }

  const codeVerifier = crypto.randomBytes(length).toString('base64url');

  if (method === 'plain') {
    return {
      codeVerifier,
      codeChallenge: codeVerifier,
      codeChallengeMethod: 'plain',
    };
  }

  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: 'S256',
  };
}

/**
 * Compute the S256 code challenge for an existing code verifier.
 */
export function computeChallenge(codeVerifier: string, method: 'S256' | 'plain' = 'S256'): string {
  if (!codeVerifier || codeVerifier.length < 43 || codeVerifier.length > 128) {
    throw new PKCEError('code_verifier must be between 43 and 128 characters per RFC 7636');
  }

  if (method === 'plain') {
    return codeVerifier;
  }

  return crypto.createHash('sha256').update(codeVerifier).digest('base64url');
}
