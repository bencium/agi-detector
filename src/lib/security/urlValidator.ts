/**
 * URL Security Validator
 * Prevents SSRF (Server-Side Request Forgery) attacks by validating URLs
 * before allowing the crawler to access them.
 */

export interface UrlValidationResult {
  safe: boolean;
  reason?: string;
}

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

    // Block private IPv4 ranges (RFC 1918)
    const privateIPv4Ranges = [
      /^10\./,                          // 10.0.0.0/8
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,  // 172.16.0.0/12
      /^192\.168\./,                    // 192.168.0.0/16
    ];

    if (privateIPv4Ranges.some(range => range.test(hostname))) {
      return {
        safe: false,
        reason: 'Private IP address access blocked'
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
