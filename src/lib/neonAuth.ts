import { createAuthClient } from "@neondatabase/neon-js/auth";
import { BetterAuthReactAdapter } from "@neondatabase/neon-js/auth/react/adapters";

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
  } catch {
    return false;
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
