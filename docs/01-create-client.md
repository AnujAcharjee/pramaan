# Registering an OAuth Client

Register your application in Pramaan to obtain the credentials needed for the OAuth flow.

---

## 1. Open the Dashboard

Sign in at [pramaan.anujacharjee.com/account](https://pramaan.anujacharjee.com/account) and navigate to **Registered Clients** under the developer section.

Click **Create OAuth Client**.

---

## 2. Fill in Client Details

| Field | Description |
| :--- | :--- |
| **Client Name** | Display name shown to users on the consent screen |
| **Client Domain** | Your application's primary domain (e.g. `yourapp.com`) |
| **Client Type** | `Confidential` for server-side apps (can store a secret securely), `Public` for SPAs/mobile apps |
| **Environment** | `Production` enforces `https://` redirect URIs. `Development` allows `http://localhost` |
| **Redirect URI** | The exact callback URL that receives the authorization code (e.g. `https://yourapp.com/oauth/callback`) |

> ⚠️ Redirect URIs are matched exactly. A trailing slash or different port will cause a mismatch error.

---

## 3. Save Your Credentials

After creation you'll see:

- **Client ID** — a public identifier included in authorization requests
- **Client Secret** — used by confidential clients during the token exchange

Store the Client Secret securely. It is not recoverable after you leave the page, but it can be regenerated from the dashboard.

> Never commit your Client Secret to version control or expose it in client-side code.

---

## 4. Manage Your Client

From the **Client Dashboard** you can:

- View and update the client configuration
- Add or remove redirect URIs
- Regenerate credentials
- Switch between development and production environments

---

## Next Steps

- [Official SDK Guide →](./03-sdk-guide.md) — Fast and secure integration using `@anuj304/pramaan`
- [Manual Implementation Guide →](./02-signup-flow.md) — Raw HTTP and protocol flow for any backend language
- [API & Claims Reference →](./04-api-reference.md) — Comprehensive endpoints, parameters, and claims specifications

