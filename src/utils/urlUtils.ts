/**
 * URL security utilities - allows HTTP for private networks, requires HTTPS otherwise.
 */

function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");

  // Loopback
  if (h === "localhost" || h === "0.0.0.0" || h.startsWith("127.")) return true;

  // IPv6 loopback
  if (h === "::1") return true;

  // RFC 1918 private ranges
  if (h.startsWith("10.")) return true;
  if (h.startsWith("192.168.")) return true;
  if (h.startsWith("172.")) {
    const octet = parseInt(h.split(".")[1], 10);
    if (octet >= 16 && octet <= 31) return true;
  }

  // Link-local (169.254.x.x IPv4, fe80:: IPv6)
  if (h.startsWith("169.254.")) return true;
  if (h.startsWith("fe80")) return true;

  // IPv6 unique local (fc00::/7)
  if (h.startsWith("fc") || h.startsWith("fd")) return true;

  // mDNS/Bonjour (.local domains)
  if (h.endsWith(".local")) return true;

  return false;
}

/** Returns true if URL is HTTPS or targets a private/local network. */
export function isSecureEndpoint(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || isPrivateHost(parsed.hostname);
  } catch {
    return false;
  }
}
