import { formatETA, type DownloadProgress } from "../../hooks/useModelDownload";
interface DownloadProgressBarProps {
  modelName: string;
  progress: DownloadProgress;
  isInstalling?: boolean;
}

export function DownloadProgressBar({
  modelName,
  progress,
  isInstalling,
}: DownloadProgressBarProps) {
  const { percentage, speed, eta } = progress;
  const pct = Math.round(percentage);
  const speedText = speed ? `${speed.toFixed(1)} MB/s` : "";
  const etaText = eta ? formatETA(eta) : "";

  return (
    <div className="px-2.5 py-2 border-b border-border-subtle">
      <div className="flex items-center gap-2 mb-2">
        {/* Compact percentage with LED glow */}
        <div className="relative flex items-center justify-center w-6 h-6">
          <div
            className={`absolute inset-0 rounded-md bg-primary/15 ${isInstalling ? "animate-pulse" : ""}`}
          />
          <span className="relative text-[10px] font-bold text-primary tabular-nums">
            {isInstalling ? "..." : `${pct}%`}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground truncate">
            {isInstalling ? `Installing ${modelName}` : `Downloading ${modelName}`}
          </p>
          {!isInstalling && (speedText || etaText) && (
            <div className="flex items-center gap-1.5 mt-0.5">
              {speedText && (
                <span className="text-[10px] text-muted-foreground/70 tabular-nums">
                  {speedText}
                </span>
              )}
              {etaText && (
                <>
                  <span className="text-[10px] text-muted-foreground/30">·</span>
                  <span className="text-[10px] text-muted-foreground/70 tabular-nums">
                    {etaText}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Progress bar - thinner, premium */}
      <div
        className="w-full rounded-full overflow-hidden bg-white/3"
        style={{ height: 4 }}
      >
        <div
          className={`${isInstalling ? "animate-pulse" : ""} bg-primary shadow-[0_0_8px_rgba(112,255,186,0.4)]`}
          style={{
            height: "100%",
            width: `${isInstalling ? 100 : Math.min(percentage, 100)}%`,
            borderRadius: 9999,
            transition: "width 300ms ease-out",
          }}
        />
      </div>
    </div>
  );
}
