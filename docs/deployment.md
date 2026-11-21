# Pramaan Self-Hosting & Deployment Guide

This guide walks you through deploying and self-hosting **Pramaan** using its modern, decoupled architecture:
- **Backend**: Headless OAuth 2.0 / OIDC engine and REST API running on **Bun**, deployed to **AWS EC2** (or any cloud VM) via Docker, Caddy, and Grafana Alloy.
- **Frontend**: React 19 SPA built with **Vite**, **Tailwind CSS v4**, and **Bun**, deployed to **Vercel** (or any static/SPA hosting).

---

## 1. System Architecture

```
[ Client Application / SDK ]
            │
            ▼
┌──────────────────────────┐           ┌──────────────────────────┐
│   Frontend (Vercel SPA)  │           │   Backend (AWS EC2 VM)   │
│   React 19 + Tailwind v4 │ ◄───────► │   Caddy Reverse Proxy    │
│   https://auth.domain.com│           │   (Automatic HTTPS / TLS)│
└──────────────────────────┘           └────────────┬─────────────┘
                                                    │
                                                    ▼
                                       ┌──────────────────────────┐
                                       │    Pramaan Container     │
                                       │   (oven/bun:1-alpine)    │
                                       │   Headless REST & OIDC   │
                                       └───────┬──────────┬───────┘
                                               │          │
                                               ▼          ▼
                                       ┌────────────┐ ┌───────────┐
                                       │ PostgreSQL │ │   Redis   │
                                       │ (Neon/RDS) │ │(Upstash)  │
                                       └────────────┘ └───────────┘
```

---

## 2. One-Click Setup with AI Agents (Fastest)

If you use an AI coding assistant or agent (**Antigravity**, **Cursor**, **Claude Code**, or **Copilot**), paste the prompt below into chat to set up the workspace automatically:

```markdown
Set up and run Pramaan (OAuth 2.0 / OpenID Connect Identity Provider) in this workspace:

1. **Prerequisites & Environment**:
   - Ensure Bun is available: `bun --version`.
   - Copy `backend/.env.example` to `backend/.env` if not present.
   - Generate 64-character high-entropy cryptographic secrets:
     `bun -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - Fill in `backend/.env`:
     - `PORT=5000`
     - `APP_DOMAIN=localhost:5000`
     - `AUTH_ISSUER=http://localhost:5000`
     - `FRONTEND_URL=http://localhost:3000`
     - `COOKIE_SECRET=<32+ random characters>`
     - `KEY_ENC_SECRET=<64 hex chars>`
     - `CLIENT_SECRET_KEY=<64 hex chars>`
     - `NEON_PG_DATABASE_URL=<valid PostgreSQL connection string>`
     - `REDIS_URL=<valid Redis connection URL>`
     - `RESEND_API_KEY=<Resend API key>`
     - `EMAIL_FROM=<verified sender email>`

2. **Dependencies & Database Sync**:
   - Install root and workspace dependencies: `bun install`
   - Generate Prisma Client: `bun --cwd backend run prisma:generate`
   - Run Prisma migrations: `bun --cwd backend run prisma:dev:migrate` (or `bun run prisma db push`)

3. **Start Development Servers**:
   - Run orchestrator: `bun run dev`
   - Backend will run on `http://localhost:5000`
   - Frontend Vite SPA will run on `http://localhost:3000`

4. **Verify Health & Discovery**:
   - Healthcheck: `http://localhost:5000/health`
   - OIDC Discovery: `http://localhost:5000/.well-known/openid-configuration`
   - Frontend Landing: `http://localhost:3000`
```

---

## 3. Local Monorepo Development

### Prerequisites
- [Bun](https://bun.sh) `>= 1.2.0`
- PostgreSQL database (local or cloud instance like Neon)
- Redis instance (local or Upstash)

### Step 1: Clone and Install
```bash
git clone https://github.com/AnujAcharjee/pramaan.git
cd pramaan
bun install
```

### Step 2: Configure Environment
Copy `backend/.env.example` to `backend/.env`:
```bash
cp backend/.env.example backend/.env
```

Ensure your PostgreSQL (`NEON_PG_DATABASE_URL`) and Redis (`REDIS_URL`) credentials are configured.

### Step 3: Run Database Migrations
```bash
bun --cwd backend run prisma:generate
bun --cwd backend run prisma:dev:migrate
```

### Step 4: Start Development Servers
```bash
bun run dev
```
- **Backend API**: `http://localhost:5000`
- **Frontend SPA**: `http://localhost:3000`

---

## 4. Backend Deployment (AWS EC2 with Docker)

The backend runs as a containerized Bun service behind a Caddy reverse proxy on an AWS EC2 instance.

### Automated CI/CD Pipeline
The repository includes a GitHub Actions workflow (`.github/workflows/deploy.yaml`) that automatically:
1. Triggers on changes to `backend/**` pushed to `main`.
2. Builds the Docker image (`anuj304/pramaan:latest`) using `backend/Dockerfile` (`oven/bun:1-alpine`).
3. Pushes the image to Docker Hub.
4. Securely transfers `docker-compose.yml`, `Caddyfile`, and `config.alloy` to `/srv/pramaan` on your EC2 instance via SSH.
5. Injects production environment variables and executes `docker compose pull && docker compose up -d --remove-orphans`.

### Manual EC2 Server Setup

#### 1. Server Directory Structure
On your EC2 host:
```bash
sudo mkdir -p /srv/pramaan
cd /srv/pramaan
```

#### 2. Configure `docker-compose.yml`
```yaml
services:
  caddy:
    image: caddy:alpine
    container_name: pramaan_caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    networks:
      - pramaan_net
    depends_on:
      pramaan:
        condition: service_healthy

  pramaan:
    image: anuj304/pramaan:latest
    container_name: pramaan_app
    restart: unless-stopped
    command: ["bun", "dist/index.js"]
    env_file: .env
    expose:
      - "8080"
    networks:
      - pramaan_net
    healthcheck:
      test: ["CMD-SHELL", "bun -e \"fetch('http://localhost:8080/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 15s

  alloy:
    image: grafana/alloy:latest
    container_name: pramaan_alloy
    restart: unless-stopped
    command: ["run", "--server.http.listen-addr=0.0.0.0:12345", "/etc/alloy/config.alloy"]
    volumes:
      - ./config.alloy:/etc/alloy/config.alloy:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    env_file: .env
    networks:
      - pramaan_net

networks:
  pramaan_net:
    driver: bridge

volumes:
  caddy_data:
  caddy_config:
```

#### 3. Configure `Caddyfile`
Caddy handles automatic SSL certificate issuance and renewal via Let's Encrypt:
```caddy
api.yourdomain.com {
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

#### 4. Configure Production `.env`
Create `/srv/pramaan/.env`:
```bash
NODE_ENV=production
PORT=8080
APP_NAME=Pramaan
APP_DOMAIN=api.yourdomain.com
AUTH_ISSUER=https://api.yourdomain.com
FRONTEND_URL=https://auth.yourdomain.com
APP_DOC_URL=https://docs.pramaan.dev

# Database (PostgreSQL / Neon)
NEON_PG_DATABASE_URL=postgresql://user:password@host/pramaan?sslmode=require

# Redis Cache
REDIS_URL=rediss://default:password@host:6379

# Cryptographic Secrets (32+ chars)
COOKIE_SECRET=your-random-64-character-hex-cookie-secret
KEY_ENC_SECRET=your-random-64-character-hex-key-enc-secret
CLIENT_SECRET_KEY=your-random-64-character-hex-client-secret-key

# Transactional Email (Resend)
RESEND_API_KEY=re_your_api_key
EMAIL_FROM=auth@yourdomain.com

# Expirations (seconds)
ACTIVE_SESSION_EX=900
IDENTITY_SESSION_EX=15552000
EMAIL_VERIFICATION_TOKEN_EX=3600
SIGN_IN_FAIL_COUNT_EX=900

# Grafana Cloud Loki Logging (Optional)
GRAFANA_CLOUD_LOKI_URL=https://logs-prod-xxx.grafana.net/loki/api/v1/push
GRAFANA_CLOUD_LOKI_USER=123456
GRAFANA_CLOUD_LOKI_TOKEN=glc_xxx
```

#### 5. Launch Backend Services
```bash
docker compose pull
docker compose up -d
```

---

## 5. Frontend Deployment (Vercel)

The React 19 SPA (`frontend/`) is optimized for zero-config deployment on **Vercel**.

### Step 1: Import Repository to Vercel
1. Log into your [Vercel Dashboard](https://vercel.com).
2. Click **Add New Project** and select your `pramaan` repository.
3. Configure the project settings:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `bun run build` (or `npm run build`)
   - **Output Directory**: `dist`

### Step 2: Set Environment Variables
Add the following environment variable in the Vercel project settings:

| Variable | Value | Description |
| :--- | :--- | :--- |
| `VITE_API_URL` | `https://api.yourdomain.com` | Base URL of your deployed EC2 backend |

### Step 3: Deploy & Routing
Vercel uses [frontend/vercel.json](file:///d:/Products/PRAMAAN-IdP/application/frontend/vercel.json) to rewrite all SPA paths to `index.html`:
```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

Once deployed, assign your custom domain (e.g. `auth.yourdomain.com`).

---

## 6. Environment Variables Reference

| Variable | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | Yes | `development` | Runtime environment (`development`, `production`, `test`) |
| `PORT` | Yes | `5000` | HTTP port the backend binds to (e.g. `5000` local, `8080` in container) |
| `APP_DOMAIN` | Yes | — | Public domain without protocol (e.g. `api.yourdomain.com`) |
| `AUTH_ISSUER` | Yes | — | Base issuer URL (e.g. `https://api.yourdomain.com`). Must match OIDC `iss`. |
| `FRONTEND_URL` | Optional | `http://localhost:3000` | Public URL of the frontend SPA (used for email verify & consent redirects) |
| `COOKIE_SECRET` | Yes | — | 32+ character secret for signed cookies |
| `KEY_ENC_SECRET` | Yes | — | 64-character hex secret for AES-256-GCM private key envelope encryption |
| `CLIENT_SECRET_KEY` | Yes | — | 64-character hex secret for encrypting client secrets at rest |
| `NEON_PG_DATABASE_URL`| Yes | — | PostgreSQL connection string |
| `REDIS_URL` | Yes | — | Redis connection URL |
| `RESEND_API_KEY` | Yes | — | Resend API key for transactional email |
| `EMAIL_FROM` | Yes | — | Verified sender email address |
| `PRAMAAN_DNS_SERVERS` | Optional | — | Custom DNS resolvers for DNS TXT verification (e.g. `1.1.1.1,8.8.8.8`) |

---

## 7. Verification & Health Monitoring

Verify the backend deployment with:

```bash
# Check service health (returns 200 OK)
curl -i https://api.yourdomain.com/health

# Check OIDC Discovery metadata
curl -s https://api.yourdomain.com/.well-known/openid-configuration | jq .

# Check active public JWKS
curl -s https://api.yourdomain.com/.well-known/jwks.json | jq .
```

---

## Next Steps

- [Client Registration & Management →](./01-create-client.md)
- [Official SDK Guide (`@anuj304/pramaan`) →](./03-sdk-guide.md)
- [API & Claims Reference →](./04-api-reference.md)
- [Security Best Practices →](./05-security.md)
