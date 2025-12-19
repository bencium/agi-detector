import net from 'net';
import { lookup } from 'dns/promises';

/**
 * URL Security Validator
 * Prevents SSRF (Server-Side Request Forgery) attacks by validating URLs
 * before allowing the crawler to access them.
 */

export interface UrlValidationResult {
  safe: boolean;
  reason?: string;
}

type IpCheckResult = { safe: boolean; reason?: string };

/**
 * Check if a URL is safe to crawl
 * Blocks localhost, private IPs, and non-HTTP protocols
 */
export function isUrlSafe(url: string): UrlValidationResult {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Only allow HTTP and HTTPS protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return {
        safe: false,
        reason: `Protocol ${parsed.protocol} not allowed. Only HTTP/HTTPS permitted.`
      };
    }

    // Block localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') {
      return {
        safe: false,
        reason: 'Localhost access blocked for security'
      };
    }

    // Block direct IPs that are private or special-use
    const ipCheck = checkIpSafety(hostname);
    if (!ipCheck.safe) {
      return {
        safe: false,
        reason: ipCheck.reason
      };
    }

    // Block link-local addresses
    if (/^169\.254\./.test(hostname)) {
      return {
        safe: false,
        reason: 'Link-local address (169.254.x.x) blocked - potential cloud metadata access'
      };
    }

    // Block loopback IP range
    if (/^127\./.test(hostname)) {
      return {
        safe: false,
        reason: 'Loopback IP address blocked'
      };
    }

    // Block IPv6 private ranges
    if (hostname.startsWith('fd') || hostname.startsWith('fc')) {
      return {
        safe: false,
        reason: 'Private IPv6 address blocked'
      };
    }

    // Block common cloud metadata endpoints (prevent credential theft)
    const dangerousHosts = [
      'metadata.google.internal',
      'metadata',
      '169.254.169.254',  // AWS, Azure, GCP metadata
    ];

    if (dangerousHosts.includes(hostname)) {
      return {
        safe: false,
        reason: 'Cloud metadata endpoint blocked'
      };
    }

    return { safe: true };

  } catch (error) {
    return {
      safe: false,
      reason: `Invalid URL: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Resolve DNS and block if hostname resolves to private/special IPs.
 */
export async function isUrlSafeWithDns(url: string): Promise<UrlValidationResult> {
  const basic = isUrlSafe(url);
  if (!basic.safe) return basic;

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Only resolve if hostname is not already an IP literal
    if (isIpLiteral(hostname)) {
      return { safe: true };
    }

    const results = await lookup(hostname, { all: true });

    for (const result of results) {
      const ipCheck = checkIpSafety(result.address);
      if (!ipCheck.safe) {
        return {
          safe: false,
          reason: `Hostname resolves to blocked IP (${result.address}): ${ipCheck.reason}`
        };
      }
    }

    return { safe: true };
  } catch (error) {
    return {
      safe: false,
      reason: `DNS resolution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

function isIpLiteral(hostname: string): boolean {
  if (hostname.startsWith('[') && hostname.endsWith(']')) return true;
  return net.isIP(hostname) !== 0;
}

function checkIpSafety(input: string): IpCheckResult {
  const hostname = input.replace(/^\[|\]$/g, '').toLowerCase();
  const ipVersion = net.isIP(hostname);
  if (!ipVersion) {
    return { safe: true };
  }

  const ip = normalizeIp(hostname);
  if (!ip) {
    return { safe: false, reason: 'Invalid IP address' };
  }

  if (ipVersion === 4) {
    if (isPrivateIPv4(ip)) {
      return { safe: false, reason: 'Private or special IPv4 address blocked' };
    }
    return { safe: true };
  }

  if (isPrivateIPv6(ip)) {
    return { safe: false, reason: 'Private or special IPv6 address blocked' };
  }

  return { safe: true };
}

function normalizeIp(ip: string): string | null {
  if (ip.startsWith('::ffff:')) {
    return ip.replace('::ffff:', '');
  }
  return ip;
}

function isPrivateIPv4(ip: string): boolean {
  if (ip === '0.0.0.0') return true;
  if (ip.startsWith('127.')) return true;
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) return true;
  if (ip.startsWith('169.254.')) return true; // link-local
  if (ip.startsWith('100.64.')) return true; // carrier-grade NAT
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::' || lower === '::1') return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local
  if (lower.startsWith('fe80')) return true; // link-local
  if (lower.startsWith('::ffff:')) return isPrivateIPv4(lower.replace('::ffff:', ''));
  return false;
}

/**
 * Validate multiple URLs and return only safe ones
 */
export function filterSafeUrls(urls: string[]): string[] {
  return urls.filter(url => {
    const result = isUrlSafe(url);
    if (!result.safe) {
      console.warn(`[Security] Blocked unsafe URL: ${url} - ${result.reason}`);
    }
    return result.safe;
  });
}
