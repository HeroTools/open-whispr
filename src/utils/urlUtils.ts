/**
 * Check if a URL points to a local or private network address.
 * These addresses are safe to access over HTTP since they don't traverse the public internet.
 *
 * Includes:
 * - localhost / 127.x.x.x (loopback)
 * - 10.x.x.x (Class A private)
 * - 172.16.x.x - 172.31.x.x (Class B private)
 * - 192.168.x.x (Class C private)
 */
export function isLocalNetworkUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Localhost variations
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return true;
    }

    // Check for 127.x.x.x loopback range
    if (hostname.startsWith("127.")) {
      return true;
    }

    // Check for private IP ranges
    // 10.x.x.x
    if (hostname.startsWith("10.")) {
      return true;
    }

    // 192.168.x.x
    if (hostname.startsWith("192.168.")) {
      return true;
    }

    // 172.16.x.x - 172.31.x.x
    if (hostname.startsWith("172.")) {
      const parts = hostname.split(".");
      if (parts.length >= 2) {
        const secondOctet = parseInt(parts[1], 10);
        if (secondOctet >= 16 && secondOctet <= 31) {
          return true;
        }
      }
    }

    return false;
  } catch {
    return false;
  }
}
