# Pramaan Backend — Headless REST & OIDC Engine

The headless core engine and authentication server for **Pramaan Identity Provider**.

Built with **Bun**, **Express 5**, **TypeScript**, **Prisma ORM (PostgreSQL)**, and **Redis**.

---

## ⚡ Architecture & Features

- **Headless Architecture**: Complete separation from presentation tier; exposes REST API endpoints under `/api/v1/*` and standard OIDC discovery/OAuth endpoints under `/api/oauth/*` and `/.well-known/*`.
- **RFC 7636 PKCE**: Mandatory Proof Key for Code Exchange (S256) preventing code interception attacks.
- **Cryptographic Key Management**:
  - Asymmetric RS256 token signing with dynamic Key ID (`kid`) rotation.
  - Automated JWKS publishing at `/.well-known/jwks.json`.
  - AES-256-GCM envelope encryption for private keys stored at rest in PostgreSQL.
- **DNS TXT Domain Verification**: Authoritative DNS TXT verification for production client redirect URIs (`_pramaan-verification.<domain>`).
- **Production Observability**: Structured JSON logging via Pino, request correlation IDs (`X-Request-Id`), and log forwarding to Grafana Loki via Grafana Alloy.

---

## 🛠️ Development & Tooling

### Prerequisites
- [Bun](https://bun.sh) `>= 1.2.0`
- PostgreSQL database
- Redis instance

### Scripts & Commands

```bash
# Start backend in watch mode (http://localhost:5000)
bun run dev

# Run comprehensive test suites (96 tests across integration, crypto, domain verification)
bun run test

# Typecheck and compile TypeScript to dist/
bun run build

# Run database migrations
bun run prisma:dev:migrate

# Regenerate Prisma Client
bun run prisma:generate

# Rotate RS256/ES256 signing keys and update JWKS
bun run keys:rotate

# Lint backend source
bun run lint
```

---

## 🐳 Containerization & Deployment

The backend is packaged as a minimal, lightweight container based on `oven/bun:1-alpine`.

```bash
# Build Docker image
docker build -t anuj304/pramaan:latest -f Dockerfile .

# Run with Docker Compose
docker compose up -d
```

Automated deployments to AWS EC2 are managed via `.github/workflows/deploy.yaml`.
See the full [Deployment Guide →](../docs/deployment.md).
