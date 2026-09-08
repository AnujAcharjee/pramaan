import { CLIENT_ID, CLIENT_SECRET, CALLBACK_URL } from '../config.js';
import { getOpenIdConfiguration } from '../utils/discovery.js';
import { verifyIdToken } from '../utils/jose.js';
import { TokenResponse } from '../@types/app.types.js';

export interface UserProfileClaims {
  sub: string;
  email: string;
  name: string;
  avatar?: string | null;
  picture?: string | null;
  [key: string]: unknown;
}

export interface BuildAuthUrlParams {
  state: string;
  nonce: string;
  codeChallenge: string;
  scope?: string;
}

export class OAuthClientService {
  async buildAuthorizationUrl(params: BuildAuthUrlParams): Promise<string> {
    const oidcConfig = await getOpenIdConfiguration();
    const authUrl = new URL(oidcConfig.authorization_endpoint);

    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', CALLBACK_URL);
    authUrl.searchParams.set('scope', params.scope ?? 'openid profile email');
    authUrl.searchParams.set('state', params.state);
    authUrl.searchParams.set('nonce', params.nonce);
    authUrl.searchParams.set('code_challenge', params.codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    return authUrl.toString();
  }

  async exchangeCodeForTokens(code: string, codeVerifier: string): Promise<TokenResponse> {
    const oidcConfig = await getOpenIdConfiguration();
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code_verifier: codeVerifier,
    });

    const response = await fetch(oidcConfig.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token exchange failed:', errorText);
      throw new Error(`Token exchange failed: ${response.status}`);
    }

    const json = await response.json();
    return (json.data ?? json) as TokenResponse;
  }

  async fetchUserInfo(accessToken: string): Promise<UserProfileClaims> {
    const oidcConfig = await getOpenIdConfiguration();
    const response = await fetch(oidcConfig.userinfo_endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Profile fetch failed: ${response.status}`);
    }

    return (await response.json()) as UserProfileClaims;
  }

  async verifyIdToken(idToken: string, nonce: string) {
    return verifyIdToken(idToken, nonce);
  }
}

export const oauthClientService = new OAuthClientService();
