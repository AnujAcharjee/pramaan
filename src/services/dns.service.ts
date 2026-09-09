import { Resolver } from 'node:dns/promises';
import { ENV } from '../config/env.js';
import { parseDnsServers } from '../utils/dns.js';

export interface IDnsResolver {
  resolveTxt(hostname: string): Promise<string[][]>;
  getServers(): string[];
  setServers(servers: string[]): void;
}

export class DnsService {
  private readonly defaultServers: string[];
  private readonly defaultTimeoutMs: number;

  constructor(options?: { servers?: string[]; timeoutMs?: number }) {
    this.defaultServers = options?.servers ?? (ENV.PRAMAAN_DNS_SERVERS || []);
    this.defaultTimeoutMs = options?.timeoutMs ?? 5000;
  }

  /**
   * Creates a dedicated DNS Resolver instance with conservative timeout and retries.
   * If DNS servers are configured, sets them on the resolver.
   * If not configured, uses the host's system resolver.
   */
  createResolver(customServers?: string[]): Resolver {
    const resolver = new Resolver({ timeout: 4000, tries: 2 });
    const serversToUse = customServers !== undefined ? customServers : this.defaultServers;

    if (serversToUse && serversToUse.length > 0) {
      resolver.setServers(serversToUse);
    }

    return resolver;
  }

  /**
   * Flattens and reconstructs RFC 1035 chunked TXT records into complete strings.
   * Node's resolveTxt returns an array of string arrays (string[][]), where each inner
   * array represents one TXT record chunked into 255-byte strings.
   */
  reconstructTxtRecords(txtRecords: string[][]): string[] {
    if (!Array.isArray(txtRecords)) return [];
    return txtRecords
      .map((chunks) => (Array.isArray(chunks) ? chunks.join('').trim() : ''))
      .filter((record) => record.length > 0);
  }

  /**
   * Resolves TXT records for a hostname with timeout protection.
   * Returns reconstructed TXT record strings (string[]).
   */
  async resolveTxt(
    hostname: string,
    options?: { resolver?: IDnsResolver; timeoutMs?: number },
  ): Promise<string[]> {
    const resolver = options?.resolver ?? this.createResolver();
    const timeout = options?.timeoutMs ?? this.defaultTimeoutMs;

    let timer: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        const err = new Error(`DNS resolution timed out after ${timeout}ms`);
        err.name = 'TimeoutError';
        (err as unknown as { code: string }).code = 'ETIMEOUT';
        reject(err);
      }, timeout);
      timer.unref();
    });

    let rawRecords: string[][];
    try {
      rawRecords = await Promise.race([resolver.resolveTxt(hostname), timeoutPromise]);
    } finally {
      if (timer) clearTimeout(timer);
    }

    return this.reconstructTxtRecords(rawRecords);
  }

  /**
   * Determines whether an error indicates that the TXT record does not exist.
   */
  isRecordNotFoundError(err: unknown): boolean {
    const code = (err as { code?: string })?.code;
    return code === 'ENOTFOUND' || code === 'ENODATA' || code === 'NXDOMAIN';
  }

  /**
   * Determines whether an error is a DNS infrastructure failure (e.g. refused, timeout, servfail).
   */
  isInfrastructureError(err: unknown): boolean {
    const dnsErr = err as { code?: string; name?: string };
    const code = dnsErr?.code || '';
    const name = dnsErr?.name || '';
    return (
      code === 'ECONNREFUSED' ||
      code === 'ETIMEOUT' ||
      code === 'ETIMEDOUT' ||
      code === 'SERVFAIL' ||
      code === 'ESERVFAIL' ||
      code === 'EREFUSED' ||
      code === 'ENETUNREACH' ||
      code === 'EHOSTUNREACH' ||
      code === 'ECONNRESET' ||
      code === 'EAI_AGAIN' ||
      name === 'TimeoutError' ||
      name === 'AbortError'
    );
  }
}

export { parseDnsServers };
export const dnsService = new DnsService();
