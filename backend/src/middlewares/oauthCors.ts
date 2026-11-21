import cors from 'cors';

/**
 * CORS configuration for public OAuth 2.0 and OpenID Connect endpoints:
 * - Token endpoint (/api/oauth/token)
 * - UserInfo endpoints (/userinfo, /api/oauth/userinfo)
 * - Discovery & JWKS (/.well-known/*, /api/.well-known/*)
 *
 * Per RFC 6749 and OIDC Core specifications, public clients (SPAs, mobile apps)
 * communicate directly with these endpoints cross-origin without ambient credentials.
 */
export const oauthCors = cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  maxAge: 86400, // 24 hours preflight cache
});
