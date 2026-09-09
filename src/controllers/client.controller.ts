import { BaseController } from './base.controller.js';
import { AppError } from '../utils/appError.js';
import { ErrorCode } from '../utils/errorCodes.js';
import { OAUTH_CLIENT_ENVIRONMENTS, OAUTH_CLIENT_TYPES, ROLES } from '../utils/constant.js';
import { ENV } from '../config/env.js';
import { SERVER_URL } from '../utils/constant.js';
import type { Request, Response } from 'express';
import type { ClientService } from '../services/client.service.js';
import type { AccountService } from '../services/account.service.js';
import { OAuthClientEnvironment } from '../../generated/prisma/index.js';
import { ClientZSchema } from '../validators/client.validators.js';

export class ClientController extends BaseController {
  constructor(
    private clientService: ClientService,
    private accountService: AccountService,
  ) {
    super();
  }

  private getString(value: unknown): string | undefined {
    if (typeof value === 'string') return value;
    if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
    return undefined;
  }

  private validateRedirectUriInput(uri: string): string {
    const trimmed = uri.trim();
    if (!trimmed) {
      throw new AppError('Redirect URI is required', 400, ErrorCode.INVALID_REDIRECT_URI);
    }
    if (/\s/.test(trimmed)) {
      throw new AppError('Invalid redirect URI format', 400, ErrorCode.INVALID_REDIRECT_URI);
    }
    if (!/^https?:\/\//i.test(trimmed)) {
      throw new AppError('Invalid redirect URI format', 400, ErrorCode.INVALID_REDIRECT_URI);
    }
    return trimmed;
  }

  // ---------------- ADD CLIENT ----------------

  private buildAddClientViewData(req: Request) {
    return {
      title: 'Add Client',
      formData: {
        name: typeof req.body?.name === 'string' ? req.body.name : '',
        domain:
          typeof req.body?.domain === 'string'
            ? req.body.domain
            : typeof req.body?.slug === 'string'
              ? req.body.slug
              : '',
        client_type: typeof req.body?.client_type === 'string' ? req.body.client_type : 'CONFIDENTIAL',
        client_environment:
          typeof req.body?.client_environment === 'string' ? req.body.client_environment : 'development',
        redirect_uri: typeof req.body?.redirect_uri === 'string' ? req.body.redirect_uri : '',
      },
      success: typeof req.query.success === 'string' ? req.query.success : null,
      error: typeof req.query.error === 'string' ? req.query.error : null,
    };
  }

  renderAddClient = this.handleViewRequest(async (req, res) => {
    res.render('pages/app/forms/create-client', {
      ...this.buildAddClientViewData(req),
    });
  });

  addClient = this.handleViewRequest(
    async (req, res) => {
      const name = this.getString(req.body?.name);
      const domainInput = this.getString(req.body?.domain) || this.getString(req.body?.slug);
      const redirect_uri = this.getString(req.body?.redirect_uri);
      const client_type = req.body?.client_type;
      const client_environment = req.body?.client_environment;

      if (!name || !domainInput || !redirect_uri) {
        throw new AppError('Invalid client data', 400, ErrorCode.INVALID_REQUEST);
      }

      const domain = this.clientService.normalizeAndValidateDomain(domainInput);

      const sanitizedRedirectUri = this.validateRedirectUriInput(redirect_uri);
      const data = await this.clientService.createClient({
        userId: req.user.id,
        name,
        domain,
        redirectURI: sanitizedRedirectUri,
        clientType: client_type || OAUTH_CLIENT_TYPES.CONFIDENTIAL,
        environment: client_environment || OAUTH_CLIENT_ENVIRONMENTS.DEVELOPMENT,
      });

      // flash secret
      res.cookie('__flash_client_secret', data.clientSecret, {
        httpOnly: true,
        secure: ENV.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 1000,
      });

      if (!req.user.roles.includes(ROLES.DEVELOPER)) {
        await this.accountService.update(req.user.id, {
          roles: [...req.user.roles, ROLES.DEVELOPER],
        });
      }

      return res.redirect(303, `/client/${data.id}`);
    },
    'pages/app/forms/create-client',
    (req) => this.buildAddClientViewData(req),
    ClientZSchema.addClientSchema,
  );

  // ---------------- DASHBOARD ----------------

  private async buildClientDashboardViewData(req: Request, res: Response) {
    const clientId = this.getString(req.params.client_id);
    if (!clientId) {
      throw new AppError('clientId missing', 500, ErrorCode.INTERNAL_SERVER_ERROR, false);
    }
    const client = await this.clientService.getClient(clientId);

    // flash secret injection
    const clientSecret = req.cookies?.__flash_client_secret;
    res.clearCookie('__flash_client_secret');

    return {
      title: 'OAuth Dashboard',
      serverUrl: SERVER_URL,
      client: {
        ...client,
        client_secret: clientSecret,
      },
      createdAtFormatted: new Date(client.createdAt).toLocaleDateString(),
      updatedAtFormatted: new Date(client.updatedAt).toLocaleDateString(),
      revokedAtFormatted: client.revokedAt ? new Date(client.revokedAt).toLocaleDateString() : null,
      error: typeof req.query.error === 'string' ? req.query.error : undefined,
      success: typeof req.query.success === 'string' ? req.query.success : undefined,
      warning: typeof req.query.warning === 'string' ? req.query.warning : undefined,
    };
  }

  renderClientDashboard = this.handleViewRequest(async (req, res) => {
    const viewData = await this.buildClientDashboardViewData(req, res);

    res.render('pages/app/dashboards/client', {
      ...viewData,
    });
  });

  // -------------------- MANAGE REDIRECT URIS -------------------

  manageRedirects = this.handleViewRequest(async (req, res) => {
    const client_id = this.getString(req.params.client_id);
    const action = this.getString(req.body?.action);
    const redirect_uri = this.getString(req.body?.redirect_uri);

    if (!client_id || !action || !redirect_uri) {
      throw new AppError('Invalid request', 400, ErrorCode.INVALID_REQUEST);
    }

    try {
      if (!['add', 'del'].includes(action)) {
        throw new AppError('Invalid action', 400, ErrorCode.INVALID_REQUEST);
      }

      const client = await this.clientService.getClient(client_id);

      const sanitizedRedirectUri = this.validateRedirectUriInput(redirect_uri);
      const normalizedURI = this.clientService.normalizeAndValidateURI(
        sanitizedRedirectUri,
        client.environment,
        client.domain,
      );

      const exists = client.redirectURIs.includes(normalizedURI);

      if (action === 'add') {
        if (exists) {
          throw new AppError('Redirect URI already exists', 400, ErrorCode.INVALID_REDIRECT_URI);
        }

        await this.clientService.addRedirectURI({
          clientId: client_id,
          normalizedURI,
          existingRedirectURIs: client.redirectURIs,
        });
      } else {
        if (!exists) {
          throw new AppError('Redirect URI does not exist', 400, ErrorCode.INVALID_REDIRECT_URI);
        }

        await this.clientService.deleteRedirectURI({
          clientId: client_id,
          normalizedURI,
          existingRedirectURIs: client.redirectURIs,
        });
      }
    } catch (error) {
      if (error instanceof AppError) {
        return res.redirect(303, `/client/${client_id}?error=${encodeURIComponent(error.message)}`);
      }
      throw error;
    }

    const successMessage =
      action === 'add' ? 'Redirect URI added successfully' : 'Redirect URI removed successfully';
    return res.redirect(303, `/client/${client_id}?success=${encodeURIComponent(successMessage)}`);
  });

  // ---------------- ROTATE SECRET ----------------

  rotateClientSecret = this.handleViewRequest(async (req, res) => {
    const client_id = this.getString(req.body?.client_id);

    if (!client_id) {
      throw new AppError('Client ID is required', 400, ErrorCode.INVALID_REQUEST);
    }

    const data = await this.clientService.rotateClientSecret(client_id);

    res.cookie('__flash_client_secret', data.clientSecret, {
      httpOnly: true,
      secure: ENV.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 1000,
    });

    return res.redirect(
      303,
      `/client/${client_id}?success=${encodeURIComponent('Client secret rotated successfully')}`,
    );
  });

  // ---------------- UPDATE SETTINGS (NAME / DOMAIN) ----------------

  updateClientSettings = this.handleViewRequest(async (req, res) => {
    const client_id = this.getString(req.params.client_id);
    const name = this.getString(req.body?.name);
    const domain = this.getString(req.body?.domain);

    if (!client_id) {
      throw new AppError('Client ID is required', 400, ErrorCode.INVALID_REQUEST);
    }

    try {
      await this.clientService.updateClientDetails(client_id, req.user.id, {
        name,
        domain,
      });

      return res.redirect(
        303,
        `/client/${client_id}?success=${encodeURIComponent('Client settings updated successfully')}`,
      );
    } catch (error) {
      if (error instanceof AppError) {
        return res.redirect(303, `/client/${client_id}?error=${encodeURIComponent(error.message)}`);
      }
      throw error;
    }
  });

  // ---------------- UPDATE CLIENT TYPE ----------------

  updateClientType = this.handleViewRequest(async (req, res) => {
    const client_id = this.getString(req.params.client_id);
    const client_type = req.body?.client_type;

    if (!client_id || !client_type) {
      throw new AppError('Client type is required', 400, ErrorCode.INVALID_REQUEST);
    }

    try {
      const { clientSecret } = await this.clientService.updateClientType(
        client_id,
        req.user.id,
        client_type,
      );

      if (clientSecret) {
        res.cookie('__flash_client_secret', clientSecret, {
          httpOnly: true,
          secure: ENV.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 60 * 1000,
        });
      }

      return res.redirect(
        303,
        `/client/${client_id}?success=${encodeURIComponent(`Client type updated to ${client_type}`)}`,
      );
    } catch (error) {
      if (error instanceof AppError) {
        return res.redirect(303, `/client/${client_id}?error=${encodeURIComponent(error.message)}`);
      }
      throw error;
    }
  });

  // ---------------- UPDATE ENVIRONMENT ----------------

  updateClientEnvironment = this.handleViewRequest(async (req, res) => {
    const client_id = this.getString(req.params.client_id);
    const environment = this.getString(req.body?.environment);

    if (!client_id) {
      throw new AppError('Environment is required', 400, ErrorCode.INVALID_REQUEST);
    }

    try {
      const client = await this.clientService.getClient(client_id);
      const targetEnvironment =
        (
          environment &&
          Object.values(OAUTH_CLIENT_ENVIRONMENTS).includes(
            environment as (typeof OAUTH_CLIENT_ENVIRONMENTS)[keyof typeof OAUTH_CLIENT_ENVIRONMENTS],
          )
        ) ?
          environment
        : client.environment === OAUTH_CLIENT_ENVIRONMENTS.DEVELOPMENT ? OAUTH_CLIENT_ENVIRONMENTS.PRODUCTION
        : OAUTH_CLIENT_ENVIRONMENTS.DEVELOPMENT;

      const { clearedRedirectsCount } = await this.clientService.setClientEnvironment(
        client_id,
        targetEnvironment as OAuthClientEnvironment,
      );

      if (targetEnvironment === OAUTH_CLIENT_ENVIRONMENTS.PRODUCTION) {
        return res.redirect(
          303,
          `/client/${client_id}?warning=${encodeURIComponent(
            `Switched to Production mode. All ${clearedRedirectsCount} previously saved redirect URI(s) have been deleted. Please register your HTTPS redirect URI(s) matching "${client.domain}".`,
          )}`,
        );
      }

      return res.redirect(
        303,
        `/client/${client_id}?success=${encodeURIComponent(
          `Client environment switched to ${targetEnvironment}`,
        )}`,
      );
    } catch (error) {
      if (error instanceof AppError) {
        return res.redirect(303, `/client/${client_id}?error=${encodeURIComponent(error.message)}`);
      }
      throw error;
    }
  });

  deactivate = this.handleViewRequest(async (req, res) => {
    const clientId = this.getString(req.params.client_id);
    if (!clientId) {
      throw new AppError('clientId missing', 400, ErrorCode.INVALID_REQUEST);
    }

    await this.clientService.update(clientId, {
      isActive: false,
      revokedAt: new Date(),
    });

    return res.redirect(
      303,
      `/client/${clientId}?success=${encodeURIComponent('Client deactivated successfully')}`,
    );
  });

  activate = this.handleViewRequest(async (req, res) => {
    const clientId = this.getString(req.params.client_id);
    if (!clientId) {
      throw new AppError('clientId missing', 400, ErrorCode.INVALID_REQUEST);
    }

    await this.clientService.activate(clientId);

    return res.redirect(
      303,
      `/client/${clientId}?success=${encodeURIComponent('Client activated successfully')}`,
    );
  });

  delete = this.handleViewRequest(async (req, res) => {
    const clientId = this.getString(req.params.client_id);
    if (!clientId) {
      throw new AppError('clientId missing', 400, ErrorCode.INVALID_REQUEST);
    }

    await this.clientService.delete(clientId);

    return res.redirect(303, `/account?success=${encodeURIComponent('Client deleted permanently')}`);
  });

  private async buildClientConfirmationViewData(req: Request) {
    const clientId = this.getString(req.params.client_id);
    const action = this.getString(req.params.action);

    if (!clientId || !action) {
      throw new AppError('Invalid request', 400, ErrorCode.INVALID_REQUEST);
    }

    const allowedActions = new Set(['delete', 'activate', 'deactivate', 'environment']);
    if (!allowedActions.has(action)) {
      throw new AppError('Invalid action', 400, ErrorCode.INVALID_REQUEST);
    }

    if (action === 'environment') {
      const client = await this.clientService.getClient(clientId);
      const requestedEnvironment = this.getString(req.query.environment);
      let targetEnvironment = requestedEnvironment;

      if (!targetEnvironment) {
        targetEnvironment =
          client.environment === OAUTH_CLIENT_ENVIRONMENTS.DEVELOPMENT ?
            OAUTH_CLIENT_ENVIRONMENTS.PRODUCTION
          : OAUTH_CLIENT_ENVIRONMENTS.DEVELOPMENT;
      } else if (
        !Object.values(OAUTH_CLIENT_ENVIRONMENTS).includes(
          targetEnvironment as (typeof OAUTH_CLIENT_ENVIRONMENTS)[keyof typeof OAUTH_CLIENT_ENVIRONMENTS],
        )
      ) {
        throw new AppError('Invalid environment', 400, ErrorCode.INVALID_REQUEST);
      }
      let httpRedirectCount = 0;
      let httpsRedirectCount = 0;

      for (const uri of client.redirectURIs) {
        try {
          const protocol = new URL(uri).protocol;
          if (protocol === 'http:') httpRedirectCount += 1;
          if (protocol === 'https:') httpsRedirectCount += 1;
        } catch {
          // ignore invalid entries
        }
      }

      return {
        title: 'Confirm Client Action',
        clientId,
        action,
        name: client.name,
        domain: client.domain,
        redirectCount: client.redirectURIs.length,
        currentEnvironment: client.environment,
        targetEnvironment,
        httpRedirectCount,
        httpsRedirectCount,
      };
    }

    return {
      title: 'Confirm Client Action',
      clientId,
      action,
      name: typeof req.query.name === 'string' ? req.query.name : undefined,
    };
  }

  renderClientConfirmation = this.handleViewRequest(async (req, res) => {
    const viewData = await this.buildClientConfirmationViewData(req);

    res.render('pages/app/confirm-action/client', viewData);
  });
}
