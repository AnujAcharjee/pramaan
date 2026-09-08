# Pramaan — Identity Provider

**Pramaan** is a self-hosted OAuth 2.0 and OpenID Connect identity provider built for developers who want full control over authentication without third-party lock-in.

It implements the **Authorization Code flow with PKCE** (RFC 7636) and **OpenID Connect Core 1.0**, issuing RS256-signed tokens verifiable via standard JWKS discovery.

🌐 **Live:** [pramaan.anujacharjee.com](https://pramaan.anujacharjee.com)

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

## Getting Started

### 1. Register a Client

Create an OAuth client in the Pramaan dashboard to get your **Client ID** and **Client Secret**.

📄 [Client Registration Guide →](./docs/01-create-client.md)

### 2. Implement the OAuth Flow

Wire up the authorization redirect, token exchange, ID token verification, and user session creation in your application.

📄 [Implementation Guide →](./docs/02-signup-flow.md)

### 3. Run the Test Client

A fully working reference client is included under [`docs/test-app/`](./docs/test-app/README.md). Clone it, point it at your Pramaan instance, and run through the complete flow locally.

---

## Documentation

```
docs/
├── 01-create-client.md    # Register your app as an OAuth client
├── 02-signup-flow.md       # Step-by-step implementation guide
└── test-app/
    └── README.md           # Run the reference client locally
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
