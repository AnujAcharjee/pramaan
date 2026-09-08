# Pramaan Test Client

A reference OAuth 2.0 + OpenID Connect client for testing the complete authentication flow against Pramaan.

The app runs behind Caddy (automatic HTTPS via local CA) inside Docker, giving you a realistic production-like setup on `https://test.localhost`.

---

## Project Structure

```
test-app/
├── src/
│   ├── controllers/       # Route handlers (auth, home)
│   ├── services/           # OAuth logic & user store
│   ├── middlewares/         # Auth guards
│   ├── routes/              # Express route definitions
│   ├── utils/
│   │   ├── discovery.ts     # OIDC discovery with endpoint caching
│   │   ├── jose.ts          # ID token verification via JWKS
│   │   └── securityParameters.ts  # PKCE, state, nonce generation
│   ├── views/               # EJS templates (login, dashboard)
│   ├── @types/              # TypeScript declarations
│   ├── config.ts            # Environment config
│   ├── app.ts               # Express setup
│   └── index.ts             # Entry point
├── Caddyfile                # Reverse proxy config
├── Dockerfile
├── docker-compose.yaml
└── .env.example
```

---

## Setup

### 1. Clone and Navigate

```bash
git clone https://github.com/AnujAcharjee/pramaan.git
cd pramaan/docs/test-app
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Open `.env` and fill in your client credentials:

```env
PORT=3000
CLIENT_URI=https://test.localhost
PRAMAAN_SERVER=https://pramaan.anujacharjee.com
CLIENT_ID=<your-client-id>
CLIENT_SECRET=<your-client-secret>
```

Get `CLIENT_ID` and `CLIENT_SECRET` from the [Pramaan dashboard](https://pramaan.anujacharjee.com/account) after [creating a client](../01-create-client.md). Set the redirect URI to `https://test.localhost/oauth/callback`.

### 3. Install Dependencies

```bash
npm install
```

### 4. Build and Start (Docker)

```bash
npm run docker:build
npm run docker:up
```

This starts two containers:
- **app** — the Node.js test client on port 3000
- **caddy** — reverse proxy serving `https://test.localhost` with automatic TLS

### 5. Trust the Local CA Certificate

```bash
npm run trust
```

This copies `root.crt` from the Caddy container. Import it into your system's trusted root certificate store so your browser accepts `https://test.localhost`.

### 6. Open the App

Visit [https://test.localhost](https://test.localhost) and click **Sign In with Pramaan**.

---

## Running Without Docker

If you prefer to run locally without Docker (HTTP only, suitable for development):

```bash
npm run dev
```

The app will start on `http://localhost:3000`. Make sure your `CLIENT_URI` in `.env` matches and that you've registered `http://localhost:3000/oauth/callback` as a redirect URI with environment set to **Development** in the Pramaan dashboard.

---

## What This Client Demonstrates

- **OIDC Discovery** — fetches `/.well-known/openid-configuration` and caches endpoint URLs
- **Authorization Code + PKCE** — generates `code_verifier`/`code_challenge` (S256), `state`, and `nonce`
- **Token Exchange** — exchanges the authorization code at the token endpoint with PKCE proof
- **ID Token Verification** — validates RS256 signature via remote JWKS, checks `issuer`, `audience`, and `nonce`
- **UserInfo Claims** — fetches user profile from the `/userinfo` endpoint using the access token
- **Session Management** — creates a server-side session with secure cookie flags after authentication

---

## Security Notes

- Do not disable HTTPS in production — OAuth requires it for redirect URIs
- Always validate `state` and `nonce` on the callback
- Never expose `CLIENT_SECRET` in client-side code
- Verify ID token signatures via JWKS — never skip verification
