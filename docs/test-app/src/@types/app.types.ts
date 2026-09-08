export interface OAuthSessionData {
  intent: string;
  state: string;
  nonce: string;
  codeVerifier: string;
}

export interface AppUser {
  id: string;
  provider: 'oidc';
  providerUserId: string;
  email: string;
  name: string;
  avatar: string | null;
  createdAt: Date;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  id_token?: string;
  accessToken?: string;
  idToken?: string;
}
