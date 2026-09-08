# Implementation Guide — OAuth 2.0 + OpenID Connect with Pramaan

This guide walks through the complete Authorization Code flow with PKCE using Pramaan as the identity provider.

The examples use Node.js with Express and the [`jose`](https://github.com/panva/jose) library for JWT verification.

> 💡 **Using Node.js or TypeScript?** You do not need to implement this protocol manually. The official SDK [**`@anuj304/pramaan`**](./03-sdk-guide.md) implements this complete flow with automated PKCE, cryptographic state verification, token exchange, and JWKS verification out-of-the-box.

---

## Overview

1. Your app generates PKCE parameters, state, and nonce
2. User is redirected to Pramaan's authorization endpoint
3. User authenticates and grants consent on Pramaan
4. Pramaan redirects back to your callback with an authorization code
5. Your backend exchanges the code (with PKCE proof) for an access token and ID token
6. Your backend verifies the ID token signature via JWKS and validates claims
7. Your backend fetches user profile claims from the UserInfo endpoint
8. Your app creates a local user record and establishes its own session


## Step 0 — Discover Endpoints

Pramaan publishes an OpenID Connect discovery document. Fetch it once at startup and cache it:

```typescript
const PRAMAAN_SERVER = process.env.PRAMAAN_SERVER!; // e.g. "https://pramaan.anujacharjee.com"

interface OidcConfig {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
}

let cached: OidcConfig | null = null;

async function getOidcConfig(): Promise<OidcConfig> {
  if (cached) return cached;

  const res = await fetch(`${PRAMAAN_SERVER}/.well-known/openid-configuration`);
  if (!res.ok) throw new Error(`Discovery failed: ${res.status}`);

  cached = (await res.json()) as OidcConfig;
  return cached;
}
```

The discovery document returns the exact endpoint URLs to use in subsequent steps, so you never need to hardcode paths.

---

## Step 1 — Generate Security Parameters

Generate a PKCE code verifier/challenge pair, a `state` value for CSRF protection, and a `nonce` that will be embedded in the ID token:

```typescript
import crypto from "crypto";

function base64url(bytes: Buffer): string {
  return bytes.toString("base64url");
}

export function generateOAuthParameters() {
  const codeVerifier = base64url(crypto.randomBytes(32));

  return {
    state: base64url(crypto.randomBytes(32)),
    nonce: base64url(crypto.randomBytes(32)),
    codeVerifier,
    codeChallenge: base64url(
      crypto.createHash("sha256").update(codeVerifier).digest()
    ),
  };
}
```

Store `state`, `nonce`, and `codeVerifier` in the server-side session — they are needed later during the callback.

---

## Step 2 — Redirect to Authorization Endpoint

Build the authorization URL using the discovered `authorization_endpoint` and redirect the user:

```typescript
app.get("/login", async (req, res) => {
  const config = await getOidcConfig();
  const params = generateOAuthParameters();

  // Save to session for callback validation
  req.session.oauth = {
    state: params.state,
    nonce: params.nonce,
    codeVerifier: params.codeVerifier,
  };

  const url = new URL(config.authorization_endpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", process.env.CLIENT_ID!);
  url.searchParams.set("redirect_uri", process.env.CALLBACK_URL!);
  url.searchParams.set("scope", "openid profile email");
  url.searchParams.set("state", params.state);
  url.searchParams.set("nonce", params.nonce);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  res.redirect(url.toString());
});
```

Pramaan will authenticate the user, show a consent screen (if needed), and redirect back to your `redirect_uri` with `code` and `state` query parameters.

---

## Step 3 — Handle the Callback

Validate the `state` parameter and extract the authorization code:

```typescript
app.get("/oauth/callback", async (req, res) => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    console.error("OAuth error:", error_description || error);
    return res.redirect("/login?error=access_denied");
  }

  if (!state || state !== req.session.oauth?.state) {
    return res.status(403).send("Invalid state parameter");
  }

  if (typeof code !== "string") {
    return res.status(400).send("Missing authorization code");
  }

  // Proceed to token exchange (Step 4)
});
```

---

## Step 4 — Exchange Code for Tokens

Send the authorization code and PKCE `code_verifier` to the token endpoint:

```typescript
async function exchangeCode(code: string, codeVerifier: string) {
  const config = await getOidcConfig();

  const res = await fetch(config.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: process.env.CLIENT_ID!,
      client_secret: process.env.CLIENT_SECRET!,
      code_verifier: codeVerifier,
    }).toString(),
  });

  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);

  return await res.json();
}
```

The response contains:

```json
{
  "access_token": "eyJhbG...",
  "token_type": "Bearer",
  "expires_in": 600,
  "scope": "openid profile email",
  "id_token": "eyJhbG..."
}
```

---

## Step 5 — Verify the ID Token

Validate the RS256 signature using Pramaan's JWKS, and check the `issuer`, `audience`, and `nonce` claims:

```typescript
import { createRemoteJWKSet, jwtVerify } from "jose";

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

async function verifyIdToken(idToken: string, expectedNonce: string) {
  const config = await getOidcConfig();

  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(config.jwks_uri));
  }

  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: config.issuer,
    audience: process.env.CLIENT_ID!,
    algorithms: ["RS256"],
  });

  if (payload.nonce !== expectedNonce) {
    throw new Error("Nonce mismatch — possible token replay");
  }

  return payload; // { sub, nonce, iss, aud, iat, exp }
}
```

---

## Step 6 — Fetch User Profile from UserInfo

Use the access token to retrieve profile claims from the UserInfo endpoint:

```typescript
async function fetchUserInfo(accessToken: string) {
  const config = await getOidcConfig();

  const res = await fetch(config.userinfo_endpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) throw new Error(`UserInfo failed: ${res.status}`);

  return await res.json();
  // { sub, name, email, email_verified, picture }
}
```

The claims returned depend on the scopes granted:

| Scope | Claims |
| :--- | :--- |
| `openid` | `sub` |
| `profile` | `name`, `picture` |
| `email` | `email`, `email_verified` |

---

## Step 7 — Create or Link User and Start a Session

Match the Pramaan user ID (`sub`) to a user in your database. If no match exists, create one:

```typescript
// Inside the callback handler, after Steps 4-6:

const tokens = await exchangeCode(code, req.session.oauth.codeVerifier);
const idPayload = await verifyIdToken(tokens.id_token, req.session.oauth.nonce);
const profile = await fetchUserInfo(tokens.access_token);

// Find or create local user
let user = await db.users.findUnique({
  where: { pramaanId: idPayload.sub as string },
});

if (!user) {
  user = await db.users.create({
    data: {
      pramaanId: idPayload.sub as string,
      email: profile.email,
      name: profile.name,
      avatar: profile.picture ?? null,
    },
  });
}

// Create your own application session
req.session.user = { id: user.id, email: user.email, name: user.name };
delete req.session.oauth; // Clean up one-time OAuth state

res.redirect("/dashboard");
```

> ⚠️ **Do not use OAuth tokens as your application session.** They are short-lived and scoped to Pramaan's API. Always create your own session with `httpOnly`, `secure`, and `sameSite: 'lax'` cookie flags.

---

## Complete Flow Summary

1. Generate PKCE, state, and nonce — store in server session
2. Redirect user to Pramaan's authorization endpoint
3. Receive callback with authorization code — validate state
4. Exchange code + code_verifier for access token and ID token
5. Verify ID token signature (JWKS) and nonce
6. Fetch user claims from the UserInfo endpoint
7. Create or link user in your database
8. Issue your own application session

---

## Next Steps

- [Official SDK Integration Guide →](./03-sdk-guide.md) — Integrate in 4 lines of code with `@anuj304/pramaan`
- [API & Claims Reference →](./04-api-reference.md) — Comprehensive endpoints and claims specifications
- [Security Best Practices →](./05-security.md) — Production hardening, PKCE rationale, and CSRF mitigation

