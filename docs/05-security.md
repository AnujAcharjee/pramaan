# Security & Production Best Practices

This guide outlines security standards, threat models, and best practices for integrating with Pramaan.

---

## 1. Threat Mitigation Matrix

| Threat | Vulnerability | Pramaan & SDK Mitigation |
| :--- | :--- | :--- |
| **Code Interception** | Malicious app intercepts authorization code on the callback URL. | **PKCE S256 (RFC 7636)**: Authorization server requires `code_challenge`. Code exchange requires `code_verifier` matching SHA-256 hash. Intercepted code is useless without verifier. |
| **CSRF Attack** | Attacker tricks user into associating attacker's Pramaan account with victim's local session. | **Cryptographic State Parameter**: High-entropy random state tied to user session, validated in constant time (`crypto.timingSafeEqual`) on callback. |
| **ID Token Replay** | Attacker captures a previously valid ID token and presents it in a different login session. | **Nonce Validation**: Single-use cryptographic nonce embedded in ID token payload, verified against initial session transaction. |
| **Signature Forgery** | Attacker modifies JWT claims (e.g. `sub` or `email`) to impersonate other users. | **Asymmetric RS256 Signing via JWKS**: Server signs tokens with private key. Clients cryptographically verify signatures using Pramaan's public key from `/.well-known/jwks.json`. |
| **Redirect Hijacking** | Attacker registers wildcards or open redirects to leak codes. | **Exact Redirect URI Matching**: Pramaan enforces exact string match on registered callback URIs (trailing slashes, ports, and schemes must match). |

---

## 2. Session Architecture vs Token Architecture

A common mistake in OAuth/OIDC integrations is storing the identity provider's `access_token` directly in browser storage (`localStorage` or `sessionStorage`) and using it as the application session.

### Recommended Pattern: Backend-for-Frontend (BFF)

```
[Browser] 
   │  ▲
   │  │  Cookie (httpOnly, secure, SameSite=Lax)
   ▼  │
[Your Application Backend]
   │  ▲
   │  │  Pramaan Access Token & ID Token (Stored in Server Session / Redis)
   ▼  │
[Pramaan IdP]
```

1. **Keep Tokens on the Backend:** Store Pramaan tokens in server-side session stores (Redis, encrypted database, or signed encrypted cookie).
2. **Issue Your Own Application Session:** Issue an encrypted, `httpOnly` session cookie to the browser representing the user's session with *your* app.
3. **Short Lifetimes:** OAuth access tokens in Pramaan expire after 10 minutes. If your application needs continuous identity, check session state locally and re-authenticate when required.

---

## 3. Defense Implementation Guidelines

### A. PKCE (Proof Key for Code Exchange)
Always use `S256` (SHA-256). Do **not** use `plain` code challenge methods.
- The official SDK automatically generates 32 cryptographically random bytes encoded with URL-safe base64, computes the SHA-256 digest, and sends `code_challenge_method=S256`.

### B. Constant-Time State Verification
When validating the callback `state` against the session, never use simple `===` string equality, which is vulnerable to timing side-channel attacks:
```typescript
import crypto from "crypto";

export function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf-8");
  const bufB = Buffer.from(b, "utf-8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
```
*(The `@anuj304/pramaan` SDK performs this automatically).*

### C. ID Token Verification Standards
Before accepting an ID token as proof of identity, you must verify:
1. **Header Algorithm**: Must be explicitly `RS256`. Reject tokens with `none` or symmetric HMAC `HS256`.
2. **Signature**: Validated using the public key fetched from `/.well-known/jwks.json`.
3. **Issuer (`iss`)**: Must exactly match the configured Pramaan issuer URL (e.g. `https://pramaan.anujacharjee.com`).
4. **Audience (`aud`)**: Must match your registered `client_id`.
5. **Expiration (`exp`)**: Current timestamp must be before `exp` (with allowable clock skew ≤ 60 seconds).
6. **Nonce (`nonce`)**: Must match the nonce generated at the start of the authorization request.

---

## 4. Production Hardening Checklist

Use this checklist prior to launching your application to production:

- [ ] **Enforce HTTPS Everywhere:** Redirect URIs in production must strictly use `https://`.
- [ ] **Exact Redirect URIs:** Do not use wildcard domains or unvalidated subpaths in registered redirect URIs.
- [ ] **Keep Client Secret Secret:** Never commit `client_secret` to git or package bundles. Use environment variables or secret managers (e.g. AWS Secrets Manager, Doppler, Vault).
- [ ] **Secure Cookie Attributes:**
  - `httpOnly: true` (prevents JavaScript access / XSS token theft)
  - `secure: true` (enforced in production HTTPS)
  - `sameSite: 'lax'` or `'strict'` (protects against CSRF)
- [ ] **Clean Up Session Transactions:** Immediately delete the OAuth transaction state (`codeVerifier`, `state`, `nonce`) from your session once the callback completes.
- [ ] **Key Rotation Readiness:** Use dynamic JWKS resolvers (e.g. `createRemoteJWKSet` in `jose` or `@anuj304/pramaan`) rather than hardcoding static public keys, ensuring seamless cryptographic key rotation.
