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
  const progressText = `${Math.round(percentage)}%`;
  const speedText = speed ? ` • ${speed.toFixed(1)} MB/s` : "";
  const etaText = eta ? ` • ETA: ${formatETA(eta)}` : "";

  const label = isInstalling ? `Installing ${modelName}...` : `Downloading ${modelName}...`;

  return (
    <div className={`${styles.progress} p-3`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-sm font-medium ${styles.progressText}`}>{label}</span>
        {!isInstalling && (
          <span className={`text-xs ${styles.progressText}`}>
            {progressText}
            {speedText}
            {etaText}
          </span>
        )}
      </div>
      <div className={`w-full ${styles.progressBar} rounded-full h-2`}>
        <div
          className={`${styles.progressFill} h-2 rounded-full transition-all duration-300 ease-out ${isInstalling ? "animate-pulse" : ""}`}
          style={{ width: `${isInstalling ? 100 : Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}
