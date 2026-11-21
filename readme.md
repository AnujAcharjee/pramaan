# Pramaan — Modern OAuth 2.0 & OpenID Connect Identity Provider

**Pramaan** is an open-source, standards-compliant, self-hostable OAuth 2.0 and OpenID Connect (OIDC) Identity Provider built for modern engineering teams who demand complete ownership of their authentication infrastructure without proprietary lock-in.

Pramaan features a modern, completely decoupled architecture:
- **Headless Backend (`backend/`)**: High-performance REST API and OAuth/OIDC engine powered by **Bun**, **Express 5**, **TypeScript**, **Prisma ORM (PostgreSQL)**, and **Redis**. Supports PKCE (RFC 7636), RS256/ES256 asymmetric signing, automated JWKS rotation, envelope encryption at rest, and DNS TXT domain verification.
- **Modern Frontend SPA (`frontend/`)**: React 19 Single Page Application built with **TypeScript**, **Tailwind CSS v4**, **Vite**, and **Bun**, featuring a zero-tint high-contrast interface, interactive Developer Hub, and zero-config deployment on **Vercel**.
- **Official SDK (`sdk/`)**: Lightweight, framework-agnostic [`@anuj304/pramaan`](./sdk/) TypeScript client library.

---

## 🎬 Live Demo: Pramaan in Action

Watch how Pramaan delivers frictionless user sign-in, scope authorization, and instant token exchange in a client application:

<div align="center">
  <video src="https://res.cloudinary.com/ddsbhdeju/video/upload/pramaan-demo.mp4" poster="https://res.cloudinary.com/ddsbhdeju/image/upload/pramaan-demo-thumbnail.jpg" autoplay loop muted playsinline controls width="100%" style="max-width: 780px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.15);">
    <a href="https://res.cloudinary.com/ddsbhdeju/video/upload/pramaan-demo.mp4">
      <img src="https://res.cloudinary.com/ddsbhdeju/image/upload/pramaan-demo-thumbnail.jpg" alt="Pramaan in Action Demo" width="100%" style="max-width: 780px; border-radius: 12px;" />
    </a>
  </video>
  <p><sub><em>Demonstration: Frictionless OAuth 2.0 / OIDC sign-in, Developer Hub, and consent flow powered by Pramaan.</em></sub></p>
</div>

> 📺 **Direct Video Link:** If your markdown viewer does not render embedded video, [watch the demo video directly on Cloudinary](https://res.cloudinary.com/ddsbhdeju/video/upload/pramaan-demo.mp4).

---

## 🏛️ Monorepo Architecture

```
├── backend/             # Headless REST API & OIDC Engine (Bun + Express 5 + Prisma + Redis)
│   ├── prisma/          # PostgreSQL schema (schema.prisma) & migrations
│   ├── src/             # Headless controllers, services, routes, validators
│   ├── tests/           # Integration, crypto, and security test suites (96 tests)
│   ├── Dockerfile       # Lightweight container image based on oven/bun:1-alpine
│   └── docker-compose.yml # Backend container + Caddy reverse proxy + Grafana Alloy
├── frontend/            # High-performance React 19 SPA (Tailwind CSS v4 + Vite + Bun)
│   ├── src/pages/       # Landing, Developer Hub, Client Dashboard, Account Portal, Auth
│   ├── src/components/  # High-contrast UI components, modals, PramaanLogo
│   ├── src/services/    # Centralized headless API client (api.ts)
│   └── vercel.json      # Zero-config Vercel SPA rewrite configuration
├── sdk/                 # Official @anuj304/pramaan TypeScript SDK
│   ├── src/             # Discovery, PKCE, Token exchange, JWKS, UserInfo
│   └── tests/           # Comprehensive test suite (39 tests)
├── docs/                # Architecture, API specs, and deployment guides
├── package.json         # Bun workspaces root orchestrator
└── AGENTS.md            # AI agent & developer guidelines
```

---

## ⚡ Quick Start

### 1. Monorepo Local Development

Pramaan utilizes **Bun** across all workspaces. Ensure [Bun](https://bun.sh) is installed on your system.

```bash
# Clone the repository
git clone https://github.com/AnujAcharjee/pramaan.git
cd pramaan

# Install all workspace dependencies
bun install

# Start both backend (http://localhost:5000) and frontend (http://localhost:3000) concurrently
bun run dev
```

### Orchestrator Commands

| Command | Action |
| :--- | :--- |
| `bun run dev` | Starts both backend (`:5000`) and frontend (`:3000`) concurrently |
| `bun run dev:backend` | Starts backend in watch mode (`http://localhost:5000`) |
| `bun run dev:frontend` | Starts Vite frontend dev server (`http://localhost:3000`) |
| `bun run build:backend` | Compiles backend TypeScript (`tsc --build`) |
| `bun run build:frontend` | Compiles frontend TypeScript and bundles Vite (`dist/`) |
| `bun run test:backend` | Executes backend test suite (96 tests across 3 suites) |
| `bun run test:sdk` | Executes SDK test suite (39 tests across 8 suites) |
| `bun run lint` | Runs linting across codebase |
| `bun run format` | Prettier code formatting across all files |

---

## 🚀 Deployment Overview

Pramaan's decoupled architecture enables independent, optimal hosting for frontend and backend:

- **Backend (API & OIDC Engine)**: Deployed to **AWS EC2** (or any VPS/cloud VM) using Docker (`anuj304/pramaan:latest` on `oven/bun:1-alpine`), with **Caddy** providing automatic HTTPS certificates, reverse proxying, and **Grafana Alloy** shipping logs to Grafana Loki. Automated via GitHub Actions on push to `backend/**`.
- **Frontend (Web Console & SPA)**: Deployed to **Vercel** with single-click zero-config routing (`vercel.json`), pointing to the backend API via `VITE_API_URL`.

👉 Read the complete [**Self-Hosting & Deployment Guide →**](./docs/deployment.md)

---

## 🌐 Endpoints

Pramaan exposes standard RFC-compliant OIDC and OAuth 2.0 endpoints alongside headless REST APIs:

### Standard OAuth 2.0 & OIDC Endpoints

| Endpoint | Path | Description |
| :--- | :--- | :--- |
| **OpenID Configuration** | `/.well-known/openid-configuration` | OpenID Connect discovery metadata |
| **JWKS** | `/.well-known/jwks.json` | Public RS256 signing keys |
| **Authorization** | `/api/oauth/authorize` | RFC 6749 authorization code initiation |
| **Token Exchange** | `/api/oauth/token` | Exchanges authorization code for access & ID tokens |
| **UserInfo** | `/userinfo` | OIDC user profile claims (Bearer access token) |

### Headless REST APIs (v1)

| Route Prefix | Purpose |
| :--- | :--- |
| `/api/v1/auth/*` | Headless sign-in, sign-up, verification, and password recovery |
| `/api/v1/oauth/*` | Headless OAuth handshake, consent details, and decision submission |
| `/api/v1/developer/*` | Developer Hub client CRUD, secret rotation, and DNS verification |
| `/api/v1/account/*` | User profile management, password updates, active sessions, consents |

---

## 🛠️ Developer Hub & Client Management

Access the self-service **Developer Hub** at [`/developer`](https://pramaan.anujacharjee.com/developer):

- **Register OAuth Clients**: Configure client name, application domain, client type (`Confidential` vs `Public`), environment (`Development` vs `Production`), and redirect URIs.
- **Update Client Metadata**: Modify client name and application domain on the fly.
- **Credential Rotation**: Instantly rotate client secrets with zero downtime.
- **DNS TXT Domain Verification**: Verify ownership of custom apex domains or subdomains by setting a `_pramaan-verification.<domain>` TXT record, unlocking production-grade OAuth security.

👉 Read the complete [**Client Registration & Management Guide →**](./docs/01-create-client.md)

---

## 📦 Quick Start with Official SDK

The fastest and most secure way to integrate Pramaan into Node.js / TypeScript applications is with the official [`@anuj304/pramaan`](./sdk/) client library:

```bash
npm install @anuj304/pramaan
# or
bun add @anuj304/pramaan
```

```typescript
import { PramaanClient } from '@anuj304/pramaan';

const pramaan = new PramaanClient({
  issuer: 'https://pramaan.anujacharjee.com',
  clientId: process.env.PRAMAAN_CLIENT_ID!,
  clientSecret: process.env.PRAMAAN_CLIENT_SECRET,
  redirectUri: 'http://localhost:3000/pramaan/callback',
});

// 1. Initiate login (creates PKCE, state, and nonce)
const { url, transaction } = await pramaan.createAuthorizationRequest({
  scope: ['openid', 'profile', 'email'],
});
req.session.oauth = transaction;
res.redirect(url);

// 2. Complete callback & verify ID token via JWKS
const tokens = await pramaan.handleCallback({
  code: req.query.code,
  state: req.query.state,
  transaction: req.session.oauth,
});

// 3. Fetch user profile
const user = await pramaan.getUserInfo(tokens.accessToken);
```

⚡ **One-Click SDK Integration with AI Agents:** Have your AI assistant integrate authentication in seconds. [View AI Agent Prompt →](./docs/03-sdk-guide.md#-quick-setup-with-ai-agents)

---

## 📚 Documentation Suite

Comprehensive guides for every stage of integration and hosting:

| Guide | Description |
| :--- | :--- |
| 🐳 [**Self-Hosting & Deployment**](./docs/deployment.md) | AWS EC2 backend deployment (Docker + Caddy + Alloy) and Vercel frontend hosting. |
| 📄 [**01 — Registering an OAuth Client**](./docs/01-create-client.md) | Developer Hub, client creation, metadata updates, secret rotation, and DNS verification. |
| 🚀 [**02 — Manual Protocol Guide**](./docs/02-signup-flow.md) | Step-by-step RFC-compliant flow and headless handshake for any backend stack. |
| ⚡ [**03 — Official SDK Guide**](./docs/03-sdk-guide.md) | Detailed documentation for `@anuj304/pramaan` with full options, typed errors, and utilities. |
| 📚 [**04 — API & Claims Reference**](./docs/04-api-reference.md) | Headless REST APIs, OAuth endpoints, claim schemas, and error codes. |
| 🛡️ [**05 — Security & Best Practices**](./docs/05-security.md) | Threat model, PKCE rationale, timing-safe state comparison, and production checklist. |
| 💻 [**Runnable Express Example**](./sdk/examples/express/) | Full, production-ready Express reference application with sessions and UI. |

---

## 🔒 Security Practices

- **Zero Third-Party Lock-In**: Complete control over your identities, database, and encryption keys.
- **Envelope Encryption at Rest**: RSA/ECDSA private keys are encrypted using AES-256-GCM envelope encryption in PostgreSQL.
- **Mandatory PKCE (S256)**: Proof Key for Code Exchange (RFC 7636) prevents authorization code interception attacks.
- **Automated JWKS Key Rotation**: Automated rotation scripts and standard JWKS discovery.
- **DNS TXT Domain Verification**: Enforces verifiable domain ownership for production redirect URIs.

---

**License:** MIT  
**Author:** Anuj Acharjee ([@anuj304](https://github.com/AnujAcharjee))
