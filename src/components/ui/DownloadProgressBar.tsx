import { formatETA, type DownloadProgress } from "../../hooks/useModelDownload";
import { type ModelPickerStyles } from "../../utils/modelPickerStyles";

interface DownloadProgressBarProps {
  modelName: string;
  progress: DownloadProgress;
  styles: ModelPickerStyles;
  isInstalling?: boolean;
}

export function DownloadProgressBar({
  modelName,
  progress,
  styles,
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

      {/* Progress bar with gradient fill */}
      <div className="w-full h-1.5 rounded-full bg-muted dark:bg-[oklch(0.10_0.005_270)] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out bg-linear-to-r from-primary via-primary to-primary/70 ${isInstalling ? "animate-pulse" : ""}`}
          style={{ width: `${isInstalling ? 100 : Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}
