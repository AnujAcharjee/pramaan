import crypto from 'crypto';
import { CRYPTO_ALGORITHMS, type CryptoAlgorithm } from './constant.js';

type Binary = string | Buffer | Uint8Array;

export class AppCrypto {
  private constructor() {}

  static randomToken = (bytes = 32, encoding: BufferEncoding = 'base64url'): string =>
    crypto.randomBytes(bytes).toString(encoding);

  static hash = (
    value: Binary,
    algorithm: CryptoAlgorithm = CRYPTO_ALGORITHMS.sha256,
    output: crypto.BinaryToTextEncoding = 'hex',
  ): string => {
    return crypto.createHash(algorithm).update(value).digest(output);
  };

  static hmac = (
    value: Binary,
    key: Binary,
    algorithm: CryptoAlgorithm,
    output: crypto.BinaryToTextEncoding = 'hex',
  ): string => {
    return crypto.createHmac(algorithm, key).update(value).digest(output);
  };

  static timingSafeCompare = (a: Binary, b: Binary, encoding: BufferEncoding = 'utf8'): boolean => {
    const bufA = typeof a === 'string' ? Buffer.from(a, encoding) : Buffer.from(a);

    const bufB = typeof b === 'string' ? Buffer.from(b, encoding) : Buffer.from(b);

    if (bufA.length !== bufB.length) return false;

    return crypto.timingSafeEqual(bufA, bufB);
  };

  static verifyPKCE(input: {
    codeVerifier: string;
    codeChallenge: string;
    algorithm?: CryptoAlgorithm;
  }): boolean {
    const { codeVerifier, codeChallenge, algorithm = CRYPTO_ALGORITHMS.sha256 } = input;

    if (!codeVerifier || !codeChallenge) {
      return false;
    }

    const derived = this.hash(codeVerifier, algorithm, 'base64url');
    return this.timingSafeCompare(derived, codeChallenge);
  }
}
