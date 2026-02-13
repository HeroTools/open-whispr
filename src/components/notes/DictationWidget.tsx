import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Mic, Square, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";

interface DictationWidgetProps {
  isRecording: boolean;
  isProcessing: boolean;
  onStart: () => void;
  onStop: () => void;
}

const BAR_COUNT = 7;

export default function DictationWidget({ isRecording, isProcessing, onStart, onStop }: DictationWidgetProps) {
  const { t } = useTranslation();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isRecording) {
      setElapsed(0);
      return;
    }
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isRecording]);

  const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const seconds = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="sticky bottom-5 z-10 flex justify-center pointer-events-none">
      {isRecording ? (
        <div
          className={cn(
            "flex items-center gap-4 h-11 px-4 rounded-xl pointer-events-auto",
            "bg-background/80 dark:bg-surface-2/80",
            "backdrop-blur-xl",
            "border border-destructive/15 dark:border-destructive/20",
            "shadow-elevated"
          )}
          style={{ animation: "float-up 0.2s ease-out" }}
        >
          <div className="flex items-end gap-0.75 h-5">
            {Array.from({ length: BAR_COUNT }, (_, i) => (
              <div
                key={i}
                className="w-0.75 rounded-full bg-destructive/60 dark:bg-destructive/70 origin-bottom"
                style={{
                  height: "100%",
                  animation: `waveform-bar ${0.6 + i * 0.08}s ease-in-out infinite`,
                  animationDelay: `${i * 0.06}s`,
                }}
              />
            ))}
          </div>

          <span className="text-[11px] font-medium tabular-nums text-foreground/50 min-w-9">
            {minutes}:{seconds}
          </span>

          <button
            onClick={onStop}
            className={cn(
              "flex items-center justify-center w-7 h-7 rounded-lg",
              "bg-destructive/10 hover:bg-destructive/18 active:bg-destructive/25",
              "text-destructive",
              "transition-colors duration-150"
            )}
            aria-label={t("notes.editor.stop")}
          >
            <Square size={12} fill="currentColor" />
          </button>
        </div>
      ) : isProcessing ? (
        <div
          className={cn(
            "flex items-center gap-3 h-11 px-5 rounded-xl pointer-events-auto",
            "bg-background/80 dark:bg-surface-2/80",
            "backdrop-blur-xl",
            "border border-border/50 dark:border-white/8",
            "shadow-elevated"
          )}
        >
          <Loader2 size={14} className="animate-spin text-foreground/30" />
          <span className="text-[11px] font-medium text-foreground/40">
            {t("notes.editor.processing")}
          </span>
        </div>
      ) : (
        <button
          onClick={onStart}
          className={cn(
            "flex items-center gap-2.5 h-10 px-5 rounded-xl pointer-events-auto",
            "bg-background/70 dark:bg-surface-2/70",
            "backdrop-blur-xl",
            "border border-border/40 dark:border-white/6",
            "shadow-sm hover:shadow-md",
            "text-foreground/35 hover:text-foreground/55",
            "transition-all duration-200",
            "hover:bg-background/90 dark:hover:bg-surface-2/90",
            "active:scale-[0.98]"
          )}
        >
          <Mic size={14} />
          <span className="text-[11px] font-medium">
            {t("notes.editor.dictate")}
          </span>
        </button>
      )}
    </div>
  );
}
