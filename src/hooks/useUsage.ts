import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "./useAuth";
import { CACHE_CONFIG } from "../config/constants";
import { withSessionRefresh } from "../lib/neonAuth";

interface UsageData {
  wordsUsed: number;
  wordsRemaining: number;
  limit: number;
  plan: string;
  isSubscribed: boolean;
  isTrial: boolean;
  trialDaysLeft: number | null;
  currentPeriodEnd: string | null;
  resetAt: string;
}

interface UseUsageResult {
  plan: string;
  wordsUsed: number;
  wordsRemaining: number;
  limit: number;
  isSubscribed: boolean;
  isTrial: boolean;
  trialDaysLeft: number | null;
  currentPeriodEnd: string | null;
  isOverLimit: boolean;
  isApproachingLimit: boolean;
  resetAt: string | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  openCheckout: () => Promise<void>;
  openBillingPortal: () => Promise<void>;
}

const USAGE_CACHE_TTL = CACHE_CONFIG.API_KEY_TTL; // 1 hour

export function useUsage(): UseUsageResult | null {
  const { isSignedIn, isLoaded } = useAuth();
  const [data, setData] = useState<UsageData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFetchRef = useRef<number>(0);

  const fetchUsage = useCallback(async () => {
    if (!window.electronAPI?.cloudUsage) return;

    setIsLoading(true);
    setError(null);

    try {
      // Use withSessionRefresh to handle AUTH_EXPIRED automatically
      await withSessionRefresh(async () => {
        const result = await window.electronAPI.cloudUsage();
        if (result.success) {
          setData({
            wordsUsed: result.wordsUsed ?? 0,
            wordsRemaining: result.wordsRemaining ?? 0,
            limit: result.limit ?? 2000,
            plan: result.plan ?? "free",
            isSubscribed: result.isSubscribed ?? false,
            isTrial: result.isTrial ?? false,
            trialDaysLeft: result.trialDaysLeft ?? null,
            currentPeriodEnd: result.currentPeriodEnd ?? null,
            resetAt: result.resetAt ?? "rolling",
          });
          lastFetchRef.current = Date.now();
        } else {
          // Throw error to trigger withSessionRefresh retry logic if needed
          const error: any = new Error(result.error || "Failed to fetch usage");
          error.code = result.code;
          throw error;
        }
      });
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

  const openCheckout = useCallback(async () => {
    if (!window.electronAPI?.cloudCheckout || !window.electronAPI?.openExternal) return;
    const result = await window.electronAPI.cloudCheckout();
    if (result.success && result.url) {
      await window.electronAPI.openExternal(result.url);
    }
  }, []);

  const openBillingPortal = useCallback(async () => {
    if (!window.electronAPI?.cloudBillingPortal || !window.electronAPI?.openExternal) return;
    const result = await window.electronAPI.cloudBillingPortal();
    if (result.success && result.url) {
      await window.electronAPI.openExternal(result.url);
    }
  }, []);

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
    isTrial: data?.isTrial ?? false,
    trialDaysLeft: data?.trialDaysLeft ?? null,
    currentPeriodEnd: data?.currentPeriodEnd ?? null,
    isOverLimit,
    isApproachingLimit,
    resetAt: data?.resetAt ?? null,
    isLoading,
    error,
    refetch: fetchUsage,
    openCheckout,
    openBillingPortal,
  };
}
