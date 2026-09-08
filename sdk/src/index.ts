// Main client
export { PramaanClient } from './client.js';

// Sub-clients and services
export { DiscoveryClient } from './discovery.js';
export { AuthorizationService } from './authorization.js';
export { TokenClient } from './token.js';
export { JWKSClient } from './jwks.js';
export { IDTokenValidator } from './id-token.js';
export { UserInfoClient } from './userinfo.js';
export { LogoutService } from './logout.js';

// Utility functions
export { generatePKCE, computeChallenge } from './pkce.js';
export { createTransaction, validateState, validateNonce, generateRandomString } from './transaction.js';

// Errors
export {
  PramaanError,
  ConfigurationError,
  DiscoveryError,
  PKCEError,
  StateMismatchError,
  NonceMismatchError,
  OAuthError,
  TokenError,
  TokenValidationError,
  NetworkError,
  UnsupportedFeatureError,
} from './errors.js';

// Types
export type {
  PramaanConfig,
  PramaanScope,
  DiscoveryDocument,
  AuthorizationOptions,
  AuthorizationRequest,
  AuthorizationTransaction,
  CallbackOptions,
  TokenSet,
  IDTokenClaims,
  UserInfo,
  OAuthErrorResponse,
} from './types.js';

export type { PKCEPair } from './pkce.js';
export type { DiscoveryOptions } from './discovery.js';
export type { AuthorizationUrlBuilderOptions } from './authorization.js';
export type { TokenExchangeOptions } from './token.js';
export type { JWKSClientOptions } from './jwks.js';
export type { IDTokenValidatorOptions } from './id-token.js';
export type { UserInfoClientOptions } from './userinfo.js';
export type { LogoutOptions } from './logout.js';
