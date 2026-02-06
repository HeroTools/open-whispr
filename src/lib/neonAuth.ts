import { createAuthClient } from "@neondatabase/auth";
import { BetterAuthReactAdapter } from "@neondatabase/auth/react";

export const NEON_AUTH_URL = import.meta.env.VITE_NEON_AUTH_URL || "";
export const authClient = NEON_AUTH_URL
  ? createAuthClient(NEON_AUTH_URL, { adapter: BetterAuthReactAdapter() })
  : null;

export type SocialProvider = "google";

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
  } catch (err) {
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
    localStorage.setItem("isSignedIn", "false");
  } catch (err) {
    // Fallback: at minimum clear local storage
    localStorage.setItem("isSignedIn", "false");
  }
}

/**
 * Utility to wrap API calls that may fail due to expired session.
 * Automatically attempts to refresh the session and retry once on AUTH_EXPIRED.
 * Signs out the user if refresh fails.
 *
 * @param operation - The async operation to perform
 * @returns The result of the operation
 */
export async function withSessionRefresh<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    // Check if this is an auth expiration error
    const isAuthExpired =
      error?.code === "AUTH_EXPIRED" ||
      error?.message?.toLowerCase().includes("session expired") ||
      error?.message?.toLowerCase().includes("auth expired");

    if (isAuthExpired) {
      // Attempt to refresh the session
      const refreshed = await refreshSession();

      if (refreshed) {
        // Retry the operation with refreshed session
        return await operation();
      }

      // Refresh failed - sign out to clear stale session
      await signOut();
    }

    // Re-throw the original error
    throw error;
  }
}

export async function signInWithSocial(provider: SocialProvider): Promise<{ error?: Error }> {
  if (!authClient) {
    return { error: new Error("Auth not configured") };
  }

  try {
    // Build an absolute callback URL. Neon Auth redirects here after OAuth.
    // In the browser, this page detects it's outside Electron and redirects
    // to the openwhispr:// protocol to hand the verifier back to the app.
    const base = window.location.href.split("?")[0].split("#")[0];
    const callbackURL = `${base}?panel=true`;

    await authClient.signIn.social({
      provider,
      callbackURL,
      newUserCallbackURL: callbackURL,
    });

    return {};
  } catch (error) {
    return { error: error instanceof Error ? error : new Error("Social sign-in failed") };
  }
}
