import { Router } from 'express';
import { accountApiController } from '../../../controllers/api/accountApi.controller.js';
import { Authentication, Authorize } from '../../../middlewares/authMiddleware.js';
import { ROLES } from '../../../utils/constant.js';

const router = Router();

router.use(Authentication.ssr('default'), Authorize.role([ROLES.USER]));

router.get('/', accountApiController.getAccount);
router.put('/profile', accountApiController.updateProfile);
router.post('/mfa', accountApiController.manageMfa);
router.put('/mfa', accountApiController.manageMfa);
router.post('/consent/revoke', accountApiController.revokeConsent);

export default router;
