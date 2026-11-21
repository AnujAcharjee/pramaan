import { ENV } from '../config/env.js';
import { SCOPES, KEY_ALGORITHMS } from '../utils/constant.js';

export interface OpenIdConfiguration {
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
}

export class DiscoveryService {
  getOpenIdConfiguration(): OpenIdConfiguration {
    const issuer = ENV.AUTH_ISSUER.replace(/\/+$/, '');

    return {
      issuer,
      authorization_endpoint: `${issuer}/api/oauth/authorize`,
      token_endpoint: `${issuer}/api/oauth/token`,
      userinfo_endpoint: `${issuer}/userinfo`,
      jwks_uri: `${issuer}/.well-known/jwks.json`,
      response_types_supported: ['code'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: [KEY_ALGORITHMS.RS256],
      scopes_supported: Object.values(SCOPES),
      token_endpoint_auth_methods_supported: ['client_secret_post'],
      claims_supported: [
        'sub',
        'iss',
        'aud',
        'exp',
        'iat',
        'nonce',
        'email',
        'email_verified',
        'name',
        'picture',
        'avatar',
      ],
      code_challenge_methods_supported: ['S256', 'plain'],
      grant_types_supported: ['authorization_code'],
    };
  }
}

export const discoveryService = new DiscoveryService();
