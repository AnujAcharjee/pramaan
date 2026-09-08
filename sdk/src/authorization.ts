import type { AuthorizationOptions, AuthorizationRequest, AuthorizationTransaction } from './types.js';
import { generatePKCE } from './pkce.js';
import { createTransaction } from './transaction.js';
import { ConfigurationError } from './errors.js';

export interface AuthorizationUrlBuilderOptions {
  authorizationEndpoint: string;
  clientId: string;
  defaultRedirectUri?: string;
}

export class AuthorizationService {
  constructor(private readonly options: AuthorizationUrlBuilderOptions) {
    if (!options.authorizationEndpoint) {
      throw new ConfigurationError('authorizationEndpoint is required');
    }
    if (!options.clientId) {
      throw new ConfigurationError('clientId is required');
    }
  }

  /**
   * Construct the authorization URL and transaction state.
   */
  createAuthorizationRequest(options: AuthorizationOptions = {}): AuthorizationRequest {
    const redirectUri = options.redirectUri ?? this.options.defaultRedirectUri;
    if (!redirectUri) {
      throw new ConfigurationError('redirectUri is required either in PramaanClient config or in authorization options');
    }

    // Process scope
    let rawScopes: string[];
    if (Array.isArray(options.scope)) {
      rawScopes = options.scope.flatMap((s) => s.split(' '));
    } else if (typeof options.scope === 'string') {
      rawScopes = options.scope.split(' ');
    } else {
      rawScopes = ['openid', 'profile', 'email'];
    }

    const scopes = Array.from(new Set(rawScopes.map((s) => s.trim()).filter(Boolean)));

    if (scopes.length === 0) {
      scopes.push('openid', 'profile', 'email');
    }

    const scopeString = scopes.join(' ');
    const isOpenId = scopes.includes('openid');

    // Generate PKCE parameters
    const pkceMethod = options.codeChallengeMethod ?? 'S256';
    const pkce = generatePKCE(pkceMethod);
    const codeVerifier = options.codeVerifier ?? pkce.codeVerifier;
    const codeChallenge = pkce.codeChallenge;

    // Create secure transaction (state, nonce, verifier)
    const transaction: AuthorizationTransaction = createTransaction({
      codeVerifier,
      redirectUri,
      state: options.state,
      nonce: options.nonce,
    });

    // Build URL
    const url = new URL(this.options.authorizationEndpoint);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.options.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', scopeString);
    url.searchParams.set('state', transaction.state);

    // Pramaan requires nonce when openid is requested
    if (isOpenId) {
      url.searchParams.set('nonce', transaction.nonce);
    }

    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', pkceMethod);

    return {
      url: url.toString(),
      transaction,
    };
  }
}
