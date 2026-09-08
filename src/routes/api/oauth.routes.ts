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

// UserInfo endpoint
router.route('/api/oauth/account/:id').get(Authentication.client, oauthController.getUserInfo);

export default router;
