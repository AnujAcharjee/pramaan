# Pramaan API & Claims Reference

This reference documents the endpoints, payload formats, query parameters, claim schemas, and error responses exposed by the Pramaan Identity Provider.

Base URL: `https://api.yourdomain.com` (or `http://localhost:5000` in local development).

---

## 1. OpenID Connect Discovery & JWKS

### A. OpenID Provider Configuration
- **Method:** `GET`
- **Path:** `/.well-known/openid-configuration` (also `/api/.well-known/openid-configuration`)
- **Authentication:** None (Public)

#### Response (`200 OK`)
```json
{
  "issuer": "https://api.yourdomain.com",
  "authorization_endpoint": "https://api.yourdomain.com/api/oauth/authorize",
  "token_endpoint": "https://api.yourdomain.com/api/oauth/token",
  "userinfo_endpoint": "https://api.yourdomain.com/userinfo",
  "jwks_uri": "https://api.yourdomain.com/.well-known/jwks.json",
  "response_types_supported": ["code"],
  "subject_types_supported": ["public"],
  "id_token_signing_alg_values_supported": ["RS256"],
  "scopes_supported": ["openid", "profile", "email", "avatar"],
  "token_endpoint_auth_methods_supported": ["client_secret_post"],
  "claims_supported": [
    "sub", "iss", "aud", "exp", "iat", "nonce",
    "email", "email_verified", "name", "picture", "avatar"
  ],
  "code_challenge_methods_supported": ["S256", "plain"],
  "grant_types_supported": ["authorization_code"]
}
```

---

### B. JSON Web Key Set (JWKS)
- **Method:** `GET`
- **Path:** `/.well-known/jwks.json` (also `/api/.well-known/jwks.json`)
- **Authentication:** None (Public)

#### Response (`200 OK`)
```json
{
  "keys": [
    {
      "kty": "RSA",
      "use": "sig",
      "alg": "RS256",
      "kid": "pramaan-rs256-key-id",
      "n": "...",
      "e": "AQAB"
    }
  ]
}
```

---

## 2. Standard OAuth 2.0 & OIDC Endpoints

### A. Authorization Endpoint
- **Method:** `GET`
- **Path:** `/api/oauth/authorize` (aliases: `/oauth/authorize`, `/authorize`)
- **Authentication:** Browser session (prompts login/signup if unauthenticated)

#### Query Parameters
| Parameter | Required | Description |
| :--- | :---: | :--- |
| `response_type` | Yes | Must be `code`. |
| `client_id` | Yes | Registered application identifier. |
| `redirect_uri` | Yes | Exact callback URL registered for the client. |
| `scope` | Yes | Space-delimited scopes (e.g. `openid profile email`). |
| `state` | Yes | Random cryptographic string for CSRF mitigation. |
| `nonce` | Required for `openid` | Cryptographic string embedded in the ID Token. |
| `code_challenge` | Yes | Base64URL-encoded SHA-256 hash of `code_verifier`. |
| `code_challenge_method`| Yes | Must be `S256` (or `plain`). |

---

### B. Token Endpoint
- **Method:** `POST`
- **Path:** `/api/oauth/token` (alias: `/oauth/token`)
- **Headers:** `Content-Type: application/x-www-form-urlencoded`
- **CORS:** Enabled for public SPA and mobile clients.

#### Request Body (URL-Encoded)
```
grant_type=authorization_code
&code=AUTHORIZATION_CODE
&redirect_uri=https://yourapp.com/callback
&client_id=YOUR_CLIENT_ID
&client_secret=YOUR_CLIENT_SECRET
&code_verifier=YOUR_CODE_VERIFIER
```

#### Response (`200 OK`)
```json
{
  "access_token": "pramaan_at_...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "id_token": "eyJhbGciOiJSUzI1NiIs...",
  "scope": "openid profile email"
}
```

---

### C. UserInfo Endpoint
- **Method:** `GET` or `POST`
- **Path:** `/userinfo` (alias: `/api/oauth/userinfo`)
- **Headers:** `Authorization: Bearer <access_token>`

#### Response (`200 OK`)
```json
{
  "sub": "usr_9b1deb4d3b7d4bad9bdd2b0d7b3dcb6d",
  "email": "user@example.com",
  "email_verified": true,
  "name": "Jane Doe",
  "picture": "https://cdn.example.com/avatars/usr_123.png",
  "avatar": "https://cdn.example.com/avatars/usr_123.png"
}
```

---

## 3. Headless REST API v1 (`/api/v1/*`)

All headless endpoints accept and return `application/json` with credentials enabled (`{ credentials: 'include' }`).

### A. Authentication (`/api/v1/auth`)

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/v1/auth/signin` | `POST` | Authenticate user; establishes session cookies (`isid`, `asid`). |
| `/api/v1/auth/signup` | `POST` | Register new user. Accepts `flow: 'oauth'` & `request_id`. |
| `/api/v1/auth/verify-email` | `GET`/`POST` | Verify email token, activate account, route to consent if OAuth flow. |
| `/api/v1/auth/resend-verification` | `GET`/`POST` | Resend verification email, preserving OAuth flow context. |
| `/api/v1/auth/forgot-password` | `POST` | Dispatch password reset email. |
| `/api/v1/auth/reset-password` | `POST` | Set new password with reset token. |
| `/api/v1/auth/signout` | `POST` | Terminate active and identity sessions; clear cookies. |
| `/api/v1/auth/me` | `GET` | Get current authenticated user session details. |

---

### B. Headless OAuth Handshake (`/api/v1/oauth`)

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/v1/oauth/authorize` | `GET` | Validates OAuth params and returns JSON state (`unauthenticated`, `consent_required`, `authorized`). |
| `/api/v1/oauth/consent-details` | `GET` | Returns client name, avatar, and requested scope descriptions for the consent screen. |
| `/api/v1/oauth/consent/decision` | `POST` | Submits consent decision (`decision: 'approve'` or `'deny'`). Returns redirect URL with authorization code. |

---

### C. Developer Hub & Client Management (`/api/v1/developer`)

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/v1/developer/clients` | `GET` | List all OAuth clients registered by the authenticated user. |
| `/api/v1/developer/clients` | `POST` | Register a new OAuth client. |
| `/api/v1/developer/clients/:id` | `GET` | Get detailed client metadata, credentials, and verification status. |
| `/api/v1/developer/clients/:id` | `PUT` | Update client name, domain, redirect URIs, or environment tier. |
| `/api/v1/developer/clients/:id` | `DELETE` | Delete an OAuth client. |
| `/api/v1/developer/clients/:id/secret` | `POST` | Rotate client secret; immediately revokes previous secret. |
| `/api/v1/developer/clients/:id/verify-domain` | `POST` | Run live DNS TXT lookup against `_pramaan-verification.<domain>` to verify domain ownership. |

---

## 4. Standard Response & Error Envelope

All headless API responses conform to a predictable envelope:

### Success Response
```json
{
  "success": true,
  "message": "Action completed successfully",
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Detailed error message",
  "code": "ERR_4006"
}
```

### Standard Error Codes
| Code | Constant | Meaning |
| :--- | :--- | :--- |
| `ERR_4001` | `INVALID_CREDENTIALS` | Invalid email or password provided. |
| `ERR_4002` | `INVALID_INPUT` | Missing or malformed request parameters. |
| `ERR_4003` | `INVALID_REQUEST` | General request constraint violation. |
| `ERR_4004` | `INVALID_CLIENT` | Client ID does not exist or client is disabled. |
| `ERR_4005` | `INVALID_REDIRECT_URI` | Redirect URI is not registered for this client. |
| `ERR_4006` | `EMAIL_ALREADY_EXISTS` | Registration attempt with an existing email. |
| `ERR_4007` | `UNAUTHORIZED_CLIENT` | Client not authorized to request this grant or scope. |
| `ERR_4008` | `UNSUPPORTED_GRANT_TYPE`| Only `authorization_code` grant is supported. |
| `ERR_4009` | `INVALID_SCOPE` | Requested scopes are unrecognized or forbidden. |
| `ERR_4010` | `INVALID_GRANT` | Authorization code is expired, invalid, or reused. |
| `ERR_4020` | `RATE_LIMITED` | Rate limit threshold exceeded. Please retry later. |
| `ERR_5001` | `INTERNAL_SERVER_ERROR` | Server-side execution failure. |
