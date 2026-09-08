import type {
  PramaanConfig,
  DiscoveryDocument,
  AuthorizationOptions,
  AuthorizationRequest,
  CallbackOptions,
  TokenSet,
  IDTokenClaims,
  UserInfo,
} from './types.js';
import { ConfigurationError, OAuthError } from './errors.js';
import { DiscoveryClient } from './discovery.js';
import { AuthorizationService } from './authorization.js';
import { TokenClient } from './token.js';
import { JWKSClient } from './jwks.js';
import { IDTokenValidator } from './id-token.js';
import { UserInfoClient } from './userinfo.js';
import { LogoutService, type LogoutOptions } from './logout.js';
import { validateState } from './transaction.js';

/**
 * Official client for integrating applications with Pramaan Identity Provider.
 */
export class PramaanClient {
  public readonly issuer: string;
  public readonly clientId: string;
  private readonly clientSecret?: string;
  private readonly defaultRedirectUri?: string;
  private readonly clockTolerance: number;
  private readonly timeoutMs: number;

  private readonly discoveryClient: DiscoveryClient;
  private readonly tokenClient: TokenClient;
  private readonly logoutService: LogoutService;

  private jwksClient: JWKSClient | null = null;
  private idTokenValidator: IDTokenValidator | null = null;
  private userInfoClient: UserInfoClient | null = null;

  constructor(config: PramaanConfig) {
    if (!config) {
      throw new ConfigurationError('PramaanClient configuration object is required');
    }

    if (!config.issuer || typeof config.issuer !== 'string') {
      throw new ConfigurationError('Configuration "issuer" is required and must be a URL string');
    }

    if (!config.clientId || typeof config.clientId !== 'string') {
      throw new ConfigurationError('Configuration "clientId" is required');
    }

    // Validate issuer protocol (allow http only for localhost development)
    const normalizedIssuer = config.issuer.replace(/\/+$/, '');
    try {
      const parsed = new URL(normalizedIssuer);
      const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
      if (parsed.protocol !== 'https:' && !isLocal) {
        throw new ConfigurationError(
          `Insecure issuer URL "${normalizedIssuer}". Production Pramaan instances must use HTTPS.`,
        );
      }
    } catch (err: unknown) {
      if (err instanceof ConfigurationError) throw err;
      throw new ConfigurationError(`Invalid issuer URL: "${config.issuer}"`, err);
    }

    this.issuer = normalizedIssuer;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.defaultRedirectUri = config.redirectUri;
    this.clockTolerance = config.clockTolerance ?? 5;
    this.timeoutMs = config.timeoutMs ?? 10000;

    this.discoveryClient = new DiscoveryClient({
      issuer: this.issuer,
      timeoutMs: this.timeoutMs,
    });

    this.tokenClient = new TokenClient();
    this.logoutService = new LogoutService();
  }

  /**
   * Fetch and return the OpenID Connect discovery metadata.
   */
  async discover(forceRefresh = false): Promise<DiscoveryDocument> {
    return this.discoveryClient.getDiscoveryDocument(forceRefresh);
  }

  /**
   * Create an authorization request containing the URL to redirect the user to
   * and the transaction object (state, nonce, codeVerifier) to store in the session.
   *
   * @example
   * ```ts
   * const auth = await pramaan.createAuthorizationRequest({
   *   scope: ['openid', 'profile', 'email']
   * });
   * req.session.oauth = auth.transaction;
   * res.redirect(auth.url);
   * ```
   */
  async createAuthorizationRequest(options: AuthorizationOptions = {}): Promise<AuthorizationRequest> {
    const discovery = await this.discover();
    const service = new AuthorizationService({
      authorizationEndpoint: discovery.authorization_endpoint,
      clientId: this.clientId,
      defaultRedirectUri: this.defaultRedirectUri,
    });

    return service.createAuthorizationRequest(options);
  }

  /**
   * Shorthand to generate just the authorization URL.
   * NOTE: Does not provide the transaction object needed for PKCE/state verification.
   * Prefer `createAuthorizationRequest` for standard authorization code flow with PKCE.
   */
  async getAuthorizationUrl(options: AuthorizationOptions = {}): Promise<string> {
    const req = await this.createAuthorizationRequest(options);
    return req.url;
  }

  /**
   * Handle the authorization callback:
   * 1. Validates the state parameter against the saved transaction (constant-time).
   * 2. Exchanges the authorization code for tokens via PKCE.
   * 3. Validates the ID token signature, issuer, audience, expiration, and nonce.
   *
   * @example
   * ```ts
   * const tokens = await pramaan.handleCallback({
   *   code: req.query.code as string,
   *   state: req.query.state as string,
   *   transaction: req.session.oauth,
   * });
   * ```
   */
  async handleCallback(options: CallbackOptions): Promise<TokenSet> {
    const { code, state, transaction, error, errorDescription, errorUri } = options;

    if (!state || typeof state !== 'string') {
      throw new ConfigurationError('Missing "state" in callback query parameters');
    }

    if (!transaction || typeof transaction !== 'object') {
      throw new ConfigurationError(
        'Missing authorization "transaction" from session. Ensure you saved transaction from createAuthorizationRequest()',
      );
    }

    // 1. Validate State using constant-time check (validates even on error callbacks)
    validateState(state, transaction.state);

    // 2. Check if an OAuth error was returned by Pramaan (e.g. user denied consent)
    if (error) {
      throw new OAuthError(error, errorDescription, errorUri);
    }

    if (!code || typeof code !== 'string') {
      throw new ConfigurationError('Missing authorization "code" in callback query parameters');
    }

    // 2. Discover endpoints
    const discovery = await this.discover();
    const redirectUri = options.redirectUri ?? transaction.redirectUri ?? this.defaultRedirectUri;

    if (!redirectUri) {
      throw new ConfigurationError('Redirect URI is required for code exchange');
    }

    // 3. Exchange Code for Tokens
    const tokenSet = await this.tokenClient.exchangeCode({
      tokenEndpoint: discovery.token_endpoint,
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      code,
      codeVerifier: transaction.codeVerifier,
      redirectUri,
      timeoutMs: this.timeoutMs,
    });

    // 4. Validate ID Token if present (when openid scope is used)
    if (tokenSet.idToken) {
      const validator = await this.getIDTokenValidator(discovery);
      tokenSet.claims = await validator.verify(tokenSet.idToken, transaction.nonce);
    }

    return tokenSet;
  }

  /**
   * Directly exchange an authorization code for tokens without handling state validation.
   */
  async exchangeCode(code: string, codeVerifier: string, redirectUri?: string): Promise<TokenSet> {
    const discovery = await this.discover();
    const targetRedirectUri = redirectUri ?? this.defaultRedirectUri;

    if (!targetRedirectUri) {
      throw new ConfigurationError('redirectUri is required for token exchange');
    }

    return this.tokenClient.exchangeCode({
      tokenEndpoint: discovery.token_endpoint,
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      code,
      codeVerifier,
      redirectUri: targetRedirectUri,
      timeoutMs: this.timeoutMs,
    });
  }

  /**
   * Verify an ID token JWT and return its claims.
   */
  async verifyIdToken(idToken: string, expectedNonce?: string): Promise<IDTokenClaims> {
    const discovery = await this.discover();
    const validator = await this.getIDTokenValidator(discovery);
    return validator.verify(idToken, expectedNonce);
  }

  /**
   * Fetch authenticated user information using an active access token.
   *
   * @example
   * ```ts
   * const user = await pramaan.getUserInfo(tokens.accessToken);
   * console.log(user.name, user.email);
   * ```
   */
  async getUserInfo(accessToken: string): Promise<UserInfo> {
    const discovery = await this.discover();
    if (!this.userInfoClient) {
      this.userInfoClient = new UserInfoClient({
        userinfoEndpoint: discovery.userinfo_endpoint,
        timeoutMs: this.timeoutMs,
      });
    }

    return this.userInfoClient.getUserInfo(accessToken);
  }

  /**
   * OpenID Connect RP-Initiated Logout.
   *
   * @throws {UnsupportedFeatureError} Pramaan does not currently support RP-Initiated logout.
   */
  getLogoutUrl(options?: LogoutOptions): string {
    return this.logoutService.getLogoutUrl(options);
  }

  /**
   * Lazily instantiate and return the ID token validator.
   */
  private async getIDTokenValidator(discovery: DiscoveryDocument): Promise<IDTokenValidator> {
    if (!this.jwksClient) {
      this.jwksClient = new JWKSClient({
        jwksUri: discovery.jwks_uri,
        timeoutMs: this.timeoutMs,
      });
    }

    if (!this.idTokenValidator) {
      this.idTokenValidator = new IDTokenValidator({
        issuer: this.issuer,
        clientId: this.clientId,
        jwksClient: this.jwksClient,
        allowedAlgorithms: discovery.id_token_signing_alg_values_supported ?? ['RS256'],
        clockToleranceSeconds: this.clockTolerance,
      });
    }

    return this.idTokenValidator;
  }
}
