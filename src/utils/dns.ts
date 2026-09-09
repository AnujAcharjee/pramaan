import net from 'node:net';

/**
 * Validates whether a given string is a valid DNS server address (IPv4, IPv6, or IP:port)
 * suitable for Node's Resolver.prototype.setServers().
 */
export function isValidDnsServerAddress(addr: string): boolean {
  if (!addr || typeof addr !== 'string') return false;
  const trimmed = addr.trim();
  if (!trimmed) return false;

  // Check plain IPv4 or IPv6
  if (net.isIP(trimmed) !== 0) {
    return true;
  }

  // Check IPv4 with port: 1.1.1.1:53
  const ipv4WithPort = /^([0-9.]+):([0-9]+)$/.exec(trimmed);
  if (ipv4WithPort) {
    const [, ip, portStr] = ipv4WithPort;
    const port = Number(portStr);
    return Boolean(ip && net.isIPv4(ip) && Number.isInteger(port) && port >= 1 && port <= 65535);
  }

  // Check RFC 5952 IPv6 with port: [2001:4860:4860::8888]:53
  const ipv6WithPort = /^\[([a-fA-F0-9:]+)\]:([0-9]+)$/.exec(trimmed);
  if (ipv6WithPort) {
    const [, ip, portStr] = ipv6WithPort;
    const port = Number(portStr);
    return Boolean(ip && net.isIPv6(ip) && Number.isInteger(port) && port >= 1 && port <= 65535);
  }

  return false;
}

/**
 * Safely parses comma-separated DNS server addresses.
 * Handles whitespace, trailing commas, and filters out invalid addresses.
 *
 * Example:
 *  parseDnsServers("1.1.1.1, 8.8.8.8") => ["1.1.1.1", "8.8.8.8"]
 *  parseDnsServers(" 1.1.1.1 , invalid-ip, 8.8.8.8 ") => ["1.1.1.1", "8.8.8.8"]
 *  parseDnsServers("") => []
 *  parseDnsServers(undefined) => []
 */
export function parseDnsServers(input?: string | null): string[] {
  if (!input || typeof input !== 'string') {
    return [];
  }

  return input
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && isValidDnsServerAddress(item));
}
