---
name: frontend
description: >-
  Frontend architecture, UI component styling, and React 19 + Tailwind CSS v4 + Bun implementation guide for Pramaan IdP.
  Use when creating or updating React pages, components, modals, navigation, forms, badges, and styles.
---

# Pramaan IdP Frontend Design System & React Architecture

This guide defines the aesthetic standards, component architecture, and implementation guidelines for the **Pramaan Identity Provider (IdP)** frontend. Pramaan uses a modern, decoupled single-page application (SPA) built with **React 19, TypeScript, Tailwind CSS v4, Vite, and Bun**, deployed seamlessly to **Vercel** and integrated with the headless Pramaan backend REST API.

---

## 1. Core Principles & Negative Constraints

- **The Concept:** A high-precision, distraction-free developer identity workspace featuring crisp typography, razor-sharp 1px borders, and vivid signature orange accents.
- **Strict Color Scheme (No Shades/Tints):**
  - **Light Mode Background:** Pure White (`#FFFFFF`, `bg-white`). Strictly **NO** off-white, yellowed parchment, warm ivory (`#FEF9E1`), or sand (`#E9DAC1`).
  - **Dark Mode Background:** Pure Black (`#000000`, `dark:bg-black`). Cards and elevated sheets use pure black or deep slate (`dark:bg-neutral-950`) bounded by crisp borders (`dark:border-neutral-800`).
  - **Primary Brand Accent:** Pramaan Orange (`#FF9644` to `#FA812F`, `--brand-orange`, `--brand-orange-dark`).
  - **Code Blocks:** High-contrast neutral containers — light gray in light mode (`bg-slate-100 border-slate-300`) and dark gray in dark mode (`dark:bg-neutral-900 dark:border-neutral-800`) with colorful syntax highlighting.
- **Negative Constraints:**
  - **NO** heavy muddy box shadows (`shadow-2xl`).
  - **NO** glassy backdrop overlays (`backdrop-blur-2xl`) that destroy contrast.
  - **NO** generic AI purple/cyan gradients.
  - **NO** EJS / SSR rendering in the frontend workspace (all views are decoupled React components).

---

## 2. Color Palette & Typography Tokens

### Canvas & Surfaces

| Surface                  | Light Mode             | Dark Mode               | Tailwind Classes                                                            |
| :----------------------- | :--------------------- | :---------------------- | :-------------------------------------------------------------------------- |
| **Page Canvas**          | `#FFFFFF` (Pure White) | `#000000` (Pure Black)  | `bg-white dark:bg-black`                                                    |
| **Card / Modal Surface** | `#FFFFFF`              | `#000000` / `#0A0A0A`   | `bg-white dark:bg-black dark:border-neutral-800`                            |
| **Secondary Surface**    | `#F8FAFC` (Slate-50)   | `#111111` (Neutral-900) | `bg-slate-50 dark:bg-neutral-900`                                           |
| **Code Block Container** | `#F1F5F9` (Slate-100)  | `#171717` (Neutral-900) | `bg-slate-100 border-slate-300 dark:bg-neutral-900 dark:border-neutral-800` |
| **Pencil Contours**      | `1px solid #E2E8F0`    | `1px solid #262626`     | `border border-slate-200 dark:border-neutral-800`                           |

### Brand Accents & Interactive States

- **Primary Orange Gradient:** `bg-linear-to-r from-[#FF9644] to-[#FA812F]` (active buttons, hero badges, highlights).
- **Focus Rings:** `focus:ring-2 focus:ring-[#FF9644]/30 focus:border-[#FF9644]`.
- **Status Badges:**
  - _Active / Verified:_ Emerald wash (`bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800`).
  - _Pending / In Verification:_ Amber wash (`bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800`).
  - _Revoked / Destructive:_ Rose wash (`bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800`).
  - _Development / Sandbox:_ Sky wash (`bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800`).

### Typography & Fonts

- **Primary Sans:** System sans stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`).
- **Brand Title / Hero:** High-contrast tracking font (`font-bold text-slate-900 dark:text-white`).
- **Technical Monospace:** Monospace font (`font-mono` / `JetBrains Mono`) for client IDs, client secrets, hashes, DNS TXT records, and code blocks.

---

## 3. Brand Assets & The Pramaan "P" Logo

Always use the official `<PramaanLogo />` component (`frontend/src/components/PramaanLogo.tsx`) across all user-facing headers, auth pages, loaders, and footers:

```tsx
import { PramaanLogo } from '../components/PramaanLogo';

// Variants:
<PramaanLogo size="sm" />  // 24x24 px (table rows, compact headers)
<PramaanLogo size="md" />  // 36x36 px (main navbar)
<PramaanLogo size="lg" />  // 48x48 px (auth card headers)
<PramaanLogo size="xl" />  // 64x64 px (handshake loader, landing hero)
```

- **Static Asset Path:** `/android-chrome-192x192.png` located in `frontend/public/`.
- **Fallback:** Automatic stylized orange gradient box with bold letter "P".

---

## 4. Component Design Patterns

### 1. Primary Buttons (`.btn-orange`)

Use the `.btn-orange` class or Tailwind utility combination:

```tsx
<button className="btn-orange px-4 py-2.5 text-sm font-semibold rounded-lg">Get Started</button>
```

_Properties:_

- Linear gradient from `#FF9644` to `#FA812F`.
- Subtle brand shadow `box-shadow: 0 4px 14px rgba(250, 129, 47, 0.22)`.
- Smooth hover elevation: `hover:-translate-y-0.5 hover:shadow-orange-500/30`.
- Tactile click feedback: `active:translate-y-0 active:scale-[0.99]`.

### 2. Outline & Secondary Buttons

```tsx
<button className="px-4 py-2.5 text-sm font-semibold rounded-lg border border-slate-300 dark:border-neutral-700 bg-white dark:bg-black text-slate-800 dark:text-neutral-200 hover:border-[#FF9644] dark:hover:border-[#FF9644] hover:text-[#FA812F] transition-all">
  Documentation
</button>
```

### 3. Form Inputs & Selects

Inputs must feature crisp 1px borders, pure white/black background, and brand orange focus rings:

```tsx
<input
  type="text"
  className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-white dark:bg-black border border-slate-300 dark:border-neutral-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-[#FF9644]/30 focus:border-[#FF9644] transition-all"
/>
```

### 4. Interactive Modals & Dialogs

- Backdrop: Subtle dark scrim (`bg-black/60 dark:bg-black/80`).
- Container: Pure white (`bg-white`) in light mode, pure black (`dark:bg-black`) in dark mode with a 1px border (`border border-slate-200 dark:border-neutral-800 shadow-xl rounded-xl`).
- Listen for `Escape` key and clicks on backdrop to close.

### 5. Code Blocks with Colorful Syntax Highlighting

On the landing page and developer docs, code blocks are housed in high-contrast neutral containers:

- **Light mode:** `bg-slate-100 border border-slate-300`
- **Dark mode:** `dark:bg-neutral-900 dark:border dark:border-neutral-800`
- **Header:** Window controls (traffic light red/yellow/green dots) + framework selector tabs (Express, Next.js, Fastify).
- **Syntax Tokens:**
  - Keywords (`import`, `export`, `const`): `#F43F5E` (rose)
  - Modules & strings: `#10B981` (emerald)
  - Identifiers & parameters: `#38BDF8` (sky) / `#A855F7` (purple)
  - Brand token constants: `#FA812F` (brand orange)

### 6. OAuth Handshake Loader (`<OAuthHandshakeLoader />`)

When third-party applications initiate an OAuth handshake (e.g. OpenSpace `https://api.openspace.anujacharjee.com/api/v1/auth/pramaan?mode=signin`), display `<OAuthHandshakeLoader />`:

- Animated pulsing `<PramaanLogo size="xl" />`.
- Contextual loading step indicator (Validating Client ID, Checking Scope, Verifying PKCE challenge).
- Automatic smooth redirection without 404 flashes.

---

## 5. Directory & File Structure

```
frontend/
├── public/                 # Static assets (favicons, manifests, images)
│   ├── favicon_io/
│   ├── android-chrome-192x192.png
│   └── favicon.ico
├── src/
│   ├── components/         # Reusable UI components & modals
│   │   ├── PramaanLogo.tsx
│   │   ├── Navbar.tsx
│   │   ├── Footer.tsx
│   │   ├── OAuthHandshakeLoader.tsx
│   │   ├── ClientModal.tsx
│   │   ├── DomainVerificationModal.tsx
│   │   ├── RotateSecretModal.tsx
│   │   ├── RevokeConsentModal.tsx
│   │   └── Toast.tsx
│   ├── context/            # React context providers
│   │   ├── AuthContext.tsx
│   │   └── ThemeContext.tsx
│   ├── pages/              # Route views
│   │   ├── LandingPage.tsx
│   │   ├── SignInPage.tsx
│   │   ├── SignUpPage.tsx
│   │   ├── VerifyEmailPage.tsx
│   │   ├── ForgotPasswordPage.tsx
│   │   ├── ResetPasswordPage.tsx
│   │   ├── ConsentPage.tsx
│   │   ├── OAuthAuthorizePage.tsx
│   │   ├── AccountPage.tsx
│   │   ├── DeveloperPage.tsx
│   │   ├── ClientPage.tsx
│   │   └── NotFoundPage.tsx
│   ├── services/           # Headless API client
│   │   └── api.ts
│   ├── App.tsx             # Route definitions & router shell
│   ├── main.tsx            # Application entrypoint
│   └── index.css           # Tailwind CSS v4 & theme variables
├── package.json            # React 19, Vite, Tailwind v4, Bun scripts
├── tsconfig.json           # TypeScript configuration
├── vercel.json             # SPA routing rewrite for Vercel
└── vite.config.ts          # Vite configuration
```

---

## 6. Backend API Integration Rules

- All API communications must route through `frontend/src/services/api.ts` or standard fetch with `{ credentials: 'include' }` to ensure secure HTTP-only session cookies are transmitted.
- **REST Endpoints:**
  - `POST /api/v1/auth/signin`
  - `POST /api/v1/auth/signup`
  - `POST /api/v1/auth/signout`
  - `GET /api/v1/auth/me`
  - `GET /api/v1/developer/clients`
  - `POST /api/v1/developer/clients`
  - `GET /api/v1/developer/clients/:client_id`
  - `PATCH /api/v1/developer/clients/:client_id`
  - `POST /api/v1/developer/clients/:client_id/rotate-secret`
  - `POST /api/v1/developer/clients/:client_id/verify-domain`
  - `GET /api/v1/account/profile`
  - `GET /api/v1/account/sessions`
  - `GET /api/v1/account/consents`
- All JSON errors return `{ success: false, error: { message, code } }`. Always handle graceful error toasts.

---

## 7. Developer & Bun Workflow Commands

Execute commands inside `frontend/` or via monorepo scripts from the project root:

| Command           | Action           | Description                                            |
| :---------------- | :--------------- | :----------------------------------------------------- |
| `bun run dev`     | Local Dev Server | Starts Vite dev server at `http://localhost:3000`      |
| `bun run build`   | Production Build | Runs `tsc -b` and bundles with `vite build` to `dist/` |
| `bun run lint`    | Linter           | Runs `oxlint` for high-speed code inspection           |
| `bun run preview` | Local Preview    | Serves production build preview                        |

> **Monorepo Notice:** Never run `git commit` automatically; only commit when the user explicitly requests a commit.
