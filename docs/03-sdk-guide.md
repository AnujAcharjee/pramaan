# Official SDK Integration Guide — `@anuj304/pramaan`

The easiest and most secure way to integrate a Node.js or TypeScript application with Pramaan is using the official **`@anuj304/pramaan`** SDK.

The SDK automatically handles:
- ✅ **OIDC Discovery** from `/.well-known/openid-configuration`
- ✅ **PKCE S256** code challenge and verifier generation (RFC 7636)
- ✅ **CSRF & State defense** with constant-time verification
- ✅ **Nonce management** & ID token validation
- ✅ **Token exchange** with `client_secret_post`
- ✅ **RS256 JWT signature verification** via dynamic JWKS key discovery
- ✅ **UserInfo retrieval** for user profile claims

---

## 1. Installation

```bash
npm install @anuj304/pramaan
```

*(Requires Node.js >= 18.0.0)*

---

## 2. Initialize the Client

Initialize `PramaanClient` once with your client credentials:

```typescript
import { PramaanClient } from "@anuj304/pramaan";

export const pramaan = new PramaanClient({
  issuer: process.env.PRAMAAN_ISSUER || "https://pramaan.anujacharjee.com",
  clientId: process.env.PRAMAAN_CLIENT_ID!,
  clientSecret: process.env.PRAMAAN_CLIENT_SECRET, // required for confidential server-side clients
  redirectUri: "http://localhost:3000/callback",
});
```

---

## 3. Web Framework Integration (Express Example)

### Step 1: Initiate Login

When the user clicks "Sign in with Pramaan", call `createAuthorizationRequest()`. This generates the Pramaan login URL and an `AuthorizationTransaction` object (containing the `state`, `nonce`, and `codeVerifier`).

Store this transaction in the user's encrypted server-side session:

```typescript
app.get("/login", async (req, res, next) => {
  try {
    const auth = await pramaan.createAuthorizationRequest({
      scope: ["openid", "profile", "email"],
    });

    // Save transaction state in the session
    req.session.oauth = auth.transaction;

    // Redirect user to Pramaan login
    res.redirect(auth.url);
  } catch (err) {
    next(err);
  }
});
```

### Step 2: Handle Callback

When Pramaan redirects the user back to your redirect URI, pass the query parameters and saved session transaction to `handleCallback()`.

The SDK will:
1. Verify the `state` matches the transaction using constant-time comparison.
2. Exchange the authorization code for tokens at the discovered token endpoint.
3. Validate the ID token's RS256 signature, issuer, audience, and nonce via JWKS.

```typescript
app.get("/callback", async (req, res, next) => {
  try {
    const tokens = await pramaan.handleCallback({
      code: req.query.code as string,
      state: req.query.state as string,
      transaction: req.session.oauth,
      error: req.query.error as string,
      errorDescription: req.query.error_description as string,
    });

    // Clean up one-time transaction
    delete req.session.oauth;

    // Store tokens in session (or find/create local user in your database)
    req.session.tokens = tokens;

    res.redirect("/profile");
  } catch (err) {
    next(err);
  }
});
```

### Step 3: Fetch User Profile

Use the issued `accessToken` to retrieve the authenticated user's profile claims:

```typescript
app.get("/profile", async (req, res, next) => {
  try {
    if (!req.session.tokens?.accessToken) {
      return res.redirect("/login");
    }

    const user = await pramaan.getUserInfo(req.session.tokens.accessToken);

    res.json({
      id: user.sub,
      name: user.name,
      email: user.email,
      verified: user.email_verified,
      picture: user.picture,
    });
  } catch (err) {
    next(err);
  }
});
```

### Step 4: Logout

To log out from your application, destroy your local application session:

```typescript
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});
```

---

## 4. Client Configuration Reference

| Option | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `issuer` | `string` | Yes | Pramaan base URL (e.g. `https://pramaan.anujacharjee.com`) |
| `clientId` | `string` | Yes | Client ID issued by Pramaan dashboard |
| `clientSecret` | `string` | No | Client Secret (required for confidential server apps) |
| `redirectUri` | `string` | No | Default callback URI registered in Pramaan |
| `timeoutMs` | `number` | No | HTTP request timeout in milliseconds (default: `10000`) |
| `fetchFn` | `typeof fetch` | No | Custom fetch function (defaults to global `fetch`) |

---

## 5. Typed Error Handling

The SDK throws descriptive, typed errors inheriting from `PramaanError`:

```typescript
import {
  PramaanError,
  OAuthErrorResponse,
  StateMismatchError,
  TokenExchangeError,
  IdTokenVerificationError,
  UserInfoError,
  DiscoveryError,
} from "@anuj304/pramaan";

try {
  const tokens = await pramaan.handleCallback({ ... });
} catch (error) {
  if (error instanceof OAuthErrorResponse) {
    // Pramaan returned an OAuth error parameter (e.g. access_denied)
    console.error(`OAuth error: ${error.error} - ${error.errorDescription}`);
  } else if (error instanceof StateMismatchError) {
    // Potential CSRF attack or expired session
    console.error("State parameter did not match transaction session");
  } else if (error instanceof IdTokenVerificationError) {
    // Signature or claims validation failed
    console.error("ID token failed RS256/JWKS validation:", error.message);
  } else if (error instanceof TokenExchangeError) {
    // HTTP error during token POST
    console.error("Token exchange failed:", error.status, error.message);
  } else if (error instanceof PramaanError) {
    // Base SDK error
    console.error("Pramaan SDK error:", error.message);
  }
}
```

---

## 6. Granular / Modular Utilities

For custom architectures, the SDK exports standalone helper functions:

```typescript
import {
  generatePkce,
  buildAuthorizationUrl,
  createRemoteJwks,
  verifyIdToken,
  discoverOidcConfig,
} from "@anuj304/pramaan";

// 1. Generate PKCE verifier + challenge
const { codeVerifier, codeChallenge } = generatePkce();

// 2. Discover endpoints
const config = await discoverOidcConfig("https://pramaan.anujacharjee.com");

// 3. Construct URL manually
const url = buildAuthorizationUrl(config.authorization_endpoint, {
  clientId: "your-client-id",
  redirectUri: "https://yourapp.com/callback",
  scope: ["openid", "profile"],
  state: "xyz123",
  codeChallenge,
});
```

---

## 7. Complete Reference Example

A complete, runnable Express application with session configuration, styled UI, and error handling is located in the repository at:
[`application/sdk/examples/express`](../sdk/examples/express/)

To run it locally:
```bash
cd application/sdk/examples/express
cp .env.example .env
npm install
npm run dev
```

---

## Next Steps

- [Client Registration Guide →](./01-create-client.md) — Create and configure your OAuth client credentials
- [API & Claims Reference →](./04-api-reference.md) — Comprehensive endpoints, tokens, and claims specs
- [Manual Implementation Guide →](./02-signup-flow.md) — Protocol specifications for non-Node.js stacks
- [Security Best Practices →](./05-security.md) — Hardening, PKCE rationale, and CSRF mitigation

