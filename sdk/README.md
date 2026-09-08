# @anuj304/pramaan

The official Node.js SDK for **Pramaan** — the self-hostable OAuth 2.0 and OpenID Connect Identity Provider.

Integrate authentication and single sign-on into your Node.js applications with standard Authorization Code flow, automated PKCE (RFC 7636), cryptographic state/nonce verification, JWKS key rotation, and UserInfo profile retrieval.

---

## Features

* 🔍 **Automatic OIDC Discovery**: Dynamically resolves endpoints from `/.well-known/openid-configuration` — no hardcoded URLs.
* 🛡️ **Built-in PKCE (RFC 7636)**: Secure S256 code challenge and verifier generation to protect against code interception.
* 🔒 **CSRF & Nonce Protection**: Constant-time `state` validation and strict OIDC `nonce` validation.
* 🔑 **Cryptographic ID Token Verification**: Validates RS256 signatures, audience, issuer, expiration, and key ID (`kid`) rotation using standard JWKS.
* 👤 **UserInfo Integration**: Type-safe profile retrieval from the `/userinfo` endpoint.
* ⚡ **Framework Independent**: Pure TypeScript library compatible with Express, Fastify, NestJS, or raw Node.js HTTP servers.
* 📦 **Zero Fluff**: Clean API without unnecessary abstractions or database vendor lock-in.

---

## Installation

```bash
npm install @anuj304/pramaan
```

Requires Node.js `>= 18.0.0`.

---

## Quick Start

### 1. Initialize the Client

```ts
import { PramaanClient } from '@anuj304/pramaan';

export const pramaan = new PramaanClient({
  issuer: 'https://pramaan.anujacharjee.com',
  clientId: process.env.PRAMAAN_CLIENT_ID!,
  clientSecret: process.env.PRAMAAN_CLIENT_SECRET, // required for confidential clients
  redirectUri: 'http://localhost:3000/callback',
});
```

### 2. Initiate Login (Create Authorization Request)

Generate a cryptographically secure authorization URL and transaction state:

```ts
app.get('/login', async (req, res) => {
  const auth = await pramaan.createAuthorizationRequest({
    scope: ['openid', 'profile', 'email'],
  });

  // Save the transaction in the server-side session
  req.session.oauth = auth.transaction;

  // Redirect the browser to Pramaan
  res.redirect(auth.url);
});
```

### 3. Handle Callback

Exchange the authorization code for tokens, validate state, and verify the ID token:

```ts
app.get('/callback', async (req, res) => {
  const tokens = await pramaan.handleCallback({
    code: req.query.code as string,
    state: req.query.state as string,
    transaction: req.session.oauth,
  });

  // Clear one-time transaction
  delete req.session.oauth;

  // Store tokens in your server session
  req.session.tokens = tokens;

  res.redirect('/profile');
});
```

### 4. Fetch User Profile

Retrieve authenticated user claims:

```ts
app.get('/profile', async (req, res) => {
  const user = await pramaan.getUserInfo(req.session.tokens.accessToken);

  res.json({
    id: user.sub,
    name: user.name,
    email: user.email,
    picture: user.picture,
  });
});
```

---

## Architecture Flow

```text
Host Application                       Pramaan IdP
      │                                     │
      ├─────── 1. OIDC Discovery ──────────>│ (/.well-known/openid-configuration)
      │<────── Metadata & Endpoints ────────┤
      │                                     │
      ├─────── 2. Redirect to Login ───────>│ (/api/oauth/authorize)
      │        (PKCE + state + nonce)       │
      │                                     │ User Authenticates & Consents
      │<────── 3. Redirect Callback ────────┤ (code + state)
      │                                     │
      ├─────── 4. Exchange Code ───────────>│ (/api/oauth/token)
      │<────── 5. Access & ID Tokens ───────┤
      │                                     │
      ├─────── 6. Fetch JWKS ──────────────>│ (/.well-known/jwks.json)
      │<────── 7. Public Signing Keys ──────┤ (Verify RS256 Signature)
      │                                     │
      ├─────── 8. Fetch UserInfo ──────────>│ (/userinfo)
      │<────── 9. Profile Claims ───────────┤
```

---

## Security Best Practices

1. **Keep Secrets Server-Side**: Never initialize `PramaanClient` with a `clientSecret` in browser, client-side, or mobile apps.
2. **Use Server Sessions**: Persist `auth.transaction` and issued `tokens` inside encrypted server-side sessions (e.g. `express-session` with Redis/cookie store). Never store tokens in browser `localStorage`.
3. **Always Verify State & Nonce**: The SDK's `handleCallback()` method performs constant-time state comparison to mitigate timing attacks and prevent CSRF login attacks.
4. **HTTPS in Production**: The SDK enforces `https://` for all production issuer URLs, allowing unencrypted `http://` solely on `localhost` and `127.0.0.1`.

---

## API Reference

### `new PramaanClient(config)`

* `issuer` *(string, required)*: Base URL of your Pramaan instance.
* `clientId` *(string, required)*: Registered OAuth Client ID.
* `clientSecret` *(string, optional)*: Client Secret for confidential clients.
* `redirectUri` *(string, optional)*: Default redirect URI for callbacks.
* `clockTolerance` *(number, optional)*: JWT clock skew tolerance in seconds (default: 5).
* `timeoutMs` *(number, optional)*: HTTP timeout in ms (default: 10000).

### Methods

* `discover(forceRefresh?: boolean): Promise<DiscoveryDocument>`
* `createAuthorizationRequest(options?: AuthorizationOptions): Promise<AuthorizationRequest>`
* `getAuthorizationUrl(options?: AuthorizationOptions): Promise<string>`
* `handleCallback(options: CallbackOptions): Promise<TokenSet>`
* `exchangeCode(code: string, codeVerifier: string, redirectUri?: string): Promise<TokenSet>`
* `verifyIdToken(idToken: string, expectedNonce?: string): Promise<IDTokenClaims>`
* `getUserInfo(accessToken: string): Promise<UserInfo>`
* `getLogoutUrl(options?: LogoutOptions): string` *(Throws `UnsupportedFeatureError` until implemented in Pramaan)*

### Error Classes

* `PramaanError`: Base class for all SDK errors.
* `ConfigurationError`: Invalid initialization options or parameters.
* `DiscoveryError`: Discovery endpoint network failure or invalid metadata.
* `OAuthError`: Standard OAuth 2.0 error returned by server (`error`, `error_description`, `error_uri`).
* `TokenValidationError`: ID token signature verification or claims mismatch.
* `StateMismatchError`: State parameter does not match the transaction.
* `NonceMismatchError`: ID token nonce does not match the transaction.
* `UnsupportedFeatureError`: Calling an endpoint not yet supported by Pramaan.

---

## Examples

See the [`examples/express`](examples/express/) directory for a full working Express implementation.

---

## Current Protocol Limitations

* **RP-Initiated Logout**: Pramaan does not currently support `end_session_endpoint`. Local session cleanup should be performed by the application.
* **Refresh Tokens**: Pramaan currently issues access tokens and ID tokens only. Refresh token rotation is not yet implemented on the server.
* **Token Revocation / Introspection**: RFC 7009 / RFC 7662 endpoints are not yet supported.

---

## License

[MIT](LICENSE) © [Anuj Acharjee](https://anujacharjee.com)
