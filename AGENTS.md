# Pramaan - AI Agent & Developer Guidelines

Pramaan is an open-source, standards-compliant OAuth 2.0 and OpenID Connect (OIDC) Identity Provider (IdP) built with Node.js, Express, TypeScript, EJS, and Tailwind CSS v4. It features PKCE, RS256/ES256 signing, automated JWKS rotation, and DNS-based domain verification.

---

## 1. Directory Structure

```
├── src/
│   ├── config/          # Environment schema (Zod), database, Cloudinary
│   ├── controllers/     # Route handlers (auth, account, client, landing)
│   ├── middlewares/     # Auth, session, security headers, file upload
│   ├── routes/          # Express route definitions (web & api)
│   ├── services/        # Business logic (client, account, jose, email)
│   ├── styles/          # Tailwind CSS v4 source (input.css)
│   ├── utils/           # Constants, crypto, DNS, error helpers
│   ├── validators/      # Zod request payload schemas
│   └── views/           # EJS templates (layouts, pages, partials)
├── public/
│   ├── css/             # Compiled CSS (output.css)
│   └── js/              # Client scripts (dashboard, nav, copy, alert)
├── tests/               # Backend integration and security test suites
├── sdk/                 # Official @anuj304/pramaan TypeScript SDK
└── docs/                # Architecture, guides, and API specifications
```

---

## 2. Consoles Overview

- **User Account Portal (`/account`)**: User profile management, password/security settings, active login sessions, and authorized OAuth third-party app consents.
- **Developer Hub (`/developer`)**: Registered OAuth client metrics (Production vs. Dev), quick client creation, and standard OIDC protocol discovery endpoints.
- **Client Dashboard (`/client/:id`)**: Individual client credentials, secret rotation, allowed callback redirect URIs, DNS TXT domain verification, and client lifecycle settings.

---

## 3. Commands & Execution Rules

| Command             | Purpose                                   | When to Run                                                                                                                                 |
| ------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run css:build` | Recompiles Tailwind CSS to `output.css`   | **Mandatory**: Run at the end of each process whenever any EJS view, HTML markup, or `input.css` changes.                                   |
| `npm run lint`      | Runs ESLint validation across codebase    | **Mandatory**: Run before every commit (use `npm run lint:fix` to auto-resolve issues).                                                     |
| `npm run format`    | Prettier code and markdown formatting     | Run before commits to maintain formatting consistency across `.ts` and `.md` files.                                                         |
| `npm run test`      | Executes test suites with tsx test runner | Run **only** when modifying backend services, controllers, auth/crypto logic, SDK, or database queries. **Do NOT run for UI/view changes.** |
| `npm run build`     | Compiles TypeScript (`tsc --build`)       | Run to validate full TypeScript compilation before production releases or major refactors.                                                  |
