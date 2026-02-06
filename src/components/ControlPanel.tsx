import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import {
  Trash2,
  Settings,
  FileText,
  Mic,
  Download,
  RefreshCw,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import SettingsModal, { SettingsSectionType } from "./SettingsModal";
import TitleBar from "./TitleBar";
import SupportDropdown from "./ui/SupportDropdown";
import TranscriptionItem from "./ui/TranscriptionItem";
import { ConfirmDialog, AlertDialog } from "./ui/dialog";
import { useDialogs } from "../hooks/useDialogs";
import { useHotkey } from "../hooks/useHotkey";
import { useToast } from "./ui/Toast";
import { useUpdater } from "../hooks/useUpdater";
import { useSettings } from "../hooks/useSettings";
import {
  useTranscriptions,
  initializeTranscriptions,
  removeTranscription as removeFromStore,
  clearTranscriptions as clearStoreTranscriptions,
} from "../stores/transcriptionStore";
import { formatHotkeyLabel } from "../utils/hotkeys";

export default function ControlPanel() {
  const history = useTranscriptions();
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSectionType | undefined>();
  const [aiCTADismissed, setAiCTADismissed] = useState(false);
  const { hotkey } = useHotkey();
  const { toast } = useToast();
  const { useReasoningModel } = useSettings();

  // Use centralized updater hook to prevent EventEmitter memory leaks
  const {
    status: updateStatus,
    downloadProgress,
    isDownloading,
    isInstalling,
    downloadUpdate,
    installUpdate,
    error: updateError,
  } = useUpdater();

  const {
    confirmDialog,
    alertDialog,
    showConfirmDialog,
    showAlertDialog,
    hideConfirmDialog,
    hideAlertDialog,
  } = useDialogs();

  useEffect(() => {
    loadTranscriptions();
  }, []);

  // Show toast when update is ready
  useEffect(() => {
    if (updateStatus.updateDownloaded && !isDownloading) {
      toast({
        title: "Update Ready",
        description: "Click 'Install Update' to restart and apply the update.",
        variant: "success",
      });
    }
  }, [updateStatus.updateDownloaded, isDownloading, toast]);

  // Show toast on update error
  useEffect(() => {
    if (updateError) {
      toast({
        title: "Update Error",
        description: "Failed to update. Please try again later.",
        variant: "destructive",
      });
    }
  }, [updateError, toast]);

  const loadTranscriptions = async () => {
    try {
      setIsLoading(true);
      await initializeTranscriptions();
    } catch (error) {
      showAlertDialog({
        title: "Unable to load history",
        description: "Please try again in a moment.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: "Text copied to your clipboard",
        variant: "success",
        duration: 2000,
      });
    } catch (err) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy text to clipboard",
        variant: "destructive",
      });
    }
  };

  const clearHistory = async () => {
    showConfirmDialog({
      title: "Clear History",
      description: "Are you sure you want to clear all transcriptions? This cannot be undone.",
      onConfirm: async () => {
        try {
          const result = await window.electronAPI.clearTranscriptions();
          clearStoreTranscriptions();
          toast({
            title: "History cleared",
            description: `${result.cleared} transcription${result.cleared !== 1 ? "s" : ""} removed`,
            variant: "success",
            duration: 3000,
          });
        } catch (error) {
          toast({
            title: "Failed to clear",
            description: "Please try again",
            variant: "destructive",
          });
        }
      },
      variant: "destructive",
    });
  };

  const deleteTranscription = async (id: number) => {
    showConfirmDialog({
      title: "Delete Transcription",
      description: "Are you certain you wish to remove this inscription from your records?",
      onConfirm: async () => {
        try {
          const result = await window.electronAPI.deleteTranscription(id);
          if (result.success) {
            removeFromStore(id);
          } else {
            showAlertDialog({
              title: "Delete Failed",
              description: "Failed to delete transcription. It may have already been removed.",
            });
          }
        } catch (error) {
          showAlertDialog({
            title: "Delete Failed",
            description: "Failed to delete transcription. Please try again.",
          });
        }
      },
      variant: "destructive",
    });
  };

  const handleUpdateClick = async () => {
    if (updateStatus.updateDownloaded) {
      // Show confirmation dialog before installing
      showConfirmDialog({
        title: "Install Update",
        description:
          "The update will be installed and the app will restart. Make sure you've saved any work.",
        onConfirm: async () => {
          try {
            await installUpdate();
          } catch (error) {
            toast({
              title: "Install Failed",
              description: "Failed to install update. Please try again.",
              variant: "destructive",
            });
          }
        },
      });
    } else if (updateStatus.updateAvailable && !isDownloading) {
      // Start download
      try {
        await downloadUpdate();
      } catch (error) {
        toast({
          title: "Download Failed",
          description: "Failed to download update. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const getUpdateButtonContent = () => {
    if (isInstalling) {
      return (
        <>
          <Loader2 size={14} className="animate-spin" />
          <span>Installing...</span>
        </>
      );
    }
    if (isDownloading) {
      return (
        <>
          <Loader2 size={14} className="animate-spin" />
          <span>{Math.round(downloadProgress)}%</span>
        </>
      );
    }
    if (updateStatus.updateDownloaded) {
      return (
        <>
          <RefreshCw size={14} />
          <span>Install Update</span>
        </>
      );
    }
    if (updateStatus.updateAvailable) {
      return (
        <>
          <Download size={14} />
          <span>Update Available</span>
        </>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-background">
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={hideConfirmDialog}
        title={confirmDialog.title}
        description={confirmDialog.description}
        onConfirm={confirmDialog.onConfirm}
        variant={confirmDialog.variant}
      />

      <AlertDialog
        open={alertDialog.open}
        onOpenChange={hideAlertDialog}
        title={alertDialog.title}
        description={alertDialog.description}
        onOk={() => {}}
      />

      <TitleBar
        actions={
          <>
            {/* Update button */}
            {!updateStatus.isDevelopment &&
              (updateStatus.updateAvailable ||
                updateStatus.updateDownloaded ||
                isDownloading ||
                isInstalling) && (
                <Button
                  variant={updateStatus.updateDownloaded ? "default" : "outline"}
                  size="sm"
                  onClick={handleUpdateClick}
                  disabled={isInstalling || isDownloading}
                  className="gap-1.5 text-xs"
                >
                  {getUpdateButtonContent()}
                </Button>
              )}
            <SupportDropdown />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setSettingsSection(undefined);
                setShowSettings(true);
              }}
              className="text-foreground/70 hover:text-foreground hover:bg-foreground/10"
            >
              <Settings size={16} />
            </Button>
          </>
        }
      />

      <SettingsModal
        open={showSettings}
        onOpenChange={(open) => {
          setShowSettings(open);
          if (!open) setSettingsSection(undefined);
        }}
        initialSection={settingsSection}
      />

      {/* Main content */}
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header row - luxury spacing */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-baseline gap-3">
              <h1 className="text-3xl font-semibold text-foreground tracking-tight">
                Transcriptions
              </h1>
              {history.length > 0 && (
                <span className="text-lg text-primary font-medium tabular-nums">
                  ({history.length})
                </span>
              )}
            </div>
            {history.length > 0 && (
              <Button
                onClick={clearHistory}
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200"
              >
                <Trash2 size={14} className="mr-1.5" />
                Clear All
              </Button>
            )}
          </div>

          {/* AI Enhancement CTA - premium design */}
          {!useReasoningModel && !aiCTADismissed && (
            <div className="mb-8 relative rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 shadow-[0_0_40px_rgba(112,255,186,0.1)] overflow-hidden">
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-50" />

              <button
                onClick={() => setAiCTADismissed(true)}
                className="absolute top-4 right-4 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all duration-200 z-10"
              >
                <X size={16} />
              </button>

              <div className="relative flex items-start gap-5">
                <div className="shrink-0 w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center shadow-[0_0_20px_rgba(112,255,186,0.2)]">
                  <Sparkles size={22} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0 pr-8">
                  <p className="text-lg font-semibold text-foreground mb-2">
                    Enhance your transcriptions with AI
                  </p>
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                    Automatically fix grammar, punctuation, and formatting as you speak.
                  </p>
                  <Button
                    variant="default"
                    size="sm"
                    className="h-9 px-4 text-sm shadow-[0_0_20px_rgba(112,255,186,0.3)] hover:shadow-[0_0_30px_rgba(112,255,186,0.4)] transition-all duration-300"
                    onClick={() => {
                      setSettingsSection("aiModels");
                      setShowSettings(true);
                    }}
                  >
                    <Sparkles size={14} className="mr-2" />
                    Enable AI Enhancement
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Content area - refined */}
          <div className="rounded-2xl border border-border-subtle bg-surface-raised/50 backdrop-blur-sm overflow-hidden shadow-xl">
            {isLoading ? (
              <div className="flex items-center justify-center gap-3 py-16">
                <Loader2 size={18} className="animate-spin text-primary" />
                <span className="text-base text-muted-foreground">Loading…</span>
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-6">
                <div className="w-16 h-16 rounded-2xl bg-surface-raised flex items-center justify-center mb-5 shadow-lg">
                  <Mic size={28} className="text-muted-foreground" />
                </div>
                <p className="text-lg text-foreground mb-2 font-medium">No transcriptions yet</p>
                <p className="text-sm text-muted-foreground mb-5">Start dictating to see your transcriptions here</p>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span>Press</span>
                  <kbd className="inline-flex items-center h-8 px-3 rounded-lg bg-surface-raised border border-border-subtle text-sm font-mono font-medium shadow-sm">
                    {formatHotkeyLabel(hotkey)}
                  </kbd>
                  <span>to start dictating</span>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border/30 max-h-[calc(100vh-240px)] overflow-y-auto">
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
    </div>
  );
}
