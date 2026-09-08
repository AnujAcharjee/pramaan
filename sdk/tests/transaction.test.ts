import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  createTransaction,
  validateState,
  validateNonce,
  generateRandomString,
} from '../src/transaction.js';
import { StateMismatchError, NonceMismatchError } from '../src/errors.js';

describe('Transaction Module', () => {
  it('should generate random hex strings with required entropy', () => {
    const s1 = generateRandomString(32);
    const s2 = generateRandomString(32);

    assert.strictEqual(typeof s1, 'string');
    assert.strictEqual(s1.length, 64); // 32 bytes hex = 64 chars
    assert.notStrictEqual(s1, s2);
  });

  it('should create an AuthorizationTransaction object with default state and nonce', () => {
    const tx = createTransaction({
      codeVerifier: 'verifier1234567890123456789012345678901234567890',
      redirectUri: 'http://localhost:3000/callback',
    });

    assert.ok(tx.state);
    assert.ok(tx.nonce);
    assert.strictEqual(tx.codeVerifier, 'verifier1234567890123456789012345678901234567890');
    assert.strictEqual(tx.redirectUri, 'http://localhost:3000/callback');
    assert.ok(tx.createdAt > 0);
  });

  it('should accept custom state and nonce in createTransaction', () => {
    const tx = createTransaction({
      codeVerifier: 'v',
      redirectUri: 'http://localhost:3000/callback',
      state: 'custom-state',
      nonce: 'custom-nonce',
    });

    assert.strictEqual(tx.state, 'custom-state');
    assert.strictEqual(tx.nonce, 'custom-nonce');
  });

  it('should pass validateState when states match', () => {
    assert.doesNotThrow(() => {
      validateState('secure-random-state', 'secure-random-state');
    });
  });

  it('should throw StateMismatchError when state does not match', () => {
    assert.throws(
      () => validateState('attacker-state', 'original-state'),
      (err) => err instanceof StateMismatchError,
    );
  });

  it('should throw StateMismatchError when state is missing', () => {
    assert.throws(
      () => validateState('', 'original-state'),
      (err) => err instanceof StateMismatchError,
    );
  });

  it('should pass validateNonce when nonces match', () => {
    assert.doesNotThrow(() => {
      validateNonce('secure-nonce', 'secure-nonce');
    });
  });

  it('should throw NonceMismatchError when nonce does not match or is missing', () => {
    assert.throws(
      () => validateNonce('different-nonce', 'original-nonce'),
      (err) => err instanceof NonceMismatchError,
    );

    assert.throws(
      () => validateNonce(undefined, 'original-nonce'),
      (err) => err instanceof NonceMismatchError,
    );
  });
});
