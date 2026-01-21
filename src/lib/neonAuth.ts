import { createAuthClient } from "@neondatabase/neon-js/auth";
import { BetterAuthReactAdapter } from "@neondatabase/neon-js/auth/react/adapters";

export const NEON_AUTH_URL = import.meta.env.VITE_NEON_AUTH_URL || "";
export const authClient = NEON_AUTH_URL
  ? createAuthClient(NEON_AUTH_URL, { adapter: BetterAuthReactAdapter() })
  : null;
