import { Router } from 'express';
import { oauthService } from '../../services/oauth.service.js';
import { accountService } from '../../services/account.service.js';
import { clientService } from '../../services/client.service.js';
import { OAuthController } from '../../controllers/oauth.controller.js';
import { OAuthZSchema } from '../../validators/oauth.validator.js';
import { validateRequest } from '../../middlewares/validateRequest.js';
import { Authentication } from '../../middlewares/authMiddleware.js';
import { OAuthMiddleware } from '../../middlewares/oauthMiddleware.js';
import { oauthCors } from '../../middlewares/oauthCors.js';

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

// Token endpoint (with CORS for public SPA and mobile clients)
router.use('/api/oauth/token', oauthCors);
router.post('/api/oauth/token', validateRequest(OAuthZSchema.issueTokensSchema), oauthController.issueTokens);

// Standard OIDC UserInfo endpoints (GET and POST supported per OIDC Core 5.3.1 with CORS)
router.use('/userinfo', oauthCors);
router
  .route('/userinfo')
  .get(Authentication.client, oauthController.userinfo)
  .post(Authentication.client, oauthController.userinfo);

router.use('/api/oauth/userinfo', oauthCors);
router
  .route('/api/oauth/userinfo')
  .get(Authentication.client, oauthController.userinfo)
  .post(Authentication.client, oauthController.userinfo);

export default router;
