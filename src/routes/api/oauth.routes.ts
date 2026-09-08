import { Router } from 'express';
import { oauthService } from '../../services/oauth.service.js';
import { accountService } from '../../services/account.service.js';
import { clientService } from '../../services/client.service.js';
import { OAuthController } from '../../controllers/oauth.controller.js';
import { OAuthZSchema } from '../../validators/oauth.validator.js';
import { validateRequest } from '../../middlewares/validateRequest.js';
import { Authentication } from '../../middlewares/authMiddleware.js';
import { OAuthMiddleware } from '../../middlewares/oauthMiddleware.js';

const router = Router();
const oauthController = new OAuthController(oauthService, accountService, clientService);

// Authorize endpoint
router.get(
  '/api/oauth/authorize',
  validateRequest(OAuthZSchema.authorizeSchema),
  OAuthMiddleware.validateAndCacheReq,
  Authentication.ssr('oauth'),
  oauthController.authorize,
);

// Token endpoint
router.post('/api/oauth/token', validateRequest(OAuthZSchema.issueTokensSchema), oauthController.issueTokens);

// Standard OIDC UserInfo endpoints (GET and POST supported per OIDC Core 5.3.1)
router
  .route('/userinfo')
  .get(Authentication.client, oauthController.userinfo)
  .post(Authentication.client, oauthController.userinfo);

router
  .route('/api/oauth/userinfo')
  .get(Authentication.client, oauthController.userinfo)
  .post(Authentication.client, oauthController.userinfo);

export default router;
