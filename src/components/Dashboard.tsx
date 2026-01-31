import { useState, useEffect } from "react";
import { Trash2, Settings, RefreshCw, Download, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import DashboardSidebar, { type DashboardTab } from "./DashboardSidebar";
import StatsHeader from "./StatsHeader";
import TranscriptionList from "./TranscriptionList";
import SettingsModal from "./SettingsModal";
import TitleBar from "./TitleBar";
import SupportDropdown from "./ui/SupportDropdown";
import { ConfirmDialog, AlertDialog } from "./ui/dialog";
import { useDialogs } from "../hooks/useDialogs";
import { useHotkey } from "../hooks/useHotkey";
import { useToast } from "./ui/Toast";
import { useUpdater } from "../hooks/useUpdater";
import { useStats, initializeStats, refreshStats } from "../stores/statsStore";
import type { TranscriptionItemGrouped } from "../types/electron";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<DashboardTab>("dashboard");
  const [transcriptions, setTranscriptions] = useState<TranscriptionItemGrouped[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const stats = useStats();
  const { hotkey } = useHotkey();
  const { toast } = useToast();

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

  // Get agent name from localStorage for personalization
  const [agentName, setAgentName] = useState<string | null>(null);
  useEffect(() => {
    const storedName = localStorage.getItem("agentName");
    if (storedName) {
      try {
        const parsed = JSON.parse(storedName);
        // Agent name is used as the assistant name, but we want the user's name
        // For now, just don't show personalized greeting
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  useEffect(() => {
    loadData();
    setupIpcListeners();
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

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [transcriptionsData] = await Promise.all([
        window.electronAPI.getTranscriptionsGrouped(100),
        initializeStats(),
      ]);
      setTranscriptions(transcriptionsData);
    } catch (error) {
      showAlertDialog({
        title: "Unable to load data",
        description: "Please try again in a moment.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const setupIpcListeners = () => {
    const disposers: Array<() => void> = [];

    if (window.electronAPI?.onTranscriptionAdded) {
      const dispose = window.electronAPI.onTranscriptionAdded((item) => {
        if (item) {
          // Reload data to get properly grouped transcriptions
          loadData();
        }
      });
      if (typeof dispose === "function") {
        disposers.push(dispose);
      }
    }

    if (window.electronAPI?.onTranscriptionDeleted) {
      const dispose = window.electronAPI.onTranscriptionDeleted(({ id }) => {
        setTranscriptions((prev) => prev.filter((t) => t.id !== id));
        refreshStats();
      });
      if (typeof dispose === "function") {
        disposers.push(dispose);
      }
    }

    if (window.electronAPI?.onTranscriptionsCleared) {
      const dispose = window.electronAPI.onTranscriptionsCleared(() => {
        setTranscriptions([]);
        refreshStats();
      });
      if (typeof dispose === "function") {
        disposers.push(dispose);
      }
    }

    return () => {
      disposers.forEach((dispose) => dispose());
    };
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
      description:
        "Are you certain you wish to clear all transcriptions? This action cannot be undone.",
      onConfirm: async () => {
        try {
          const result = await window.electronAPI.clearTranscriptions();
          setTranscriptions([]);
          refreshStats();
          showAlertDialog({
            title: "History Cleared",
            description: `Successfully cleared ${result.cleared} transcriptions.`,
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
      description: "Are you sure you want to delete this transcription?",
      onConfirm: async () => {
        try {
          const result = await window.electronAPI.deleteTranscription(id);
          if (result.success) {
            setTranscriptions((prev) => prev.filter((t) => t.id !== id));
            refreshStats();
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
          <span>{downloadProgress}%</span>
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

  const handleTabChange = (tab: DashboardTab) => {
    if (tab === "settings") {
      setShowSettings(true);
    } else if (tab === "help") {
      window.electronAPI?.openExternal?.("https://github.com/anthropics/openwhispr/issues");
    } else {
      setActiveTab(tab);
    }
  };

  return (
    <div className="h-screen bg-white flex flex-col">
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
                  className={`gap-1.5 text-xs ${
                    updateStatus.updateDownloaded
                      ? "bg-blue-600 hover:bg-blue-700 text-white"
                      : "border-blue-300 text-blue-600 hover:bg-blue-50"
                  }`}
                >
                  {getUpdateButtonContent()}
                </Button>
              )}
            <SupportDropdown />
            <Button variant="ghost" size="icon" onClick={() => setShowSettings(!showSettings)}>
              <Settings size={16} />
            </Button>
          </>
        }
      />

      <SettingsModal open={showSettings} onOpenChange={setShowSettings} />

      <div className="flex flex-1 overflow-hidden">
        <DashboardSidebar activeTab={activeTab} onTabChange={handleTabChange} />

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto">
            <StatsHeader stats={stats} />

            {/* Clear history button */}
            {transcriptions.length > 0 && (
              <div className="flex justify-end mb-4">
                <Button
                  onClick={clearHistory}
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-1.5"
                >
                  <Trash2 size={14} />
                  Clear All
                </Button>
              </div>
            )}

            <TranscriptionList
              transcriptions={transcriptions}
              onCopy={copyToClipboard}
              onDelete={deleteTranscription}
              isLoading={isLoading}
              hotkey={hotkey}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
