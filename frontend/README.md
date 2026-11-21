# Pramaan Frontend — Modern Single Page Application (SPA)

The official web console and authentication frontend for **Pramaan Identity Provider**.

Built with **React 19**, **TypeScript**, **Tailwind CSS v4**, **Vite**, and **Bun**, optimized for zero-config deployment on **Vercel**.

---

## 🎨 Design Philosophy: Zero-Tint Aesthetic

Pramaan enforces a strict high-contrast, zero-tint developer aesthetic:

- **Light Mode**: Pure White (`#FFFFFF`, `bg-white`). Strictly no off-white, yellowed paper, ivory, or sand tints.
- **Dark Mode**: Pure Black (`#000000`, `dark:bg-black`) paired with crisp 1px borders (`dark:border-neutral-800`).
- **Signature Accent**: Pramaan Signature Orange (`#FF9644` to `#FA812F`).
- **Typography**:
  - **Sans (Prose & UI)**: [Inter](https://fonts.google.com/specimen/Inter) (`font-sans`, weights 300–800) with antialiased font smoothing.
  - **Mono (Code & Keys)**: [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) (`font-mono`) with ligatures for credentials, client IDs, code blocks, and hashes.
- **Pramaan Logo**: Always rendered using the unified `<PramaanLogo />` component (`/android-chrome-192x192.png`).

---

## 🗺️ Routes & Application Consoles

| Route | View | Description |
| :--- | :--- | :--- |
| `/` | **Landing & Discovery** | High-contrast hero, features grid, framework integration code playground, and live discovery links. |
| `/signin` | **Sign In** | Headless credential authentication, MFA challenge support, and OAuth flow resumption. |
| `/signup` | **Sign Up** | Clean user registration supporting standalone and OAuth-interrupted flows (`?flow=oauth&request_id=...`). |
| `/verify` | **Email Verification** | Informs user of dispatched link with instant resend capability. |
| `/forgot-password` | **Forgot Password** | Dispatches secure password reset link. |
| `/reset-password` | **Reset Password** | Token-authenticated password reset. |
| `/authorize` | **OAuth Handshake** | Headless loader (`<OAuthHandshakeLoader />`) preventing 404 flashes during client handshakes. |
| `/oauth/consent` | **OAuth Consent Screen** | Displays requesting application branding, domain status badge, and scope permissions. |
| `/developer` | **Developer Hub** | Client metrics (Production vs. Dev), client registration modal, and API discovery links. |
| `/client/:id` | **Client Dashboard** | Edit client name & domain, secret rotation, redirect URI management, and DNS TXT verification. |
| `/account` | **User Account Portal** | Profile management, password updates, active login sessions, and third-party app consents. |

---

## 🛠️ Development & Tooling

### Prerequisites
- [Bun](https://bun.sh) `>= 1.2.0`

### Commands

```bash
# Start Vite development server (http://localhost:3000)
bun run dev

# Run oxlint for high-speed static code quality checks
bun run lint

# Validate types and build production bundle (dist/)
bun run build

# Preview production bundle locally
bun run preview
```

---

## 🚀 Deployment (Vercel)

The frontend is ready for immediate deployment on **Vercel**:

1. **Root Directory**: `frontend`
2. **Build Command**: `bun run build`
3. **Output Directory**: `dist`
4. **Environment Variables**:
   - `VITE_API_URL`: The URL of your Pramaan backend (e.g. `https://api.yourdomain.com`). In local development, defaults to `/` (proxied to `:5000` via Vite).
5. **SPA Rewrites**: Handled by [`vercel.json`](./vercel.json):
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
