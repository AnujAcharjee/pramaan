import { PRAMAAN_SERVER } from '../config.js';

export interface OpenIdConfiguration {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
  response_types_supported?: string[];
  subject_types_supported?: string[];
  id_token_signing_alg_values_supported?: string[];
  scopes_supported?: string[];
  token_endpoint_auth_methods_supported?: string[];
  claims_supported?: string[];
  code_challenge_methods_supported?: string[];
  grant_types_supported?: string[];
  [key: string]: unknown;
}

let cachedConfig: OpenIdConfiguration | null = null;

export async function getOpenIdConfiguration(): Promise<OpenIdConfiguration> {
  if (cachedConfig) {
    return cachedConfig;
  }

  const discoveryUrl = new URL('/.well-known/openid-configuration', PRAMAAN_SERVER);
  const response = await fetch(discoveryUrl.toString(), {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch OpenID Configuration from ${discoveryUrl}: ${response.status} ${response.statusText}`,
    );
  }

  const rawConfig = (await response.json()) as OpenIdConfiguration;

  // If the server's AUTH_ISSUER is configured for production (e.g. https://pramaan.anujacharjee.com)
  // but PRAMAAN_SERVER points to a local or alternative server (e.g. http://localhost:8080),
  // ensure endpoint URLs route to PRAMAAN_SERVER so requests reach the active test server.
  const serverOrigin = new URL(PRAMAAN_SERVER).origin;
  const remapUrl = (endpointUrl: string): string => {
    try {
      const parsed = new URL(endpointUrl);
      return new URL(parsed.pathname + parsed.search, serverOrigin).toString();
    } catch {
      return endpointUrl;
    }
  };

  cachedConfig = {
    ...rawConfig,
    authorization_endpoint: remapUrl(rawConfig.authorization_endpoint),
    token_endpoint: remapUrl(rawConfig.token_endpoint),
    userinfo_endpoint: remapUrl(rawConfig.userinfo_endpoint),
    jwks_uri: remapUrl(rawConfig.jwks_uri),
  };

  return cachedConfig;
}
