import type { Request, Response } from 'express';
import { BaseController } from './base.controller.js';
import { ENV } from '../config/env.js';
import { SERVER_URL } from '../utils/constant.js';

export class LandingController extends BaseController {
  renderLandingPage = this.handleViewRequest(async (req: Request, res: Response) => {
    res.render('pages/app/landing', {
      title: 'Pramaan - Modern OAuth 2.0 & OpenID Connect Identity Provider',
      description:
        'Pramaan is an open-source OAuth 2.0 and OpenID Connect identity provider. Secure authentication with PKCE, JWKS, and standards-compliant token management.',
      keywords:
        'oauth 2.0, openid connect, identity provider, PKCE, JWKS, authentication, authorization, open source idp',
      canonical: 'https://pramaan.anujacharjee.com/',
      serverUrl: SERVER_URL,
      docUrl: ENV.APP_DOC_URL,
    });
  });
}
