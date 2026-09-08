import { Router } from 'express';
import { AuthController } from '../../controllers/auth.controller.js';
import { authService } from '../../services/auth.service.js';
import { oauthService } from '../../services/oauth.service.js';
import { Authentication, Authorize } from '../../middlewares/authMiddleware.js';
import { ROLES } from '../../utils/constant.js';
import {
  signupLimiter,
  signinLimiter,
  forgotPasswordLimiter,
  emailVerificationLimiter,
} from '../../middlewares/rateLimiter.js';

const router = Router();
const authController = new AuthController(authService, oauthService);

router.route('/signup').get(authController.renderSignupForm).post(signupLimiter, authController.signup);

router.get('/verify', authController.renderEmailVerificationPage);
router.get('/email/verify', authController.verifyEmail);
router.get('/verify/resend', emailVerificationLimiter, authController.resendVerificationEmail);

router.route('/signin').get(authController.renderSigninForm).post(signinLimiter, authController.signin);
router.get('/signin/verify', authController.verifySignin);

router
  .route('/forgot-password')
  .get(authController.renderForgotPasswordForm)
  .post(forgotPasswordLimiter, authController.forgotPassword);

router
  .route('/reset-password')
  .get(authController.renderResetPasswordForm)
  .post(authController.resetPassword);

router.post('/signout', Authentication.ssr('default'), Authorize.role([ROLES.USER]), authController.signout);

export default router;
