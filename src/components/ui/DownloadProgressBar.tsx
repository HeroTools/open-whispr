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
    <div className="p-4 border-b border-border/50 dark:border-[oklch(0.20_0.004_270)]">
      <div className="flex items-center gap-3 mb-3">
        {/* Animated pulse indicator */}
        <div className="relative flex items-center justify-center w-8 h-8">
          <div className={`absolute inset-0 rounded-lg bg-primary/15 ${isInstalling ? "animate-pulse" : "animate-pulse"}`} />
          <span className="relative text-xs font-bold text-primary tabular-nums">
            {isInstalling ? "..." : `${pct}%`}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {isInstalling ? `Installing ${modelName}` : `Downloading ${modelName}`}
          </p>
          {!isInstalling && (
            <div className="flex items-center gap-2 mt-0.5">
              {speedText && (
                <span className="text-xs text-muted-foreground tabular-nums">{speedText}</span>
              )}
              {etaText && (
                <>
                  <span className="text-xs text-muted-foreground/40">·</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{etaText} remaining</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ height: 6, backgroundColor: "var(--color-muted)" }}
      >
        <div
          className={isInstalling ? "animate-pulse" : ""}
          style={{
            height: "100%",
            width: `${isInstalling ? 100 : Math.min(percentage, 100)}%`,
            backgroundColor: "var(--color-primary)",
            borderRadius: 9999,
            transition: "width 300ms ease-out",
          }}
        />
      </div>
    </div>
  );
}
