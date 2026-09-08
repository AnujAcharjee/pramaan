# Pramaan Express Example

A complete reference application demonstrating how to integrate an Express web application with Pramaan Identity Provider using `@pramaan/node`.

## Features Demonstrated

* **OIDC Discovery**: Automatic metadata discovery from `https://pramaan.anujacharjee.com/.well-known/openid-configuration`.
* **PKCE & CSRF Defense**: S256 PKCE challenge generation, cryptographic state and nonce management.
* **Server-Side Session**: Secure persistence of authorization transactions and tokens in `express-session` (no tokens in browser localStorage).
* **ID Token Validation**: RS256 signature verification via JWKS with issuer and audience checks.
* **UserInfo Retrieval**: Authenticated fetch of the user's profile claims.

## Setup & Running

1. **Register a Client in Pramaan**:
   * Domain: `http://localhost:3000`
   * Redirect URI: `http://localhost:3000/callback`
   * Client Type: `CONFIDENTIAL`

2. **Configure Environment Variables**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Fill in your `PRAMAAN_CLIENT_ID` and `PRAMAAN_CLIENT_SECRET`.

3. **Install Dependencies**:
   ```bash
   npm install
   ```

4. **Start Development Server**:
   ```bash
   npm run dev
   ```

5. Visit `http://localhost:3000` in your browser.
