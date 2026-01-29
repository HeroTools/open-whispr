import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "./useAuth";
import { CACHE_CONFIG } from "../config/constants";
import { refreshSession } from "../lib/neonAuth";

interface UsageData {
  wordsUsed: number;
  wordsRemaining: number;
  limit: number;
  plan: string;
  isSubscribed: boolean;
  resetAt: string;
}

interface UseUsageResult {
  plan: string;
  wordsUsed: number;
  wordsRemaining: number;
  limit: number;
  isSubscribed: boolean;
  isOverLimit: boolean;
  isApproachingLimit: boolean;
  resetAt: string | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const USAGE_CACHE_TTL = CACHE_CONFIG.API_KEY_TTL; // 1 hour

export function useUsage(): UseUsageResult | null {
  const { isSignedIn, isLoaded } = useAuth();
  const [data, setData] = useState<UsageData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFetchRef = useRef<number>(0);

  const fetchUsage = useCallback(async (isRetry = false) => {
    if (!window.electronAPI?.cloudUsage) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI.cloudUsage();
      if (result.success) {
        setData({
          wordsUsed: result.wordsUsed,
          wordsRemaining: result.wordsRemaining,
          limit: result.limit,
          plan: result.plan,
          isSubscribed: result.isSubscribed,
          resetAt: result.resetAt,
        });
        lastFetchRef.current = Date.now();
      } else if (result.code === "AUTH_EXPIRED" && !isRetry) {
        // Try refreshing the session and retry once
        const refreshed = await refreshSession();
        if (refreshed) {
          return fetchUsage(true);
        }
        localStorage.setItem("isSignedIn", "false");
        setError(result.error || "Session expired");
      } else {
        setError(result.error || "Failed to fetch usage");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch usage");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount when signed in, with TTL caching
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    const shouldFetch = Date.now() - lastFetchRef.current > USAGE_CACHE_TTL;
    if (shouldFetch) {
      fetchUsage();
    }
  }, [isLoaded, isSignedIn, fetchUsage]);

  // Return null when not signed in
  if (!isSignedIn) return null;

  const wordsUsed = data?.wordsUsed ?? 0;
  const limit = data?.limit ?? 2000;
  const isSubscribed = data?.isSubscribed ?? false;
  const isOverLimit = !isSubscribed && limit > 0 && wordsUsed >= limit;
  const isApproachingLimit = !isSubscribed && limit > 0 && wordsUsed >= limit * 0.8 && !isOverLimit;

  return {
    plan: data?.plan ?? "free",
    wordsUsed,
    wordsRemaining: data?.wordsRemaining ?? (limit > 0 ? limit - wordsUsed : -1),
    limit,
    isSubscribed,
    isOverLimit,
    isApproachingLimit,
    resetAt: data?.resetAt ?? null,
    isLoading,
    error,
    refetch: fetchUsage,
  };
}
