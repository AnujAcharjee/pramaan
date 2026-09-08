import type { TokenSet } from './types.js';
import { OAuthError, TokenError, NetworkError } from './errors.js';

export interface TokenExchangeOptions {
  tokenEndpoint: string;
  clientId: string;
  clientSecret?: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
  timeoutMs?: number;
}

export class TokenClient {
  /**
   * Exchange an authorization code for tokens at the token endpoint.
   */
  async exchangeCode(options: TokenExchangeOptions): Promise<TokenSet> {
    const { tokenEndpoint, clientId, clientSecret, code, codeVerifier, redirectUri, timeoutMs = 10000 } = options;

    const bodyParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    });

    if (clientSecret) {
      bodyParams.set('client_secret', clientSecret);
    }

    let response: Response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          'User-Agent': 'pramaan-node-sdk/1.0',
        },
        body: bodyParams.toString(),
        signal: controller.signal,
      });

      clearTimeout(timer);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new NetworkError(`Token exchange request timed out after ${timeoutMs}ms`);
      }
      throw new NetworkError(`Failed to connect to token endpoint at ${tokenEndpoint}`, err);
    }

    const rawText = await response.text().catch(() => '');
    let json: unknown;
    try {
      json = rawText ? JSON.parse(rawText) : {};
    } catch (err) {
      throw new TokenError(
        `Failed to parse token response as JSON (HTTP ${response.status}): ${rawText}`,
        response.status,
        err,
      );
    }

    // Handle OAuth 2.0 error responses (RFC 6749 Section 5.2)
    if (!response.ok) {
      const errObj = json as Record<string, unknown>;
      const errorCode = typeof errObj.error === 'string' ? errObj.error : 'token_request_failed';
      const description = typeof errObj.error_description === 'string' ? errObj.error_description : undefined;
      const uri = typeof errObj.error_uri === 'string' ? errObj.error_uri : undefined;

      throw new OAuthError(errorCode, description, uri, response.status);
    }

    // Handle response data (RFC 6749 keys or custom envelope)
    const rawData = json as Record<string, unknown>;
    const payload = (rawData.data && typeof rawData.data === 'object' ? rawData.data : rawData) as Record<
      string,
      unknown
    >;

    const accessToken = (payload.access_token ?? payload.accessToken) as string | undefined;
    if (!accessToken || typeof accessToken !== 'string') {
      throw new TokenError('Token response is missing "access_token"', response.status);
    }

    const idToken = (payload.id_token ?? payload.idToken) as string | undefined;
    const tokenType = (payload.token_type ?? payload.tokenType ?? 'Bearer') as string;
    const expiresIn = Number(payload.expires_in ?? payload.expiresIn ?? 600);
    const scope = typeof payload.scope === 'string' ? payload.scope : undefined;

    return {
      accessToken,
      idToken: typeof idToken === 'string' ? idToken : undefined,
      tokenType,
      expiresIn: isNaN(expiresIn) ? 600 : expiresIn,
      scope,
      raw: rawData,
    };
  }
}
