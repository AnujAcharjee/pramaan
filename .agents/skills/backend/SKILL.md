---
name: backend
description: >-
  Backend architecture, OAuth 2.0 / OIDC protocols, crypto, database, and Bun + Express implementation guide for Pramaan IdP.
  Use when developing, modifying, or testing backend controllers, services, routes, Prisma schemas, security logic, and API endpoints.
---

# Pramaan IdP Backend Architecture & Standards Guide

This guide defines the engineering standards, protocol compliance, directory structure, and development workflows for the **Pramaan Identity Provider (IdP) Backend**. Pramaan is an open-source, standards-compliant OAuth 2.0 and OpenID Connect (OIDC) identity provider built with **Bun, TypeScript, Express 5, Prisma ORM, PostgreSQL, and Redis**.

---

## 1. Architectural Overview & System Design

- **Decoupled Architecture:** The backend operates as a headless Identity Provider providing high-speed JSON REST APIs (`/api/v1/*`), standard OAuth 2.0 / OIDC protocol endpoints, and discovery endpoints.
- **Runtime & Execution:** Powered by **Bun** (`bun --watch src/index.ts`, `bun test`, `bunx tsc --build`).
- **Data Persistence & Cache:**
  - **PostgreSQL with Prisma ORM:** Stores users, OAuth clients, consents, active sessions, and cryptographic key records.
  - **Redis:** High-throughput session cache, rate-limiting store, and token invalidation blacklist.
  - **Cloudinary:** Media asset store for user avatars and client application branding.

---

## 2. Directory & Module Structure

```
backend/
├── prisma/
│   ├── schema.prisma            # Database models & relationships
│   ├── migrations/              # SQL migration history
│   └── prisma.config.ts         # Prisma client configuration
├── src/
│   ├── config/                  # Configuration & external connections
│   │   ├── env.ts               # Strict Zod environment validation
│   │   ├── database.ts          # Prisma client singleton
│   │   ├── redis.ts             # Redis client & connection pool
│   │   ├── logger.ts            # Pino logger instance
│   │   └── cloudinary.ts        # Cloudinary SDK configuration
│   ├── controllers/
│   │   ├── api/                 # Headless JSON REST API controllers
│   │   │   ├── authApi.controller.ts
│   │   │   ├── oauthApi.controller.ts
│   │   │   ├── developerApi.controller.ts
│   │   │   └── accountApi.controller.ts
│   │   ├── oauth.controller.ts  # RFC 6749 authorization & token exchange
│   │   ├── discovery.controller.ts # OIDC Discovery & JWKS
│   │   └── jose.controller.ts   # Key management endpoints
│   ├── middlewares/
│   │   ├── corsMiddleware.ts    # Dynamic CORS origin reflection
│   │   ├── authMiddleware.ts    # Dual session & bearer token authentication
│   │   ├── securityHeaders.ts   # Helmet, CSP, & security headers
│   │   ├── rateLimiter.ts       # Route-specific rate limiters (auth vs API)
│   │   ├── requestId.ts         # Correlation ID tracking (X-Request-Id)
│   │   ├── errorMiddleware.ts   # Centralized error handler & AppError
│   │   └── uploadMiddleware.ts  # Multer for file upload validation
│   ├── routes/
│   │   ├── api/
│   │   │   ├── index.ts         # API root router
│   │   │   ├── oauth.routes.ts  # /oauth/authorize, /oauth/token, /oauth/revoke
│   │   │   ├── well-known.routes.ts # /.well-known/openid-configuration & jwks.json
│   │   │   └── v1/              # Headless REST endpoints (/api/v1/*)
│   │   │       ├── authApi.routes.ts
│   │   │       ├── oauthApi.routes.ts
│   │   │       ├── developerApi.routes.ts
│   │   │       └── accountApi.routes.ts
│   │   └── web/                 # Deprecated SSR routes (preserved for compatibility)
│   ├── services/                # Core business logic
│   │   ├── oauth.service.ts     # Auth code generation, token exchange, PKCE
│   │   ├── jose.service.ts      # RS256/ES256 signing, JWKS, envelope encryption
│   │   ├── client.service.ts    # OAuth client lifecycle, secret rotation
│   │   ├── account.service.ts   # User profile, password hashing, session lifecycle
│   │   ├── dns.service.ts       # DNS TXT domain verification
│   │   └── email.service.ts     # Nodemailer transactional email delivery
│   ├── templates/               # Email HTML & text templates
│   ├── utils/                   # Crypto helpers, error classes, constants
│   ├── validators/              # Zod payload schemas
│   ├── scripts/                 # Key rotation & maintenance scripts
│   ├── app.ts                   # Express application setup
│   └── index.ts                 # Server entrypoint & lifecycle management
└── tests/                       # Integration & security test suites
```

---

## 3. Cryptography & Protocol Compliance

Pramaan strictly adheres to official RFC specifications:

### 1. Proof Key for Code Exchange (PKCE - RFC 7636)

- **Mandatory for all public and single-page clients**.
- Supported transformation: `S256` (`BASE64URL(SHA256(code_verifier)) == code_challenge`).
- Legacy `plain` transformation is rejected for high-security applications.

### 2. Token Signing & Key Management (RFC 7515 / RFC 7517)

- **Algorithms:** `RS256` (RSA Signature with SHA-256) and `ES256` (ECDSA using P-256 and SHA-256).
- **Public Keys:** Exported via `GET /.well-known/jwks.json`.
- **Key Rotation:** Automated key rotation managed via `jose.service.ts` and triggered with `bun run keys:rotate`.
- **Envelope Encryption:** Client secrets and private keys are encrypted at rest using AES-GCM-256 with key derivation.

### 3. OpenID Connect Discovery (OIDC Core 1.0)

- Discovery metadata served at `GET /.well-known/openid-configuration`.
- Includes supported scopes (`openid`, `profile`, `email`), response types (`code`), grant types (`authorization_code`, `refresh_token`), and signing algorithms.

### 4. Domain Verification

- Production clients must verify ownership of their callback domain via a DNS TXT record:
  ```
  pramaan-site-verification=<verification_token>
  ```
- Evaluated via `dns.service.ts` using Node.js `dns.promises.resolveTxt`.

---

## 4. Headless REST API Endpoints (`/api/v1/*`)

All responses follow a consistent format:

- Success: `{ "success": true, "data": { ... } }`
- Error: `{ "success": false, "error": { "message": "...", "code": "ERROR_CODE" } }`

| Route                                                | Method   | Description                                         | Auth Required |
| :--------------------------------------------------- | :------- | :-------------------------------------------------- | :------------ |
| `/api/v1/auth/signup`                                | `POST`   | Register a new user                                 | Public        |
| `/api/v1/auth/signin`                                | `POST`   | Authenticate user & issue session cookie            | Public        |
| `/api/v1/auth/signout`                               | `POST`   | Invalidate active session & clear cookies           | User Session  |
| `/api/v1/auth/me`                                    | `GET`    | Get authenticated user context                      | User Session  |
| `/api/v1/auth/verify-email`                          | `POST`   | Confirm email token                                 | Public        |
| `/api/v1/auth/forgot-password`                       | `POST`   | Request password reset email                        | Public        |
| `/api/v1/auth/reset-password`                        | `POST`   | Reset password using reset token                    | Public        |
| `/api/v1/oauth/consent-details`                      | `GET`    | Retrieve client details & scopes for consent screen | User Session  |
| `/api/v1/oauth/consent`                              | `POST`   | Grant or deny client consent                        | User Session  |
| `/api/v1/developer/clients`                          | `GET`    | List user's registered OAuth clients                | User Session  |
| `/api/v1/developer/clients`                          | `POST`   | Register new OAuth client                           | User Session  |
| `/api/v1/developer/clients/:client_id`               | `GET`    | Get client details & secret metadata                | User Session  |
| `/api/v1/developer/clients/:client_id`               | `PATCH`  | Update client name, redirects, or environment       | User Session  |
| `/api/v1/developer/clients/:client_id/rotate-secret` | `POST`   | Invalidate old secret and generate new one          | User Session  |
| `/api/v1/developer/clients/:client_id/verify-domain` | `POST`   | Trigger DNS TXT verification check                  | User Session  |
| `/api/v1/account/profile`                            | `GET`    | Get user account details                            | User Session  |
| `/api/v1/account/sessions`                           | `GET`    | List active user sessions                           | User Session  |
| `/api/v1/account/sessions/:id`                       | `DELETE` | Revoke a specific session                           | User Session  |
| `/api/v1/account/consents`                           | `GET`    | List third-party app consents                       | User Session  |
| `/api/v1/account/consents/:id`                       | `DELETE` | Revoke consent for an OAuth client                  | User Session  |

---

## 5. Security & Session Rules

1. **Cookie Configuration:**
   - Session cookies (`pramaan_session`) are set with `httpOnly: true`, `sameSite: 'lax'`, and `secure: ENV.NODE_ENV === 'production'`.
   - Signed with `ENV.COOKIE_SECRET`.
2. **CORS Configuration (`corsMiddleware.ts`):**
   - Configured with `credentials: true`.
   - Dynamic reflection of authorized origins (local dev `http://localhost:3000` + configured production frontend domains).
3. **Rate Limiting:**
   - Authentication routes (`/api/v1/auth/*`) use strict limits to prevent brute-force attacks.
   - Standard API routes utilize Redis-backed sliding window rate limiters.
4. **Input Validation:**
   - Every request payload must be validated with Zod schemas in `backend/src/validators/`.
   - Handled cleanly before reaching controller logic.

---

## 6. Developer & Bun Workflow Commands

Execute commands inside `backend/` or via monorepo scripts from the project root:

| Command                      | Action             | Description                                                       |
| :--------------------------- | :----------------- | :---------------------------------------------------------------- |
| `bun run dev`                | Local Dev Server   | Starts server with live reload (`bun --watch src/index.ts`)       |
| `bun run build`              | Compile TypeScript | Runs `bunx tsc --build` to compile to `dist/`                     |
| `bun run test`               | Run Test Suite     | Executes backend integration and crypto tests via Bun test runner |
| `bun run lint`               | ESLint Check       | Runs ESLint validation across all TypeScript files                |
| `bun run lint:fix`           | ESLint Auto-Fix    | Automatically fixes linting issues                                |
| `bun run prisma:generate`    | Generate Client    | Regenerates Prisma client from `prisma/schema.prisma`             |
| `bun run prisma:dev:migrate` | Dev Migration      | Creates and applies new database migrations                       |
| `bun run keys:rotate`        | Rotate Keys        | Generates new signing key pair and rotates JWKS store             |

> **Monorepo Notice:** Never run `git commit` automatically; only commit when the user explicitly requests a commit.
