import { Router } from 'express';
import { oauthApiController } from '../../../controllers/api/oauthApi.controller.js';
import { Authentication, Authorize } from '../../../middlewares/authMiddleware.js';
import { ROLES } from '../../../utils/constant.js';
import { OAuthZSchema } from '../../../validators/oauth.validator.js';
import { validateRequest } from '../../../middlewares/validateRequest.js';

const router = Router();

// Handshake Authorize Route (returns JSON instructions instead of 303 for React loader)
router.get(
  '/authorize',
  validateRequest(OAuthZSchema.authorizeSchema),
  Authentication.optionalSsr(),
  oauthApiController.authorize,
);

// Consent Screen Details
router.get(
  '/consent-details',
  Authentication.optionalSsr(),
  oauthApiController.getConsentDetails,
);

// Consent Decision (Approve / Deny)
router.post(
  '/consent/decision',
  Authentication.ssr('oauth'),
  Authorize.role([ROLES.USER]),
  validateRequest(OAuthZSchema.consentSchema),
  oauthApiController.submitConsentDecision,
);

export default router;
