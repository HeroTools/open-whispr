import { createAuthClient } from "@neondatabase/auth";
import { BetterAuthReactAdapter } from "@neondatabase/auth/react";
import { OPENWHISPR_API_URL } from "../config/constants";
import { openExternalLink } from "../utils/externalLinks";

export const NEON_AUTH_URL = import.meta.env.VITE_NEON_AUTH_URL || "";
export const authClient = NEON_AUTH_URL
  ? createAuthClient(NEON_AUTH_URL, { adapter: BetterAuthReactAdapter() })
  : null;

export type SocialProvider = "google";

const LAST_SIGN_IN_STORAGE_KEY = "openwhispr:lastSignInTime";
const GRACE_PERIOD_MS = 60_000;
const GRACE_RETRY_COUNT = 6;
const INITIAL_GRACE_RETRY_DELAY_MS = 500;

let lastSignInTime: number | null = null;

function getLocalStorageSafe(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function loadLastSignInTimeFromStorage(): number | null {
  const storage = getLocalStorageSafe();
  if (!storage) return null;

  const raw = storage.getItem(LAST_SIGN_IN_STORAGE_KEY);
  if (!raw) return null;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    storage.removeItem(LAST_SIGN_IN_STORAGE_KEY);
    return null;
  }

  return parsed;
}

function persistLastSignInTime(value: number | null): void {
  const storage = getLocalStorageSafe();
  if (!storage) return;

  if (value === null) {
    storage.removeItem(LAST_SIGN_IN_STORAGE_KEY);
  } else {
    storage.setItem(LAST_SIGN_IN_STORAGE_KEY, String(value));
  }
}

function getLastSignInTime(): number | null {
  const stored = loadLastSignInTimeFromStorage();
  if (stored !== null) {
    lastSignInTime = stored;
  }
  return lastSignInTime;
}

function createAuthExpiredError(originalError: unknown): Error {
  if (originalError instanceof Error) {
    (originalError as Error & { code?: string }).code = "AUTH_EXPIRED";
    return originalError;
  }

  const error = new Error("Session expired");
  (error as Error & { code?: string }).code = "AUTH_EXPIRED";
  return error;
}

export function clearLastSignInTime(): void {
  lastSignInTime = null;
  persistLastSignInTime(null);
}

function markSignedOutState(): void {
  const storage = getLocalStorageSafe();
  storage?.setItem("isSignedIn", "false");
  clearLastSignInTime();
}

/**
 * Updates the last sign-in timestamp. Call this after successful OAuth.
 */
export function updateLastSignInTime(): void {
  const now = Date.now();
  lastSignInTime = now;
  persistLastSignInTime(now);
}

/**
 * Check if we're within the grace period after sign-in.
 * Exported so useAuth can also suppress premature sign-outs.
 */
export function isWithinGracePeriod(): boolean {
  const startedAt = getLastSignInTime();
  if (!startedAt) return false;

  const elapsed = Math.max(0, Date.now() - startedAt);
  return elapsed < GRACE_PERIOD_MS;
}

/**
 * Attempts to refresh the current session by calling getSession().
 * The Neon Auth SDK automatically refreshes expired tokens when this is called.
 * Returns true if a valid session exists after refresh, false otherwise.
 */
export async function refreshSession(): Promise<boolean> {
  if (!authClient) {
    return false;
  }

  try {
    const result = await authClient.getSession();
    return Boolean(result.data?.session?.user);
  } catch {
    return false;
  }
}

/**
 * Signs out the user and clears all session cookies.
 * This is useful when session refresh fails and we need to fully clear the stale session.
 */
export async function signOut(): Promise<void> {
  try {
    // Clear session cookies via IPC
    if (window.electronAPI?.authClearSession) {
      await window.electronAPI.authClearSession();
    }

    // Sign out via auth client if available
    if (authClient) {
      await authClient.signOut();
    }

    // Clear local storage
    markSignedOutState();
  } catch {
    // Fallback: at minimum clear local storage
    markSignedOutState();
  }
}

/**
 * Utility to wrap API calls that may fail due to expired session.
 * Automatically retries AUTH_EXPIRED calls during OAuth grace, then attempts a
 * single session refresh before surfacing the auth error to the caller.
 *
 * During the grace period, retries the operation with exponential backoff to wait
 * for session cookies to establish.
 *
 * @param operation - The async operation to perform
 * @returns The result of the operation
 */
export async function withSessionRefresh<T>(operation: () => Promise<T>): Promise<T> {
  const startedInGracePeriod = isWithinGracePeriod();
  let graceRetriesUsed = 0;
  let refreshAttempted = false;

  while (true) {
    try {
      return await operation();
    } catch (error: any) {
      const isAuthExpired =
        error?.code === "AUTH_EXPIRED" ||
        error?.message?.toLowerCase().includes("session expired") ||
        error?.message?.toLowerCase().includes("auth expired");

      if (!isAuthExpired) {
        throw error;
      }

      if (startedInGracePeriod && graceRetriesUsed < GRACE_RETRY_COUNT) {
        const delayMs = INITIAL_GRACE_RETRY_DELAY_MS * Math.pow(2, graceRetriesUsed);
        graceRetriesUsed += 1;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      if (!refreshAttempted) {
        refreshAttempted = true;
        const refreshed = await refreshSession();
        if (refreshed) {
          continue;
        }
      }

      markSignedOutState();
      throw createAuthExpiredError(error);
    }
  }
}

function getElectronOAuthCallbackURL(): string {
  const configuredUrl = (import.meta.env.VITE_OPENWHISPR_OAUTH_CALLBACK_URL || "").trim();
  if (configuredUrl) return configuredUrl;

  if (window.location.protocol !== "file:") return `${window.location.origin}/?panel=true`;

  const port = import.meta.env.VITE_DEV_SERVER_PORT || "5183";
  return `http://localhost:${port}/?panel=true`;
}

export async function signInWithSocial(provider: SocialProvider): Promise<{ error?: Error }> {
  if (!authClient) {
    return { error: new Error("Auth not configured") };
  }

  try {
    const isElectron = Boolean((window as any).electronAPI);

    if (isElectron) {
      const callbackURL = getElectronOAuthCallbackURL();

      const response = await fetch(`${NEON_AUTH_URL}/api/auth/sign-in/social`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ provider, callbackURL, disableRedirect: true }),
      });

      const data = await response.json();
      if (!data.url) return { error: new Error("Failed to get OAuth URL") };

      openExternalLink(data.url);
      return {};
    }

    const callbackURL = `${window.location.href.split("?")[0].split("#")[0]}?panel=true`;
    await authClient.signIn.social({ provider, callbackURL, newUserCallbackURL: callbackURL });
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error : new Error("Social sign-in failed") };
  }
}

/**
 * Requests a password reset email. Routes through the API proxy when available,
 * falls back to direct Neon Auth for web environments.
 */
export async function requestPasswordReset(email: string): Promise<{ error?: Error }> {
  if (!authClient) {
    return { error: new Error("Auth not configured") };
  }

  try {
    if (OPENWHISPR_API_URL) {
      const res = await fetch(`${OPENWHISPR_API_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to send reset email");
      }

      return {};
    }

    // Fallback: direct Neon Auth (web environments with proper URLs)
    const base = window.location.href.split("?")[0].split("#")[0];
    const redirectTo = `${base}?panel=true&reset_password=true`;

    await authClient.requestPasswordReset({
      email: email.trim(),
      redirectTo,
    });

    return {};
  } catch (error) {
    return { error: error instanceof Error ? error : new Error("Failed to send reset email") };
  }
}

/**
 * Resets the user's password using the token from the reset email.
 * After successful reset, the user is automatically signed in.
 */
export async function resetPassword(
  newPassword: string,
  token: string
): Promise<{ error?: Error }> {
  if (!authClient) {
    return { error: new Error("Auth not configured") };
  }

  try {
    await authClient.resetPassword({
      newPassword,
      token,
    });

    // Mark sign-in time for grace period after password reset
    updateLastSignInTime();

    return {};
  } catch (error) {
    return { error: error instanceof Error ? error : new Error("Failed to reset password") };
  }
}
