/**
 * URL security utilities for validating API endpoints.
 *
 * Allows HTTP for local/private networks (RFC 1918 + RFC 4193) since traffic
 * doesn't traverse the public internet. Requires HTTPS for all other endpoints.
 */

/**
 * Check if a hostname is a private/local network address.
 * These are safe to access over HTTP since they stay on the local network.
 *
 * Covers:
 * - localhost, 127.x.x.x (IPv4 loopback)
 * - ::1 (IPv6 loopback)
 * - 10.x.x.x (Class A private)
 * - 172.16-31.x.x (Class B private)
 * - 192.168.x.x (Class C private)
 * - fc/fd prefixes (IPv6 unique local)
 * - fe80:: (IPv6 link-local)
 */
export function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();

  // IPv4/IPv6 localhost
  if (h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "[::1]") {
    return true;
  }

  // 127.x.x.x loopback range
  if (h.startsWith("127.")) {
    return true;
  }

  // 10.x.x.x (Class A private)
  if (h.startsWith("10.")) {
    return true;
  }

  // 192.168.x.x (Class C private)
  if (h.startsWith("192.168.")) {
    return true;
  }

  // 172.16.x.x - 172.31.x.x (Class B private)
  if (h.startsWith("172.")) {
    const octet = parseInt(h.split(".")[1], 10);
    if (octet >= 16 && octet <= 31) {
      return true;
    }
  }

  // IPv6 unique local (fc00::/7) and link-local (fe80::/10)
  const ipv6 = h.replace(/^\[|\]$/g, ""); // Strip brackets if present
  if (ipv6.startsWith("fc") || ipv6.startsWith("fd") || ipv6.startsWith("fe80")) {
    return true;
  }

  return false;
}

/**
 * Check if a URL points to a local/private network.
 * Convenience wrapper that parses the URL and checks the hostname.
 */
export function isLocalNetworkUrl(url: string): boolean {
  try {
    return isPrivateHost(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * Check if a URL is safe for sending credentials (HTTPS or private network).
 * Use this to validate custom API endpoints before making requests.
 */
export function isSecureEndpoint(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || isPrivateHost(parsed.hostname);
  } catch {
    return false;
  }
}
