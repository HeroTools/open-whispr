import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "./useAuth";
import { CACHE_CONFIG } from "../config/constants";
import { withSessionRefresh } from "../lib/neonAuth";
import type { ReferralItem } from "../types/electron";

interface ReferralData {
  referralCode: string;
  referralLink: string;
  totalReferrals: number;
  completedReferrals: number;
  pendingReferrals: number;
  totalMonthsEarned: number;
  referrals: ReferralItem[];
}

export interface UseReferralsResult {
  referralCode: string;
  referralLink: string;
  totalReferrals: number;
  completedReferrals: number;
  pendingReferrals: number;
  totalMonthsEarned: number;
  referrals: ReferralItem[];
  isLoading: boolean;
  hasLoaded: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  sendInvite: (email: string) => Promise<{ success: boolean; error?: string }>;
}

const REFERRAL_CACHE_TTL = CACHE_CONFIG.API_KEY_TTL;

export function useReferrals(): UseReferralsResult | null {
  const { isSignedIn, isLoaded } = useAuth();
  const [data, setData] = useState<ReferralData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFetchRef = useRef<number>(0);

  const fetchStats = useCallback(async () => {
    if (!window.electronAPI?.getReferralStats) return;

    setIsLoading(true);
    setError(null);

    try {
      await withSessionRefresh(async () => {
        const result = await window.electronAPI.getReferralStats!();
        setData({
          referralCode: result.referralCode ?? "",
          referralLink: result.referralLink ?? "",
          totalReferrals: result.totalReferrals ?? 0,
          completedReferrals: result.completedReferrals ?? 0,
          pendingReferrals: result.pendingReferrals ?? 0,
          totalMonthsEarned: result.totalMonthsEarned ?? 0,
          referrals: result.referrals ?? [],
        });
        lastFetchRef.current = Date.now();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch referral stats");
    } finally {
      setIsLoading(false);
      setHasLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    const shouldFetch = Date.now() - lastFetchRef.current > REFERRAL_CACHE_TTL;
    if (shouldFetch) {
      fetchStats();
    } else {
      setIsLoading(false);
      setHasLoaded(true);
    }
  }, [isLoaded, isSignedIn, fetchStats]);

  const sendInvite = useCallback(
    async (email: string): Promise<{ success: boolean; error?: string }> => {
      if (!window.electronAPI?.sendReferralInvite) {
        return { success: false, error: "App not ready" };
      }

      try {
        await withSessionRefresh(async () => {
          await window.electronAPI.sendReferralInvite!(email);
        });
        await fetchStats();
        return { success: true };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : "Failed to send invite",
        };
      }
    },
    [fetchStats]
  );

  if (!isSignedIn) return null;

  return {
    referralCode: data?.referralCode ?? "",
    referralLink: data?.referralLink ?? "",
    totalReferrals: data?.totalReferrals ?? 0,
    completedReferrals: data?.completedReferrals ?? 0,
    pendingReferrals: data?.pendingReferrals ?? 0,
    totalMonthsEarned: data?.totalMonthsEarned ?? 0,
    referrals: data?.referrals ?? [],
    isLoading,
    hasLoaded,
    error,
    refetch: fetchStats,
    sendInvite,
  };
}
