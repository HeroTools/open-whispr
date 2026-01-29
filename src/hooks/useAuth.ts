import { useEffect } from "react";
import { authClient } from "../lib/neonAuth";

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

  // Sync auth state to localStorage so vanilla JS modules (audioManager, etc.) can read it
  useEffect(() => {
    if (!isPending) {
      localStorage.setItem("isSignedIn", String(isSignedIn));
    }
  }, [isSignedIn, isPending]);

  return {
    isSignedIn,
    isLoaded: !isPending,
    session,
    user,
  };
}
