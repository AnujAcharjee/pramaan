import * as jose from 'jose';
import { DiscoveryError, NetworkError, TokenValidationError } from './errors.js';

export interface JWKSClientOptions {
  jwksUri: string;
  timeoutMs?: number;
  cacheTtlMs?: number;
}

export class JWKSClient {
  private readonly jwksUri: string;
  private readonly timeoutMs: number;
  private readonly cacheTtlMs: number;
  private keysMap = new Map<string, jose.JWK>();
  private cacheExpiresAt = 0;
  private lastFetchAt = 0;
  private readonly minRefreshIntervalMs = 5000; // 5 seconds cooldown on forced refetches

  constructor(options: JWKSClientOptions) {
    this.jwksUri = options.jwksUri;
    this.timeoutMs = options.timeoutMs ?? 10000;
    this.cacheTtlMs = options.cacheTtlMs ?? 60 * 60 * 1000; // 1 hour
  }

  /**
   * Fetch JWKS keys from the server.
   */
  private async fetchJWKS(): Promise<void> {
    let response: Response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      response = await fetch(this.jwksUri, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'pramaan-node-sdk/1.0',
        },
        signal: controller.signal,
      });

      clearTimeout(timer);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new NetworkError(`JWKS request timed out after ${this.timeoutMs}ms`);
      }
      throw new NetworkError(`Failed to reach JWKS endpoint at ${this.jwksUri}`, err);
    }

    const rawText = await response.text().catch(() => '');

    if (!response.ok) {
      throw new DiscoveryError(
        `Failed to fetch JWKS with HTTP ${response.status}: ${rawText}`,
        response.status,
      );
    }

    let json: unknown;
    try {
      json = rawText ? JSON.parse(rawText) : {};
    } catch (err) {
      throw new DiscoveryError(
        `Invalid JSON received from JWKS endpoint: ${rawText}`,
        response.status,
        err,
      );
    }

    const jwks = json as { keys?: jose.JWK[] };
    if (!Array.isArray(jwks.keys)) {
      throw new DiscoveryError('JWKS response must contain a "keys" array');
    }

    this.keysMap.clear();
    for (const key of jwks.keys) {
      if (key.kid) {
        this.keysMap.set(key.kid, key);
      }
    }

    this.lastFetchAt = Date.now();
    this.cacheExpiresAt = Date.now() + this.cacheTtlMs;
  }

  /**
   * Get a public JWK by key ID (kid).
   * Automatically refreshes JWKS if the kid is not found in cache (handling key rotation).
   */
  async getKey(kid: string): Promise<jose.JWK> {
    if (!kid) {
      throw new TokenValidationError('JWT header is missing key ID ("kid")');
    }

    // Refresh if cache expired
    if (this.keysMap.size === 0 || Date.now() >= this.cacheExpiresAt) {
      await this.fetchJWKS();
    }

    let key = this.keysMap.get(kid);
    if (!key && Date.now() - this.lastFetchAt >= this.minRefreshIntervalMs) {
      // Key not found in current cache and not recently fetched:
      // trigger a fresh fetch in case keys were rotated
      await this.fetchJWKS();
      key = this.keysMap.get(kid);
    }

    if (!key) {
      throw new TokenValidationError(`No matching key found in JWKS for kid: "${kid}"`);
    }

    return key;
  }
}
