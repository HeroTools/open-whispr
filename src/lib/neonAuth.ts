import { createAuthClient } from "@neondatabase/neon-js/auth";
import { BetterAuthReactAdapter } from "@neondatabase/neon-js/auth/react/adapters";

export const NEON_AUTH_URL = import.meta.env.VITE_NEON_AUTH_URL || "";
export const authClient = NEON_AUTH_URL
  ? createAuthClient(NEON_AUTH_URL, { adapter: BetterAuthReactAdapter() })
  : null;

export type SocialProvider = "google" | "github";

export async function signInWithSocial(provider: SocialProvider): Promise<{ error?: Error }> {
  if (!authClient) {
    return { error: new Error("Auth not configured") };
  }

  try {
    // For Electron/Vite dev, use the current origin (localhost)
    // The callback URL is where the user returns after OAuth
    const callbackURL = window.location.origin;

    await authClient.signIn.social({
      provider,
      callbackURL,
    });

    return {};
  } catch (error) {
    return { error: error instanceof Error ? error : new Error("Social sign-in failed") };
  }
}
