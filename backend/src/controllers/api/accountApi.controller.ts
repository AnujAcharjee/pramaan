import type { Request, Response, NextFunction } from 'express';
import { accountService } from '../../services/account.service.js';
import { oauthService } from '../../services/oauth.service.js';
import { clientService } from '../../services/client.service.js';
import { AppError } from '../../utils/appError.js';
import { ErrorCode } from '../../utils/errorCodes.js';

export class AccountApiController {
  /**
   * Get Current User Account & Dashboard Info
   */
  getAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.id;
      const user = await accountService.get(userId);
      const oauthConsents = await oauthService.getUserConsents(userId);
      const clients = await clientService.getAllClientsForUser(userId);

      res.status(200).json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          gender: user.gender,
          mfaEnabled: user.mfaEnabled,
          roles: req.user.roles,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        consents: oauthConsents,
        clients,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update Profile Details
   */
  updateProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.id;
      const { name, avatar } = req.body;

      const updated = await accountService.update(userId, { name, avatar });

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        user: {
          id: updated.id,
          name: updated.name,
          email: updated.email,
          avatar: updated.avatar,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Manage Two-Factor Authentication (Enable / Disable MFA)
   */
  manageMfa = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.id;
      const { action, enable } = req.body;
      const isEnable = enable !== undefined ? Boolean(enable) : action === 'enable';

      await accountService.manageMfa(userId, isEnable);

      res.status(200).json({
        success: true,
        mfaEnabled: isEnable,
        message: `Two-factor authentication ${isEnable ? 'enabled' : 'disabled'} successfully.`,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Revoke OAuth Consent for Client
   */
  revokeConsent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.id;
      const client_id = req.body.client_id || req.body.clientId;

      if (!client_id) {
        throw new AppError('client_id is required', 400, ErrorCode.INVALID_REQUEST);
      }

      await oauthService.revokeConsent(userId, client_id);

      res.status(200).json({
        success: true,
        message: 'Consent revoked successfully',
      });
    } catch (error) {
      next(error);
    }
  };
}

export const accountApiController = new AccountApiController();
