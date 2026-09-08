/**
 * Base error class for all Pramaan SDK errors.
 */
export class PramaanError extends Error {
  constructor(message: string, public override readonly cause?: unknown) {
    super(message, { cause });
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when client configuration is invalid or missing required parameters.
 */
export class ConfigurationError extends PramaanError {}

/**
 * Thrown when OpenID Connect Discovery fails or returns an invalid document.
 */
export class DiscoveryError extends PramaanError {
  constructor(message: string, public readonly status?: number, cause?: unknown) {
    super(message, cause);
  }
}

/**
 * Thrown when PKCE verifier/challenge generation or validation fails.
 */
export class PKCEError extends PramaanError {}

/**
 * Thrown when state validation fails on callback (prevents CSRF / state injection).
 */
export class StateMismatchError extends PramaanError {
  constructor(message = 'State validation failed: state parameter does not match the original transaction') {
    super(message);
  }
}

/**
 * Thrown when nonce validation fails on ID token verification.
 */
export class NonceMismatchError extends PramaanError {
  constructor(message = 'Nonce validation failed: ID token nonce claim does not match the original transaction') {
    super(message);
  }
}

/**
 * Thrown when an OAuth 2.0 error is returned by the authorization server.
 * Preserves standard RFC 6749 fields: error (code), error_description, error_uri.
 */
export class OAuthError extends PramaanError {
  constructor(
    public readonly code: string,
    public readonly description?: string,
    public readonly uri?: string,
    public readonly statusCode?: number,
    cause?: unknown,
  ) {
    super(
      `OAuth Error [${code}]${description ? `: ${description}` : ''}${statusCode ? ` (HTTP ${statusCode})` : ''}`,
      cause,
    );
  }
}

/**
 * Thrown when token exchange fails or returns a malformed response.
 */
export class TokenError extends PramaanError {
  constructor(message: string, public readonly statusCode?: number, cause?: unknown) {
    super(message, cause);
  }
}

/**
 * Thrown when ID token JWT validation fails (invalid signature, expired, bad claims).
 */
export class TokenValidationError extends PramaanError {}

/**
 * Thrown when HTTP network requests time out or fail to reach the server.
 */
export class NetworkError extends PramaanError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
  }
}

/**
 * Thrown when calling a feature not currently supported by Pramaan (e.g. RP-Initiated logout).
 */
export class UnsupportedFeatureError extends PramaanError {}
