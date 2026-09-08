import { SCOPES } from '../utils/constant.js';
import type { Request, Response, NextFunction } from 'express';
import type { OAuthService, AuthorizationCacheType } from '../services/oauth.service.js';
import type { AccountService } from '../services/account.service.js';
import { BaseController } from './base.controller.js';
import { AppError } from '../utils/appError.js';
import { ErrorCode } from '../utils/errorCodes.js';
import { ClientService } from '../services/client.service.js';

/**
 * AUTHORIZE (GET) :
 *  1. validate & cache the req
 *  2. consent: true -> generate code -> redirect(redirect_uri)
 *  3. consent: false -> redirect(renderConsent page route + request_id)
 *
 * ISSUE TOKENS:
 *  1. get OIDC & Access tokens
 */

export class OAuthController extends BaseController {
  constructor(
    private oauthService: OAuthService,
    private accountService: AccountService,
    private clientService: ClientService,
  ) {
    super();
  }

  // ---------------- AUTHORIZE ----------------

  authorize = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user.id;
      const requestId = req.requestId;

      const redirectURL = await this.oauthService.authorize(requestId, userId);

      return res.redirect(303, redirectURL);
    } catch (error) {
      next(error);
    }
  };

  // ---------------- CONSENT ----------------

  renderConsentPage = this.handleViewRequest(async (req: Request, res: Response) => {
    const requestId = req.query.request_id as string;
    const authReq = await this.oauthService.getAuthorizationRequest(requestId);
    const client = await this.clientService.getClient(authReq.clientId);

    res.render('pages/oauth/consent', {
      title: 'Authorize Application',
      requestId: authReq.id,
      clientId: authReq.clientId,
      clientName: client.name,
      clientDomain: client.domain,
      scopes: authReq.scopes,
    });
  });

  consent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { request_id, decision } = req.body;
      const userId = req.user.id;

      const authReq = (await this.oauthService.getAuthorizationRequest(request_id)) as AuthorizationCacheType;
      if (!authReq) {
        throw new AppError('Authorization request not found', 404, ErrorCode.NOT_FOUND, false);
      }

      // DENY
      if (decision === 'deny') {
        const redirectURL = new URL(authReq.redirectUri);
        redirectURL.searchParams.set('error', 'access_denied');
        redirectURL.searchParams.set('error_description', 'The resource owner denied the request');
        if (authReq.state) redirectURL.searchParams.set('state', authReq.state);

        return res.redirect(303, redirectURL.toString());
      }

      // APPROVE
      if (decision === 'approve') {
        await this.oauthService.storeConsent(userId, authReq.clientId, authReq.scopes);

        const authCode = await this.oauthService.issueAuthorizationCode(authReq, userId);

        const redirectURL = new URL(authReq.redirectUri);
        redirectURL.searchParams.set('code', authCode);
        if (authReq.state) redirectURL.searchParams.set('state', authReq.state);

        return res.redirect(303, redirectURL.toString());
      }

      throw new AppError('Invalid decision', 400, ErrorCode.INVALID_INPUT);
    } catch (error) {
      next(error);
    }
  };

  // ---------------- TOKEN ----------------

  issueTokens = (req: Request, res: Response, next: NextFunction) =>
    this.handleApiRequest(req, res, next, async () => {
      const tokens = await this.oauthService.issueTokens({
        grantType: req.body.grant_type,
        code: req.body.code,
        codeVerifier: req.body.code_verifier,
        clientId: req.body.client_id,
        clientSecret: req.body.client_secret,
      });

      return {
        res,
        data: tokens,
        message: 'Tokens issued successfully',
      };
    });

  // ---------------- OIDC USERINFO ----------------

  userinfo = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, scopes } = req.client;
      const claims = await this.oauthService.getUserInfoClaims(userId, scopes);

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store, no-cache, max-age=0, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      return res.status(200).json(claims);
    } catch (error) {
      next(error);
    }
  };
}
