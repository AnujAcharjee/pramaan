import { Router } from 'express';
import { AccountController } from '../../controllers/account.controller.js';
import { accountService } from '../../services/account.service.js';
import { authService } from '../../services/auth.service.js';
import { oauthService } from '../../services/oauth.service.js';
import { clientService } from '../../services/client.service.js';
import { sessionService } from '../../services/session.service.js';
import { AccountZSchema } from '../../validators/account.validators.js';
import { validateRequest } from '../../middlewares/validateRequest.js';
import { Authentication, Authorize } from '../../middlewares/authMiddleware.js';
import { ROLES } from '../../utils/constant.js';
import { upload } from '../../middlewares/upload.js';

const router = Router();
const accountController = new AccountController(
  accountService,
  authService,
  oauthService,
  clientService,
  sessionService,
);

router
  .route('/account')
  .get(Authentication.ssr('default'), Authorize.role([ROLES.USER]), accountController.renderAccountDashboard)
  .put(
    Authentication.ssr('default'),
    Authorize.role([ROLES.USER]),
    upload.single('avatar'),
    (req, res, next) => {
      // Map multipart form fields to expected nested structure for Zod validation
      req.body = { updates: { ...req.body } };
      next();
    },
    validateRequest(AccountZSchema.updateProfileSchema),
    accountController.updateProfile,
  )
  .delete(Authentication.ssr('default'), Authorize.role([ROLES.USER]), accountController.delete);

router.post(
  '/account/mfa',
  Authentication.ssr('default'),
  Authorize.role([ROLES.USER]),
  validateRequest(AccountZSchema.manageMfaSchema),
  accountController.manageMfa,
);

router.post(
  '/account/change-password',
  Authentication.ssr('default'),
  Authorize.role([ROLES.USER]),
  validateRequest(AccountZSchema.changePasswordSchema),
  accountController.changePassword,
);

router.post(
  '/account/deactivate',
  Authentication.ssr('default'),
  Authorize.role([ROLES.USER]),
  accountController.deactivate,
);

router.post(
  '/account/activate',
  Authentication.ssr('default'),
  Authorize.role([ROLES.USER]),
  accountController.activate,
);

router.post(
  '/consent/revoke',
  Authentication.ssr('default'),
  Authorize.role([ROLES.USER]),
  validateRequest(AccountZSchema.updateConsentSchema),
  accountController.revokeConsent,
);

router.post(
  '/consent/reissue',
  Authentication.ssr('default'),
  Authorize.role([ROLES.USER]),
  validateRequest(AccountZSchema.updateConsentSchema),
  accountController.reissueConsent,
);

router.get(
  '/account/:action',
  Authentication.ssr('default'),
  Authorize.role([ROLES.USER]),
  accountController.renderAccountConfirmation,
);

export default router;
