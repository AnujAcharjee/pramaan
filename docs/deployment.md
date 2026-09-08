# Pramaan Self-Hosting & Deployment Guide

This guide walks you through deploying and self-hosting your own instance of **Pramaan** on your own infrastructure (VPS, AWS, DigitalOcean, Hetzner, or bare metal).

---

## 1. System Architecture

A production Pramaan deployment consists of:

* **Pramaan App Container:** Node.js backend executing the OpenID Connect & OAuth 2.0 services.
* **Reverse Proxy (Caddy / Nginx):** Handles SSL termination (automatic Let's Encrypt certificates), compression, and security headers.
* **PostgreSQL Database:** Stores users, registered OAuth clients, grants, and cryptographic key metadata (compatible with PostgreSQL 14+, Neon, Supabase, or AWS RDS).
* **Redis Cache:** High-speed in-memory store for session states, authorization codes, rate limiting, and discovery document caching.
* **Transactional Email (Resend):** Sends email verification codes and password reset links.
* **Cloudinary (Optional):** Handles user avatar image storage.

---

## 2. Quick Start with Docker Compose (Recommended)

The easiest way to run Pramaan in production is using Docker Compose with Caddy.

### Step 1: Clone the Repository

```bash
git clone https://github.com/AnujAcharjee/pramaan.git
cd pramaan
```

### Step 2: Configure Environment Variables

Copy the sample environment file:

```bash
cp .env.example .env
```

Edit `.env` and fill in your production values (see [Configuration Reference](#4-configuration-reference) below):

```bash
# Minimum required settings
NODE_ENV=production
PORT=8080
APP_NAME=Pramaan
APP_DOMAIN=auth.yourdomain.com
OAUTH_ISSUER=https://auth.yourdomain.com

# PostgreSQL Connection String
NEON_PG_DATABASE_URL=postgresql://user:password@db-host:5432/pramaan?sslmode=require

# Redis Connection
REDIS_HOST=your-redis-host.com
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_TLS_ENABLED=true

# High-Entropy Cryptographic Secrets (32+ random characters each)
COOKIE_SECRET=generate-a-random-64-character-hex-string
KEY_ENC_SECRET=generate-a-random-64-character-hex-string
CLIENT_SECRET_KEY=generate-a-random-64-character-hex-string

# Email Delivery
RESEND_API_KEY=re_your_resend_api_key
EMAIL_FROM=auth@yourdomain.com

# Initial Super Admin Account
INIT_ADMIN_EMAIL=admin@yourdomain.com
INIT_ADMIN_PASSWORD=YourStrongInitialPassword123!
```

> 💡 **Tip:** Generate random 64-character hex strings in your terminal with:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

### Step 3: Configure Caddy Reverse Proxy

Edit the included `Caddyfile` with your domain:

```caddy
auth.yourdomain.com {
  encode gzip zstd
  reverse_proxy pramaan:8080

  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    X-Content-Type-Options "nosniff"
    X-Frame-Options "DENY"
    Referrer-Policy "no-referrer"
    Permissions-Policy "camera=(), microphone=(), geolocation=()"
  }

  log {
    output stdout
    format console
  }
}
```

Caddy will automatically obtain and renew SSL/TLS certificates from Let's Encrypt for your domain.

### Step 4: Run Database Migrations

Before starting the server, run the Prisma schema migrations against your PostgreSQL database:

```bash
npx prisma db push
```

### Step 5: Launch Services

Start the containers in detached mode:

```bash
docker compose up -d
```

Check health and logs:

```bash
docker compose ps
docker compose logs -f pramaan
```

Visit `https://auth.yourdomain.com` in your browser and sign in with your `INIT_ADMIN_EMAIL` and `INIT_ADMIN_PASSWORD`.

---

## 3. Manual Node.js Deployment (Bare Metal / VM)

If deploying directly onto a Linux server without Docker:

### Prerequisites
* **Node.js:** `>= 20.0.0`
* **npm:** `>= 10.0.0`
* **Process Manager:** `pm2` (`npm install -g pm2`)

### Build & Start Steps

```bash
# 1. Install dependencies
npm ci

# 2. Generate Prisma Client
npx prisma generate

# 3. Push schema to database
npx prisma db push

# 4. Build TypeScript & CSS bundles
npm run build

# 5. Start with PM2
pm2 start dist/index.js --name "pramaan" -i max
pm2 save
pm2 startup
```

---

## 4. Configuration Reference

| Variable | Required | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | Yes | `production` or `development`. |
| `PORT` | Yes | Port the HTTP application listens on (default: `8080`). |
| `APP_DOMAIN` | Yes | Public domain name without protocol (e.g. `auth.yourdomain.com`). |
| `OAUTH_ISSUER` | Yes | Exact base URL of your identity provider (e.g. `https://auth.yourdomain.com`). Must match what clients use. |
| `NEON_PG_DATABASE_URL`| Yes | PostgreSQL database connection string. |
| `REDIS_HOST` | Yes | Redis host endpoint. |
| `REDIS_PORT` | Yes | Redis port (default: `6379`). |
| `REDIS_PASSWORD` | No | Redis authorization password. |
| `REDIS_TLS_ENABLED` | No | `true` if your Redis provider uses TLS (e.g. Upstash, AWS). |
| `COOKIE_SECRET` | Yes | Secret key used to sign HTTP session cookies. |
| `KEY_ENC_SECRET` | Yes | Cryptographic key used to encrypt RS256 private keys in the database. |
| `CLIENT_SECRET_KEY` | Yes | Secret key used to encrypt client secrets. |
| `RESEND_API_KEY` | Yes | API key from Resend for verification emails. |
| `EMAIL_FROM` | Yes | Sender email address (e.g. `auth@yourdomain.com`). |
| `INIT_ADMIN_EMAIL` | Yes | Initial super-admin email seeded on first startup. |
| `INIT_ADMIN_PASSWORD`| Yes| Password for the initial admin account. |

---

## 5. Production Health & Monitoring

Pramaan provides a lightweight healthcheck endpoint:

```bash
curl https://auth.yourdomain.com/health
```

**Response (`200 OK`):**
```json
{
  "status": "healthy",
  "timestamp": "2026-09-09T04:00:00.000Z"
}
```

The Docker Compose configuration includes an automatic health check that restarts the container if the endpoint fails 3 consecutive times.

---

## Next Steps

- [Client Registration Guide →](./01-create-client.md) — Register your first OAuth application
- [Official SDK Guide →](./03-sdk-guide.md) — Integrate your Node.js apps with `@anuj304/pramaan`
- [Security Best Practices →](./05-security.md) — Production hardening guidelines
