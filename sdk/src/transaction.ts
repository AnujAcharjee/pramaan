import crypto from 'node:crypto';
import type { AuthorizationTransaction } from './types.js';
import { StateMismatchError, NonceMismatchError } from './errors.js';

/**
 * Generate a cryptographically secure random token (e.g. for state or nonce).
 */
export function generateRandomString(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Create a new AuthorizationTransaction with cryptographically secure state, nonce, and PKCE parameters.
 */
export function createTransaction(options: {
  codeVerifier: string;
  redirectUri: string;
  state?: string;
  nonce?: string;
}): AuthorizationTransaction {
  return {
    state: options.state ?? generateRandomString(32),
    nonce: options.nonce ?? generateRandomString(32),
    codeVerifier: options.codeVerifier,
    redirectUri: options.redirectUri,
    createdAt: Date.now(),
  };
}

/**
 * Validate that the state received in the callback matches the transaction state using constant-time comparison.
 *
 * @throws {StateMismatchError} if states do not match or are missing
 */
export function validateState(receivedState: string, expectedState: string): void {
  if (!receivedState || !expectedState) {
    throw new StateMismatchError('Missing state parameter on callback or transaction');
  }

  const bufA = Buffer.from(receivedState, 'utf8');
  const bufB = Buffer.from(expectedState, 'utf8');

  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    throw new StateMismatchError('State parameter does not match the original transaction');
  }
}

/**
 * Validate that the nonce in the ID token matches the transaction nonce.
 *
 * @throws {NonceMismatchError} if nonces do not match or are missing
 */
export function validateNonce(receivedNonce: string | undefined, expectedNonce: string): void {
  if (!receivedNonce) {
    throw new NonceMismatchError('ID token is missing the required nonce claim');
  }

  const bufA = Buffer.from(receivedNonce, 'utf8');
  const bufB = Buffer.from(expectedNonce, 'utf8');

  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    throw new NonceMismatchError('ID token nonce does not match the original transaction nonce');
  }
}
