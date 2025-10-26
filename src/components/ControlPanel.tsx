import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Trash2, RefreshCw, Settings, FileText, Mic, X } from "lucide-react";
import SettingsModal from "./SettingsModal";
import TitleBar from "./TitleBar";
import SupportDropdown from "./ui/SupportDropdown";
import TranscriptionItem from "./ui/TranscriptionItem";
import { ConfirmDialog, AlertDialog } from "./ui/dialog";
import { useDialogs } from "../hooks/useDialogs";
import { useHotkey } from "../hooks/useHotkey";
import { useToast } from "./ui/Toast";
import type { TranscriptionItem as TranscriptionItemType } from "../types/electron";

export default function ControlPanel() {
  const [history, setHistory] = useState<TranscriptionItemType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const { hotkey } = useHotkey();
  const { toast } = useToast();
  const [updateStatus, setUpdateStatus] = useState({
    updateAvailable: false,
    updateDownloaded: false,
    isDevelopment: false,
  });
  const isWindows =
    typeof window !== "undefined" && window.electronAPI?.getPlatform?.() === "win32";

  const {
    confirmDialog,
    alertDialog,
    showConfirmDialog,
    showAlertDialog,
    hideConfirmDialog,
    hideAlertDialog,
  } = useDialogs();

  const handleClose = () => {
    void window.electronAPI.windowClose();
  };

  // Memoize loadTranscriptions to prevent recreating on every render
  const loadTranscriptions = useCallback(async () => {
    try {
      setIsLoading(true);
      const transcriptions = await window.electronAPI.getTranscriptions(50);
      console.log('[ControlPanel] Loaded transcriptions:', transcriptions.length);
      setHistory(transcriptions);
    } catch (error) {
      console.error('[ControlPanel] Error loading transcriptions:', error);
    } finally {
      setIsLoading(false);
    }
  }, []); // No dependencies - function never changes

  useEffect(() => {
    // Load transcription history from database on mount
    loadTranscriptions();

    // Listen for new transcriptions (event-based, no polling)
    const handleTranscriptionAdded = (_event: any, _result: any) => {
      console.log('[ControlPanel] New transcription added, refreshing list...');
      loadTranscriptions();
    };

    window.electronAPI.onTranscriptionAdded(handleTranscriptionAdded);

    // Initialize update status
    const initializeUpdateStatus = async () => {
      try {
        const status = await window.electronAPI.getUpdateStatus();
        setUpdateStatus(status);
      } catch (error) {
        // Update status not critical for app function
      }
    };

    initializeUpdateStatus();

    // Set up update event listeners
    const handleUpdateAvailable = (_event: any, _info: any) => {
      setUpdateStatus((prev) => ({ ...prev, updateAvailable: true }));
    };

    const handleUpdateDownloaded = (_event: any, _info: any) => {
      setUpdateStatus((prev) => ({ ...prev, updateDownloaded: true }));
    };

    const handleUpdateError = (_event: any, _error: any) => {
      // Update errors are handled by the update service
    };

    window.electronAPI.onUpdateAvailable(handleUpdateAvailable);
    window.electronAPI.onUpdateDownloaded(handleUpdateDownloaded);
    window.electronAPI.onUpdateError(handleUpdateError);

    // Cleanup listeners on unmount
    return () => {
      window.electronAPI.removeAllListeners?.("transcription-added");
      window.electronAPI.removeAllListeners?.("update-available");
      window.electronAPI.removeAllListeners?.("update-downloaded");
      window.electronAPI.removeAllListeners?.("update-error");
    };
  }, [loadTranscriptions]); // Include loadTranscriptions as dependency

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
      description:
        "Are you certain you wish to clear all inscribed records? This action cannot be undone.",
      onConfirm: async () => {
        try {
          const result = await window.electronAPI.clearTranscriptions();
          setHistory([]);
          showAlertDialog({
            title: "History Cleared",
            description: `Successfully cleared ${result.cleared} transcriptions from your chronicles.`,
          });
        } catch (error) {
          showAlertDialog({
            title: "Error",
            description: "Failed to clear history. Please try again.",
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
            // Remove from local state
            setHistory((prev) => prev.filter((item) => item.id !== id));
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

  const refreshHistory = async () => {
    await loadTranscriptions();
  };

  return (
    <div className="min-h-screen bg-white">
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
            {/* Update notification badge */}
            {!updateStatus.isDevelopment &&
              (updateStatus.updateAvailable || updateStatus.updateDownloaded) && (
                <div className="relative">
                  <div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-blue-500"></div>
                </div>
              )}
            <SupportDropdown />
            <Button variant="ghost" size="icon" onClick={() => setShowSettings(!showSettings)}>
              <Settings size={16} />
            </Button>
            {isWindows && (
              <div className="ml-2 flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={handleClose}
                  aria-label="Close window"
                >
                  <X size={14} />
                </Button>
              </div>
            )}
          </>
        }
      />

      <SettingsModal open={showSettings} onOpenChange={setShowSettings} />

      {/* Main content */}
      <div className="p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Transcriptions - Modern Clean Design */}
          <Card className="overflow-hidden border border-primary-200 bg-gradient-to-b from-white to-primary-50/30 shadow-sm">
            <CardHeader className="border-b border-primary-100 bg-gradient-to-r from-primary-50 to-white pb-5">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <CardTitle className="text-xl font-semibold tracking-tight text-primary-900">
                    Recent Transcriptions
                  </CardTitle>
                  <p className="mt-1.5 text-sm text-primary-700/70">
                    Your dictation history {history.length > 0 && `• ${history.length} ${history.length === 1 ? 'item' : 'items'}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={refreshHistory}
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 rounded-lg p-0 text-primary-600 hover:bg-primary-100 hover:text-primary-700"
                    title="Refresh"
                  >
                    <RefreshCw size={18} />
                  </Button>
                  {history.length > 0 && (
                    <Button
                      onClick={clearHistory}
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 rounded-lg p-0 text-neutral-500 hover:bg-error-50 hover:text-error-600"
                      title="Clear all"
                    >
                      <Trash2 size={18} />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="bg-white/50 px-6 pb-6">
              {isLoading ? (
                <div className="py-16 text-center">
                  <div className="loader mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-3 border-primary-200 border-t-primary-600" />
                  <p className="text-sm font-medium text-primary-700/70">Loading transcriptions...</p>
                </div>
              ) : history.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700 shadow-lg">
                    <Mic className="h-10 w-10 text-white" />
                  </div>
                  <h4 className="mb-2 text-lg font-semibold text-primary-900">
                    No transcriptions yet
                  </h4>
                  <p className="mb-8 text-sm text-primary-700/70">
                    Start recording to see your transcriptions here
                  </p>

                  {/* Quick Start - Clean Card */}
                  <div className="mx-auto max-w-md rounded-2xl border border-primary-200 bg-gradient-to-br from-white to-primary-50/30 p-6 text-left shadow-sm">
                    <p className="mb-3 text-sm font-semibold text-primary-900">Quick Start Guide</p>
                    <p className="text-sm leading-relaxed text-primary-800/80">
                      Press{" "}
                      <kbd className="mx-1 rounded-lg border border-primary-300 bg-primary-100 px-2 py-1 font-mono text-xs font-semibold text-primary-700 shadow-sm">
                        {hotkey}
                      </kbd>{" "}
                      to start recording, speak your text, then press{" "}
                      <kbd className="mx-1 rounded-lg border border-primary-300 bg-primary-100 px-2 py-1 font-mono text-xs font-semibold text-primary-700 shadow-sm">
                        {hotkey}
                      </kbd>{" "}
                      again to stop.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 pt-6">
                  <div className="max-h-[520px] space-y-3 overflow-y-auto pr-2">
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
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
