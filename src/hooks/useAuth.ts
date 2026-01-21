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

  return {
    isSignedIn: Boolean(user),
    isLoaded: !isPending,
    session,
    user,
  };
}
