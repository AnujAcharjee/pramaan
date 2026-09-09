import type { Request, Response } from 'express';
import { COOKIE_NAMES, setSessionCookies } from '../utils/cookies.js';
import { BaseController } from './base.controller.js';
import { AppError } from '../utils/appError.js';
import { ErrorCode } from '../utils/errorCodes.js';
import type { AuthService } from '../services/auth.service.js';
import type { OAuthService } from '../services/oauth.service.js';
import { AuthZSchema } from '../validators/auth.validators.js';

/**
 * SIGN UP :
 *  signup (get user data, create user) -> send email verification -> verifyEmail -> activate user
 *
 * SIGN IN :
 *  signin (get credentials) -> if no mfa - issue new session else send verification email -> verify -> success, issue new session
 *
 * RESET PASSWORD :
 *  forgot password (send reset email + token) -> reset password - user rest here
 *
 * SIGN OUT :
 */

export class AuthController extends BaseController {
  constructor(
    private authService: AuthService,
    private oauthService: OAuthService,
  ) {
    super();
  }

  // Used when user not authenticated and tries OAuth
  private async handleOAuthFlow(res: Response, requestId: string, userId: string): Promise<void> {
    const redirectURL = await this.oauthService.authorize(requestId, userId);
    return res.redirect(303, redirectURL);
  }

  /** ------------------------ SIGN UP ------------------------ */

  private buildSignupViewData(req: Request) {
    const { flow, requestId, isOAuthFlow } = this.getFlow(req);

    return {
      title: 'Sign up',
      email: req.body?.email ?? null,
      name: req.body?.name ?? null,
      gender: req.body?.gender ?? null,
      flow,
      requestId: isOAuthFlow ? (requestId ?? null) : null,
      success: typeof req.query.success === 'string' ? req.query.success : null,
      error: typeof req.query.error === 'string' ? req.query.error : null,
    };
  }

  renderSignupForm = this.handleViewRequest(async (req, res) => {
    res.status(200).render('pages/auth/signup', {
      ...this.buildSignupViewData(req),
    });
  });

  signup = this.handleViewRequest(
    async (req, res) => {
      const { email, name, gender, password } = req.body;
      const { flow, requestId, isOAuthFlow } = this.getFlow(req);

      if (isOAuthFlow && !requestId) {
        throw new AppError('Missing request_id for OAuth flow', 400, ErrorCode.INVALID_REQUEST, false);
      }

      await this.authService.signup({ email, name, gender, password, flow, requestId });

      res.clearCookie(COOKIE_NAMES.IDENTITY_SESSION, { signed: true });
      res.clearCookie(COOKIE_NAMES.ACTIVE_SESSION, { signed: true });

      const params = new URLSearchParams({ email });
      if (isOAuthFlow && requestId) {
        params.set('flow', 'oauth');
        params.set('request_id', requestId);
      }
      params.set('success', 'Account created successfully 🎉');

      return res.redirect(303, `/verify?${params.toString()}`);
    },
    'pages/auth/signup',
    (req) => this.buildSignupViewData(req),
    AuthZSchema.signupSchema,
  );

  private buildEmailVerificationViewData(req: Request) {
    const { flow, requestId, isOAuthFlow } = this.getFlow(req);
    const email =
      typeof req.query.email === 'string'
        ? req.query.email
        : typeof req.body?.email === 'string'
          ? req.body.email
          : '';

    return {
      title: 'Email Verification',
      email,
      flow,
      requestId: isOAuthFlow ? requestId : undefined,
      success: typeof req.query.success === 'string' ? req.query.success : null,
      error: typeof req.query.error === 'string' ? req.query.error : null,
    };
  }

  /** Called by email */
  renderEmailVerificationPage = this.handleViewRequest(async (req, res) => {
    res.status(200).render('pages/auth/emailVerification', {
      ...this.buildEmailVerificationViewData(req),
    });
  });

  verifyEmail = this.handleViewRequest(
    async (req, res) => {
      const token = req.query.token as string;
      const { requestId, isOAuthFlow } = this.getFlow(req);

      if (isOAuthFlow && !requestId) {
        throw new AppError('Missing request_id for OAuth flow', 400, ErrorCode.INVALID_REQUEST, true);
      }

      const data = await this.authService.verifyEmail(token);

      await setSessionCookies(res, data?.identitySessionId, data?.activeSessionId);

      if (isOAuthFlow && requestId) {
        return this.handleOAuthFlow(res, requestId, data.userId);
      }

      res.redirect(303, `/account`);
    },
    'pages/auth/emailVerification',
    (req) => this.buildEmailVerificationViewData(req),
    AuthZSchema.verifyEmailSchema,
  );

  resendVerificationEmail = this.handleViewRequest(
    async (req, res) => {
      const email = typeof req.query.email === 'string' ? req.query.email : undefined;
      const { flow, requestId, isOAuthFlow } = this.getFlow(req);

      if (!email) {
        throw new AppError('Invalid email', 400, ErrorCode.INVALID_EMAIL);
      }

      await this.authService.resendVerificationEmail(email, flow, requestId);

      const params = new URLSearchParams({ email });
      if (isOAuthFlow && requestId) {
        params.set('flow', 'oauth');
        params.set('request_id', requestId);
      }
      params.set('success', 'If an account exists, a verification email has been sent.');

      return res.redirect(303, `/verify?${params.toString()}`);
    },
    'pages/auth/emailVerification',
    (req) => this.buildEmailVerificationViewData(req),
    AuthZSchema.resendVerificationEmailSchema,
  );

  /** ------------------------ SIGN IN ------------------------ */

  private buildSigninViewData(req: Request) {
    const { flow, requestId } = this.getFlow(req);

    return {
      title: 'Sign in',
      email: req.body?.email ?? null,
      flow,
      requestId,
      success: typeof req.query.success === 'string' ? req.query.success : null,
      error: typeof req.query.error === 'string' ? req.query.error : null,
    };
  }

  renderSigninForm = this.handleViewRequest(async (req, res) => {
    res.status(200).render('pages/auth/signin', {
      ...this.buildSigninViewData(req),
    });
  });

  signin = this.handleViewRequest(
    async (req, res) => {
      const { email, password } = req.body;
      const { flow, requestId, isOAuthFlow } = this.getFlow(req);

      if (isOAuthFlow && !requestId) {
        throw new AppError('Missing request_id for OAuth flow', 500, ErrorCode.INTERNAL_SERVER_ERROR, false);
      }

      const user = await this.authService.validateSignin(email, password);

      if (!user?.mfaEnabled) {
        const ids = await this.authService.createNewSession(user.id, user.roles);

        if (!ids.identitySessionId || !ids.activeSessionId) {
          throw new AppError(
            'Identity & Active session ids are null',
            500,
            ErrorCode.INTERNAL_SERVER_ERROR,
            false,
          );
        }

        await setSessionCookies(res, ids.identitySessionId, ids.activeSessionId);

        if (isOAuthFlow && requestId) {
          return this.handleOAuthFlow(res, requestId, user.id);
        }

        return res.redirect(303, `/account`);
      }

      await this.authService.sendSigninVerificationEmail({
        email: user.email,
        name: user.name,
        userId: user.id,
        flow,
        requestId,
      });

      return res.status(200).render('pages/auth/signin', {
        ...this.buildSigninViewData(req),
        success: 'Sign-in verification email has been sent to the registered email address',
      });
    },
    'pages/auth/signin',
    (req) => this.buildSigninViewData(req),
    AuthZSchema.signinSchema,
  );

  /** Called by email */
  verifySignin = this.handleViewRequest(
    async (req, res) => {
      const { requestId, isOAuthFlow } = this.getFlow(req);
      const token = req.query.token as string;

      const user = await this.authService.verifySignIn(token);
      const ids = await this.authService.createNewSession(user.id, user.roles);

      await setSessionCookies(res, ids.identitySessionId, ids.activeSessionId);

      if (isOAuthFlow && requestId) {
        return this.handleOAuthFlow(res, requestId, user.id);
      }

      return res.redirect(303, `/account`);
    },
    'pages/auth/signin',
    (req) => this.buildSigninViewData(req),
    AuthZSchema.verifySignInSchema,
  );

  /** ------------------------ RESET PASSWORD ------------------------ */

  private buildForgotPasswordViewData(req: Request) {
    const { flow, requestId, isOAuthFlow } = this.getFlow(req);

    return {
      title: 'Forgot Password',
      email: req.body?.email ?? null,
      flow,
      requestId: isOAuthFlow ? (requestId ?? null) : null,
      success: null,
      error: null,
    };
  }

  renderForgotPasswordForm = this.handleViewRequest(async (req, res) => {
    res.status(200).render('pages/auth/forgot-password', {
      ...this.buildForgotPasswordViewData(req),
    });
  });

  forgotPassword = this.handleViewRequest(
    async (req, res) => {
      const { email } = req.body;
      const { flow, requestId, isOAuthFlow } = this.getFlow(req);

      if (typeof email !== 'string') {
        throw new AppError('Email is required', 400, ErrorCode.INVALID_REQUEST);
      }

      if (isOAuthFlow && !requestId) {
        throw new AppError('Missing request_id for OAuth flow', 500, ErrorCode.INTERNAL_SERVER_ERROR, false);
      }

      await this.authService.initiateResetPassword(email, flow, requestId);

      res.status(200).render('pages/auth/forgot-password', {
        ...this.buildForgotPasswordViewData(req),
        success: 'If an account exists, a password reset email has been sent',
      });
    },
    'pages/auth/forgot-password',
    (req) => this.buildForgotPasswordViewData(req),
    AuthZSchema.forgotPasswordSchema,
  );

  private buildResetPasswordViewData(req: Request) {
    const { flow, requestId, isOAuthFlow } = this.getFlow(req);

    const resetToken =
      typeof req.params.token === 'string' ? req.params.token
      : typeof req.query.token === 'string' ? req.query.token
      : null;

    return {
      title: 'Reset Password',
      resetToken,
      flow,
      requestId: isOAuthFlow ? (requestId ?? null) : null,
      success: null,
      error: null,
    };
  }

  renderResetPasswordForm = this.handleViewRequest(async (req, res) => {
    res.status(200).render('pages/auth/reset-password', {
      ...this.buildResetPasswordViewData(req),
    });
  });

  resetPassword = this.handleViewRequest(
    async (req, res) => {
      const { token, new_password } = req.body;
      const { requestId, isOAuthFlow } = this.getFlow(req);

      if (typeof token !== 'string' || typeof new_password !== 'string') {
        throw new AppError('Invalid reset request', 400, ErrorCode.INVALID_REQUEST);
      }

      if (isOAuthFlow && !requestId) {
        throw new AppError('Missing request_id for OAuth flow', 400, ErrorCode.INTERNAL_SERVER_ERROR, false);
      }

      await this.authService.resetPassword(token, new_password);

      const message = 'Password reset successfully 🎉';

      return res.redirect(
        303,
        isOAuthFlow ?
          `/signin?flow=oauth&request_id=${encodeURIComponent(
            String(requestId),
          )}&success=${encodeURIComponent(message)}`
        : `/signin?success=${encodeURIComponent(message)}`,
      );
    },
    'pages/auth/reset-password',
    (req) => this.buildResetPasswordViewData(req),
    AuthZSchema.resetPasswordSchema,
  );

  /** ------------------------ SIGN OUT ------------------------ */

  signout = this.handleViewRequest(async (req, res) => {
    const isid = req.signedCookies[COOKIE_NAMES.IDENTITY_SESSION];
    const asid = req.signedCookies[COOKIE_NAMES.ACTIVE_SESSION];

    await this.authService.signout(isid, asid);

    res.clearCookie(COOKIE_NAMES.IDENTITY_SESSION, { signed: true });
    res.clearCookie(COOKIE_NAMES.ACTIVE_SESSION, { signed: true });

    return res.redirect(303, `/`);
  });
}
