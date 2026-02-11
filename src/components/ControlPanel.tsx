import React, { Suspense, useState, useEffect, useRef, useCallback } from "react";
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
  Cloud,
  X,
  AlertTriangle,
} from "lucide-react";
import type { SettingsSectionType } from "./SettingsModal";
import TitleBar from "./TitleBar";
import SupportDropdown from "./ui/SupportDropdown";
import TranscriptionItem from "./ui/TranscriptionItem";
import UpgradePrompt from "./UpgradePrompt";
import { ConfirmDialog, AlertDialog } from "./ui/dialog";
import { useDialogs } from "../hooks/useDialogs";
import { useHotkey } from "../hooks/useHotkey";
import { useToast } from "./ui/Toast";
import { useUpdater } from "../hooks/useUpdater";
import { useSettings } from "../hooks/useSettings";
import { useAuth } from "../hooks/useAuth";
import { useUsage } from "../hooks/useUsage";
import {
  useTranscriptions,
  initializeTranscriptions,
  removeTranscription as removeFromStore,
  clearTranscriptions as clearStoreTranscriptions,
} from "../stores/transcriptionStore";
import { formatHotkeyLabel } from "../utils/hotkeys";

const SettingsModal = React.lazy(() => import("./SettingsModal"));

export default function ControlPanel() {
  const history = useTranscriptions();
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [limitData, setLimitData] = useState<{ wordsUsed: number; limit: number } | null>(null);
  const hasShownUpgradePrompt = useRef(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSectionType | undefined>();
  const [aiCTADismissed, setAiCTADismissed] = useState(
    () => localStorage.getItem("aiCTADismissed") === "true"
  );
  const [showCloudMigrationBanner, setShowCloudMigrationBanner] = useState(false);
  const cloudMigrationProcessed = useRef(false);
  const { hotkey } = useHotkey();
  const { toast } = useToast();
  const { useReasoningModel, setUseLocalWhisper, setCloudTranscriptionMode } = useSettings();
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const usage = useUsage();

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

  useEffect(() => {
    if (updateStatus.updateDownloaded && !isDownloading) {
      toast({
        title: "Update ready to install",
        description: "Click 'Install Update' to restart with the latest version.",
        variant: "success",
      });
    }
  }, [updateStatus.updateDownloaded, isDownloading, toast]);

  useEffect(() => {
    if (updateError) {
      toast({
        title: "Update ran into a problem",
        description: "We couldn't complete the update. Please try again later.",
        variant: "destructive",
      });
    }
  }, [updateError, toast]);

  useEffect(() => {
    const dispose = window.electronAPI?.onLimitReached?.(
      (data: { wordsUsed: number; limit: number }) => {
        if (!hasShownUpgradePrompt.current) {
          hasShownUpgradePrompt.current = true;
          setLimitData(data);
          setShowUpgradePrompt(true);
        } else {
          toast({
            title: "Weekly limit reached",
            description:
              "Your limit resets on a rolling basis. Upgrade to Pro or use your own API key for unlimited use.",
            duration: 5000,
          });
        }
      }
    );

    return () => {
      dispose?.();
    };
  }, [toast]);

  useEffect(() => {
    if (!usage?.isPastDue || !usage.hasLoaded) return;
    if (sessionStorage.getItem("pastDueNotified")) return;
    sessionStorage.setItem("pastDueNotified", "true");
    toast({
      title: "We couldn't process your payment",
      description:
        "Don't worry — you're on the free plan for now. Update your payment in Settings to get back to Pro.",
      variant: "destructive",
      duration: 8000,
    });
  }, [usage?.isPastDue, usage?.hasLoaded, toast]);

  useEffect(() => {
    if (!authLoaded || !isSignedIn || cloudMigrationProcessed.current) return;
    const isPending = localStorage.getItem("pendingCloudMigration") === "true";
    const alreadyShown = localStorage.getItem("cloudMigrationShown") === "true";
    if (!isPending || alreadyShown) return;

    cloudMigrationProcessed.current = true;
    setUseLocalWhisper(false);
    setCloudTranscriptionMode("openwhispr");
    localStorage.removeItem("pendingCloudMigration");
    setShowCloudMigrationBanner(true);
  }, [authLoaded, isSignedIn, setUseLocalWhisper, setCloudTranscriptionMode]);

  const loadTranscriptions = async () => {
    try {
      setIsLoading(true);
      await initializeTranscriptions();
    } catch (error) {
      showAlertDialog({
        title: "Couldn't load your history",
        description:
          "Something went wrong loading your transcriptions. Try closing and reopening the app.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = useCallback(
    async (text: string) => {
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
          title: "Couldn't copy",
          description: "Something went wrong copying to your clipboard. Try again.",
          variant: "destructive",
        });
      }
    },
    [toast]
  );

  const clearHistory = useCallback(async () => {
    showConfirmDialog({
      title: "Clear History",
      description: "This will remove all your transcriptions. You can't undo this.",
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
            title: "Couldn't clear history",
            description: "Something went wrong. Please try again.",
            variant: "destructive",
          });
        }
      },
      variant: "destructive",
    });
  }, [showConfirmDialog, toast]);

  const deleteTranscription = useCallback(
    async (id: number) => {
      showConfirmDialog({
        title: "Delete Transcription",
        description: "This transcription will be permanently removed.",
        onConfirm: async () => {
          try {
            const result = await window.electronAPI.deleteTranscription(id);
            if (result.success) {
              removeFromStore(id);
            } else {
              showAlertDialog({
                title: "Couldn't delete",
                description: "This transcription may have already been removed.",
              });
            }
          } catch (error) {
            showAlertDialog({
              title: "Couldn't delete",
              description: "Something went wrong. Please try again.",
            });
          }
        },
        variant: "destructive",
      });
    },
    [showConfirmDialog, showAlertDialog]
  );

  const handleUpdateClick = async () => {
    if (updateStatus.updateDownloaded) {
      showConfirmDialog({
        title: "Install Update",
        description:
          "OpenWhispr will restart to apply the update. Any in-progress work will be saved.",
        onConfirm: async () => {
          try {
            await installUpdate();
          } catch (error) {
            toast({
              title: "Couldn't install update",
              description: "Something went wrong. Please try again.",
              variant: "destructive",
            });
          }
        },
      });
    } else if (updateStatus.updateAvailable && !isDownloading) {
      try {
        await downloadUpdate();
      } catch (error) {
        toast({
          title: "Couldn't download update",
          description: "Check your internet connection and try again.",
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

      <UpgradePrompt
        open={showUpgradePrompt}
        onOpenChange={setShowUpgradePrompt}
        wordsUsed={limitData?.wordsUsed}
        limit={limitData?.limit}
      />

      <TitleBar
        actions={
          <>
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

      {showSettings && (
        <Suspense fallback={null}>
          <SettingsModal
            open={showSettings}
            onOpenChange={(open) => {
              setShowSettings(open);
              if (!open) setSettingsSection(undefined);
            }}
            initialSection={settingsSection}
          />
        </Suspense>
      )}

      <div className="p-4">
        <div className="max-w-3xl mx-auto">
          {usage?.isPastDue && (
            <div className="mb-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 p-3">
              <div className="flex items-start gap-3">
                <div className="shrink-0 w-8 h-8 rounded-md bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                  <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-amber-900 dark:text-amber-200 mb-0.5">
                    We couldn't process your payment
                  </p>
                  <p className="text-[12px] text-amber-700 dark:text-amber-300/80 mb-2">
                    You're on the free plan for now — you still get {usage.limit.toLocaleString()}{" "}
                    words per week. Update your payment to get back to Pro.
                  </p>
                  <Button
                    variant="default"
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => {
                      setSettingsSection("account");
                      setShowSettings(true);
                    }}
                  >
                    Update Payment
                  </Button>
                </div>
              </div>
            </div>
          )}

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
                    Cloud for faster, more accurate results. Your previous settings are saved —
                    switch back anytime in Settings.
                  </p>
                  <Button
                    variant="default"
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => {
                      setShowCloudMigrationBanner(false);
                      localStorage.setItem("cloudMigrationShown", "true");
                      setSettingsSection("transcription");
                      setShowSettings(true);
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
                    onClick={() => {
                      setSettingsSection("aiModels");
                      setShowSettings(true);
                    }}
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
    </div>
  );
}
