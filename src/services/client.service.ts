import crypto from 'node:crypto';
import net from 'node:net';
import prisma from '../config/database.js';
import redis from '../config/redis.js';
import { ENV } from '../config/env.js';
import { logger } from '../config/logger.js';
import { dnsService, DnsService, type IDnsResolver } from './dns.service.js';
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
  domainStatus: 'PENDING' | 'VERIFIED';
  domainVerificationToken: string | null;
  domainVerificationMethod: string;
  domainVerifiedAt: Date | null;
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
  domainStatus?: 'PENDING' | 'VERIFIED';
  domainVerificationToken?: string | null;
  domainVerificationMethod?: string;
  domainVerifiedAt?: Date | null;
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

  constructor(private readonly dns: DnsService = dnsService) {}

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

  isValidDomain(domain: string, allowLocalhost = false): boolean {
    if (!domain) return false;
    let normalized = domain.trim().toLowerCase();
    if (normalized === 'localhost') return allowLocalhost;
    if (normalized.startsWith('https://')) normalized = normalized.slice(8);
    if (normalized.startsWith('http://')) normalized = normalized.slice(7);
    if (normalized.endsWith('.')) normalized = normalized.slice(0, -1);
    if (normalized.includes('/')) normalized = normalized.split('/')[0]!;
    if (normalized.includes(':')) normalized = normalized.split(':')[0]!;

    if (normalized === 'localhost') {
      return allowLocalhost;
    }

    if (normalized.endsWith('.localhost') || net.isIP(normalized) !== 0) {
      return false;
    }

    if (normalized.length < 3 || normalized.length > 253) return false;
    return /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(normalized);
  }

  normalizeAndValidateDomain(domainInput: string, allowLocalhost = false): string {
    let trimmed = domainInput?.trim().toLowerCase();
    if (!trimmed) {
      throw new AppError('Domain is required', 400, ErrorCode.INVALID_DOMAIN);
    }
    if (trimmed === 'localhost') {
      if (allowLocalhost) return 'localhost';
      throw new AppError('Domain cannot be localhost or an IP address', 400, ErrorCode.INVALID_DOMAIN);
    }
    if (trimmed.includes('?') || trimmed.includes('#')) {
      throw new AppError(
        'Domain must not contain query parameters or fragments',
        400,
        ErrorCode.INVALID_DOMAIN,
      );
    }
    // Auto-strip protocols
    if (trimmed.startsWith('https://')) {
      trimmed = trimmed.slice(8);
    } else if (trimmed.startsWith('http://')) {
      trimmed = trimmed.slice(7);
    }
    // Auto-strip trailing dot
    if (trimmed.endsWith('.')) {
      trimmed = trimmed.slice(0, -1);
    }
    // Auto-strip trailing path or slashes
    if (trimmed.includes('/')) {
      trimmed = trimmed.split('/')[0]!;
    }
    // Check IP before port stripping (especially for IPv6 addresses)
    if (trimmed === 'localhost') {
      if (allowLocalhost) return 'localhost';
      throw new AppError('Domain cannot be localhost or an IP address', 400, ErrorCode.INVALID_DOMAIN);
    }
    if (trimmed.endsWith('.localhost') || net.isIP(trimmed) !== 0) {
      throw new AppError('Domain cannot be localhost or an IP address', 400, ErrorCode.INVALID_DOMAIN);
    }
    // Auto-strip port
    if (trimmed.includes(':')) {
      trimmed = trimmed.split(':')[0]!;
    }

    if (trimmed === 'localhost') {
      if (allowLocalhost) return 'localhost';
      throw new AppError('Domain cannot be localhost or an IP address', 400, ErrorCode.INVALID_DOMAIN);
    }
    if (trimmed.endsWith('.localhost') || net.isIP(trimmed) !== 0) {
      throw new AppError('Domain cannot be localhost or an IP address', 400, ErrorCode.INVALID_DOMAIN);
    }

    if (!this.isValidDomain(trimmed, allowLocalhost)) {
      throw new AppError(
        'Domain must be a valid domain name like "xyz.com" (not a single name or URL)',
        400,
        ErrorCode.INVALID_DOMAIN,
      );
    }
    return trimmed;
  }

  isValidSlug(slug: string): boolean {
    return this.isValidDomain(slug);
  }

  isVercelDomain(domain?: string): boolean {
    if (!domain) return false;
    let normalized = domain.trim().toLowerCase();
    if (normalized.startsWith('https://')) normalized = normalized.slice(8);
    if (normalized.startsWith('http://')) normalized = normalized.slice(7);
    if (normalized.endsWith('.')) normalized = normalized.slice(0, -1);
    if (normalized.includes('/')) normalized = normalized.split('/')[0]!;
    if (normalized.includes(':')) normalized = normalized.split(':')[0]!;

    return (
      normalized.endsWith('.vercel.app') &&
      normalized.length > '.vercel.app'.length &&
      !normalized.startsWith('.')
    );
  }

  normalizeAndValidateURI(
    uri: string,
    environment: OAuthClientEnvironment,
    clientDomain?: string,
    domainStatus: 'PENDING' | 'VERIFIED' = 'PENDING',
  ): string {
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
    const isVercelHost = this.isVercelDomain(hostname);
    const isVercelClientDomain = this.isVercelDomain(normalizedDomain);

    if (environment === OAUTH_CLIENT_ENVIRONMENTS.PRODUCTION) {
      if ((isVercelHost || isVercelClientDomain) && domainStatus !== 'VERIFIED') {
        throw new AppError(
          'In production, Vercel domains (*.vercel.app) are not allowed without verified domain ownership.',
          400,
          ErrorCode.INVALID_REDIRECT_URI,
        );
      }
      if (domainStatus !== 'VERIFIED') {
        throw new AppError(
          `In production, domain "${normalizedDomain}" must be verified via DNS TXT record before configuring redirect URIs.`,
          400,
          ErrorCode.INVALID_REDIRECT_URI,
        );
      }
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

      if (isRegisteredDomain && !isVercelClientDomain && domainStatus !== 'VERIFIED') {
        throw new AppError(
          `Domain "${normalizedDomain}" is not verified yet. Please verify your domain via DNS TXT record in the dashboard before using it in redirect URIs, or use localhost or *.vercel.app in development.`,
          400,
          ErrorCode.INVALID_REDIRECT_URI,
        );
      }

      if (!isLocalhost && !isRegisteredDomain && !isVercelHost) {
        throw new AppError(
          `In development mode, redirect URIs must use localhost, 127.0.0.1, *.vercel.app, or registered domain "${normalizedDomain || 'xyz.com'}" (got "${hostname}")`,
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
    environment?: OAuthClientEnvironment;
    redirectURI?: string;
  }) {
    const normalizedName = input.name.trim().toLowerCase();
    if (!normalizedName) {
      throw new AppError('Client name is required', 400, ErrorCode.INVALID_INPUT);
    }

    const normalizedDomain = this.normalizeAndValidateDomain(input.domain, true);

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

    const { clientSecret, clientSecretHash } =
      input.clientType === OAUTH_CLIENT_TYPES.CONFIDENTIAL ?
        await this.generateClientSecret()
      : { clientSecret: null, clientSecretHash: null };

    const domainVerificationToken = crypto.randomBytes(32).toString('hex');

    const redirectURIs: string[] = [];
    if (input.redirectURI) {
      const sanitized = input.redirectURI.trim();
      const normalizedURI = this.normalizeAndValidateURI(
        sanitized,
        OAUTH_CLIENT_ENVIRONMENTS.DEVELOPMENT,
        normalizedDomain,
        'PENDING',
      );
      redirectURIs.push(normalizedURI);
    }

    const client = await prisma.oAuthClient.create({
      data: {
        userId: input.userId,
        name: normalizedName,
        domain: normalizedDomain,
        domainStatus: 'PENDING',
        domainVerificationToken,
        domainVerificationMethod: 'DNS_TXT',
        domainVerifiedAt: null,
        clientType: input.clientType,
        environment: OAUTH_CLIENT_ENVIRONMENTS.DEVELOPMENT,
        clientSecretHash,
        enforcePKCE: true,
        redirectURIs,
        isActive: true,
      },
    });

    return {
      id: client.id,
      userId: client.userId,
      name: client.name,
      domain: client.domain,
      domainStatus: client.domainStatus,
      domainVerificationToken: client.domainVerificationToken,
      domainVerificationMethod: client.domainVerificationMethod,
      domainVerifiedAt: client.domainVerifiedAt,
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
        domainStatus: true,
        domainVerificationToken: true,
        domainVerificationMethod: true,
        domainVerifiedAt: true,
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

    if (!client.domainVerificationToken) {
      const token = crypto.randomBytes(32).toString('hex');
      await prisma.oAuthClient.update({
        where: { id: clientId },
        data: { domainVerificationToken: token },
      });
      client.domainVerificationToken = token;
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
        ...(updates.domainStatus !== undefined && { domainStatus: updates.domainStatus }),
        ...(updates.domainVerificationToken !== undefined && {
          domainVerificationToken: updates.domainVerificationToken,
        }),
        ...(updates.domainVerificationMethod !== undefined && {
          domainVerificationMethod: updates.domainVerificationMethod,
        }),
        ...(updates.domainVerifiedAt !== undefined && { domainVerifiedAt: updates.domainVerifiedAt }),
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
        domainStatus: true,
        domainVerificationToken: true,
        domainVerificationMethod: true,
        domainVerifiedAt: true,
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
      const normalizedDomain = this.normalizeAndValidateDomain(input.domain, true);
      if (normalizedDomain !== existing.domain.toLowerCase()) {
        updates.domain = normalizedDomain;
        updates.domainStatus = 'PENDING';
        updates.domainVerificationToken = crypto.randomBytes(32).toString('hex');
        updates.domainVerifiedAt = null;

        // If client was in production, revert to development because the new domain is unverified
        if (existing.environment === OAUTH_CLIENT_ENVIRONMENTS.PRODUCTION) {
          updates.environment = OAUTH_CLIENT_ENVIRONMENTS.DEVELOPMENT;
          updates.redirectURIs = [];
        }
      }
    }

    return this.update(clientId, updates);
  }

  // -------- VERIFY DOMAIN OWNERSHIP (DNS TXT) --------

  async verifyDomainOwnership(
    clientId: string,
    userId: string,
    resolverOverride?: IDnsResolver,
  ): Promise<{ client: ClientView; domain: string }> {
    const client = await prisma.oAuthClient.findUnique({
      where: { id: clientId },
    });

    if (!client || client.userId !== userId) {
      throw new AppError('Client not found', 404, ErrorCode.NOT_FOUND);
    }

    if (client.domainStatus === 'VERIFIED') {
      return { client: client as unknown as ClientView, domain: client.domain };
    }

    if (client.domain === 'localhost') {
      throw new AppError(
        'Localhost cannot be verified via DNS TXT record. Please update your client domain to a registered domain name before verifying.',
        400,
        ErrorCode.INVALID_REQUEST,
      );
    }

    if (this.isVercelDomain(client.domain)) {
      throw new AppError(
        'Vercel domains (*.vercel.app) are for development only and do not require DNS verification. To use production, please configure and verify a custom domain.',
        400,
        ErrorCode.INVALID_REQUEST,
      );
    }

    let token = client.domainVerificationToken;
    if (!token) {
      token = crypto.randomBytes(32).toString('hex');
      await prisma.oAuthClient.update({
        where: { id: clientId },
        data: { domainVerificationToken: token },
      });
    }

    const expectedValue = `pramaan-verification=${token}`;
    const lookupHost = `_pramaan-verification.${client.domain}`;

    let records: string[] = [];
    try {
      records = await this.dns.resolveTxt(lookupHost, {
        resolver: resolverOverride,
      });
    } catch (err: unknown) {
      if (this.dns.isRecordNotFoundError(err)) {
        throw new AppError('Verification TXT record not found.', 400, ErrorCode.INVALID_REQUEST);
      }

      const dnsErr = err as { code?: string; message?: string; name?: string };
      logger.error('DNS infrastructure failure during domain verification', {
        domain: client.domain,
        lookupHost,
        code: dnsErr?.code || dnsErr?.name,
        error: dnsErr?.message,
      });

      throw new AppError(
        'DNS resolution failed. Please try again later.',
        503,
        ErrorCode.SERVICE_UNAVAILABLE,
      );
    }

    const matched = records.some((val) => val === expectedValue);

    if (!matched) {
      throw new AppError('Verification TXT record not found.', 400, ErrorCode.INVALID_REQUEST);
    }

    const updated = await this.update(clientId, {
      domainStatus: 'VERIFIED',
      domainVerifiedAt: new Date(),
    });

    await redis.del(this.clientCacheKey(clientId));
    return { client: updated, domain: client.domain };
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
  ): Promise<{ client: ClientView; clearedRedirectsCount: number }> {
    const client = await prisma.oAuthClient.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        redirectURIs: true,
        domain: true,
        domainStatus: true,
      },
    });

    if (!client) {
      throw new AppError('Client not found', 404, ErrorCode.NOT_FOUND);
    }

    if (environment === OAUTH_CLIENT_ENVIRONMENTS.PRODUCTION) {
      if (this.isVercelDomain(client.domain)) {
        throw new AppError(
          'Cannot switch to production: Vercel domains (*.vercel.app) are only permitted in development mode. Please configure and verify a custom domain for production.',
          400,
          ErrorCode.INVALID_REQUEST,
        );
      }
      if (client.domainStatus !== 'VERIFIED') {
        throw new AppError(
          `Cannot switch to production: domain "${client.domain}" must be verified via DNS TXT record first.`,
          400,
          ErrorCode.INVALID_REQUEST,
        );
      }
    }

    const updates: ClientUpdateInput = { environment };
    let clearedRedirectsCount = 0;

    if (environment === OAUTH_CLIENT_ENVIRONMENTS.PRODUCTION) {
      clearedRedirectsCount = client.redirectURIs.length;
      updates.redirectURIs = [];
    }

    const updatedClient = await this.update(clientId, updates);
    return { client: updatedClient, clearedRedirectsCount };
  }
}

export const clientService = new ClientService();
