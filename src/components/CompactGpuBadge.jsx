import { useEffect, useState } from "react";
import { Zap, Cpu } from "lucide-react";

export function CompactGpuBadge() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const fetchStatus = async () => {
      if (window.electronAPI?.getGpuStatus) {
        try {
          const gpuStatus = await window.electronAPI.getGpuStatus();
          setStatus(gpuStatus);
        } catch (err) {
          console.error("Failed to get GPU status:", err);
        }
      }
    };

    fetchStatus();

    // Refresh every 30 seconds (less frequent than the settings page)
    const interval = setInterval(fetchStatus, 30000);

    return () => clearInterval(interval);
  }, []);

  if (!status) return null;

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-black/20 rounded-md text-xs">
      {status.usingCuda ? (
        <>
          <Zap className="h-3 w-3 text-yellow-400" />
          <span className="text-white/90 font-medium">CUDA</span>
        </>
      ) : (
        <>
          <Cpu className="h-3 w-3 text-blue-400" />
          <span className="text-white/70">CPU</span>
        </>
      )}
    </div>
  );
}
