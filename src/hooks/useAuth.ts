import { useEffect } from "react";
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

  useEffect(() => {
    if (!isPending) {
      logger.debug("Auth state sync", { isSignedIn }, "auth");
      localStorage.setItem("isSignedIn", String(isSignedIn));

      if (isSignedIn) {
        window.electronAPI
          ?.assemblyAiStreamingWarmup?.({
            sampleRate: 16000,
          })
          .then((result: { success: boolean; error?: string }) => {
            if (result?.success) {
              logger.debug("AssemblyAI connection pre-warmed on auth", {}, "streaming");
            }
          })
          .catch(() => {
            // Non-fatal - warmup can fail if not in streaming mode
          });
      }
    }
  }, [isSignedIn, isPending]);

  return {
    isSignedIn,
    isLoaded: !isPending,
    session,
    user,
  };
}
