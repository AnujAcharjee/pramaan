# Manual Implementation & Protocol Guide — OAuth 2.0 + OIDC

This guide provides a comprehensive walkthrough of the complete **Authorization Code Flow with PKCE** (RFC 7636) and **OpenID Connect Core 1.0** implementation against Pramaan.

> 💡 **Using Node.js or TypeScript?** You do not need to implement this protocol manually. The official SDK [**`@anuj304/pramaan`**](./03-sdk-guide.md) implements automated PKCE, cryptographic state verification, token exchange, and JWKS verification out-of-the-box.

---

## 1. Flow Overview

```
[ User Browser / App ]            [ Your Backend ]                 [ Pramaan IdP ]
          │                              │                                │
          │ ── 1. Initiate Login ──────► │                                │
          │                              │ ── 2. Create PKCE, state ───►  │
          │ ◄── 3. Redirect to Pramaan ── │                                │
          │                                                               │
          │ ── 4. Authenticate & Grant Consent (Web or Headless) ───────► │
          │                                                               │
          │ ◄── 5. Redirect to callback (?code=xxx&state=yyy) ─────────── │
          │                                                               │
          │ ── 6. Deliver callback ────► │                                │
          │                              │ ── 7. POST /api/oauth/token ─► │
          │                              │       (code + code_verifier)   │
          │                              │ ◄── 8. Access & ID Tokens ──── │
          │                              │                                │
          │                              │ ── 9. GET /userinfo ─────────► │
          │                              │ ◄── 10. User profile claims ── │
          │                              │                                │
          │ ◄── 11. App Session Created ─ │                                │
```

---

## 2. Step-by-Step Implementation

### Step 0 — Discover Endpoints
Pramaan exposes standard OpenID Connect discovery metadata. Fetch and cache it once on service startup:

```typescript
const PRAMAAN_ISSUER = process.env.PRAMAAN_ISSUER!; // e.g. "https://pramaan.anujacharjee.com"

interface OidcDiscovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
}

let cachedDiscovery: OidcDiscovery | null = null;

async function getOidcConfig(): Promise<OidcDiscovery> {
  if (cachedDiscovery) return cachedDiscovery;
  const res = await fetch(`${PRAMAAN_ISSUER}/.well-known/openid-configuration`);
  if (!res.ok) throw new Error(`OIDC Discovery failed: ${res.status}`);
  cachedDiscovery = (await res.json()) as OidcDiscovery;
  return cachedDiscovery;
}
```

---

### Step 1 — Generate PKCE & Security Parameters
Generate a cryptographically secure PKCE code verifier and challenge (S256), a `state` parameter for CSRF defense, and a `nonce` to verify in the ID token:

```typescript
import crypto from 'node:crypto';

function base64url(buffer: Buffer): string {
  return buffer.toString('base64url');
}

export function generateSecurityParameters() {
  const codeVerifier = base64url(crypto.randomBytes(32));
  const codeChallenge = base64url(
    crypto.createHash('sha256').update(codeVerifier).digest()
  );

  return {
    state: base64url(crypto.randomBytes(32)),
    nonce: base64url(crypto.randomBytes(32)),
    codeVerifier,
    codeChallenge,
  };
}
```

Store `state`, `nonce`, and `codeVerifier` in your user's server-side session or temporary signed httpOnly cookie for 5–10 minutes.

---

### Step 2 — Redirect to Authorization Endpoint
Construct the authorization URL using the discovered `authorization_endpoint`:

```typescript
app.get('/login', async (req, res) => {
  const config = await getOidcConfig();
  const params = generateSecurityParameters();

  req.session.oauth = {
    state: params.state,
    nonce: params.nonce,
    codeVerifier: params.codeVerifier,
  };

  const url = new URL(config.authorization_endpoint);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', process.env.PRAMAAN_CLIENT_ID!);
  url.searchParams.set('redirect_uri', process.env.PRAMAAN_REDIRECT_URI!);
  url.searchParams.set('scope', 'openid profile email');
  url.searchParams.set('state', params.state);
  url.searchParams.set('nonce', params.nonce);
  url.searchParams.set('code_challenge', params.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');

  res.redirect(url.toString());
});
```

---

### Step 3 — User Authentication & Sign-Up Handling

When redirected to Pramaan:
1. **Existing User**: Signs in with credentials or MFA.
2. **New User**: Clicks *"Don't have an account? Sign up"*.
   - Directed to `/signup?flow=oauth&request_id=<req_id>`.
   - On registration, Pramaan sends a verification email retaining the OAuth context.
   - Once the user clicks the verification link, their account is activated and they are seamlessly routed to the consent screen (`/oauth/consent?request_id=<req_id>`).
3. **Consent**: The user reviews the requested scopes (`openid`, `profile`, `email`) and clicks **Allow**.
4. Pramaan issues a 32-byte authorization code in Redis and redirects the browser back to your `redirect_uri`.

---

### Step 4 — Exchange Authorization Code for Tokens
In your callback route, validate `state`, extract `code`, and exchange it at the `token_endpoint`:

```typescript
app.get('/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    throw new Error(`OAuth error: ${error} - ${error_description}`);
  }

  // 1. Constant-time state validation
  const sessionOauth = req.session.oauth;
  if (!sessionOauth || !timingSafeEqual(String(state), sessionOauth.state)) {
    return res.status(403).send('State mismatch. Possible CSRF attack.');
  }

  const config = await getOidcConfig();

  // 2. Token exchange request (RFC 6749 Section 4.1.3)
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: String(code),
    redirect_uri: process.env.PRAMAAN_REDIRECT_URI!,
    client_id: process.env.PRAMAAN_CLIENT_ID!,
    client_secret: process.env.PRAMAAN_CLIENT_SECRET!,
    code_verifier: sessionOauth.codeVerifier,
  });

  const tokenRes = await fetch(config.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.json();
    throw new Error(`Token exchange failed: ${JSON.stringify(err)}`);
  }

  const tokens = await tokenRes.json();
  // tokens = { access_token, token_type, expires_in, id_token, scope }

  // Clean up transaction
  delete req.session.oauth;
```

---

### Step 5 — Verify the ID Token via JWKS
Validate the RS256 signature using the public keys from `/.well-known/jwks.json`:

```typescript
import * as jose from 'jose';

// Create cached remote JWKS set
const JWKS = jose.createRemoteJWKSet(new URL(config.jwks_uri));

const { payload } = await jose.jwtVerify(tokens.id_token, JWKS, {
  issuer: config.issuer,
  audience: process.env.PRAMAAN_CLIENT_ID!,
});

// Enforce single-use nonce validation
if (payload.nonce !== sessionOauth.nonce) {
  throw new Error('Nonce mismatch in ID token');
}
```

---

### Step 6 — Retrieve UserInfo Claims
Call the `userinfo_endpoint` using the Bearer access token:

```typescript
const userinfoRes = await fetch(config.userinfo_endpoint, {
  headers: {
    Authorization: `Bearer ${tokens.access_token}`,
    Accept: 'application/json',
  },
});

const userProfile = await userinfoRes.json();
// userProfile = { sub, email, email_verified, name, picture, avatar }
```

---

### Step 7 — Create Local Application Session
Never use OAuth tokens directly as your application session. Issue your own session cookie:

```typescript
req.session.user = {
  id: userProfile.sub,
  email: userProfile.email,
  name: userProfile.name,
};

res.redirect('/dashboard');
```

---

## 3. Headless REST API Handshake (`/api/v1/oauth/authorize`)

For SPAs, mobile applications, or decoupled frontends that do not use 303 redirects:

```http
GET /api/v1/oauth/authorize?client_id=...&redirect_uri=...&scope=openid+profile&response_type=code&state=...&code_challenge=...&code_challenge_method=S256&nonce=...
```

**JSON Response (Unauthenticated):**
```json
{
  "status": "unauthenticated",
  "requestId": "req_12345",
  "client": {
    "id": "cli_abc",
    "name": "My App",
    "domain": "myapp.com"
  },
  "redirectUrl": "/signin?flow=oauth&request_id=req_12345"
}
```

**JSON Response (Consent Required):**
```json
{
  "status": "consent_required",
  "requestId": "req_12345",
  "client": {
    "id": "cli_abc",
    "name": "My App",
    "domain": "myapp.com"
  },
  "redirectUrl": "/oauth/consent?request_id=req_12345"
}
```

---

## Next Steps

- [Official SDK Guide (`@anuj304/pramaan`) →](./03-sdk-guide.md)
- [API & Claims Reference →](./04-api-reference.md)
- [Security Best Practices →](./05-security.md)
