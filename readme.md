# Pramaan — Identity Provider

**Pramaan** is a self-hostable OAuth 2.0 and OpenID Connect identity provider built for developers who want full control over their authentication infrastructure without third-party lock-in.

It implements the **Authorization Code flow with PKCE** (RFC 7636) and **OpenID Connect Core 1.0**, issuing RS256-signed tokens verifiable via standard JWKS discovery.

---

## Get Started

Use the hosted Pramaan instance or deploy your own.

🌐 **Hosted:** [pramaan.anujacharjee.com](https://pramaan.anujacharjee.com/)

🛠️ **Self-host:** Clone the repository and run Pramaan on your own infrastructure. [Deployment Guide →](./docs/deployment.md)

---

## Endpoints

Pramaan exposes the following OIDC-compliant endpoints. All paths are discoverable via the OpenID Configuration document.

| Endpoint | Path |
| :--- | :--- |
| OpenID Configuration | `/.well-known/openid-configuration` |
| JWKS | `/.well-known/jwks.json` |
| Authorization | `/api/oauth/authorize` |
| Token | `/api/oauth/token` |
| UserInfo | `/userinfo` |

---

## Quick Start with Official SDK

The fastest and most secure way to integrate Pramaan with Node.js / TypeScript is using the official SDK:

```bash
npm install @anuj304/pramaan
```

```typescript
import { PramaanClient } from "@anuj304/pramaan";

const pramaan = new PramaanClient({
  issuer: "https://pramaan.anujacharjee.com",
  clientId: process.env.PRAMAAN_CLIENT_ID!,
  clientSecret: process.env.PRAMAAN_CLIENT_SECRET,
  redirectUri: "http://localhost:3000/callback",
});

// 1. Initiate login
const { url, transaction } = await pramaan.createAuthorizationRequest({
  scope: ["openid", "profile", "email"],
});

// 2. Complete callback & verify ID token via JWKS
const tokens = await pramaan.handleCallback({
  code: req.query.code,
  state: req.query.state,
  transaction: req.session.transaction,
});

// 3. Fetch user profile
const user = await pramaan.getUserInfo(tokens.accessToken);
```

---

## Documentation Suite

Comprehensive guides for every stage of integration and hosting:

| Guide | Description |
| :--- | :--- |
| 🐳 [**Self-Hosting & Deployment**](./docs/deployment.md) | How to deploy your own instance of Pramaan with Docker Compose, Caddy, Postgres, and Redis. |
| 📄 [**01 — Registering an OAuth Client**](./docs/01-create-client.md) | How to register your application, configure redirect URIs, and retrieve credentials. |
| 🚀 [**02 — Manual Protocol Guide**](./docs/02-signup-flow.md) | Step-by-step RFC-compliant flow for Python, Go, Rust, Java, or raw HTTP integrations. |
| ⚡ [**03 — Official SDK Guide**](./docs/03-sdk-guide.md) | Detailed documentation for `@anuj304/pramaan` with full options, typed errors, and utilities. |
| 📚 [**04 — API & Claims Reference**](./docs/04-api-reference.md) | Endpoints, query parameters, token response formats, claim mappings, and error codes. |
| 🛡️ [**05 — Security & Best Practices**](./docs/05-security.md) | Threat model, PKCE rationale, timing-safe state comparison, and production checklist. |
| 💻 [**Runnable Express Example**](./sdk/examples/express/) | Full, production-ready Express reference application with sessions and UI. |

```
docs/
├── deployment.md             # Docker Compose, Caddy & self-hosting instructions
├── 01-create-client.md       # Register and manage OAuth clients
├── 02-signup-flow.md         # Protocol flow & manual integration (Python, Go, etc.)
├── 03-sdk-guide.md           # Official Node.js/TypeScript SDK guide
├── 04-api-reference.md       # Endpoints, schemas, claims & error reference
└── 05-security.md            # Threat model, PKCE, and production checklist
```

---

## Token Model

Pramaan issues two token types. Understanding the distinction from your application session is critical.

| | Access Token | ID Token |
| :--- | :--- | :--- |
| **Purpose** | Authorize API calls (e.g. `/userinfo`) | Prove user identity |
| **Audience** | Resource server (`userinfo`) | Your client (`client_id`) |
| **Signed with** | RS256 (asymmetric) | RS256 (asymmetric) |
| **Lifetime** | Short-lived (configurable) | Short-lived (configurable) |
| **Contains** | `sub`, `scope` | `sub`, `nonce`, `aud`, `iss` |

> ⚠️ Never use OAuth tokens as your application session. After verifying the ID token, create your own session (cookie, JWT, etc.) with appropriate expiration and security flags.

---

## Supported Scopes

| Scope | Claims Returned |
| :--- | :--- |
| `openid` | `sub` |
| `profile` | `name`, `picture` |
| `email` | `email`, `email_verified` |
| `avatar` | `avatar`, `picture` |

---

## Common Issues

| Problem | Fix |
| :--- | :--- |
| **Invalid Redirect URI** | Must exactly match the URI registered in the client dashboard |
| **State Mismatch** | Possible CSRF or expired session — validate the `state` parameter against your stored value |
| **Invalid ID Token** | Verify `issuer`, `audience`, `nonce`, RS256 signature (via JWKS), and `exp` |
| **Access Token Expired** | Re-authenticate the user; Pramaan does not currently issue refresh tokens |

---

## Production Checklist

- [ ] HTTPS on all redirect URIs
- [ ] Secure cookies (`httpOnly`, `secure`, `sameSite: 'lax'`)
- [ ] PKCE enforced for all clients
- [ ] ID token signature verified via JWKS
- [ ] Session expiration configured
- [ ] Rate limiting on login/token endpoints
- [ ] `state` and `nonce` validated on every callback
- [ ] Client secret rotated periodically
- [ ] Logging and monitoring enabled

---

## Security Practices

- Never expose `CLIENT_SECRET` in frontend code or version control
- Always validate `state` and `nonce` on the callback
- Verify ID token signatures using the JWKS endpoint — never skip verification
- Use server-side sessions; do not store OAuth tokens in localStorage
- Expire OAuth parameters (state, nonce, code_verifier) within 5–10 minutes
- Enforce RS256 as the only accepted signing algorithm

---

**Last Updated:** September 2026
**Version:** 2.1
