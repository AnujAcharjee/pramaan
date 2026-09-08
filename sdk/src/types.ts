/**
 * Configuration options for creating a PramaanClient instance.
 */
export interface PramaanConfig {
  /**
   * The base URL of the Pramaan Identity Provider.
   * e.g. "https://pramaan.anujacharjee.com" or "http://localhost:8000"
   */
  issuer: string;

  /**
   * The OAuth 2.0 Client ID registered in Pramaan.
   */
  clientId: string;

  /**
   * The OAuth 2.0 Client Secret (required for confidential clients).
   * Kept private and never exposed to the client-side.
   */
  clientSecret?: string;

  /**
   * The default redirect URI registered for this client.
   * Can be overridden per authorization request.
   */
  redirectUri?: string;

  /**
   * Clock tolerance for JWT verification in seconds. Default is 5 seconds.
   */
  clockTolerance?: number;

  /**
   * Request timeout in milliseconds for HTTP calls. Default is 10000ms.
   */
  timeoutMs?: number;
}

/**
 * Valid scopes supported by Pramaan.
 */
export type PramaanScope = 'openid' | 'profile' | 'email' | 'avatar' | (string & {});

/**
 * The OpenID Connect Discovery document structure returned by Pramaan.
 */
export interface DiscoveryDocument {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
  response_types_supported: string[];
  subject_types_supported: string[];
  id_token_signing_alg_values_supported: string[];
  scopes_supported: string[];
  token_endpoint_auth_methods_supported: string[];
  claims_supported: string[];
  code_challenge_methods_supported: string[];
  grant_types_supported: string[];
  end_session_endpoint?: string;
  [key: string]: unknown;
}

/**
 * Options for generating an authorization request URL.
 */
export interface AuthorizationOptions {
  /**
   * Requested OAuth scopes. Defaults to ['openid', 'profile', 'email'].
   */
  scope?: PramaanScope[] | string;

  /**
   * The redirect URI to return to after authorization.
   * If omitted, falls back to config.redirectUri.
   */
  redirectUri?: string;

  /**
   * Custom state string. If omitted, a cryptographically secure 32-byte hex state is generated.
   */
  state?: string;

  /**
   * Custom nonce string. If omitted, a cryptographically secure 32-byte hex nonce is generated.
   */
  nonce?: string;

  /**
   * Custom code_verifier for PKCE. If omitted, a cryptographically secure 43-128 char verifier is generated.
   */
  codeVerifier?: string;

  /**
   * PKCE challenge method. Defaults to 'S256' per RFC 7636.
   */
  codeChallengeMethod?: 'S256' | 'plain';
}

/**
 * Security-sensitive state that must be retained across the authorization redirect.
 * Typically stored in the user's encrypted server-side session.
 */
export interface AuthorizationTransaction {
  state: string;
  nonce: string;
  codeVerifier: string;
  redirectUri: string;
  createdAt: number;
}

/**
 * Result of creating an authorization request.
 */
export interface AuthorizationRequest {
  /**
   * The complete authorization URL on Pramaan to redirect the user to.
   */
  url: string;

  /**
   * The transaction object containing state, nonce, and codeVerifier to persist in the session.
   */
  transaction: AuthorizationTransaction;
}

/**
 * Options passed to handleCallback upon returning from Pramaan.
 */
export interface CallbackOptions {
  /**
   * The authorization code received in the query parameters.
   * Required when no error occurred.
   */
  code?: string;

  /**
   * The state parameter received in the query parameters.
   */
  state: string;

  /**
   * The saved authorization transaction from the session.
   */
  transaction: AuthorizationTransaction;

  /**
   * Explicit redirectUri if different from transaction.redirectUri.
   */
  redirectUri?: string;

  /**
   * OAuth error code returned in query parameters (e.g. "access_denied").
   */
  error?: string;

  /**
   * OAuth error description returned in query parameters.
   */
  errorDescription?: string;

  /**
   * OAuth error URI returned in query parameters.
   */
  errorUri?: string;
}

/**
 * Normalized token response returned after code exchange.
 */
export interface TokenSet {
  /**
   * The access token for accessing protected resources (e.g. UserInfo).
   */
  accessToken: string;

  /**
   * The raw signed ID token JWT (if openid scope was requested).
   */
  idToken?: string;

  /**
   * Verified claims from the ID token (if openid scope was requested).
   */
  claims?: IDTokenClaims;

  /**
   * Token type (typically "Bearer").
   */
  tokenType: string;

  /**
   * Token lifetime in seconds.
   */
  expiresIn: number;

  /**
   * Granted scopes string.
   */
  scope?: string;

  /**
   * The raw JSON response from Pramaan.
   */
  raw: Record<string, unknown>;
}

/**
 * Standard OIDC ID Token Claims verified by the SDK.
 */
export interface IDTokenClaims {
  iss: string;
  sub: string;
  aud: string;
  exp: number;
  iat: number;
  nonce: string;
  [key: string]: unknown;
}

/**
 * Strongly-typed user profile claims returned by Pramaan's UserInfo endpoint.
 */
export interface UserInfo {
  /**
   * The unique Pramaan user ID (subject identifier).
   */
  sub: string;

  /**
   * User's email address (when email scope is granted).
   */
  email?: string;

  /**
   * Whether the user's email has been verified.
   */
  email_verified?: boolean;

  /**
   * CamelCase alias for email_verified.
   */
  emailVerified?: boolean;

  /**
   * User's full name (when profile scope is granted).
   */
  name?: string;

  /**
   * URL to the user's profile image / avatar.
   */
  picture?: string;

  /**
   * URL to the user's profile image / avatar (when avatar scope is granted).
   */
  avatar?: string;

  [key: string]: unknown;
}

/**
 * RFC 6749 error response shape.
 */
export interface OAuthErrorResponse {
  error: string;
  error_description?: string;
  error_uri?: string;
}
