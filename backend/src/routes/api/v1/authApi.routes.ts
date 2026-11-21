import { Router } from 'express';
import { authApiController } from '../../../controllers/api/authApi.controller.js';
import { Authentication } from '../../../middlewares/authMiddleware.js';
import { AuthZSchema } from '../../../validators/auth.validators.js';
import { validateRequest } from '../../../middlewares/validateRequest.js';

const router = Router();

router.post('/signin', validateRequest(AuthZSchema.signinSchema), authApiController.signin);
router.post('/signup', validateRequest(AuthZSchema.signupSchema), authApiController.signup);
router.get('/resend-verification', authApiController.resendVerification);
router.get('/verify-email', authApiController.verifyEmail);
router.post('/forgot-password', authApiController.forgotPassword);
router.post('/reset-password', authApiController.resetPassword);
router.post('/signout', authApiController.signout);
router.get('/me', Authentication.optionalSsr(), authApiController.me);

export default router;
