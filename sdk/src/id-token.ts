import * as jose from 'jose';
import type { IDTokenClaims } from './types.js';
import type { JWKSClient } from './jwks.js';
import { validateNonce } from './transaction.js';
import { TokenValidationError } from './errors.js';

export interface IDTokenValidatorOptions {
  issuer: string;
  clientId: string;
  jwksClient: JWKSClient;
  allowedAlgorithms?: string[];
  clockToleranceSeconds?: number;
}

export class IDTokenValidator {
  private readonly issuer: string;
  private readonly clientId: string;
  private readonly jwksClient: JWKSClient;
  private readonly allowedAlgorithms: string[];
  private readonly clockTolerance: number;

  constructor(options: IDTokenValidatorOptions) {
    this.issuer = options.issuer.replace(/\/+$/, '');
    this.clientId = options.clientId;
    this.jwksClient = options.jwksClient;
    this.allowedAlgorithms = options.allowedAlgorithms ?? ['RS256'];
    this.clockTolerance = options.clockToleranceSeconds ?? 5;
  }

  /**
   * Verify and validate an OIDC ID token JWT.
   *
   * @param idToken The raw compact JWT string.
   * @param expectedNonce The nonce saved in the authorization transaction.
   * @returns The verified IDTokenClaims.
   */
  async verify(idToken: string, expectedNonce?: string): Promise<IDTokenClaims> {
    if (!idToken || typeof idToken !== 'string') {
      throw new TokenValidationError('ID token must be a non-empty string');
    }

    // 1. Decode header to inspect algorithm and kid without verifying yet
    let header: jose.ProtectedHeaderParameters;
    try {
      header = jose.decodeProtectedHeader(idToken);
    } catch (err) {
      throw new TokenValidationError('Failed to decode ID token header', err);
    }

    if (!header.alg || header.alg === 'none') {
      throw new TokenValidationError('ID token uses unallowed or insecure algorithm ("none")');
    }

    if (!this.allowedAlgorithms.includes(header.alg)) {
      throw new TokenValidationError(
        `ID token algorithm "${header.alg}" is not allowed (allowed: ${this.allowedAlgorithms.join(', ')})`,
      );
    }

    if (!header.kid) {
      throw new TokenValidationError('ID token header is missing "kid" (key ID)');
    }

    // 2. Fetch public key from JWKS
    const jwk = await this.jwksClient.getKey(header.kid);

    // 3. Import public key
    let publicKey: Uint8Array | jose.KeyLike;
    try {
      publicKey = await jose.importJWK(jwk, header.alg);
    } catch (err) {
      throw new TokenValidationError('Failed to import public key from JWKS', err);
    }

    // 4. Verify signature and claims (iss, aud, exp)
    let payload: jose.JWTPayload;
    try {
      const result = await jose.jwtVerify(idToken, publicKey, {
        issuer: this.issuer,
        audience: this.clientId,
        algorithms: this.allowedAlgorithms,
        clockTolerance: this.clockTolerance,
      });
      payload = result.payload;
    } catch (err: unknown) {
      if (err instanceof Error) {
        throw new TokenValidationError(`ID token verification failed: ${err.message}`, err);
      }
      throw new TokenValidationError('ID token verification failed', err);
    }

    // 5. Nonce validation
    if (expectedNonce) {
      const tokenNonce = payload.nonce as string | undefined;
      validateNonce(tokenNonce, expectedNonce);
    }

    // 6. Sub validation
    if (!payload.sub || typeof payload.sub !== 'string') {
      throw new TokenValidationError('ID token is missing required "sub" claim');
    }

    return payload as IDTokenClaims;
  }
}
