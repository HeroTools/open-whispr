import { useEffect, useRef } from "react";
import { authClient } from "../lib/neonAuth";
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
  const isSignedIn = Boolean(user);

  // Track last synced state to prevent duplicate syncs
  const lastSyncedStateRef = useRef<boolean | null>(null);
  const warmupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isPending && lastSyncedStateRef.current !== isSignedIn) {
      logger.debug("Auth state sync", { isSignedIn }, "auth");
      localStorage.setItem("isSignedIn", String(isSignedIn));
      lastSyncedStateRef.current = isSignedIn;

      // Clear any pending warmup
      if (warmupTimeoutRef.current) {
        clearTimeout(warmupTimeoutRef.current);
        warmupTimeoutRef.current = null;
      }

      // Only warm up streaming when signing in, not on every state change
      // Delay warmup to ensure session cookies are fully established after OAuth
      if (isSignedIn) {
        warmupTimeoutRef.current = setTimeout(() => {
          window.electronAPI
            ?.assemblyAiStreamingWarmup?.({
              sampleRate: 16000,
            })
            .then((result: { success: boolean; error?: string; code?: string }) => {
              if (result?.success) {
                logger.debug("AssemblyAI connection pre-warmed on auth", {}, "streaming");
              } else if (result?.code === "AUTH_EXPIRED") {
                // Session will be refreshed automatically on first actual use via withSessionRefresh
                logger.debug(
                  "Session expired during warmup, will refresh on first use",
                  {},
                  "auth"
                );
              }
            })
            .catch(() => {
              // Non-fatal - warmup can fail if not in streaming mode
            });
        }, 1000); // Delay to allow session to stabilize after OAuth redirect
      }
    }

    return () => {
      if (warmupTimeoutRef.current) {
        clearTimeout(warmupTimeoutRef.current);
      }
    };
  }, [isSignedIn, isPending]);

  return {
    isSignedIn,
    isLoaded: !isPending,
    session,
    user,
  };
}
