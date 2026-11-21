import type { Request, Response, NextFunction } from 'express';
import { clientService } from '../../services/client.service.js';
import { accountService } from '../../services/account.service.js';
import { AppError } from '../../utils/appError.js';
import { ErrorCode } from '../../utils/errorCodes.js';
import { OAUTH_CLIENT_ENVIRONMENTS, OAUTH_CLIENT_TYPES, ROLES } from '../../utils/constant.js';

export class DeveloperApiController {
  /**
   * List All Clients Registered by Authenticated Developer
   */
  listClients = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.id;
      const clients = await clientService.getAllClientsForUser(userId);

      res.status(200).json({
        clients,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Create New OAuth Application / Client
   */
  createClient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.id;
      const { name, domain: domainInput, client_type } = req.body;

      if (!name || typeof name !== 'string') {
        throw new AppError('Client name is required', 400, ErrorCode.INVALID_REQUEST);
      }

      const domain = clientService.normalizeAndValidateDomain(domainInput || 'localhost', true);

      const client = await clientService.createClient({
        userId,
        name: name.trim(),
        domain,
        clientType: client_type || OAUTH_CLIENT_TYPES.CONFIDENTIAL,
        environment: OAUTH_CLIENT_ENVIRONMENTS.DEVELOPMENT,
      });

      // Grant DEVELOPER role if not present
      if (!req.user.roles.includes(ROLES.DEVELOPER)) {
        await accountService.update(userId, {
          roles: [...req.user.roles, ROLES.DEVELOPER],
        });
      }

      res.status(201).json({
        success: true,
        message: 'Application registered successfully',
        client,
        clientSecret: client.clientSecret, // Sent on creation
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get Specific Client Details
   */
  getClient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const clientId = String(req.params.client_id);
      const client = await clientService.getClient(clientId);

      res.status(200).json({
        client,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update Client Details (Name, Domain)
   */
  updateClient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const clientId = String(req.params.client_id);
      const userId = req.user.id;
      const { name, domain } = req.body;

      const updated = await clientService.updateClientDetails(clientId, userId, {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(domain !== undefined && { domain: String(domain).trim() }),
      });

      res.status(200).json({
        success: true,
        message: 'Client details updated successfully',
        client: updated,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Rotate Client Secret
   */
  rotateSecret = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const clientId = String(req.params.client_id);
      const { clientSecret } = await clientService.rotateClientSecret(clientId);

      res.status(200).json({
        success: true,
        clientSecret,
        message: 'Client secret rotated successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Add Redirect URI to Client
   */
  addRedirectUri = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const clientId = String(req.params.client_id);
      const { uri } = req.body;

      if (!uri || typeof uri !== 'string') {
        throw new AppError('Redirect URI is required', 400, ErrorCode.INVALID_REQUEST);
      }

      const client = await clientService.getClient(clientId);
      const updated = await clientService.addRedirectURI({
        clientId,
        normalizedURI: uri.trim(),
        existingRedirectURIs: client.redirectURIs || [],
      });

      res.status(200).json({
        success: true,
        message: 'Redirect URI added successfully',
        ...updated,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Remove Redirect URI from Client
   */
  removeRedirectUri = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const clientId = String(req.params.client_id);
      const { uri } = req.body;

      if (!uri || typeof uri !== 'string') {
        throw new AppError('Redirect URI is required', 400, ErrorCode.INVALID_REQUEST);
      }

      const client = await clientService.getClient(clientId);
      const updated = await clientService.deleteRedirectURI({
        clientId,
        normalizedURI: uri.trim(),
        existingRedirectURIs: client.redirectURIs || [],
      });

      res.status(200).json({
        success: true,
        message: 'Redirect URI removed successfully',
        ...updated,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Verify Domain Ownership via DNS TXT
   */
  verifyDomain = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const clientId = String(req.params.client_id);
      const result = await clientService.verifyDomainOwnership(clientId, req.user.id);

      res.status(200).json({
        success: true,
        message: 'Domain verified successfully',
        client: result.client,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete Client
   */
  deleteClient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const clientId = String(req.params.client_id);
      await clientService.delete(clientId);

      res.status(200).json({
        success: true,
        message: 'Application deleted permanently',
      });
    } catch (error) {
      next(error);
    }
  };
}

export const developerApiController = new DeveloperApiController();
