import type { Request, Response, NextFunction } from 'express';
import { oauthService, type AuthorizeParamsType, type AuthorizationCacheType } from '../../services/oauth.service.js';
import { accountService } from '../../services/account.service.js';
import { clientService } from '../../services/client.service.js';
import { AppError } from '../../utils/appError.js';
import { ErrorCode } from '../../utils/errorCodes.js';

export class OAuthApiController {
  /**
   * Headless Authorize Handshake
   * Validates OAuth request, caches transaction in Redis,
   * checks user authentication state and consent status,
   * and returns actionable JSON instructions for SPA loaders.
   */
  authorize = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const requestId = req.requestId;
      const params = req.query as AuthorizeParamsType;

      // 1. Validate parameters, active client, allowed redirect URIs & cache in Redis
      await oauthService.validateAndCacheAuthorizeRequest(params, requestId);

      const client = await clientService.getClient(params.client_id);

      // 2. Check if user is authenticated (populated by Authentication.optionalSsr)
      const userId = req.user?.id;

      if (!userId) {
        res.status(200).json({
          status: 'unauthenticated',
          requestId,
          client: {
            id: client.id,
            name: client.name,
            domain: client.domain,
            avatar: client.avatar,
            domainStatus: client.domainStatus,
          },
          redirectUrl: `/signin?flow=oauth&request_id=${encodeURIComponent(requestId)}`,
        });
        return;
      }

      // 3. User is authenticated -> Check consent
      const scopes = oauthService.validateScopes(params.scope);
      const hasConsent = await oauthService.hasConsent(userId, client.id, scopes);

      if (!hasConsent) {
        res.status(200).json({
          status: 'consent_required',
          requestId,
          client: {
            id: client.id,
            name: client.name,
            domain: client.domain,
            avatar: client.avatar,
            domainStatus: client.domainStatus,
          },
          redirectUrl: `/oauth/consent?request_id=${encodeURIComponent(requestId)}`,
        });
        return;
      }

      // 4. Consent is already granted -> Issue code and return redirect
      const authReq = await oauthService.getAuthorizationRequest(requestId);
      const authCode = await oauthService.issueAuthorizationCode(authReq, userId);

      const redirectURL = new URL(authReq.redirectUri);
      redirectURL.searchParams.set('code', authCode);
      if (authReq.state) redirectURL.searchParams.set('state', authReq.state);

      res.status(200).json({
        status: 'authorized',
        requestId,
        redirectUrl: redirectURL.toString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get Consent Screen Metadata
   */
  getConsentDetails = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const requestId = req.query.request_id as string;
      if (!requestId) {
        throw new AppError('request_id is required', 400, ErrorCode.INVALID_REQUEST);
      }

      const authReq = await oauthService.getAuthorizationRequest(requestId);
      const client = await clientService.getClient(authReq.clientId);
      const user = req.user?.id ? await accountService.get(req.user.id) : null;

      let alreadyConsented = false;
      let redirectUrl: string | undefined = undefined;

      if (user) {
        const hasConsent = await oauthService.hasConsent(user.id, client.id, authReq.scopes);
        if (hasConsent) {
          alreadyConsented = true;
          const authCode = await oauthService.issueAuthorizationCode(authReq, user.id);
          const redirectURL = new URL(authReq.redirectUri);
          redirectURL.searchParams.set('code', authCode);
          if (authReq.state) redirectURL.searchParams.set('state', authReq.state);
          redirectUrl = redirectURL.toString();
        }
      }

      res.status(200).json({
        alreadyConsented,
        redirectUrl,
        requestId: authReq.id,
        scopes: authReq.scopes,
        redirectUri: authReq.redirectUri,
        client: {
          id: client.id,
          name: client.name,
          domain: client.domain,
          avatar: client.avatar,
          environment: client.environment,
          domainStatus: client.domainStatus,
        },
        user: user
          ? {
              id: user.id,
              name: user.name,
              email: user.email,
              avatar: user.avatar,
            }
          : null,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Process Consent Decision (Approve / Deny)
   */
  submitConsentDecision = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { request_id, decision } = req.body;
      const effectiveDecision = Array.isArray(decision) ? decision[0] : decision;
      const userId = req.user.id;

      if (!request_id || !effectiveDecision) {
        throw new AppError('request_id and decision are required', 400, ErrorCode.INVALID_REQUEST);
      }

      const authReq = (await oauthService.getAuthorizationRequest(request_id)) as AuthorizationCacheType;
      if (!authReq) {
        throw new AppError('Authorization request expired or not found', 404, ErrorCode.NOT_FOUND);
      }

      // DENY
      if (effectiveDecision === 'deny') {
        const redirectURL = new URL(authReq.redirectUri);
        redirectURL.searchParams.set('error', 'access_denied');
        redirectURL.searchParams.set('error_description', 'The resource owner denied the request');
        if (authReq.state) redirectURL.searchParams.set('state', authReq.state);

        res.status(200).json({
          status: 'denied',
          redirectUrl: redirectURL.toString(),
        });
        return;
      }

      // APPROVE
      if (effectiveDecision === 'approve') {
        await oauthService.storeConsent(userId, authReq.clientId, authReq.scopes);
        const authCode = await oauthService.issueAuthorizationCode(authReq, userId);

        const redirectURL = new URL(authReq.redirectUri);
        redirectURL.searchParams.set('code', authCode);
        if (authReq.state) redirectURL.searchParams.set('state', authReq.state);

        res.status(200).json({
          status: 'approved',
          redirectUrl: redirectURL.toString(),
        });
        return;
      }

      throw new AppError('Invalid decision. Must be approve or deny', 400, ErrorCode.INVALID_INPUT);
    } catch (error) {
      next(error);
    }
  };
}

export const oauthApiController = new OAuthApiController();
