import type { DiscoveryDocument } from './types.js';
import { DiscoveryError, NetworkError } from './errors.js';

export interface DiscoveryOptions {
  issuer: string;
  timeoutMs?: number;
  cacheTtlMs?: number;
}

export class DiscoveryClient {
  private readonly issuer: string;
  private readonly timeoutMs: number;
  private readonly cacheTtlMs: number;
  private cachedDoc: DiscoveryDocument | null = null;
  private cacheExpiresAt = 0;

  constructor(options: DiscoveryOptions) {
    // Normalize issuer URL: remove trailing slash
    this.issuer = options.issuer.replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? 10000;
    this.cacheTtlMs = options.cacheTtlMs ?? 60 * 60 * 1000; // 1 hour cache
  }

  /**
   * Fetch and validate OpenID Connect Discovery metadata from the issuer.
   */
  async getDiscoveryDocument(forceRefresh = false): Promise<DiscoveryDocument> {
    if (!forceRefresh && this.cachedDoc && Date.now() < this.cacheExpiresAt) {
      return this.cachedDoc;
    }

    const discoveryUrl = `${this.issuer}/.well-known/openid-configuration`;

    let response: Response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      response = await fetch(discoveryUrl, {
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
        throw new NetworkError(`OIDC Discovery request timed out after ${this.timeoutMs}ms`);
      }
      throw new NetworkError(`Failed to reach OIDC Discovery endpoint at ${discoveryUrl}`, err);
    }

    const bodyText = await response.text().catch(() => '');

    if (!response.ok) {
      throw new DiscoveryError(
        `OIDC Discovery failed with HTTP ${response.status} (${response.statusText}): ${bodyText}`,
        response.status,
      );
    }

    let doc: unknown;
    try {
      doc = JSON.parse(bodyText);
    } catch (err: unknown) {
      throw new DiscoveryError('Invalid JSON received from OIDC Discovery endpoint', response.status, err);
    }

    this.validateDiscoveryDocument(doc);

    this.cachedDoc = doc as DiscoveryDocument;
    this.cacheExpiresAt = Date.now() + this.cacheTtlMs;

    return this.cachedDoc;
  }

  /**
   * Validate that the document contains required OIDC discovery properties and that issuer matches.
   */
  private validateDiscoveryDocument(doc: unknown): asserts doc is DiscoveryDocument {
    if (!doc || typeof doc !== 'object') {
      throw new DiscoveryError('Discovery document must be a valid JSON object');
    }

    const d = doc as Record<string, unknown>;

    if (typeof d.issuer !== 'string' || !d.issuer) {
      throw new DiscoveryError('Discovery document is missing required "issuer" field');
    }

    const returnedIssuer = d.issuer.replace(/\/+$/, '');
    if (returnedIssuer !== this.issuer) {
      throw new DiscoveryError(
        `Discovery issuer mismatch: expected "${this.issuer}" but received "${returnedIssuer}"`,
      );
    }

    if (typeof d.authorization_endpoint !== 'string' || !d.authorization_endpoint) {
      throw new DiscoveryError('Discovery document is missing "authorization_endpoint"');
    }

    if (typeof d.token_endpoint !== 'string' || !d.token_endpoint) {
      throw new DiscoveryError('Discovery document is missing "token_endpoint"');
    }

    if (typeof d.jwks_uri !== 'string' || !d.jwks_uri) {
      throw new DiscoveryError('Discovery document is missing "jwks_uri"');
    }

    if (typeof d.userinfo_endpoint !== 'string' || !d.userinfo_endpoint) {
      throw new DiscoveryError('Discovery document is missing "userinfo_endpoint"');
    }
  }

  /**
   * Invalidate cached discovery document.
   */
  clearCache(): void {
    this.cachedDoc = null;
    this.cacheExpiresAt = 0;
  }
}
