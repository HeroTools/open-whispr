import { useState, useEffect } from "react";
import type { GpuStatusResult } from "../types/electron";

export function useGpuStatus() {
  const [gpuStatus, setGpuStatus] = useState<GpuStatusResult | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshStatus = async () => {
    if (typeof window !== "undefined" && window.electronAPI?.getGpuStatus) {
      try {
        const status = await window.electronAPI.getGpuStatus();
        setGpuStatus(status);
      } catch (err) {
        console.error("Failed to get GPU status:", err);
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshStatus();
  }, []);

  return {
    gpuStatus,
    loading,
    refreshStatus,
  };
}
