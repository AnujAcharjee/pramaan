import type { Request, Response, NextFunction } from 'express';
import { authService, type AuthenticationFlow } from '../../services/auth.service.js';
import { oauthService } from '../../services/oauth.service.js';
import { accountService } from '../../services/account.service.js';
import { setSessionCookies, clearSessionCookies, COOKIE_NAMES } from '../../utils/cookies.js';
import { AppError } from '../../utils/appError.js';
import { ErrorCode } from '../../utils/errorCodes.js';

export class AuthApiController {
  /**
   * Headless Sign In
   */
  signin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password, flow, requestId, request_id } = req.body;
      const effectiveRequestId = (requestId || request_id) as string | undefined;
      const authFlow: AuthenticationFlow = flow === 'oauth' && effectiveRequestId ? 'oauth' : 'default';

      if (!email || !password) {
        throw new AppError('Email and password are required', 400, ErrorCode.INVALID_INPUT);
      }

      const user = await authService.validateSignin(email, password);

      if (user.mfaEnabled) {
        await authService.sendSigninVerificationEmail({
          email: user.email,
          name: user.name,
          userId: user.id,
          flow: authFlow,
          requestId: effectiveRequestId,
        });

        res.status(200).json({
          requiresMfa: true,
          message: 'Sign-in verification email sent. Please check your inbox.',
        });
        return;
      }

      // Establish session
      const ids = await authService.createNewSession(user.id, user.roles);
      if (!ids.identitySessionId || !ids.activeSessionId) {
        throw new AppError('Failed to establish user session', 500, ErrorCode.INTERNAL_SERVER_ERROR);
      }

      await setSessionCookies(res, ids.identitySessionId, ids.activeSessionId);

      // Handle OAuth authorization if in OAuth flow
      if (authFlow === 'oauth' && effectiveRequestId) {
        try {
          const redirectURL = await oauthService.authorize(effectiveRequestId, user.id);
          res.status(200).json({
            success: true,
            redirectUrl: redirectURL,
            user: { id: user.id, email: user.email, name: user.name },
          });
          return;
        } catch {
          // If authorization request expired in Redis, return account redirect with notification
          res.status(200).json({
            success: true,
            redirectUrl: '/account?warning=OAuth+request+expired',
            user: { id: user.id, email: user.email, name: user.name },
          });
          return;
        }
      }

      res.status(200).json({
        success: true,
        redirectUrl: '/account',
        user: { id: user.id, email: user.email, name: user.name },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Headless Sign Up
   */
  signup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, name, gender, password, flow, requestId, request_id } = req.body;
      const effectiveRequestId = (requestId || request_id) as string | undefined;
      const authFlow: AuthenticationFlow = flow === 'oauth' && effectiveRequestId ? 'oauth' : 'default';

      if (!email || !name || !password) {
        throw new AppError('Missing required registration fields', 400, ErrorCode.INVALID_INPUT);
      }

      await authService.signup({
        email,
        name,
        gender: gender || 'OTHER',
        password,
        flow: authFlow,
        requestId: effectiveRequestId,
      });

      clearSessionCookies(res);

      const params = new URLSearchParams({ email });
      if (authFlow === 'oauth' && effectiveRequestId) {
        params.set('flow', 'oauth');
        params.set('request_id', effectiveRequestId);
      }

      res.status(201).json({
        success: true,
        message: 'Account created successfully. Please verify your email.',
        redirectUrl: `/verify?${params.toString()}`,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Resend Verification Email
   */
  resendVerification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const email = (req.query.email as string) || (req.body?.email as string);
      const flow = (req.query.flow as AuthenticationFlow) || 'default';
      const requestId = (req.query.request_id as string) || undefined;

      if (!email) {
        throw new AppError('Email is required', 400, ErrorCode.INVALID_EMAIL);
      }

      await authService.resendVerificationEmail(email, flow, requestId);

      res.status(200).json({
        success: true,
        message: 'If an account exists, a verification link has been resent.',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Verify Email
   */
  verifyEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = (req.query.token as string) || (req.body?.token as string);
      const flow = (req.query.flow as AuthenticationFlow) || (req.body?.flow as AuthenticationFlow) || 'default';
      const requestId =
        ((req.query.request_id || req.query.requestId || req.body?.request_id || req.body?.requestId) as string) ||
        undefined;

      if (!token) {
        throw new AppError('Verification token is required', 400, ErrorCode.INVALID_REQUEST);
      }

      const data = await authService.verifyEmail(token);
      await setSessionCookies(res, data.identitySessionId, data.activeSessionId);

      if (flow === 'oauth' && requestId) {
        try {
          const redirectURL = await oauthService.authorize(requestId, data.userId);
          res.status(200).json({ success: true, redirectUrl: redirectURL });
          return;
        } catch {
          res.status(200).json({ success: true, redirectUrl: '/account' });
          return;
        }
      }

      res.status(200).json({ success: true, redirectUrl: '/account' });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Forgot Password
   */
  forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, flow, requestId, request_id } = req.body;
      const effectiveRequestId = (requestId || request_id) as string | undefined;
      const authFlow: AuthenticationFlow = flow === 'oauth' && effectiveRequestId ? 'oauth' : 'default';

      if (!email) {
        throw new AppError('Email is required', 400, ErrorCode.INVALID_EMAIL);
      }

      await authService.initiateResetPassword(email, authFlow, effectiveRequestId);

      res.status(200).json({
        success: true,
        message: 'If an account exists, a password reset link has been dispatched.',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Reset Password
   */
  resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token, new_password, password, flow, requestId, request_id } = req.body;
      const effectivePassword = (new_password || password) as string | undefined;
      const effectiveRequestId = (requestId || request_id) as string | undefined;
      const authFlow: AuthenticationFlow = flow === 'oauth' && effectiveRequestId ? 'oauth' : 'default';

      if (!token || !effectivePassword) {
        throw new AppError('Token and new password are required', 400, ErrorCode.INVALID_INPUT);
      }

      await authService.resetPassword(token, effectivePassword);

      const params = new URLSearchParams({ success: 'Password reset successfully 🎉' });
      if (authFlow === 'oauth' && effectiveRequestId) {
        params.set('flow', 'oauth');
        params.set('request_id', effectiveRequestId);
      }

      res.status(200).json({
        success: true,
        message: 'Password reset successfully.',
        redirectUrl: `/signin?${params.toString()}`,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Current Authenticated User (Session Check)
   */
  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) {
        res.status(401).json({ authenticated: false, user: null });
        return;
      }

      const account = await accountService.get(req.user.id);
      res.status(200).json({
        authenticated: true,
        user: {
          id: account.id,
          name: account.name,
          email: account.email,
          avatar: account.avatar,
          roles: req.user.roles,
          mfaEnabled: account.mfaEnabled,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Sign Out
   */
  signout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const isid = req.signedCookies[COOKIE_NAMES.IDENTITY_SESSION];
      const asid = req.signedCookies[COOKIE_NAMES.ACTIVE_SESSION];

      await authService.signout(isid, asid);

      clearSessionCookies(res);

      res.status(200).json({
        success: true,
        redirectUrl: '/',
      });
    } catch (error) {
      next(error);
    }
  };
}

export const authApiController = new AuthApiController();
