import prisma from '../config/database.js';
import redis from '../config/redis.js';
import { ENV } from '../config/env.js';
import { AppError } from '../utils/appError.js';
import { ErrorCode } from '../utils/errorCodes.js';
import { AppCrypto } from '../utils/crypto.js';
import {
  OAUTH_CLIENT_TYPES,
  OAUTH_CLIENT_ENVIRONMENTS,
  CRYPTO_ALGORITHMS,
  type OAuthClientType,
  type OAuthClientEnvironment,
} from '../utils/constant.js';

export type ClientView = {
  id: string;
  name: string;
  domain: string;
  clientType: OAuthClientType;
  environment: OAuthClientEnvironment;
  enforcePKCE: boolean;
  redirectURIs: string[];
  isActive: boolean;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AllClientsView = {
  id: string;
  name: string;
  isActive: boolean;
};

export interface ClientUpdateInput {
  name?: string;
  domain?: string;
  clientType?: OAuthClientType;
  redirectURIs?: string[];
  clientSecretHash?: string | null;
  environment?: OAuthClientEnvironment;
  isActive?: boolean;
  revokedAt?: Date | null;
}

export class ClientService {
  private readonly appDomain = ENV.APP_DOMAIN;
  private readonly clientCacheEX = ENV.CLIENT_CACHE_EX ?? 15 * 60;
  private readonly clientSecretKey = ENV.CLIENT_SECRET_KEY;
  private clientCacheKey = (clientId: string): string => `client:${clientId}`;

  async generateClientSecret() {
    const clientSecret = AppCrypto.randomToken(48);
    const clientSecretHash = AppCrypto.hmac(
      clientSecret,
      this.clientSecretKey,
      CRYPTO_ALGORITHMS.sha256,
      'base64url',
    );
    return { clientSecret, clientSecretHash };
  }

  getClientDomain(slug: string): string {
    return slug;
  }

  isValidDomain(domain: string): boolean {
    if (!domain) return false;
    const normalized = domain.trim().toLowerCase();
    if (normalized.length < 3 || normalized.length > 253) return false;
    if (normalized.includes('://') || normalized.includes('/') || normalized.includes(':') || normalized.includes('?') || normalized.includes('#')) {
      return false;
    }
    return /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(normalized);
  }

  normalizeAndValidateDomain(domainInput: string): string {
    const trimmed = domainInput?.trim().toLowerCase();
    if (!trimmed) {
      throw new AppError('Domain is required', 400, ErrorCode.INVALID_DOMAIN);
    }
    if (trimmed.includes('://') || trimmed.includes('/') || trimmed.includes(':') || trimmed.includes('?') || trimmed.includes('#')) {
      throw new AppError(
        'Domain must be a domain name like "xyz.com" (do not include http://, https://, ports, or paths)',
        400,
        ErrorCode.INVALID_DOMAIN,
      );
    }
    if (!this.isValidDomain(trimmed)) {
      throw new AppError(
        'Domain must be a valid domain name like "xyz.com" (not a URL or single name)',
        400,
        ErrorCode.INVALID_DOMAIN,
      );
    }
    return trimmed;
  }

  isValidSlug(slug: string): boolean {
    return this.isValidDomain(slug);
  }

  normalizeAndValidateURI(uri: string, environment: OAuthClientEnvironment, clientDomain?: string): string {
    const trimmed = uri.trim();
    if (!trimmed) {
      throw new AppError('Invalid URI format', 400, ErrorCode.INVALID_REDIRECT_URI);
    }
    if (/\s/.test(trimmed)) {
      throw new AppError('Invalid URI format', 400, ErrorCode.INVALID_REDIRECT_URI);
    }

    let url: URL;

    try {
      url = new URL(trimmed);
    } catch {
      throw new AppError('Invalid URI format', 400, ErrorCode.INVALID_REDIRECT_URI);
    }

    const isHttps = url.protocol === 'https:';
    const isHttp = url.protocol === 'http:';
    if (url.username || url.password) {
      throw new AppError('Redirect URI must not include credentials', 400, ErrorCode.INVALID_REDIRECT_URI);
    }
    if (url.hash) {
      throw new AppError('Redirect URI must not include fragments', 400, ErrorCode.INVALID_REDIRECT_URI);
    }
    if (environment === OAUTH_CLIENT_ENVIRONMENTS.PRODUCTION && !isHttps) {
      throw new AppError(
        'Invalid redirect URI. Use HTTPS in production.',
        400,
        ErrorCode.INVALID_REDIRECT_URI,
      );
    }

    if (!isHttps && !isHttp) {
      throw new AppError('Invalid redirect URI protocol', 400, ErrorCode.INVALID_REDIRECT_URI);
    }

    if (trimmed.includes('*')) {
      throw new AppError('Wildcard URIs are not allowed', 400, ErrorCode.INVALID_REDIRECT_URI);
    }

    const hostname = url.hostname.toLowerCase();
    const normalizedDomain = clientDomain?.trim().toLowerCase();

    if (environment === OAUTH_CLIENT_ENVIRONMENTS.PRODUCTION) {
      if (normalizedDomain && hostname !== normalizedDomain) {
        throw new AppError(
          `In production, redirect URI domain must match registered domain "${normalizedDomain}" (got "${hostname}")`,
          400,
          ErrorCode.INVALID_REDIRECT_URI,
        );
      }
    } else {
      const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
      const isRegisteredDomain = Boolean(normalizedDomain && hostname === normalizedDomain);
      if (!isLocalhost && !isRegisteredDomain) {
        throw new AppError(
          `In development mode, redirect URIs must use localhost, 127.0.0.1, or registered domain "${normalizedDomain || 'xyz.com'}" (got "${hostname}")`,
          400,
          ErrorCode.INVALID_REDIRECT_URI,
        );
      }
    }

    return url.toString();
  }

  // -------------- VERIFY CLIENT ----------------

  async verifyClient(input: { clientId: string; clientSecret: string }) {
    const client = await prisma.oAuthClient.findUnique({
      where: { id: input.clientId },
      select: {
        id: true,
        clientType: true,
        clientSecretHash: true,
        isActive: true,
        revokedAt: true,
        enforcePKCE: true,
        redirectURIs: true,
      },
    });

    if (!client || !client.isActive || client.revokedAt) {
      throw new AppError('Invalid client', 401, ErrorCode.INVALID_CLIENT);
    }

    if (client.clientType === OAUTH_CLIENT_TYPES.CONFIDENTIAL) {
      if (!input.clientSecret || !client.clientSecretHash) {
        throw new AppError('Invalid client', 401, ErrorCode.INVALID_CLIENT);
      }

      const derived = AppCrypto.hmac(
        input.clientSecret,
        this.clientSecretKey,
        CRYPTO_ALGORITHMS.sha256,
        'base64url',
      );

      const ok = AppCrypto.timingSafeCompare(derived, client.clientSecretHash, 'base64url');

      if (!ok) {
        throw new AppError('Invalid client', 401, ErrorCode.INVALID_CLIENT);
      }
    }

    // PUBLIC clients must not authenticate with secret
    if (client.clientType === OAUTH_CLIENT_TYPES.PUBLIC && input.clientSecret) {
      throw new AppError('Invalid client', 401, ErrorCode.INVALID_CLIENT);
    }

    return {
      id: client.id,
      clientType: client.clientType,
      isActive: client.isActive,
      revokedAt: client.revokedAt,
      enforcePKCE: client.enforcePKCE,
      redirectURIs: client.redirectURIs,
    };
  }

  // ---------------- CREATE CLIENT ----------------

  async createClient(input: {
    userId: string;
    name: string;
    domain: string;
    clientType: OAuthClientType;
    environment: OAuthClientEnvironment;
    redirectURI: string; // enforce ONE at creation
  }) {
    const normalizedName = input.name.trim().toLowerCase();
    if (!normalizedName) {
      throw new AppError('Client name is required', 400, ErrorCode.INVALID_INPUT);
    }

    const existingClients = await prisma.oAuthClient.findMany({
      where: { userId: input.userId },
      select: { name: true },
    });

    const hasDuplicateName = existingClients.some(
      (client) => client.name.trim().toLowerCase() === normalizedName.toLowerCase(),
    );

    if (hasDuplicateName) {
      throw new AppError('Client name already exists', 409, ErrorCode.ALREADY_EXISTS);
    }

    const redirectURI = this.normalizeAndValidateURI(input.redirectURI, input.environment, input.domain);

    const { clientSecret, clientSecretHash } =
      input.clientType === OAUTH_CLIENT_TYPES.CONFIDENTIAL ?
        await this.generateClientSecret()
      : { clientSecret: null, clientSecretHash: null };

    const client = await prisma.oAuthClient.create({
      data: {
        userId: input.userId,
        name: normalizedName,
        domain: input.domain.trim().toLowerCase(),
        clientType: input.clientType,
        environment: input.environment,
        clientSecretHash,
        enforcePKCE: true,
        redirectURIs: [redirectURI],
        isActive: true,
      },
    });

    return {
      id: client.id,
      userId: client.userId,
      name: client.name,
      domain: client.domain.trim().toLowerCase(),
      clientType: client.clientType,
      environment: client.environment,
      enforcePKCE: client.enforcePKCE,
      redirectURIs: client.redirectURIs,
      isActive: client.isActive,
      clientSecret,
    };
  }

  // -------- GET CLIENT --------

  async getClient(clientId: string): Promise<ClientView> {
    const cached = await redis.get(this.clientCacheKey(clientId));
    if (cached) {
      return JSON.parse(cached);
    }

    const client = await prisma.oAuthClient.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        name: true,
        domain: true,
        clientType: true,
        environment: true,
        enforcePKCE: true,
        redirectURIs: true,
        isActive: true,
        revokedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!client) {
      throw new AppError('Client not found', 404, ErrorCode.NOT_FOUND);
    }

    await redis.set(this.clientCacheKey(clientId), JSON.stringify(client), 'EX', this.clientCacheEX);
    return client;
  }

  // -------- UPDATE --------
  async update(clientId: string, updates: ClientUpdateInput): Promise<ClientView> {
    if (Object.keys(updates).length === 0) {
      throw new AppError('No updates provided', 400, ErrorCode.INVALID_GRANT);
    }

    const client = await prisma.oAuthClient.update({
      where: { id: clientId },
      data: {
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.domain !== undefined && { domain: updates.domain }),
        ...(updates.clientType !== undefined && { clientType: updates.clientType }),
        ...(updates.redirectURIs !== undefined && { redirectURIs: updates.redirectURIs }),
        ...(updates.clientSecretHash !== undefined && { clientSecretHash: updates.clientSecretHash }),
        ...(updates.environment !== undefined && { environment: updates.environment }),
        ...(updates.isActive !== undefined && { isActive: updates.isActive }),
        ...(updates.revokedAt !== undefined && { revokedAt: updates.revokedAt }),
      },
      select: {
        id: true,
        name: true,
        domain: true,
        clientType: true,
        environment: true,
        enforcePKCE: true,
        redirectURIs: true,
        isActive: true,
        revokedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!client) {
      throw new AppError('Client not found', 404, ErrorCode.NOT_FOUND);
    }

    await redis.del(this.clientCacheKey(clientId));
    return client;
  }

  async updateClientDetails(
    clientId: string,
    userId: string,
    input: { name?: string; domain?: string },
  ): Promise<ClientView> {
    const existing = await prisma.oAuthClient.findUnique({
      where: { id: clientId },
    });
    if (!existing || existing.userId !== userId) {
      throw new AppError('Client not found', 404, ErrorCode.NOT_FOUND);
    }

    const updates: ClientUpdateInput = {};

    if (input.name !== undefined) {
      const normalizedName = input.name.trim();
      if (!normalizedName) {
        throw new AppError('Client name cannot be empty', 400, ErrorCode.INVALID_INPUT);
      }
      if (normalizedName.toLowerCase() !== existing.name.toLowerCase()) {
        const userClients = await prisma.oAuthClient.findMany({
          where: { userId },
          select: { id: true, name: true },
        });
        const hasDuplicate = userClients.some(
          (c) => c.id !== clientId && c.name.toLowerCase() === normalizedName.toLowerCase(),
        );
        if (hasDuplicate) {
          throw new AppError('Client name already exists', 409, ErrorCode.ALREADY_EXISTS);
        }
      }
      updates.name = normalizedName;
    }

    if (input.domain !== undefined) {
      const normalizedDomain = this.normalizeAndValidateDomain(input.domain);
      updates.domain = normalizedDomain;
    }

    return this.update(clientId, updates);
  }

  async updateClientType(
    clientId: string,
    userId: string,
    targetType: OAuthClientType,
  ): Promise<{ client: ClientView; clientSecret?: string }> {
    const existing = await prisma.oAuthClient.findUnique({
      where: { id: clientId },
    });
    if (!existing || existing.userId !== userId) {
      throw new AppError('Client not found', 404, ErrorCode.NOT_FOUND);
    }

    if (existing.clientType === targetType) {
      return { client: existing as unknown as ClientView };
    }

    let generatedSecret: string | undefined;
    const updates: ClientUpdateInput = { clientType: targetType };

    if (targetType === OAUTH_CLIENT_TYPES.CONFIDENTIAL) {
      const { clientSecret, clientSecretHash } = await this.generateClientSecret();
      updates.clientSecretHash = clientSecretHash;
      generatedSecret = clientSecret;
    } else {
      updates.clientSecretHash = null;
    }

    const updated = await this.update(clientId, updates);
    return { client: updated, clientSecret: generatedSecret };
  }

  // -------- ADD REDIRECT URI --------

  async addRedirectURI(input: { clientId: string; normalizedURI: string; existingRedirectURIs: string[] }) {
    const updated = [...input.existingRedirectURIs, input.normalizedURI];

    await this.update(input.clientId, { redirectURIs: updated });

    await redis.del(this.clientCacheKey(input.clientId));
    return { redirectURI: input.normalizedURI, added: true };
  }

  // -------- DELETE REDIRECT URI --------

  async deleteRedirectURI(input: {
    clientId: string;
    normalizedURI: string;
    existingRedirectURIs: string[];
  }) {
    const updated = input.existingRedirectURIs.filter((u) => u !== input.normalizedURI);

    await this.update(input.clientId, { redirectURIs: updated });

    await redis.del(this.clientCacheKey(input.clientId));
    return { redirectURI: input.normalizedURI, removed: true };
  }

  // -------- DELETE --------

  async delete(clientId: string) {
    const deleted = await prisma.oAuthClient.deleteMany({
      where: { id: clientId },
    });

    if (deleted.count === 0) {
      throw new AppError('Client not found', 404, ErrorCode.NOT_FOUND);
    }

    await redis.del(this.clientCacheKey(clientId));
  }

  // -------- ACTIVATE --------
  async activate(clientId: string) {
    await this.update(clientId, { isActive: true, revokedAt: null });
  }

  // ---------------- ROTATE SECRET ----------------

  async rotateClientSecret(clientId: string) {
    const { clientSecret, clientSecretHash } = await this.generateClientSecret();

    await this.update(clientId, { clientSecretHash });

    await redis.del(this.clientCacheKey(clientId));
    return { clientSecret };
  }

  // -------- GET ALL CLIENTS FOR A USER --------

  async getAllClientsForUser(userId: string): Promise<AllClientsView[]> {
    return prisma.oAuthClient.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async setClientEnvironment(
    clientId: string,
    environment: OAuthClientEnvironment,
  ): Promise<{ client: ClientView; removedHttpRedirects: number }> {
    const client = await prisma.oAuthClient.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        redirectURIs: true,
      },
    });

    if (!client) {
      throw new AppError('Client not found', 404, ErrorCode.NOT_FOUND);
    }

    const updates: ClientUpdateInput = { environment };
    let removedHttpRedirects = 0;

    if (environment === OAUTH_CLIENT_ENVIRONMENTS.PRODUCTION) {
      const httpsOnly = client.redirectURIs.filter((uri) => {
        try {
          return new URL(uri).protocol === 'https:';
        } catch {
          return false;
        }
      });

      removedHttpRedirects = client.redirectURIs.length - httpsOnly.length;

      if (httpsOnly.length === 0) {
        throw new AppError(
          'At least one HTTPS redirect URI is required to switch to production.',
          400,
          ErrorCode.INVALID_REDIRECT_URI,
        );
      }

      updates.redirectURIs = httpsOnly;
    }

    const updatedClient = await this.update(clientId, updates);
    return { client: updatedClient, removedHttpRedirects };
  }
}

export const clientService = new ClientService();
