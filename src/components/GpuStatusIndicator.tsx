import { useEffect } from "react";
import { useGpuStatus } from "../hooks/useGpuStatus";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { CheckCircle2, Cpu, Zap, AlertCircle } from "lucide-react";

export function GpuStatusIndicator() {
  const { gpuStatus, loading, refreshStatus } = useGpuStatus();

  // Refresh status when component mounts or when settings change
  useEffect(() => {
    const interval = setInterval(() => {
      refreshStatus();
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [refreshStatus]);

  if (loading || !gpuStatus) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {gpuStatus.usingCuda ? (
            <Zap className="h-5 w-5 text-yellow-500" />
          ) : (
            <Cpu className="h-5 w-5 text-blue-500" />
          )}
          GPU Acceleration Status
        </CardTitle>
        <CardDescription>
          Current transcription acceleration mode
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Active Mode:</span>
          <Badge variant={gpuStatus.usingCuda ? "default" : "secondary"}>
            {gpuStatus.binaryType}
          </Badge>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">User Preference:</span>
          <Badge variant="outline">
            {gpuStatus.preference === "auto" && "Auto-detect"}
            {gpuStatus.preference === "force-cpu" && "Force CPU"}
            {gpuStatus.preference === "force-cuda" && "Force CUDA"}
          </Badge>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">NVIDIA GPU Detected:</span>
          {gpuStatus.gpuAvailable ? (
            <div className="flex items-center gap-1 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm">Yes</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-gray-500">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">No</span>
            </div>
          )}
        </div>

        {gpuStatus.binaryPath && (
          <div className="pt-2 border-t">
            <span className="text-xs text-muted-foreground">Binary:</span>
            <p className="text-xs font-mono mt-1 break-all text-muted-foreground">
              {gpuStatus.binaryPath}
            </p>
          </div>
        )}

        {/* Warning if GPU available but not using CUDA */}
        {gpuStatus.gpuAvailable && !gpuStatus.usingCuda && gpuStatus.preference !== "force-cpu" && (
          <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
              <div className="text-xs text-yellow-800">
                <p className="font-medium">GPU available but not in use</p>
                <p className="mt-1">
                  CUDA binary may not be downloaded. Run{" "}
                  <code className="bg-yellow-100 px-1 rounded">npm run download:whisper-cpp</code>{" "}
                  to download CUDA-enabled binaries.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Success message when using CUDA */}
        {gpuStatus.usingCuda && (
          <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-md">
            <div className="flex items-start gap-2">
              <Zap className="h-4 w-4 text-green-600 mt-0.5" />
              <div className="text-xs text-green-800">
                <p className="font-medium">CUDA acceleration active</p>
                <p className="mt-1">
                  Transcription is using GPU acceleration for faster processing (10-50x speedup).
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
