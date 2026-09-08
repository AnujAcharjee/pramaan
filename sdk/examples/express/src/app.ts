import express from 'express';
import session from 'express-session';
import dotenv from 'dotenv';
import {
  PramaanClient,
  type AuthorizationTransaction,
  type TokenSet,
  OAuthError,
  PramaanError,
} from '@anuj304/pramaan';

dotenv.config();

// Augment express-session types
declare module 'express-session' {
  interface SessionData {
    oauth?: AuthorizationTransaction;
    tokens?: TokenSet;
  }
}

const app = express();
const port = process.env.PORT || 3000;

// Initialize Pramaan SDK Client
const pramaan = new PramaanClient({
  issuer: process.env.PRAMAAN_ISSUER || 'https://pramaan.anujacharjee.com',
  clientId: process.env.PRAMAAN_CLIENT_ID || 'demo-client-id',
  clientSecret: process.env.PRAMAAN_CLIENT_SECRET,
  redirectUri: process.env.PRAMAAN_REDIRECT_URI || `http://localhost:${port}/callback`,
});

// Configure server-side session
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'pramaan-demo-secret-key-12345',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60, // 1 hour
    },
  }),
);

// Home Page
app.get('/', (req, res) => {
  if (req.session.tokens) {
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Pramaan Demo App</title><style>body{font-family:sans-serif;padding:2rem;background:#0d1117;color:#c9d1d9;}a{color:#58a6ff;}</style></head>
        <body>
          <h2>Welcome! You are logged in.</h2>
          <p><a href="/profile">View Profile & Claims</a></p>
          <p><a href="/logout">Logout</a></p>
        </body>
      </html>
    `);
  }

  res.send(`
    <!DOCTYPE html>
    <html>
      <head><title>Pramaan Demo App</title><style>body{font-family:sans-serif;padding:2rem;background:#0d1117;color:#c9d1d9;}a{color:#58a6ff;font-size:1.2rem;}</style></head>
      <body>
        <h1>Pramaan Node.js SDK Demo</h1>
        <p>This application demonstrates authentication with Pramaan using <code>@pramaan/node</code>.</p>
        <p><a href="/login">Sign in with Pramaan &rarr;</a></p>
      </body>
    </html>
  `);
});

// 1. Step 1: Start Authorization Flow
app.get('/login', async (req, res, next) => {
  try {
    const authorization = await pramaan.createAuthorizationRequest({
      scope: ['openid', 'profile', 'email'],
    });

    // Save transaction state (state, nonce, codeVerifier) in secure server session
    req.session.oauth = authorization.transaction;

    // Redirect browser to Pramaan IdP
    res.redirect(authorization.url);
  } catch (err) {
    next(err);
  }
});

// 2. Step 2: Handle OAuth Callback
app.get('/callback', async (req, res, next) => {
  try {
    const { code, state, error, error_description } = req.query;

    // Handle user denial or server-side OAuth error
    if (error) {
      throw new OAuthError(String(error), error_description ? String(error_description) : undefined);
    }

    if (!req.session.oauth) {
      return res.status(400).send('Session expired. Please try logging in again.');
    }

    // Exchange code for tokens, validate state, and verify ID token
    const tokens = await pramaan.handleCallback({
      code: String(code),
      state: String(state),
      transaction: req.session.oauth,
    });

    // Clean up one-time authorization transaction
    delete req.session.oauth;

    // Save tokens in session
    req.session.tokens = tokens;

    res.redirect('/profile');
  } catch (err) {
    next(err);
  }
});

// 3. Step 3: Fetch Protected UserInfo
app.get('/profile', async (req, res, next) => {
  try {
    if (!req.session.tokens?.accessToken) {
      return res.redirect('/login');
    }

    // Fetch user profile from Pramaan UserInfo endpoint
    const user = await pramaan.getUserInfo(req.session.tokens.accessToken);

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>User Profile</title>
          <style>
            body { font-family: sans-serif; padding: 2rem; background: #0d1117; color: #c9d1d9; }
            pre { background: #161b22; padding: 1rem; border-radius: 6px; overflow-x: auto; color: #58a6ff; }
            a { color: #58a6ff; }
            .badge { background: #238636; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; }
          </style>
        </head>
        <body>
          <h2>User Profile <span class="badge">Authenticated</span></h2>
          <p><strong>Name:</strong> ${user.name || 'N/A'}</p>
          <p><strong>Email:</strong> ${user.email || 'N/A'} ${user.email_verified ? '✓ Verified' : ''}</p>
          <p><strong>Subject (User ID):</strong> <code>${user.sub}</code></p>
          ${user.picture ? `<p><img src="${user.picture}" alt="Avatar" width="80" style="border-radius:50%;" /></p>` : ''}
          
          <h3>UserInfo Response</h3>
          <pre>${JSON.stringify(user, null, 2)}</pre>

          <h3>Verified ID Token Claims</h3>
          <pre>${JSON.stringify(req.session.tokens.claims || {}, null, 2)}</pre>

          <p><a href="/logout">Log out</a></p>
        </body>
      </html>
    `);
  } catch (err) {
    next(err);
  }
});

// 4. Step 4: Logout (Client Session)
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// Error handling middleware
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Application Error:', err);

  const message = err instanceof PramaanError ? err.message : 'An unexpected error occurred';
  res.status(500).send(`
    <h2>Authentication Error</h2>
    <p style="color:red;">${message}</p>
    <p><a href="/">Return Home</a></p>
  `);
});

app.listen(port, () => {
  console.log(`Example Express app running at http://localhost:${port}`);
});
