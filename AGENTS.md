# Pramaan - AI Agent & Developer Guidelines

Pramaan is an open-source, standards-compliant OAuth 2.0 and OpenID Connect (OIDC) Identity Provider (IdP). It features a modern, decoupled architecture:

- **Backend (`backend/`)**: Headless REST API and OAuth/OIDC engine built with **Bun**, **Express 5**, **TypeScript**, **Prisma ORM (PostgreSQL)**, and **Redis**. Supports PKCE (RFC 7636), RS256/ES256 signing, automated JWKS rotation, envelope encryption at rest, and DNS-based TXT domain verification.
- **Frontend (`frontend/`)**: High-performance Single Page Application (SPA) built with **React 19**, **TypeScript**, **Tailwind CSS v4**, **Vite**, and **Bun**, optimized for zero-config **Vercel** deployment.
- **SDK (`sdk/`)**: Official `@anuj304/pramaan` TypeScript client library.

---

## 1. Directory Structure

```
├── backend/
│   ├── prisma/          # Database schema (schema.prisma) & migrations
│   ├── src/
│   │   ├── config/      # Zod env schema, Prisma client, Redis, Pino logger
│   │   ├── controllers/ # Headless REST API (api/v1/*), OAuth & OIDC controllers
│   │   ├── middlewares/ # Auth/session, CORS, security headers, rate limiters
│   │   ├── routes/      # API routes (api/v1/*), OAuth protocols, & well-known
│   │   ├── services/    # Business logic (oauth, jose, client, account, dns)
│   │   ├── utils/       # Crypto helpers, error classes, constants, cookies
│   │   ├── validators/  # Zod request validation schemas
│   │   └── views/       # Legacy EJS templates (preserved for reference)
│   ├── tests/           # Integration, crypto, and security test suites
│   └── package.json     # Backend dependencies & Bun scripts
├── frontend/
│   ├── public/          # Static assets, favicons, Pramaan "P" logo
│   ├── src/
│   │   ├── components/  # Reusable UI components, modals, PramaanLogo, nav, footer
│   │   ├── context/     # AuthContext, ThemeContext
│   │   ├── pages/       # React SPA routes (Landing, Auth, Developer, Client, Account)
│   │   ├── services/    # Centralized headless API client (api.ts)
│   │   ├── App.tsx      # React router configuration
│   │   └── index.css    # Tailwind CSS v4 source & theme variables
│   ├── vercel.json      # Vercel SPA rewrite configuration
│   └── package.json     # Frontend dependencies & Vite/Bun scripts
├── sdk/                 # Official @anuj304/pramaan TypeScript SDK
├── scripts/             # Monorepo maintenance & utility scripts
├── docs/                # Architecture, API specs, and deployment guides
├── package.json         # Monorepo workspaces & root orchestrator scripts
└── AGENTS.md            # AI agent & developer guidelines (this file)
```

---

## 2. Consoles & Frontend Routes Overview

- **Landing & Discovery (`/`)**: High-contrast hero, features grid, framework integration code examples, and live OIDC discovery links.
- **Authentication (`/signin`, `/signup`, `/verify`, `/forgot-password`, `/reset-password`)**: Pure white/pure black auth flows with `<PramaanLogo />`.
- **OAuth Handshake & Consent (`/oauth/consent`, `/oauth/authorize`, `/authorize`)**: OAuth consent authorization with `<OAuthHandshakeLoader />` preventing 404 flashes during client handshakes.
- **Developer Hub (`/developer`)**: Registered OAuth client metrics (Production vs. Dev), client registration modal, and API discovery links.
- **Client Dashboard (`/client/:id`)**: Individual client credentials, secret rotation, redirect URI management, DNS TXT domain verification, and client lifecycle settings.
- **User Account Portal (`/account`)**: User profile management, password/security settings, active login sessions, and third-party app consents.

---

## 3. Strict Frontend Aesthetic Rules

- **Zero-Tint Color Palette:**
  - **Light Mode:** Pure White (`#FFFFFF`, `bg-white`). Strictly **NO** off-white, yellowed paper, ivory, or sand tints.
  - **Dark Mode:** Pure Black (`#000000`, `dark:bg-black`) with crisp 1px borders (`dark:border-neutral-800`).
  - **Accents:** Pramaan Signature Orange (`#FF9644` to `#FA812F`).
  - **Code Blocks:** High-contrast neutral containers — light gray in light mode (`bg-slate-100 border-slate-300`) and dark gray in dark mode (`dark:bg-neutral-900 dark:border-neutral-800`) with colorful syntax tokens.
- **Pramaan "P" Logo:**
  - Always use `<PramaanLogo />` component (`/android-chrome-192x192.png`) across navbars, auth cards, handshake loaders, and footers.

---

## 4. Commands & Execution Rules

Pramaan utilizes **Bun** across both backend and frontend workspaces.

### Root Orchestrator Commands

| Command                  | Action                                                            |
| :----------------------- | :---------------------------------------------------------------- |
| `bun run dev:backend`    | Starts backend server in watch mode (`http://localhost:5000`)     |
| `bun run dev:frontend`   | Starts Vite frontend dev server (`http://localhost:3000`)         |
| `bun run build:backend`  | Compiles backend TypeScript (`tsc --build`)                       |
| `bun run build:frontend` | Compiles frontend TypeScript and bundles Vite (`dist/`)           |
| `bun run test:backend`   | Executes backend test suites via Bun test runner                  |
| `bun run lint`           | Runs ESLint across backend codebase                               |
| `bun run format`         | Prettier code formatting across `.ts`, `.tsx`, `.md`, and `.json` |

### Workspace-Specific Commands

| Workspace   | Command                      | Purpose                                           |
| :---------- | :--------------------------- | :------------------------------------------------ |
| `backend/`  | `bun run dev`                | Watch mode server (`bun --watch src/index.ts`)    |
| `backend/`  | `bun run build`              | Compiles TypeScript to `dist/`                    |
| `backend/`  | `bun run test`               | Runs backend tests with Bun test runner           |
| `backend/`  | `bun run prisma:dev:migrate` | Runs Prisma database migrations                   |
| `backend/`  | `bun run prisma:generate`    | Regenerates Prisma client                         |
| `backend/`  | `bun run keys:rotate`        | Rotates RS256/ES256 signing keys and updates JWKS |
| `frontend/` | `bun run dev`                | Starts Vite dev server                            |
| `frontend/` | `bun run build`              | Validates types and builds production SPA bundle  |
| `frontend/` | `bun run lint`               | Runs high-speed `oxlint` on frontend source       |

---

## 5. Critical Agent Constraints

1. **DO NOT COMMIT CHANGES AUTOMATICALLY**: Never execute `git commit` unless the user explicitly gives direct permission in chat.
2. **Preserve Legacy Views**: Keep legacy EJS templates in `backend/src/views/` for backwards-compatibility and reference; do not delete them.
3. **Frontend / Backend Separation**:
   - Frontend must never import server-side modules or access database/crypto keys directly.
   - All client communication must go through headless REST APIs (`/api/v1/*`) or OAuth endpoints with `{ credentials: 'include' }`.
