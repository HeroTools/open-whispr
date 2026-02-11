import { Button } from "./ui/button";
import { Trash2, FileText, Mic, Loader2, Sparkles, Cloud, X } from "lucide-react";
import TranscriptionItem from "./ui/TranscriptionItem";
import type { TranscriptionItem as TranscriptionItemType } from "../types/electron";
import { formatHotkeyLabel } from "../utils/hotkeys";

interface HistoryViewProps {
  history: TranscriptionItemType[];
  isLoading: boolean;
  hotkey: string;
  showCloudMigrationBanner: boolean;
  setShowCloudMigrationBanner: (show: boolean) => void;
  aiCTADismissed: boolean;
  setAiCTADismissed: (dismissed: boolean) => void;
  useReasoningModel: boolean;
  clearHistory: () => void;
  copyToClipboard: (text: string) => void;
  deleteTranscription: (id: number) => void;
  onOpenSettings: (section?: string) => void;
}

export default function HistoryView({
  history,
  isLoading,
  hotkey,
  showCloudMigrationBanner,
  setShowCloudMigrationBanner,
  aiCTADismissed,
  setAiCTADismissed,
  useReasoningModel,
  clearHistory,
  copyToClipboard,
  deleteTranscription,
  onOpenSettings,
}: HistoryViewProps) {
  return (
    <div className="p-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Transcriptions</h2>
            {history.length > 0 && (
              <span className="text-[11px] text-muted-foreground tabular-nums">
                ({history.length})
              </span>
            )}
          </div>
          {history.length > 0 && (
            <Button
              onClick={clearHistory}
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px] text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 size={12} className="mr-1" />
              Clear
            </Button>
          )}
        </div>

        {showCloudMigrationBanner && (
          <div className="mb-3 relative rounded-lg border border-primary/20 bg-primary/5 dark:bg-primary/10 p-3">
            <button
              onClick={() => {
                setShowCloudMigrationBanner(false);
                localStorage.setItem("cloudMigrationShown", "true");
              }}
              className="absolute top-2 right-2 p-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <X size={14} />
            </button>
            <div className="flex items-start gap-3 pr-6">
              <div className="shrink-0 w-8 h-8 rounded-md bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                <Cloud size={16} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-foreground mb-0.5">
                  Welcome to OpenWhispr Pro
                </p>
                <p className="text-[12px] text-muted-foreground mb-2">
                  Your 7-day free trial is active! We've switched your transcription to OpenWhispr
                  Cloud for faster, more accurate results. Your previous settings are saved — switch
                  back anytime in Settings.
                </p>
                <Button
                  variant="default"
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => {
                    setShowCloudMigrationBanner(false);
                    localStorage.setItem("cloudMigrationShown", "true");
                    onOpenSettings("transcription");
                  }}
                >
                  View Settings
                </Button>
              </div>
            </div>
          </div>
        )}

        {!useReasoningModel && !aiCTADismissed && (
          <div className="mb-3 relative rounded-lg border border-primary/20 bg-primary/5 dark:bg-primary/10 p-3">
            <button
              onClick={() => {
                localStorage.setItem("aiCTADismissed", "true");
                setAiCTADismissed(true);
              }}
              className="absolute top-2 right-2 p-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <X size={14} />
            </button>
            <div className="flex items-start gap-3 pr-6">
              <div className="shrink-0 w-8 h-8 rounded-md bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                <Sparkles size={16} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-foreground mb-0.5">
                  Enhance your transcriptions with AI
                </p>
                <p className="text-[12px] text-muted-foreground mb-2">
                  Automatically fix grammar, punctuation, and formatting as you speak.
                </p>
                <Button
                  variant="default"
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => onOpenSettings("aiModels")}
                >
                  Enable AI Enhancement
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-border bg-card/50 dark:bg-card/30 backdrop-blur-sm">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 size={14} className="animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Loading…</span>
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="w-10 h-10 rounded-md bg-muted/50 dark:bg-white/4 flex items-center justify-center mb-3">
                <Mic size={18} className="text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground mb-3">No transcriptions yet</p>
              <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                <span>Press</span>
                <kbd className="inline-flex items-center h-5 px-1.5 rounded-sm bg-surface-1 dark:bg-white/6 border border-border text-[11px] font-mono font-medium">
                  {formatHotkeyLabel(hotkey)}
                </kbd>
                <span>to start</span>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border/50 max-h-[calc(100vh-180px)] overflow-y-auto">
              {history.map((item, index) => (
                <TranscriptionItem
                  key={item.id}
                  item={item}
                  index={index}
                  total={history.length}
                  onCopy={copyToClipboard}
                  onDelete={deleteTranscription}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
