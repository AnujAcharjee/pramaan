# Registering & Managing OAuth Clients

Pramaan provides a dedicated **Developer Hub** at [`/developer`](https://pramaan.anujacharjee.com/developer) where you can create OAuth 2.0 / OpenID Connect applications, update client configurations, rotate client secrets, and verify custom domain ownership.

---

## 1. Access the Developer Hub

1. Sign in to Pramaan at [`/signin`](https://pramaan.anujacharjee.com/signin).
2. Navigate to the **Developer Hub** via the navigation bar or by visiting [`/developer`](https://pramaan.anujacharjee.com/developer).
3. The Developer Hub shows your registered applications partitioned by environment (**Production** vs. **Development**), along with their verification statuses.
4. Click **New OAuth Client** to open the registration modal.

---

## 2. Configure Client Properties

| Field | Description | Rules & Constraints |
| :--- | :--- | :--- |
| **Client Name** | The user-friendly application name displayed on the OAuth consent screen. | 2–50 characters. Can be updated anytime. |
| **Client Domain** | Your application's primary domain (e.g. `myapp.com` or `dev.myapp.com`). | Must be a valid domain. Protocol (`http://`, `https://`) and paths are stripped automatically. |
| **Client Type** | Application security architecture: <br>• **Confidential**: Server-side apps (Node, Next.js, Python, Go) that protect a secret.<br>• **Public**: SPAs, mobile, or desktop apps using PKCE without a client secret. | Determines whether a `client_secret` is issued and required during token exchange. |
| **Environment** | Target operational tier: <br>• **Development**: Permits `http://localhost`, `127.0.0.1`, and unverified preview domains.<br>• **Production**: Enforces strict `https://` schemes and requires DNS TXT domain verification. | Can be switched from the Client Dashboard. |
| **Redirect URIs** | Whitespace- or newline-separated callback URLs receiving the authorization code. | Matched exactly per RFC 6749. Scheme, host, port, and path must match without wildcards. |

---

## 3. Retrieve & Secure Your Credentials

After creating the client:
- **Client ID**: A unique, public identifier (e.g. `cli_a1b2c3d4e5f6...`) included in all authorization requests.
- **Client Secret**: A 64-character high-entropy cryptographic secret issued for Confidential clients.

> ⚠️ **Important:** The client secret is displayed in full **only once** upon creation or rotation. Copy and store it immediately in your application's secure secret manager or `.env` file. Never commit client secrets to version control.

---

## 4. Managing Your Application (`/client/:id`)

Click on any client card in the Developer Hub to open its individual **Client Dashboard**:

### A. Update Client Name & Domain
You can update your application's display name and primary domain at any time directly in the configuration section. Changes take effect immediately across all authorization requests and user consent screens.

### B. Rotate Client Secret
If a secret is compromised or routine rotation is required:
1. Click **Rotate Secret** in the Credentials card.
2. Confirm the rotation in the prompt.
3. The previous secret is revoked immediately, and a new 64-character secret is generated and displayed.

### C. DNS TXT Domain Ownership Verification
For **Production** applications, Pramaan enforces domain verification to prevent authorization code leakage:
1. Copy the **Verification Host** and **TXT Token** from the Domain Verification card:
   - **Apex domain** (`myapp.com`): Set TXT record at `_pramaan-verification.myapp.com` (or `_pramaan-verification`).
   - **Subdomain** (`auth.myapp.com`): Set TXT record at `_pramaan-verification.auth.myapp.com`.
2. Add the TXT record in your DNS provider (Cloudflare, Route 53, Vercel, GoDaddy).
3. Click **Verify Domain**. Pramaan performs live authoritative DNS queries. Once detected, the domain status upgrades to `VERIFIED`.

---

## Next Steps

- [Official SDK Guide (`@anuj304/pramaan`) →](./03-sdk-guide.md) — 3-minute integration for Node.js / TypeScript.
- [Manual Protocol Implementation →](./02-signup-flow.md) — Integrate using Python, Go, Java, Rust, or raw HTTP.
- [API & Claims Reference →](./04-api-reference.md) — Complete endpoint schemas and token parameters.
