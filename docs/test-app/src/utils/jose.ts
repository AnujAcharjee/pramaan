import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { CLIENT_ID } from '../config.js';
import { getOpenIdConfiguration } from './discovery.js';

let jwksCache: JWTVerifyGetKey | null = null;

export async function verifyIdToken(idToken: string, nonce: string) {
  const oidcConfig = await getOpenIdConfiguration();

  if (!jwksCache) {
    jwksCache = createRemoteJWKSet(new URL(oidcConfig.jwks_uri));
  }

  const issuers = Array.from(new Set([oidcConfig.issuer, new URL(oidcConfig.jwks_uri).origin]));

  const verified = await jwtVerify(idToken, jwksCache, {
    issuer: issuers.length === 1 ? issuers[0] : issuers,
    audience: CLIENT_ID,
    algorithms: ['RS256'],
  });

  if (verified.payload.nonce !== nonce) {
    throw new Error('Invalid nonce');
  }

  return verified.payload;
}
