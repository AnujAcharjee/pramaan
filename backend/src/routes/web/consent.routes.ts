import { Router } from 'express';
import { oauthService } from '../../services/oauth.service.js';
import { accountService } from '../../services/account.service.js';
import { clientService } from '../../services/client.service.js';
import { OAuthController } from '../../controllers/oauth.controller.js';
import { OAuthZSchema } from '../../validators/oauth.validator.js';
import { validateRequest } from '../../middlewares/validateRequest.js';
import { Authentication, Authorize } from '../../middlewares/authMiddleware.js';
import { ROLES } from '../../utils/constant.js';

const router = Router();
const oauthController = new OAuthController(oauthService, accountService, clientService);

router
  .route('/oauth/consent')
  .get((req, res) => {
    const frontendUrl = (process.env.FRONTEND_URL || 'https://pramaan.anujacharjee.com').replace(/\/+$/, '');
    const queryString = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    return res.redirect(303, `${frontendUrl}/oauth/consent${queryString}`);
  })
  .post(
    Authentication.ssr('oauth'),
    Authorize.role([ROLES.USER]),
    validateRequest(OAuthZSchema.consentSchema),
    oauthController.consent,
  );

export default router;
