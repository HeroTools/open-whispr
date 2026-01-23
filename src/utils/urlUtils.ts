/**
 * URL security and normalization utilities
 * - Allows HTTP for private networks, requires HTTPS otherwise
 * - Normalizes URLs (trailing slashes, protocol upgrades)
 * - Detects known API providers from base URLs
 */

import modelRegistryData from "../models/modelRegistryData.json";

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

  // Link-local IPv4
  if (h.startsWith("169.254.")) return true;

  // IPv6 addresses contain colons - check before matching prefixes
  const isIPv6 = h.includes(":");

  // Link-local IPv6 (fe80::/10)
  if (isIPv6 && h.startsWith("fe80")) return true;

  // IPv6 unique local (fc00::/7)
  if (isIPv6 && (h.startsWith("fc") || h.startsWith("fd"))) return true;

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

/**
 * Normalizes a base URL for API endpoints:
 * - Trims whitespace
 * - Removes trailing slashes
 * - Upgrades http:// to https:// for public endpoints
 * - Returns empty string if invalid or insecure
 */
export function normalizeBaseUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";

  try {
    const parsed = new URL(trimmed);

    // Upgrade to HTTPS for public endpoints
    if (parsed.protocol === "http:" && !isPrivateHost(parsed.hostname)) {
      parsed.protocol = "https:";
    }

    // Remove trailing slash from pathname
    let pathname = parsed.pathname;
    if (pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    }
    parsed.pathname = pathname;

    const normalized = parsed.toString();

    // Validate security
    if (!isSecureEndpoint(normalized)) {
      return "";
    }

    return normalized;
  } catch {
    return "";
  }
}

/**
 * Detects which known transcription provider matches the given base URL.
 * Returns the provider ID if matched, or null if it's truly custom.
 */
export function detectTranscriptionProvider(baseUrl: string): string | null {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) return null;

  const providers = modelRegistryData.transcriptionProviders || [];

  for (const provider of providers) {
    const providerNormalized = normalizeBaseUrl(provider.baseUrl);
    if (normalized === providerNormalized) {
      return provider.id;
    }
  }

  return null;
}

/**
 * Validates and resolves transcription provider settings.
 * Returns { provider, baseUrl, isValid } with normalized values.
 *
 * @param inputUrl - User-provided base URL
 * @param currentProvider - Currently selected provider ID
 * @returns Validated settings with provider detection
 */
export function validateTranscriptionSettings(
  inputUrl: string,
  currentProvider: string = "openai"
) {
  const normalized = normalizeBaseUrl(inputUrl);

  // Empty URL - use default OpenAI
  if (!normalized) {
    const defaultProvider = modelRegistryData.transcriptionProviders.find((p) => p.id === "openai");
    return {
      provider: "openai",
      baseUrl: defaultProvider?.baseUrl || "https://api.openai.com/v1",
      isValid: true,
      isDefault: true,
    };
  }

  // Try to detect known provider
  const detectedProvider = detectTranscriptionProvider(normalized);

  if (detectedProvider) {
    const provider = modelRegistryData.transcriptionProviders.find(
      (p) => p.id === detectedProvider
    );
    return {
      provider: detectedProvider,
      baseUrl: normalized,
      isValid: true,
      isDefault: detectedProvider === "openai",
    };
  }

  // Truly custom URL - validated and normalized
  return {
    provider: "custom",
    baseUrl: normalized,
    isValid: true,
    isDefault: false,
  };
}
