import { ENV } from '../config/env.js';
import type { Response } from 'express';

export const COOKIE_NAMES = {
  ACTIVE_SESSION: '_Secure-ASID',
  IDENTITY_SESSION: '_Secure-ISID',
  HOST_ID: '_Host-ID',
  USER: '_User-INFO',
} as const;

export async function setSessionCookies(res: Response, isid: string | null, asid: string | null) {
  if (isid) {
    res.cookie(COOKIE_NAMES.IDENTITY_SESSION, isid, {
      httpOnly: true,
      secure: ENV.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: ENV.NODE_ENV === 'production' ? ENV.IDENTITY_SESSION_EX * 1000 : 30 * 24 * 60 * 60 * 1000,
      signed: true,
    });
  }

  if (asid) {
    res.cookie(COOKIE_NAMES.ACTIVE_SESSION, asid, {
      httpOnly: true,
      secure: ENV.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: ENV.NODE_ENV === 'production' ? ENV.ACTIVE_SESSION_EX * 1000 : 15 * 60 * 1000,
      signed: true,
    });
  }
}
