import { BaseController } from './base.controller.js';
import { COOKIE_NAMES } from '../utils/cookies.js';
import { SERVER_URL } from '../utils/constant.js';
import type { Request } from 'express';
import type { AuthService } from '../services/auth.service.js';
import type { SessionService } from '../services/session.service.js';
import { cloudinary } from '../config/cloudinary.js';
import streamifier from 'streamifier';
import type { AccountView, AccountService } from '../services/account.service.js';
import type { AllClientsView, ClientService } from '../services/client.service.js';
import type { OAuthConsentView, OAuthService } from '../services/oauth.service.js';

export class AccountController extends BaseController {
  constructor(
    private accountService: AccountService,
    private authService: AuthService,
    private oauthService: OAuthService,
    private clientService: ClientService,
    private sessionService: SessionService,
  ) {
    super();
  }

  private async buildAccountDashboardViewData(req: Request) {
    const userId = req.user.id;

    const user: AccountView = await this.accountService.get(userId);
    const oauthConsents: OAuthConsentView[] = await this.oauthService.getUserConsents(userId);
    const clients: AllClientsView[] = await this.clientService.getAllClientsForUser(userId);

    return {
      title: 'Account Dashboard',
      robots: 'noindex, nofollow',
      serverUrl: SERVER_URL,
      user,
      createdAtFormatted: new Date(user.createdAt).toLocaleDateString(),
      updatedAtFormatted: new Date(user.updatedAt).toLocaleDateString(),
      oauthConsents,
      clients,
      error: typeof req.query.error === 'string' ? req.query.error : undefined,
      success: typeof req.query.success === 'string' ? req.query.success : undefined,
    };
  }

  renderAccountDashboard = this.handleViewRequest(async (req, res) => {
    const viewData = await this.buildAccountDashboardViewData(req);

    res.render('pages/app/dashboards/account', viewData);
  });

  updateProfile = this.handleViewRequest(async (req, res) => {
    let avatarUrl = req.body.updates?.avatar;
    const user = await this.accountService.get(req.user.id);

    if (req.file) {
      try {
        // Upload image to Cloudinary using streamifier
        avatarUrl = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: 'pramaan_avatars' },
            (error, result) => {
              if (result) resolve(result.secure_url);
              else reject(error);
            }
          );
          streamifier.createReadStream(req.file!.buffer).pipe(stream);
        });
      } catch (error: any) {
        console.error('Cloudinary upload error details:', error);
        return res.redirect(303, `/account?error=${encodeURIComponent('Avatar upload failed. Please check Cloudinary configuration.')}`);
      }
    }

    if (avatarUrl) {
      req.body.updates = { ...req.body.updates, avatar: avatarUrl };
    }

    await this.accountService.update(req.user.id, req.body.updates);

    return res.redirect(303, `/account?success=${encodeURIComponent('Profile updated successfully')}`);
  });

  removeAvatar = this.handleViewRequest(async (req, res) => {
    await this.accountService.update(req.user.id, { avatar: null });

    return res.redirect(
      303,
      `/account?success=${encodeURIComponent('Avatar removed successfully')}`,
    );
  });

  changePassword = this.handleViewRequest(async (req, res) => {
    const user = await this.accountService.get(req.user.id);

    await this.authService.initiateResetPassword(user.email, 'default');

    return res.redirect(303, `/account?success=${encodeURIComponent('Password reset email sent')}`);
  });

  manageMfa = this.handleViewRequest(async (req, res) => {
    const { action } = req.body;
    const enable = action === 'enable';

    await this.accountService.manageMfa(req.user.id, enable);

    return res.redirect(
      303,
      `/account?success=${encodeURIComponent(
        `Two-factor authentication ${enable ? 'enabled' : 'disabled'} successfully`,
      )}`,
    );
  });

  deactivate = this.handleViewRequest(async (req, res) => {
    await this.accountService.deactivate(req.user.id);

    const isid = req.signedCookies[COOKIE_NAMES.IDENTITY_SESSION];
    const asid = req.signedCookies[COOKIE_NAMES.ACTIVE_SESSION];

    if (isid) {
      await this.sessionService.revokeIdentitySession(isid);
    }
    if (asid) {
      await this.sessionService.revokeActiveSession(asid);
    }

    res.clearCookie(COOKIE_NAMES.IDENTITY_SESSION, { signed: true });
    res.clearCookie(COOKIE_NAMES.ACTIVE_SESSION, { signed: true });

    return res.redirect(
      303,
      `/signin?success=${encodeURIComponent('User account deactivated successfully')}`,
    );
  });

  activate = this.handleViewRequest(async (req, res) => {
    await this.accountService.activate(req.user.id);

    return res.redirect(303, `/account?success=${encodeURIComponent('User account activated successfully')}`);
  });

  delete = this.handleViewRequest(async (req, res) => {
    await this.accountService.delete(req.user.id);

    const isid = req.signedCookies[COOKIE_NAMES.IDENTITY_SESSION];
    const asid = req.signedCookies[COOKIE_NAMES.ACTIVE_SESSION];

    if (isid) {
      await this.sessionService.revokeIdentitySession(isid);
    }
    if (asid) {
      await this.sessionService.revokeActiveSession(asid);
    }

    res.clearCookie(COOKIE_NAMES.IDENTITY_SESSION, { signed: true });
    res.clearCookie(COOKIE_NAMES.ACTIVE_SESSION, { signed: true });

    return res.redirect(303, `/signin?success=${encodeURIComponent('User account deleted permanently')}`);
  });

  renderAccountConfirmation = this.handleViewRequest(async (req, res) => {
    res.render('pages/app/confirm-action/account', {
      title: 'Confirm Account Action',
      userId: req.user.id,
      action: req.params.action,
      clientId: typeof req.query.clientId === 'string' ? req.query.clientId : undefined,
      clientDomain: typeof req.query.clientDomain === 'string' ? req.query.clientDomain : undefined,
    });
  });

  /** ----------------- CONSENT ----------------- */

  revokeConsent = this.handleViewRequest(async (req, res) => {
    await this.oauthService.revokeConsent(req.user.id, req.body.client_id);

    return res.redirect(303, `/account?success=${encodeURIComponent('Consent revoked successfully')}`);
  });

  reissueConsent = this.handleViewRequest(async (req, res) => {
    await this.oauthService.reissueConsent(req.user.id, req.body.client_id);

    return res.redirect(303, `/account?success=${encodeURIComponent('Consent reissued successfully')}`);
  });
}
