import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Trash2, Settings, FileText, Mic, Download, RefreshCw, Loader2 } from "lucide-react";
import SettingsModal from "./SettingsModal";
import TitleBar from "./TitleBar";
import SupportDropdown from "./ui/SupportDropdown";
import TranscriptionItem from "./ui/TranscriptionItem";
import { ConfirmDialog, AlertDialog } from "./ui/dialog";
import { useDialogs } from "../hooks/useDialogs";
import { useHotkey } from "../hooks/useHotkey";
import { useToast } from "./ui/Toast";
import {
  useTranscriptions,
  initializeTranscriptions,
  removeTranscription as removeFromStore,
  clearTranscriptions as clearStoreTranscriptions,
} from "../stores/transcriptionStore";

export default function ControlPanel() {
  const history = useTranscriptions();
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const { hotkey } = useHotkey();
  const { toast } = useToast();
  const [updateStatus, setUpdateStatus] = useState({
    updateAvailable: false,
    updateDownloaded: false,
    isDevelopment: false,
  });
  const [isDownloading, setIsDownloading] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const isInstallingRef = useRef(false);

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
      setIsDownloading(false);
      setDownloadProgress(100);
      setUpdateStatus((prev) => ({ ...prev, updateDownloaded: true }));
      toast({
        title: "Update Ready",
        description: "Click 'Install Update' to restart and apply the update.",
        variant: "success",
      });
    };

    const handleUpdateError = (_event: any, _error: any) => {
      setIsDownloading(false);
      setIsInstalling(false);
      toast({
        title: "Update Error",
        description: "Failed to update. Please try again later.",
        variant: "destructive",
      });
    };

    const handleDownloadProgress = (_event: any, progressObj: any) => {
      if (progressObj?.percent != null) {
        const newProgress = Math.round(progressObj.percent);
        setDownloadProgress((prev) => (newProgress > prev ? newProgress : prev));
        setIsDownloading(true);
      }
    };

    const disposers = [
      window.electronAPI.onUpdateAvailable(handleUpdateAvailable),
      window.electronAPI.onUpdateDownloaded(handleUpdateDownloaded),
      window.electronAPI.onUpdateError(handleUpdateError),
      window.electronAPI.onUpdateDownloadProgress(handleDownloadProgress),
    ];

    // Cleanup listeners on unmount
    return () => {
      disposers.forEach((dispose) => dispose?.());
    };
  }, []);

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
      description:
        "Are you certain you wish to clear all inscribed records? This action cannot be undone.",
      onConfirm: async () => {
        try {
          const result = await window.electronAPI.clearTranscriptions();
          clearStoreTranscriptions();
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
          setIsInstalling(true);
          isInstallingRef.current = true;
          try {
            await window.electronAPI.installUpdate();
            // Set a timeout to show an alert if the app doesn't restart
            setTimeout(() => {
              if (isInstallingRef.current) {
                isInstallingRef.current = false;
                setIsInstalling(false);
                showAlertDialog({
                  title: "Update Installation",
                  description:
                    "The app may not have restarted automatically. Please quit and reopen the app to complete the update.",
                });
              }
            }, 10000);
          } catch (error) {
            isInstallingRef.current = false;
            setIsInstalling(false);
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
      setIsDownloading(true);
      setDownloadProgress(0);
      try {
        await window.electronAPI.downloadUpdate();
      } catch (error) {
        setIsDownloading(false);
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

      {/* Main content */}
      <div className="p-6">
        <div className="space-y-6 max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText size={18} className="text-indigo-600" />
                  Recent Transcriptions
                </CardTitle>
                <div className="flex gap-2">
                  {history.length > 0 && (
                    <Button
                      onClick={clearHistory}
                      variant="ghost"
                      size="icon"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 mx-auto mb-3 bg-indigo-600 rounded-lg flex items-center justify-center">
                    <span className="text-white text-sm">📝</span>
                  </div>
                  <p className="text-neutral-600">Loading transcriptions...</p>
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 bg-neutral-100 rounded-full flex items-center justify-center">
                    <Mic className="w-8 h-8 text-neutral-400" />
                  </div>
                  <h3 className="text-lg font-medium text-neutral-900 mb-2">
                    No transcriptions yet
                  </h3>
                  <p className="text-neutral-600 mb-4 max-w-sm mx-auto">
                    Press your hotkey to start recording and create your first transcription.
                  </p>
                  <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 max-w-md mx-auto">
                    <h4 className="font-medium text-neutral-800 mb-2">Quick Start:</h4>
                    <ol className="text-sm text-neutral-600 text-left space-y-1">
                      <li>1. Click in any text field</li>
                      <li>
                        2. Press{" "}
                        <kbd className="bg-white px-2 py-1 rounded text-xs font-mono border border-neutral-300">
                          {hotkey}
                        </kbd>{" "}
                        to start recording
                      </li>
                      <li>3. Speak your text</li>
                      <li>
                        4. Press{" "}
                        <kbd className="bg-white px-2 py-1 rounded text-xs font-mono border border-neutral-300">
                          {hotkey}
                        </kbd>{" "}
                        again to stop
                      </li>
                      <li>5. Your text will appear automatically!</li>
                    </ol>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
