import { ENV } from '../config/env.js';
import type { Response } from 'express';

export const COOKIE_NAMES = {
  ACTIVE_SESSION: '_Secure-ASID',
  IDENTITY_SESSION: '_Secure-ISID',
  HOST_ID: '_Host-ID',
  USER: '_User-INFO',
} as const;

export function getCookieDomain(): string | undefined {
  if (ENV.NODE_ENV !== 'production') return undefined;
  if (process.env.COOKIE_DOMAIN) return process.env.COOKIE_DOMAIN;
  if (ENV.APP_DOMAIN && !ENV.APP_DOMAIN.includes('localhost')) {
    // If APP_DOMAIN is e.g. api.pramaan.anujacharjee.com, extract .pramaan.anujacharjee.com
    const cleanDomain = ENV.APP_DOMAIN.replace(/^https?:\/\//, '').split(':')[0];
    const parentDomain = cleanDomain.replace(/^api\./, '');
    return `.${parentDomain}`;
  }
  return undefined;
}

export async function setSessionCookies(res: Response, isid: string | null, asid: string | null) {
  const cookieDomain = getCookieDomain();
  const domainOption = cookieDomain ? { domain: cookieDomain } : {};

  if (isid) {
    res.cookie(COOKIE_NAMES.IDENTITY_SESSION, isid, {
      httpOnly: true,
      secure: ENV.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: ENV.NODE_ENV === 'production' ? ENV.IDENTITY_SESSION_EX * 1000 : 30 * 24 * 60 * 60 * 1000,
      signed: true,
      ...domainOption,
    });
  }

  if (asid) {
    res.cookie(COOKIE_NAMES.ACTIVE_SESSION, asid, {
      httpOnly: true,
      secure: ENV.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: ENV.NODE_ENV === 'production' ? ENV.ACTIVE_SESSION_EX * 1000 : 15 * 60 * 1000,
      signed: true,
      ...domainOption,
    });
  }
}

export function clearSessionCookies(res: Response) {
  const cookieDomain = getCookieDomain();
  // Clear without domain (for host-only cookies)
  res.clearCookie(COOKIE_NAMES.IDENTITY_SESSION, { signed: true });
  res.clearCookie(COOKIE_NAMES.ACTIVE_SESSION, { signed: true });
  // Clear with domain (for shared domain cookies)
  if (cookieDomain) {
    res.clearCookie(COOKIE_NAMES.IDENTITY_SESSION, { signed: true, domain: cookieDomain });
    res.clearCookie(COOKIE_NAMES.ACTIVE_SESSION, { signed: true, domain: cookieDomain });
  }
}
