import { useEffect, useRef } from "react";
import { authClient, isWithinGracePeriod } from "../lib/neonAuth";
import logger from "../utils/logger";

const useStaticSession = () => ({
  data: null,
  isPending: false,
  error: null,
  refetch: async () => null,
});

export function useAuth() {
  const useSession = authClient?.useSession ?? useStaticSession;
  const { data: session, isPending } = useSession();
  const user = session?.user ?? null;
  const rawIsSignedIn = Boolean(user);
  const gracePeriodActive = isWithinGracePeriod();

  // CRITICAL: During the grace period after OAuth, session cookies may not
  // be fully established yet. The Neon Auth SDK's useSession hook can return
  // null during this time, but we should NOT report signed out to the UI.
  // Instead, we keep reporting signed in and let withSessionRefresh handle retries.
  const isSignedIn = rawIsSignedIn || gracePeriodActive;

  // Track last synced state to prevent duplicate syncs
  const lastSyncedStateRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!isPending && lastSyncedStateRef.current !== isSignedIn) {
      logger.debug("Auth state sync", { isSignedIn, rawIsSignedIn, gracePeriod: gracePeriodActive }, "auth");
      localStorage.setItem("isSignedIn", String(isSignedIn));
      lastSyncedStateRef.current = isSignedIn;
    }
  }, [isSignedIn, rawIsSignedIn, gracePeriodActive, isPending]);

  return {
    isSignedIn,
    isLoaded: !isPending,
    session,
    user,
  };
}
