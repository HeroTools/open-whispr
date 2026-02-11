import React, { Suspense, useState, useEffect, useRef, useCallback } from "react";
import { Button } from "./ui/button";
import { Download, RefreshCw, Loader2 } from "lucide-react";
import type { SettingsSectionType } from "./SettingsModal";
import UpgradePrompt from "./UpgradePrompt";
import { ConfirmDialog, AlertDialog } from "./ui/dialog";
import { useDialogs } from "../hooks/useDialogs";
import { useHotkey } from "../hooks/useHotkey";
import { useToast } from "./ui/Toast";
import { useUpdater } from "../hooks/useUpdater";
import { useSettings } from "../hooks/useSettings";
import { useAuth } from "../hooks/useAuth";
import {
  useTranscriptions,
  initializeTranscriptions,
  removeTranscription as removeFromStore,
  clearTranscriptions as clearStoreTranscriptions,
} from "../stores/transcriptionStore";
import ControlPanelSidebar, { type ControlPanelView } from "./ControlPanelSidebar";
import { setActiveNoteId } from "../stores/noteStore";
import HistoryView from "./HistoryView";

const SettingsModal = React.lazy(() => import("./SettingsModal"));
const PersonalNotesView = React.lazy(() => import("./notes/PersonalNotesView"));
const DictionaryView = React.lazy(() => import("./DictionaryView"));
const UploadAudioView = React.lazy(() => import("./notes/UploadAudioView"));
const ReferralView = React.lazy(() => import("./ReferralView"));

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
  const [activeView, setActiveView] = useState<ControlPanelView>("home");
  const cloudMigrationProcessed = useRef(false);
  const { hotkey } = useHotkey();
  const { toast } = useToast();
  const { useReasoningModel, setUseLocalWhisper, setCloudTranscriptionMode } = useSettings();
  const { isSignedIn, isLoaded: authLoaded, user } = useAuth();

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
        title: "Update Ready",
        description: "Click 'Install Update' to restart and apply the update.",
        variant: "success",
      });
    }
  }, [updateStatus.updateDownloaded, isDownloading, toast]);

  useEffect(() => {
    if (updateError) {
      toast({
        title: "Update Error",
        description: "Failed to update. Please try again later.",
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
            title: "Daily Limit Reached",
            description: "Resets at midnight UTC. Upgrade to Pro or use your own API key.",
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
        title: "Unable to load history",
        description: "Please try again in a moment.",
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
          title: "Copy Failed",
          description: "Failed to copy text to clipboard",
          variant: "destructive",
        });
      }
    },
    [toast]
  );

  const clearHistory = useCallback(async () => {
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
  }, [showConfirmDialog, toast]);

  const deleteTranscription = useCallback(
    async (id: number) => {
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
    },
    [showConfirmDialog, showAlertDialog]
  );

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
    <div className="min-h-screen bg-background flex flex-col">
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

      <div className="flex flex-1 overflow-hidden">
        <ControlPanelSidebar
          activeView={activeView}
          onViewChange={setActiveView}
          onOpenSettings={() => {
            setSettingsSection(undefined);
            setShowSettings(true);
          }}
          userName={user?.name}
          userEmail={user?.email}
          userImage={user?.image}
          isSignedIn={isSignedIn}
          updateAction={
            !updateStatus.isDevelopment &&
            (updateStatus.updateAvailable ||
              updateStatus.updateDownloaded ||
              isDownloading ||
              isInstalling) ? (
              <Button
                variant={updateStatus.updateDownloaded ? "default" : "outline"}
                size="sm"
                onClick={handleUpdateClick}
                disabled={isInstalling || isDownloading}
                className="gap-1.5 text-[11px] w-full h-7"
              >
                {getUpdateButtonContent()}
              </Button>
            ) : undefined
          }
        />
        <main className="flex-1 flex flex-col overflow-hidden">
          <div
            className="w-full h-10 shrink-0"
            style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
          />
          <div className="flex-1 overflow-y-auto pt-1">
            {activeView === "home" && (
              <HistoryView
                history={history}
                isLoading={isLoading}
                hotkey={hotkey}
                showCloudMigrationBanner={showCloudMigrationBanner}
                setShowCloudMigrationBanner={setShowCloudMigrationBanner}
                aiCTADismissed={aiCTADismissed}
                setAiCTADismissed={setAiCTADismissed}
                useReasoningModel={useReasoningModel}
                clearHistory={clearHistory}
                copyToClipboard={copyToClipboard}
                deleteTranscription={deleteTranscription}
                onOpenSettings={(section) => {
                  setSettingsSection(section as SettingsSectionType);
                  setShowSettings(true);
                }}
              />
            )}
            {activeView === "personal-notes" && (
              <Suspense fallback={null}>
                <PersonalNotesView />
              </Suspense>
            )}
            {activeView === "dictionary" && (
              <Suspense fallback={null}>
                <DictionaryView />
              </Suspense>
            )}
            {activeView === "upload" && (
              <Suspense fallback={null}>
                <UploadAudioView onNoteCreated={(noteId) => { setActiveNoteId(noteId); setActiveView("personal-notes"); }} />
              </Suspense>
            )}
            {activeView === "referrals" && (
              <Suspense fallback={null}>
                <ReferralView />
              </Suspense>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
