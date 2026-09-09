import { describe, it } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import prisma from '../src/config/database.js';
import { clientService } from '../src/services/client.service.js';
import { dnsService, type IDnsResolver } from '../src/services/dns.service.js';
import { parseDnsServers } from '../src/utils/dns.js';
import { AppError } from '../src/utils/appError.js';
import { ErrorCode } from '../src/utils/errorCodes.js';
import { OAUTH_CLIENT_ENVIRONMENTS } from '../src/utils/constant.js';

describe('Domain Validation and Normalization', () => {
  it('should normalize standard domain to lowercase', () => {
    const domain = clientService.normalizeAndValidateDomain('EXAMPLE.COM');
    assert.strictEqual(domain, 'example.com');
  });

  it('should auto-strip http and https protocols', () => {
    assert.strictEqual(
      clientService.normalizeAndValidateDomain('https://app.example.com'),
      'app.example.com',
    );
    assert.strictEqual(clientService.normalizeAndValidateDomain('http://mytest.org'), 'mytest.org');
  });

  it('should auto-strip trailing slashes, paths, and ports', () => {
    assert.strictEqual(
      clientService.normalizeAndValidateDomain('https://example.com/callback/oauth'),
      'example.com',
    );
    assert.strictEqual(clientService.normalizeAndValidateDomain('example.com:8080'), 'example.com');
  });

  it('should auto-strip trailing dot', () => {
    assert.strictEqual(clientService.normalizeAndValidateDomain('example.com.'), 'example.com');
  });

  it('should reject localhost when allowLocalhost is false (default)', () => {
    assert.throws(() => {
      clientService.normalizeAndValidateDomain('localhost');
    }, /cannot be localhost/i);

    assert.throws(() => {
      clientService.normalizeAndValidateDomain('localhost', false);
    }, /cannot be localhost/i);

    assert.throws(() => {
      clientService.normalizeAndValidateDomain('app.localhost');
    }, /cannot be localhost/i);
  });

  it('should allow localhost when allowLocalhost is true', () => {
    assert.strictEqual(clientService.normalizeAndValidateDomain('localhost', true), 'localhost');
    assert.strictEqual(clientService.normalizeAndValidateDomain('http://localhost:3000', true), 'localhost');
  });

  it('should reject IP addresses', () => {
    assert.throws(() => {
      clientService.normalizeAndValidateDomain('127.0.0.1');
    }, /cannot be localhost or an IP address/i);

    assert.throws(() => {
      clientService.normalizeAndValidateDomain('192.168.1.1');
    }, /cannot be localhost or an IP address/i);

    assert.throws(() => {
      clientService.normalizeAndValidateDomain('::1');
    }, /cannot be localhost or an IP address/i);
  });

  it('should reject single names without TLD or invalid syntax', () => {
    assert.throws(() => {
      clientService.normalizeAndValidateDomain('singlename');
    }, /valid domain name/i);

    assert.throws(() => {
      clientService.normalizeAndValidateDomain('');
    }, /Domain is required/i);
  });
});

describe('Vercel Domain Identification', () => {
  it('should identify valid Vercel domains', () => {
    assert.strictEqual(clientService.isVercelDomain('myapp.vercel.app'), true);
    assert.strictEqual(clientService.isVercelDomain('my-preview-app-pr-12.vercel.app'), true);
    assert.strictEqual(clientService.isVercelDomain('sub.team.vercel.app'), true);
  });

  it('should normalize protocol, ports, paths, and trailing dots when checking Vercel domains', () => {
    assert.strictEqual(clientService.isVercelDomain('https://myapp.vercel.app/oauth'), true);
    assert.strictEqual(clientService.isVercelDomain('http://myapp.vercel.app:3000'), true);
    assert.strictEqual(clientService.isVercelDomain('myapp.vercel.app.'), true);
    assert.strictEqual(clientService.isVercelDomain('  MYAPP.VERCEL.APP  '), true);
  });

  it('should reject root vercel.app and non-vercel domains', () => {
    assert.strictEqual(clientService.isVercelDomain('vercel.app'), false);
    assert.strictEqual(clientService.isVercelDomain('.vercel.app'), false);
    assert.strictEqual(clientService.isVercelDomain('myvercel.app'), false);
    assert.strictEqual(clientService.isVercelDomain('myapp-vercel.app'), false);
    assert.strictEqual(clientService.isVercelDomain('vercel.app.com'), false);
    assert.strictEqual(clientService.isVercelDomain('example.com'), false);
    assert.strictEqual(clientService.isVercelDomain('localhost'), false);
    assert.strictEqual(clientService.isVercelDomain(''), false);
    assert.strictEqual(clientService.isVercelDomain(undefined), false);
  });
});

describe('Redirect URI Validation Policy', () => {
  const registeredDomain = 'clientapp.com';
  const vercelDomain = 'my-cool-app.vercel.app';

  it('should allow localhost and 127.0.0.1 in development mode even if domain is unverified', () => {
    const uri1 = clientService.normalizeAndValidateURI(
      'http://localhost:3000/auth/callback',
      OAUTH_CLIENT_ENVIRONMENTS.DEVELOPMENT,
      registeredDomain,
      'PENDING',
    );
    assert.strictEqual(uri1, 'http://localhost:3000/auth/callback');

    const uri2 = clientService.normalizeAndValidateURI(
      'http://127.0.0.1:8080/callback',
      OAUTH_CLIENT_ENVIRONMENTS.DEVELOPMENT,
      registeredDomain,
      'PENDING',
    );
    assert.strictEqual(uri2, 'http://127.0.0.1:8080/callback');
  });

  it('should block custom registered domain in development mode if domain is unverified', () => {
    assert.throws(() => {
      clientService.normalizeAndValidateURI(
        'https://clientapp.com/callback',
        OAUTH_CLIENT_ENVIRONMENTS.DEVELOPMENT,
        registeredDomain,
        'PENDING',
      );
    }, /not verified yet/i);
  });

  it('should allow custom registered domain in development mode once verified', () => {
    const uri = clientService.normalizeAndValidateURI(
      'https://clientapp.com/callback',
      OAUTH_CLIENT_ENVIRONMENTS.DEVELOPMENT,
      registeredDomain,
      'VERIFIED',
    );
    assert.strictEqual(uri, 'https://clientapp.com/callback');
  });

  it('should allow Vercel domains in development mode without DNS TXT verification', () => {
    const uri1 = clientService.normalizeAndValidateURI(
      'https://my-cool-app.vercel.app/api/auth/callback',
      OAUTH_CLIENT_ENVIRONMENTS.DEVELOPMENT,
      vercelDomain,
      'PENDING',
    );
    assert.strictEqual(uri1, 'https://my-cool-app.vercel.app/api/auth/callback');

    // Localhost callbacks are also allowed for development Vercel clients
    const uri2 = clientService.normalizeAndValidateURI(
      'http://localhost:3000/api/auth/callback',
      OAUTH_CLIENT_ENVIRONMENTS.DEVELOPMENT,
      vercelDomain,
      'PENDING',
    );
    assert.strictEqual(uri2, 'http://localhost:3000/api/auth/callback');
  });

  it('should allow Vercel domains in development mode even when registered domain is different or unverified', () => {
    const uri1 = clientService.normalizeAndValidateURI(
      'https://preview-deploy.vercel.app/callback',
      OAUTH_CLIENT_ENVIRONMENTS.DEVELOPMENT,
      registeredDomain,
      'PENDING',
    );
    assert.strictEqual(uri1, 'https://preview-deploy.vercel.app/callback');

    const uri2 = clientService.normalizeAndValidateURI(
      'https://another-app.vercel.app/callback',
      OAUTH_CLIENT_ENVIRONMENTS.DEVELOPMENT,
      'localhost',
      'PENDING',
    );
    assert.strictEqual(uri2, 'https://another-app.vercel.app/callback');
  });

  it('should reject broad wildcard Vercel redirect URIs', () => {
    assert.throws(() => {
      clientService.normalizeAndValidateURI(
        'https://*.vercel.app/*',
        OAUTH_CLIENT_ENVIRONMENTS.DEVELOPMENT,
        vercelDomain,
        'PENDING',
      );
    }, /Wildcard URIs are not allowed/i);

    assert.throws(() => {
      clientService.normalizeAndValidateURI(
        'https://my-cool-app.vercel.app/*',
        OAUTH_CLIENT_ENVIRONMENTS.DEVELOPMENT,
        vercelDomain,
        'PENDING',
      );
    }, /Wildcard URIs are not allowed/i);
  });

  it('should block redirect URIs in production mode if custom domain is unverified', () => {
    assert.throws(() => {
      clientService.normalizeAndValidateURI(
        'https://clientapp.com/callback',
        OAUTH_CLIENT_ENVIRONMENTS.PRODUCTION,
        registeredDomain,
        'PENDING',
      );
    }, /must be verified/i);
  });

  it('should never allow unverified Vercel domains in production mode', () => {
    assert.throws(
      () => {
        clientService.normalizeAndValidateURI(
          'https://my-cool-app.vercel.app/callback',
          OAUTH_CLIENT_ENVIRONMENTS.PRODUCTION,
          vercelDomain,
          'PENDING',
        );
      },
      (err: unknown) => {
        assert.ok(err instanceof AppError);
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /Vercel domains/i);
        return true;
      },
    );
  });

  it('should allow registered custom domain in production mode once verified (HTTPS only)', () => {
    const uri = clientService.normalizeAndValidateURI(
      'https://clientapp.com/callback',
      OAUTH_CLIENT_ENVIRONMENTS.PRODUCTION,
      registeredDomain,
      'VERIFIED',
    );
    assert.strictEqual(uri, 'https://clientapp.com/callback');

    // Insecure HTTP should fail in production
    assert.throws(() => {
      clientService.normalizeAndValidateURI(
        'http://clientapp.com/callback',
        OAUTH_CLIENT_ENVIRONMENTS.PRODUCTION,
        registeredDomain,
        'VERIFIED',
      );
    }, /Use HTTPS in production/i);
  });
});

describe('Token Generation', () => {
  it('should generate unpredictable 32-byte (64 hex character) tokens', () => {
    const token1 = crypto.randomBytes(32).toString('hex');
    const token2 = crypto.randomBytes(32).toString('hex');

    assert.strictEqual(token1.length, 64);
    assert.strictEqual(token2.length, 64);
    assert.notStrictEqual(token1, token2);
  });
});

describe('DNS Configuration and Address Parsing', () => {
  it('PRAMAAN_DNS_SERVERS=1.1.1.1,8.8.8.8 should produce ["1.1.1.1", "8.8.8.8"]', () => {
    const servers = parseDnsServers('1.1.1.1,8.8.8.8');
    assert.deepStrictEqual(servers, ['1.1.1.1', '8.8.8.8']);
  });

  it('should handle whitespace safely in DNS server configuration', () => {
    const servers = parseDnsServers('   1.1.1.1  ,   8.8.8.8   ');
    assert.deepStrictEqual(servers, ['1.1.1.1', '8.8.8.8']);
  });

  it('should safely filter out invalid configuration without throwing', () => {
    const servers = parseDnsServers(' 1.1.1.1 , not-a-dns-ip , 8.8.8.8 , 999.999.999.999 ');
    assert.deepStrictEqual(servers, ['1.1.1.1', '8.8.8.8']);
  });

  it('should handle empty or undefined configuration safely', () => {
    assert.deepStrictEqual(parseDnsServers(''), []);
    assert.deepStrictEqual(parseDnsServers('   '), []);
    assert.deepStrictEqual(parseDnsServers(undefined), []);
    assert.deepStrictEqual(parseDnsServers(null), []);
  });

  it('should parse single internal DNS resolver (e.g. 10.0.0.53)', () => {
    const servers = parseDnsServers('10.0.0.53');
    assert.deepStrictEqual(servers, ['10.0.0.53']);
  });

  it('should support IPv4 and IPv6 addresses with ports', () => {
    const servers = parseDnsServers('1.1.1.1:53, [2001:4860:4860::8888]:53');
    assert.deepStrictEqual(servers, ['1.1.1.1:53', '[2001:4860:4860::8888]:53']);
  });
});

describe('Dedicated DNS Resolver Behavior', () => {
  it('configured DNS servers are passed to Resolver', () => {
    const resolver = dnsService.createResolver(['1.1.1.1', '8.8.8.8']);
    assert.deepStrictEqual(resolver.getServers(), ['1.1.1.1', '8.8.8.8']);
  });

  it('missing DNS configuration falls back appropriately', () => {
    const resolver = dnsService.createResolver([]);
    const servers = resolver.getServers();
    assert.ok(Array.isArray(servers), 'Resolver servers should be an array');
    assert.ok(servers.length > 0, 'Resolver should have fallback system servers');
  });
});

describe('DNS TXT Domain Ownership Verification', () => {
  const clientId = 'test-client-id-123';
  const userId = 'authorized-user-456';
  const domain = 'example.com';
  const token = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  const expectedValue = `pramaan-verification=${token}`;

  const createMockResolver = (resolveTxtFn: (host: string) => Promise<string[][]>): IDnsResolver => ({
    resolveTxt: resolveTxtFn,
    getServers: () => ['1.1.1.1'],
    setServers: () => {},
  });

  // Save original prisma methods
  const originalFindUnique = prisma.oAuthClient.findUnique;
  const originalUpdate = prisma.oAuthClient.update;

  type MockDnsError = Error & { code?: string };

  function setupPrismaMock(mockClient: Record<string, unknown> | null = null) {
    const defaultClient = {
      id: clientId,
      userId,
      name: 'Test Client',
      domain,
      domainStatus: 'PENDING',
      domainVerificationToken: token,
      domainVerificationMethod: 'DNS_TXT',
      domainVerifiedAt: null,
      clientType: 'CONFIDENTIAL',
      environment: 'DEVELOPMENT',
      enforcePKCE: true,
      redirectURIs: [],
      isActive: true,
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const clientData = mockClient === null ? defaultClient : mockClient;

    Object.assign(prisma.oAuthClient, {
      findUnique: async () => clientData,
      update: async ({ data }: { data: Record<string, unknown> }) => ({
        ...clientData,
        ...data,
      }),
    });
  }

  it('correct TXT token → VERIFIED', async () => {
    setupPrismaMock();
    const mockResolver = createMockResolver(async (host) => {
      assert.strictEqual(host, `_pramaan-verification.${domain}`);
      return [[expectedValue]];
    });

    const result = await clientService.verifyDomainOwnership(clientId, userId, mockResolver);
    assert.strictEqual(result.client.domainStatus, 'VERIFIED');
    assert.strictEqual(result.domain, domain);
    assert.ok(result.client.domainVerifiedAt instanceof Date);
  });

  it('incorrect TXT token → verification failure', async () => {
    setupPrismaMock();
    const mockResolver = createMockResolver(async () => [
      ['pramaan-verification=wrong-token-9999999999999999999999999999999999999999'],
    ]);

    await assert.rejects(
      () => clientService.verifyDomainOwnership(clientId, userId, mockResolver),
      (err: AppError) => {
        assert.strictEqual(err.message, 'Verification TXT record not found.');
        assert.strictEqual(err.statusCode, 400);
        return true;
      },
    );
  });

  it('no TXT record → verification failure', async () => {
    setupPrismaMock();
    const mockResolver = createMockResolver(async () => []);

    await assert.rejects(
      () => clientService.verifyDomainOwnership(clientId, userId, mockResolver),
      (err: AppError) => {
        assert.strictEqual(err.message, 'Verification TXT record not found.');
        assert.strictEqual(err.statusCode, 400);
        return true;
      },
    );
  });

  it('multiple TXT records → correct token is detected', async () => {
    setupPrismaMock();
    const mockResolver = createMockResolver(async () => [
      ['v=spf1 include:_spf.google.com ~all'],
      [expectedValue],
      ['google-site-verification=some-other-token-xyz'],
    ]);

    const result = await clientService.verifyDomainOwnership(clientId, userId, mockResolver);
    assert.strictEqual(result.client.domainStatus, 'VERIFIED');
  });

  it('TXT record split across DNS strings → correctly reconstructed', async () => {
    setupPrismaMock();
    // RFC 1035 chunked strings inside a single TXT record
    const mockResolver = createMockResolver(async () => [
      ['pramaan-verification=', token.slice(0, 20), token.slice(20)],
    ]);

    const result = await clientService.verifyDomainOwnership(clientId, userId, mockResolver);
    assert.strictEqual(result.client.domainStatus, 'VERIFIED');
  });

  it('NXDOMAIN → appropriate verification failure', async () => {
    setupPrismaMock();
    const mockResolver = createMockResolver(async () => {
      const err = new Error('queryTxt NXDOMAIN') as MockDnsError;
      err.code = 'ENOTFOUND';
      throw err;
    });

    await assert.rejects(
      () => clientService.verifyDomainOwnership(clientId, userId, mockResolver),
      (err: AppError) => {
        assert.strictEqual(err.message, 'Verification TXT record not found.');
        assert.strictEqual(err.statusCode, 400);
        return true;
      },
    );
  });

  it('ECONNREFUSED → DNS infrastructure error', async () => {
    setupPrismaMock();
    const mockResolver = createMockResolver(async () => {
      const err = new Error('queryTxt ECONNREFUSED 127.0.0.1:53') as MockDnsError;
      err.code = 'ECONNREFUSED';
      throw err;
    });

    await assert.rejects(
      () => clientService.verifyDomainOwnership(clientId, userId, mockResolver),
      (err: AppError) => {
        assert.strictEqual(err.message, 'DNS resolution failed. Please try again later.');
        assert.strictEqual(err.statusCode, 503);
        assert.strictEqual(err.code, ErrorCode.SERVICE_UNAVAILABLE);
        return true;
      },
    );
  });

  it('timeout → DNS infrastructure error', async () => {
    setupPrismaMock();
    const mockResolver = createMockResolver(async () => {
      const err = new Error('DNS query timed out') as MockDnsError;
      err.name = 'TimeoutError';
      err.code = 'ETIMEOUT';
      throw err;
    });

    await assert.rejects(
      () => clientService.verifyDomainOwnership(clientId, userId, mockResolver),
      (err: AppError) => {
        assert.strictEqual(err.message, 'DNS resolution failed. Please try again later.');
        assert.strictEqual(err.statusCode, 503);
        assert.strictEqual(err.code, ErrorCode.SERVICE_UNAVAILABLE);
        return true;
      },
    );
  });

  it("unauthorized user cannot verify another user's domain", async () => {
    // Client belongs to 'owner-id'
    setupPrismaMock({
      id: clientId,
      userId: 'owner-id',
      domain,
      domainStatus: 'PENDING',
      domainVerificationToken: token,
    });

    const mockResolver = createMockResolver(async () => [[expectedValue]]);

    // Attacker with different user ID attempts verification
    await assert.rejects(
      () => clientService.verifyDomainOwnership(clientId, 'unauthorized-user-id', mockResolver),
      (err: AppError) => {
        assert.strictEqual(err.statusCode, 404);
        assert.strictEqual(err.code, ErrorCode.NOT_FOUND);
        return true;
      },
    );
  });

  it('Vercel domain DNS verification request is rejected with helpful guidance', async () => {
    setupPrismaMock({
      id: clientId,
      userId,
      domain: 'my-app.vercel.app',
      domainStatus: 'PENDING',
      domainVerificationToken: token,
    });

    const mockResolver = createMockResolver(async () => [[expectedValue]]);

    await assert.rejects(
      () => clientService.verifyDomainOwnership(clientId, userId, mockResolver),
      (err: AppError) => {
        assert.strictEqual(
          err.message,
          'Vercel domains (*.vercel.app) are for development only and do not require DNS verification. To use production, please configure and verify a custom domain.',
        );
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.code, ErrorCode.INVALID_REQUEST);
        return true;
      },
    );
  });

  it('setClientEnvironment blocks switching to production for Vercel domains', async () => {
    setupPrismaMock({
      id: clientId,
      userId,
      domain: 'my-app.vercel.app',
      domainStatus: 'PENDING',
      redirectURIs: ['https://my-app.vercel.app/callback'],
    });

    await assert.rejects(
      () => clientService.setClientEnvironment(clientId, OAUTH_CLIENT_ENVIRONMENTS.PRODUCTION),
      (err: AppError) => {
        assert.strictEqual(
          err.message,
          'Cannot switch to production: Vercel domains (*.vercel.app) are only permitted in development mode. Please configure and verify a custom domain for production.',
        );
        assert.strictEqual(err.statusCode, 400);
        return true;
      },
    );
  });

  it('setClientEnvironment blocks switching to production for unverified custom domains', async () => {
    setupPrismaMock({
      id: clientId,
      userId,
      domain: 'custom.com',
      domainStatus: 'PENDING',
      redirectURIs: ['http://localhost:3000/callback'],
    });

    await assert.rejects(
      () => clientService.setClientEnvironment(clientId, OAUTH_CLIENT_ENVIRONMENTS.PRODUCTION),
      (err: AppError) => {
        assert.strictEqual(
          err.message,
          'Cannot switch to production: domain "custom.com" must be verified via DNS TXT record first.',
        );
        assert.strictEqual(err.statusCode, 400);
        return true;
      },
    );
  });

  it('setClientEnvironment allows switching to production for verified custom domains and clears dev redirects', async () => {
    setupPrismaMock({
      id: clientId,
      userId,
      domain: 'custom.com',
      domainStatus: 'VERIFIED',
      redirectURIs: ['http://localhost:3000/callback'],
    });

    const result = await clientService.setClientEnvironment(
      clientId,
      OAUTH_CLIENT_ENVIRONMENTS.PRODUCTION,
    );
    assert.strictEqual(result.clearedRedirectsCount, 1);
  });

  // Restore mocks after tests
  it('should restore original prisma mocks', () => {
    prisma.oAuthClient.findUnique = originalFindUnique;
    prisma.oAuthClient.update = originalUpdate;
  });
});

describe('Test Suite Cleanup', () => {
  it('should clean up and exit', async () => {
    setTimeout(() => process.exit(0), 100).unref();
  });
});
