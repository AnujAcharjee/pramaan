import type { Request, Response } from 'express';
import { oauthClientService } from '../services/oauth.service.js';
import { userService } from '../services/user.service.js';
import { generateOAuthParameters } from '../utils/securityParameters.js';

export class AuthController {
  async login(req: Request, res: Response): Promise<void> {
    try {
      const oauthParameters = generateOAuthParameters();

      const authorizationUrl = await oauthClientService.buildAuthorizationUrl({
        state: oauthParameters.state,
        nonce: oauthParameters.nonce,
        codeChallenge: oauthParameters.codeChallenge,
      });

      req.session.oauth = {
        intent: 'oauth-signin',
        state: oauthParameters.state,
        nonce: oauthParameters.nonce,
        codeVerifier: oauthParameters.codeVerifier,
      };

      res.redirect(authorizationUrl);
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).send('Failed to initialize login flow');
    }
  }

  async callback(req: Request, res: Response): Promise<void> {
    try {
      const { code, state, error, error_description } = req.query;

      if (error) {
        console.error('OAuth callback error from provider:', error_description ?? error);
        res.redirect(`/login?error=${encodeURIComponent('Access denied. Please try again.')}`);
        return;
      }

      if (!state || state !== req.session.oauth?.state) {
        res.status(403).send('Invalid state parameter');
        return;
      }

      if (typeof code !== 'string') {
        res.status(400).send('Missing authorization code');
        return;
      }

      const oauthSession = req.session.oauth;
      if (!oauthSession) {
        res.status(400).send('OAuth session missing');
        return;
      }

      const { codeVerifier, nonce } = oauthSession;

      // Exchange authorization code for tokens
      const tokenData = await oauthClientService.exchangeCodeForTokens(code, codeVerifier);
      const idToken = tokenData?.id_token ?? tokenData?.idToken;

      if (!idToken) {
        res.redirect(`/login?error=${encodeURIComponent('Something went wrong. Please try again.')}`);
        return;
      }

      // Verify ID token with remote JWKS and validate nonce
      const payload = await oauthClientService.verifyIdToken(idToken, nonce);
      const providerUserId = typeof payload.sub === 'string' ? payload.sub : String(payload.sub);

      let user = userService.getByProviderUserId(providerUserId);

      // If user does not exist locally yet, fetch profile from userinfo endpoint
      if (!user) {
        const accessToken = tokenData.access_token ?? tokenData.accessToken!;
        const profile = await oauthClientService.fetchUserInfo(accessToken);

        user = userService.findOrCreateUser({
          sub: providerUserId,
          email: profile.email,
          name: profile.name,
          avatar: profile.avatar ?? profile.picture,
        });
      }

      req.session.user = user;
      delete req.session.oauth;

      res.redirect('/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('OAuth callback error:', message);
      res.status(500).send('OAuth callback error');
    }
  }

  logout(req: Request, res: Response): void {
    req.session.destroy(() => {
      res.redirect('/');
    });
  }
}

export const authController = new AuthController();
