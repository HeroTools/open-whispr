import React, { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { RefreshCw, Download, Keyboard, Mic, Shield } from "lucide-react";
import WhisperModelPicker from "./WhisperModelPicker";
import ProcessingModeSelector from "./ui/ProcessingModeSelector";
import ApiKeyInput from "./ui/ApiKeyInput";
import { ConfirmDialog, AlertDialog } from "./ui/dialog";
import { useSettings } from "../hooks/useSettings";
import { useDialogs } from "../hooks/useDialogs";
import { useAgentName } from "../utils/agentName";
import { useWhisper } from "../hooks/useWhisper";
import { usePermissions } from "../hooks/usePermissions";
import { useClipboard } from "../hooks/useClipboard";
import { REASONING_PROVIDERS } from "../utils/languages";
import { formatHotkeyLabel } from "../utils/hotkeys";
import LanguageSelector from "./ui/LanguageSelector";
import PromptStudio from "./ui/PromptStudio";
import { API_ENDPOINTS } from "../config/constants";
import AIModelSelectorEnhanced from "./AIModelSelectorEnhanced";
import type { UpdateInfoResult } from "../types/electron";
const InteractiveKeyboard = React.lazy(() => import("./ui/Keyboard"));
import HotkeyCapture from "./ui/HotkeyCapture";
import { getLanguageLabel } from "../utils/languages";

export type SettingsSectionType =
  | "general"
  | "transcription"
  | "aiModels"
  | "agentConfig"
  | "prompts";

interface SettingsPageProps {
  activeSection?: SettingsSectionType;
}

export default function SettingsPage({ activeSection = "general" }: SettingsPageProps) {
  // Use custom hooks
  const {
    confirmDialog,
    alertDialog,
    showConfirmDialog,
    showAlertDialog,
    hideConfirmDialog,
    hideAlertDialog,
  } = useDialogs();

  const {
    useLocalWhisper,
    whisperModel,
    allowOpenAIFallback,
    allowLocalFallback,
    fallbackWhisperModel,
    preferredLanguage,
    cloudTranscriptionBaseUrl,
    enableTranslation,
    targetLanguage,
    cloudReasoningBaseUrl,
    useReasoningModel,
    reasoningModel,
    reasoningProvider,
    openaiApiKey,
    anthropicApiKey,
    geminiApiKey,
    dictationKey,
    setUseLocalWhisper,
    setWhisperModel,
    setAllowOpenAIFallback,
    setAllowLocalFallback,
    setFallbackWhisperModel,
    setPreferredLanguage,
    setCloudTranscriptionBaseUrl,
    setEnableTranslation,
    setTargetLanguage,
    setCloudReasoningBaseUrl,
    setUseReasoningModel,
    setReasoningModel,
    setReasoningProvider,
    setOpenaiApiKey,
    setAnthropicApiKey,
    setGeminiApiKey,
    setDictationKey,
    updateTranscriptionSettings,
    updateReasoningSettings,
    updateApiKeys,
  } = useSettings();

  // Update state
  const [currentVersion, setCurrentVersion] = useState<string>("");
  const [updateStatus, setUpdateStatus] = useState<{
    updateAvailable: boolean;
    updateDownloaded: boolean;
    isDevelopment: boolean;
  }>({ updateAvailable: false, updateDownloaded: false, isDevelopment: false });
  const [checkingForUpdates, setCheckingForUpdates] = useState(false);
  const [downloadingUpdate, setDownloadingUpdate] = useState(false);
  const [installInitiated, setInstallInitiated] = useState(false);
  const [updateDownloadProgress, setUpdateDownloadProgress] = useState(0);
  const [updateInfo, setUpdateInfo] = useState<{
    version?: string;
    releaseDate?: string;
    releaseNotes?: string;
  }>({});
  const [isRemovingModels, setIsRemovingModels] = useState(false);
  const cachePathHint =
    typeof navigator !== "undefined" && /Windows/i.test(navigator.userAgent)
      ? "%USERPROFILE%\\.cache\\openwhispr\\models"
      : "~/.cache/openwhispr/models";

  const isUpdateAvailable =
    !updateStatus.isDevelopment && (updateStatus.updateAvailable || updateStatus.updateDownloaded);

  const whisperHook = useWhisper(showAlertDialog);
  const permissionsHook = usePermissions(showAlertDialog);
  const { pasteFromClipboardWithFallback } = useClipboard(showAlertDialog);
  const { agentName, setAgentName } = useAgentName();
  const installTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const subscribeToUpdates = useCallback(() => {
    if (!window.electronAPI) return;

    window.electronAPI.onUpdateAvailable?.((_event, info) => {
      setUpdateStatus((prev) => ({ ...prev, updateAvailable: true, updateDownloaded: false }));
      if (info) {
        setUpdateInfo({
          version: info.version || "unknown",
          releaseDate: info.releaseDate,
          releaseNotes: info.releaseNotes ?? undefined,
        });
      }
    });

    window.electronAPI.onUpdateNotAvailable?.(() => {
      setUpdateStatus((prev) => ({ ...prev, updateAvailable: false, updateDownloaded: false }));
      setUpdateInfo({});
      setDownloadingUpdate(false);
      setInstallInitiated(false);
      setUpdateDownloadProgress(0);
    });

    window.electronAPI.onUpdateDownloaded?.((_event, info) => {
      setUpdateStatus((prev) => ({ ...prev, updateDownloaded: true }));
      setDownloadingUpdate(false);
      setInstallInitiated(false);
      if (info) {
        setUpdateInfo({
          version: info.version || "unknown",
          releaseDate: info.releaseDate,
          releaseNotes: info.releaseNotes ?? undefined,
        });
      }
    });

    window.electronAPI.onUpdateDownloadProgress?.((_event, progressObj) => {
      setUpdateDownloadProgress(progressObj.percent || 0);
    });

    window.electronAPI.onUpdateError?.((_event, error) => {
      setCheckingForUpdates(false);
      setDownloadingUpdate(false);
      setInstallInitiated(false);
      console.error("Update error:", error);
      showAlertDialog({
        title: "Update Error",
        description:
          typeof error?.message === "string"
            ? error.message
            : "The updater encountered a problem. Please try again or download the latest release manually.",
      });
    });
  }, [showAlertDialog]);

  // Local state for provider selection (overrides computed value)
  const [localReasoningProvider, setLocalReasoningProvider] = useState(() => {
    return localStorage.getItem("reasoningProvider") || reasoningProvider;
  });

  // Defer heavy operations for better performance
  useEffect(() => {
    let mounted = true;

    // Defer version and update checks to improve initial render
    const timer = setTimeout(async () => {
      if (!mounted) return;

      const versionResult = await window.electronAPI?.getAppVersion();
      if (versionResult && mounted) setCurrentVersion(versionResult.version);

      const statusResult = await window.electronAPI?.getUpdateStatus();
      if (statusResult && mounted) {
        setUpdateStatus((prev) => ({
          ...prev,
          ...statusResult,
          updateAvailable: prev.updateAvailable || statusResult.updateAvailable,
          updateDownloaded: prev.updateDownloaded || statusResult.updateDownloaded,
        }));
        if (
          (statusResult.updateAvailable || statusResult.updateDownloaded) &&
          window.electronAPI?.getUpdateInfo
        ) {
          const info = await window.electronAPI.getUpdateInfo();
          if (info) {
            setUpdateInfo({
              version: info.version || "unknown",
              releaseDate: info.releaseDate,
              releaseNotes: info.releaseNotes ?? undefined,
            });
          }
        }
      }

      subscribeToUpdates();

      // Check whisper after initial render
      if (mounted) {
        whisperHook.checkWhisperInstallation();
      }
    }, 100);

    return () => {
      mounted = false;
      clearTimeout(timer);
      // Always clean up update listeners if they exist
      if (window.electronAPI) {
        window.electronAPI.removeAllListeners?.("update-available");
        window.electronAPI.removeAllListeners?.("update-not-available");
        window.electronAPI.removeAllListeners?.("update-downloaded");
        window.electronAPI.removeAllListeners?.("update-error");
        window.electronAPI.removeAllListeners?.("update-download-progress");
      }
    };
  }, [whisperHook, subscribeToUpdates]);

  useEffect(() => {
    if (installInitiated) {
      if (installTimeoutRef.current) {
        clearTimeout(installTimeoutRef.current);
      }
      installTimeoutRef.current = setTimeout(() => {
        setInstallInitiated(false);
        showAlertDialog({
          title: "Still Running",
          description:
            "OpenWhispr didn't restart automatically. Please quit the app manually to finish installing the update.",
        });
      }, 10000);
    } else if (installTimeoutRef.current) {
      clearTimeout(installTimeoutRef.current);
      installTimeoutRef.current = null;
    }

    return () => {
      if (installTimeoutRef.current) {
        clearTimeout(installTimeoutRef.current);
        installTimeoutRef.current = null;
      }
    };
  }, [installInitiated, showAlertDialog]);

  const saveReasoningSettings = useCallback(async () => {
    const normalizedReasoningBase = (cloudReasoningBaseUrl || "").trim();
    setCloudReasoningBaseUrl(normalizedReasoningBase);

    // Update reasoning settings
    updateReasoningSettings({
      useReasoningModel,
      reasoningModel,
      cloudReasoningBaseUrl: normalizedReasoningBase,
    });

    // Save API keys to backend based on provider
    if (localReasoningProvider === "openai" && openaiApiKey) {
      await window.electronAPI?.saveOpenAIKey(openaiApiKey);
    }
    if (localReasoningProvider === "anthropic" && anthropicApiKey) {
      await window.electronAPI?.saveAnthropicKey(anthropicApiKey);
    }
    if (localReasoningProvider === "gemini" && geminiApiKey) {
      await window.electronAPI?.saveGeminiKey(geminiApiKey);
    }

    updateApiKeys({
      ...(localReasoningProvider === "openai" && openaiApiKey.trim() && { openaiApiKey }),
      ...(localReasoningProvider === "anthropic" && anthropicApiKey.trim() && { anthropicApiKey }),
      ...(localReasoningProvider === "gemini" && geminiApiKey.trim() && { geminiApiKey }),
    });

    // Save the provider separately since it's computed from the model
    localStorage.setItem("reasoningProvider", localReasoningProvider);

    const providerLabel =
      localReasoningProvider === "custom"
        ? "Custom"
        : REASONING_PROVIDERS[localReasoningProvider as keyof typeof REASONING_PROVIDERS]?.name ||
          localReasoningProvider;

    showAlertDialog({
      title: "Reasoning Settings Saved",
      description: `AI text enhancement ${useReasoningModel ? "enabled" : "disabled"} with ${
        providerLabel
      } ${reasoningModel}`,
    });
  }, [
    useReasoningModel,
    reasoningModel,
    localReasoningProvider,
    openaiApiKey,
    anthropicApiKey,
    updateReasoningSettings,
    updateApiKeys,
    showAlertDialog,
  ]);

  const saveApiKey = useCallback(async () => {
    try {
      // Save all API keys to backend
      if (openaiApiKey) {
        await window.electronAPI?.saveOpenAIKey(openaiApiKey);
      }
      if (anthropicApiKey) {
        await window.electronAPI?.saveAnthropicKey(anthropicApiKey);
      }
      if (geminiApiKey) {
        await window.electronAPI?.saveGeminiKey(geminiApiKey);
      }

      updateApiKeys({ openaiApiKey, anthropicApiKey, geminiApiKey });
      updateTranscriptionSettings({ allowLocalFallback, fallbackWhisperModel });

      try {
        if (openaiApiKey) {
          await window.electronAPI?.createProductionEnvFile(openaiApiKey);
        }

        const savedKeys: string[] = [];
        if (openaiApiKey) savedKeys.push("OpenAI");
        if (anthropicApiKey) savedKeys.push("Anthropic");
        if (geminiApiKey) savedKeys.push("Gemini");

        showAlertDialog({
          title: "API Keys Saved",
          description: `${savedKeys.join(", ")} API key${savedKeys.length > 1 ? "s" : ""} saved successfully! Your credentials have been securely recorded.${
            allowLocalFallback ? " Local Whisper fallback is enabled." : ""
          }`,
        });
      } catch (envError) {
        showAlertDialog({
          title: "API Key Saved",
          description: `OpenAI API key saved successfully and will be available for transcription${
            allowLocalFallback ? " with Local Whisper fallback enabled" : ""
          }`,
        });
      }
    } catch (error) {
      console.error("Failed to save API key:", error);
      updateApiKeys({ openaiApiKey });
      updateTranscriptionSettings({ allowLocalFallback, fallbackWhisperModel });
      showAlertDialog({
        title: "API Key Saved",
        description: "OpenAI API key saved to localStorage (fallback mode)",
      });
    }
  }, [
    openaiApiKey,
    anthropicApiKey,
    geminiApiKey,
    allowLocalFallback,
    fallbackWhisperModel,
    updateApiKeys,
    updateTranscriptionSettings,
    showAlertDialog,
  ]);

  const resetAccessibilityPermissions = () => {
    const message = `🔄 RESET ACCESSIBILITY PERMISSIONS\n\nIf you've rebuilt or reinstalled OpenWhispr and automatic inscription isn't functioning, you may have obsolete permissions from the previous version.\n\n📋 STEP-BY-STEP RESTORATION:\n\n1️⃣ Open System Settings (or System Preferences)\n   • macOS Ventura+: Apple Menu → System Settings\n   • Older macOS: Apple Menu → System Preferences\n\n2️⃣ Navigate to Privacy & Security → Accessibility\n\n3️⃣ Look for obsolete OpenWhispr entries:\n   • Any entries named "OpenWhispr"\n   • Any entries named "Electron"\n   • Any entries with unclear or generic names\n   • Entries pointing to old application locations\n\n4️⃣ Remove ALL obsolete entries:\n   • Select each old entry\n   • Click the minus (-) button\n   • Enter your password if prompted\n\n5️⃣ Add the current OpenWhispr:\n   • Click the plus (+) button\n   • Navigate to and select the CURRENT OpenWhispr app\n   • Ensure the checkbox is ENABLED\n\n6️⃣ Restart OpenWhispr completely\n\n💡 This is very common during development when rebuilding applications!\n\nClick OK when you're ready to open System Settings.`;

    showConfirmDialog({
      title: "Reset Accessibility Permissions",
      description: message,
      onConfirm: () => {
        showAlertDialog({
          title: "Opening System Settings",
          description:
            "Opening System Settings... Look for the Accessibility section under Privacy & Security.",
        });

        window.open(
          "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
          "_blank"
        );
      },
    });
  };

  const saveKey = async () => {
    try {
      const result = await window.electronAPI?.updateHotkey(dictationKey);

      if (!result?.success) {
        showAlertDialog({
          title: "Hotkey Not Saved",
          description:
            result?.message || "This key could not be registered. Please choose a different key.",
        });
        return;
      }

      showAlertDialog({
        title: "Key Saved",
        description: `Dictation key saved: ${formatHotkeyLabel(dictationKey)}`,
      });
    } catch (error) {
      console.error("Failed to update hotkey:", error);
      showAlertDialog({
        title: "Error",
        description: `Failed to update hotkey: ${error.message}`,
      });
    }
  };

  const handleRemoveModels = useCallback(() => {
    if (isRemovingModels) return;

    showConfirmDialog({
      title: "Remove downloaded models?",
      description: `This deletes all locally cached Whisper models (${cachePathHint}) and frees disk space. You can download them again from the model picker.`,
      confirmText: "Delete Models",
      variant: "destructive",
      onConfirm: () => {
        setIsRemovingModels(true);
        window.electronAPI
          ?.modelDeleteAll?.()
          .then((result) => {
            if (!result?.success) {
              showAlertDialog({
                title: "Unable to Remove Models",
                description:
                  result?.error || "Something went wrong while deleting the cached models.",
              });
              return;
            }

            window.dispatchEvent(new Event("openwhispr-models-cleared"));

            showAlertDialog({
              title: "Models Removed",
              description:
                "All downloaded Whisper models were deleted. You can re-download any model from the picker when needed.",
            });
          })
          .catch((error) => {
            showAlertDialog({
              title: "Unable to Remove Models",
              description: error?.message || "An unknown error occurred.",
            });
          })
          .finally(() => {
            setIsRemovingModels(false);
          });
      },
    });
  }, [isRemovingModels, cachePathHint, showConfirmDialog, showAlertDialog]);

  const renderSectionContent = () => {
    switch (activeSection) {
      case "general":
        return (
          <div className="space-y-6">
            {/* Version & Updates */}
            <section className="space-y-4">
              <div className="border-b border-primary-200 pb-3">
                <h3 className="text-base font-semibold text-primary-900">Version & Updates</h3>
                <p className="mt-1 text-sm text-secondary-500">
                  Keep OpenWhispr up to date with the latest features
                </p>
              </div>

              <div className="space-y-4 rounded-lg border border-primary-200 bg-primary-50 p-4">
                <h4 className="font-medium text-primary-900">Version Information</h4>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-primary-900">Current Version</p>
                    <p className="mt-0.5 text-sm text-secondary-500">{currentVersion || "Loading..."}</p>
                  </div>
                  <div>
                    {updateStatus.isDevelopment ? (
                      <span className="rounded-lg border border-primary-200 bg-primary-50 px-2.5 py-1 text-xs font-medium text-secondary-500">
                        Development
                      </span>
                    ) : updateStatus.updateAvailable ? (
                      <span className="rounded-lg bg-primary-500/10 px-2.5 py-1 text-xs font-medium text-primary-600">
                        Update Available
                      </span>
                    ) : (
                      <span className="rounded-lg border border-primary-200 bg-primary-50 px-2.5 py-1 text-xs font-medium text-secondary-500">
                        Up to Date
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Button
                    onClick={async () => {
                      setCheckingForUpdates(true);
                      try {
                        const result = await window.electronAPI?.checkForUpdates();
                        if (result?.updateAvailable) {
                          setUpdateInfo({
                            version: result.version || "unknown",
                            releaseDate: result.releaseDate,
                            releaseNotes: result.releaseNotes,
                          });
                          setUpdateStatus((prev) => ({
                            ...prev,
                            updateAvailable: true,
                            updateDownloaded: false,
                          }));
                          showAlertDialog({
                            title: "Update Available",
                            description: `Update available: v${result.version || "new version"}`,
                          });
                        } else {
                          showAlertDialog({
                            title: "No Updates",
                            description: result?.message || "No updates available",
                          });
                        }
                      } catch (error: any) {
                        showAlertDialog({
                          title: "Update Check Failed",
                          description: `Error checking for updates: ${error.message}`,
                        });
                      } finally {
                        setCheckingForUpdates(false);
                      }
                    }}
                    disabled={checkingForUpdates || updateStatus.isDevelopment}
                    variant="outline"
                    className="w-full"
                  >
                    <RefreshCw size={16} />
                    {checkingForUpdates ? "Checking..." : "Check for Updates"}
                  </Button>

                  {isUpdateAvailable && !updateStatus.updateDownloaded && (
                    <>
                      <Button
                        onClick={async () => {
                          setDownloadingUpdate(true);
                          setUpdateDownloadProgress(0);
                          try {
                            await window.electronAPI?.downloadUpdate();
                          } catch (error: any) {
                            setDownloadingUpdate(false);
                            showAlertDialog({
                              title: "Download Failed",
                              description: `Failed to download update: ${error.message}`,
                            });
                          }
                        }}
                        disabled={downloadingUpdate}
                        variant="default"
                        className="w-full"
                      >
                        <Download size={16} />
                        {downloadingUpdate
                          ? `Downloading... ${Math.round(updateDownloadProgress)}%`
                          : `Download v${updateInfo.version || ""}`}
                      </Button>

                      {downloadingUpdate && (
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary-100">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-300"
                            style={{
                              width: `${Math.min(100, Math.max(0, updateDownloadProgress))}%`,
                            }}
                          />
                        </div>
                      )}
                    </>
                  )}

                  {updateStatus.updateDownloaded && (
                    <Button
                      onClick={() => {
                        showConfirmDialog({
                          title: "Install Update",
                          description: `Ready to install v${updateInfo.version || ""}. The app will restart.`,
                          confirmText: "Install & Restart",
                          onConfirm: async () => {
                            try {
                              setInstallInitiated(true);
                              const result = await window.electronAPI?.installUpdate?.();
                              if (!result?.success) {
                                setInstallInitiated(false);
                                showAlertDialog({
                                  title: "Install Failed",
                                  description: result?.message || "Failed to start installer.",
                                });
                                return;
                              }
                              showAlertDialog({
                                title: "Installing Update",
                                description: "OpenWhispr will restart to complete installation.",
                              });
                            } catch (error: any) {
                              setInstallInitiated(false);
                              showAlertDialog({
                                title: "Install Failed",
                                description: `Failed to install: ${error.message}`,
                              });
                            }
                          },
                        });
                      }}
                      disabled={installInitiated}
                      variant="default"
                      className="w-full"
                    >
                      <RefreshCw size={16} className={installInitiated ? "animate-spin" : ""} />
                      {installInitiated ? "Installing..." : "Install & Restart"}
                    </Button>
                  )}
                </div>

                {updateInfo.version && (
                  <div className="mt-3 rounded-lg border border-primary-200 bg-primary-50 p-3 text-sm">
                    <p className="mb-1 font-medium text-primary-900">Version {updateInfo.version}</p>
                    {updateInfo.releaseDate && (
                      <p className="mb-2 text-xs text-secondary-500">
                        {new Date(updateInfo.releaseDate).toLocaleDateString()}
                      </p>
                    )}
                    {updateInfo.releaseNotes && (
                      <div className="mt-2 border-t border-primary-200 pt-2 text-xs text-primary-800">
                        <div className="whitespace-pre-wrap">{updateInfo.releaseNotes}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* Dictation Hotkey */}
            <section className="space-y-4">
              <div className="border-b border-primary-200 pb-3">
                <h3 className="text-base font-semibold text-primary-900">Dictation Hotkey</h3>
                <p className="mt-1 text-sm text-secondary-500">
                  Key combination to start and stop dictation
                </p>
              </div>

              <div className="space-y-4 rounded-lg border border-primary-200 bg-primary-50 p-4">
                <h4 className="font-medium text-primary-900">Configure Hotkey</h4>

                <Tabs defaultValue="capture" className="space-y-4">
                  <TabsList className="grid w-full grid-cols-2 !bg-white border border-primary-200">
                    <TabsTrigger value="capture">Key Combinations</TabsTrigger>
                    <TabsTrigger value="keyboard">Visual Keyboard</TabsTrigger>
                  </TabsList>

                  <TabsContent value="capture" className="space-y-3">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-primary-900">
                        Hotkey Combination
                      </label>
                      <HotkeyCapture
                        value={dictationKey}
                        onChange={setDictationKey}
                        placeholder="Click and press a key combination"
                      />
                      <p className="mt-2 text-xs text-secondary-500">
                        Supports modifier keys (Ctrl, Alt, Shift)
                      </p>
                    </div>
                  </TabsContent>

                  <TabsContent value="keyboard" className="space-y-3">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-primary-900">
                        Activation Key
                      </label>
                      <Input
                        placeholder="Default: ` (backtick)"
                        value={dictationKey}
                        onChange={(e) => setDictationKey(e.target.value)}
                        className="text-center font-mono text-lg"
                      />
                      <p className="mt-2 text-xs text-secondary-500">
                        Press this key from anywhere to start/stop dictation
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-primary-900">Select a key:</p>
                      <React.Suspense
                        fallback={
                          <div className="flex h-32 items-center justify-center text-sm text-secondary-500">
                            Loading keyboard...
                          </div>
                        }
                      >
                        <InteractiveKeyboard
                          selectedKey={dictationKey}
                          setSelectedKey={setDictationKey}
                        />
                      </React.Suspense>
                    </div>
                  </TabsContent>
                </Tabs>

                <Button onClick={saveKey} disabled={!dictationKey.trim()} variant="default" className="w-full">
                  <Keyboard size={16} />
                  Save Hotkey
                </Button>
              </div>
            </section>

            {/* System Permissions */}
            <section className="space-y-4">
              <div className="border-b border-primary-200 pb-3">
                <h3 className="text-base font-semibold text-primary-900">System Permissions</h3>
                <p className="mt-1 text-sm text-secondary-500">
                  Manage microphone and accessibility access
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Button onClick={permissionsHook.requestMicPermission} variant="outline" className="w-full">
                  <Mic className="h-4 w-4" />
                  Test Microphone
                </Button>
                <Button onClick={permissionsHook.testAccessibilityPermission} variant="outline" className="w-full">
                  <Shield className="h-4 w-4" />
                  Test Accessibility
                </Button>
                <Button onClick={resetAccessibilityPermissions} variant="outline" className="w-full">
                  <RefreshCw className="h-4 w-4" />
                  Reset Permissions
                </Button>
              </div>
            </section>

            {/* Application Info */}
            <section className="space-y-4">
              <div className="border-b border-primary-200 pb-3">
                <h3 className="text-base font-semibold text-primary-900">Application Info</h3>
                <p className="mt-1 text-sm text-secondary-500">Quick overview of app status</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-primary-200 bg-primary-50 p-4 text-center">
                  <Keyboard className="mx-auto mb-2 h-5 w-5 text-secondary-500" />
                  <p className="mb-1 text-xs font-medium text-primary-900">Hotkey</p>
                  <p className="font-mono text-xs text-secondary-500">
                    {formatHotkeyLabel(dictationKey)}
                  </p>
                </div>
                <div className="rounded-lg border border-primary-200 bg-primary-50 p-4 text-center">
                  <div className="mx-auto mb-2 h-5 w-5 text-center text-sm font-semibold text-secondary-500">v</div>
                  <p className="mb-1 text-xs font-medium text-primary-900">Version</p>
                  <p className="text-xs text-secondary-500">{currentVersion || "0.1.0"}</p>
                </div>
                <div className="rounded-lg border border-primary-200 bg-primary-50 p-4 text-center">
                  <div className="mx-auto mb-2 h-5 w-5 text-center text-2xl leading-5 text-primary-500">•</div>
                  <p className="mb-1 text-xs font-medium text-primary-900">Status</p>
                  <p className="text-xs font-medium text-primary-600">Active</p>
                </div>
              </div>
            </section>

            {/* Maintenance & Storage */}
            <section className="space-y-4">
              <div className="border-b border-primary-200 pb-3">
                <h3 className="text-base font-semibold text-primary-900">Maintenance & Storage</h3>
                <p className="mt-1 text-sm text-secondary-500">Reset settings and manage app data</p>
              </div>

              <div className="space-y-3">
                <div className="rounded-lg border border-primary-200 bg-primary-50 p-3">
                  <p className="text-xs text-secondary-500">
                    Model cache: <code className="font-mono text-primary-800">{cachePathHint}</code>
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Button
                    onClick={() => {
                      showConfirmDialog({
                        title: "Reset Onboarding",
                        description:
                          "Reset the onboarding process and show the welcome flow again?",
                        onConfirm: () => {
                          localStorage.removeItem("onboardingCompleted");
                          window.location.reload();
                        },
                        variant: "destructive",
                      });
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Reset Setup
                  </Button>

                  <Button
                    variant="outline"
                    onClick={handleRemoveModels}
                    disabled={isRemovingModels}
                    className="w-full"
                  >
                    <Download className="h-4 w-4" />
                    {isRemovingModels ? "Removing..." : "Remove Models"}
                  </Button>

                  <Button
                    onClick={() => {
                      showConfirmDialog({
                        title: "Delete All Data",
                        description:
                          "Permanently delete ALL app data including database, settings, and models? This cannot be undone.",
                        onConfirm: () => {
                          window.electronAPI
                            ?.cleanupApp()
                            .then(() => {
                              showAlertDialog({
                                title: "Data Deleted",
                                description: "All app data has been removed.",
                              });
                              setTimeout(() => window.location.reload(), 1000);
                            })
                            .catch((error) => {
                              showAlertDialog({
                                title: "Cleanup Failed",
                                description: `Error: ${error.message}`,
                              });
                            });
                        },
                        variant: "destructive",
                      });
                    }}
                    variant="destructive-outline"
                    className="w-full"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                    Delete Data
                  </Button>
                </div>
              </div>
            </section>
          </div>
        );

      case "transcription":
        return (
          <div className="space-y-6">
            <section className="space-y-4">
              <div className="border-b border-primary-200 pb-3">
                <h3 className="text-base font-semibold text-primary-900">
                  Speech to Text Processing
                </h3>
                <p className="mt-1 text-sm text-secondary-500">
                  Configure how your voice is transcribed
                </p>
              </div>
              <ProcessingModeSelector
                useLocalWhisper={useLocalWhisper}
                setUseLocalWhisper={(value) => {
                  setUseLocalWhisper(value);
                  updateTranscriptionSettings({ useLocalWhisper: value });
                }}
              />
            </section>

            {!useLocalWhisper && (
              <section className="space-y-4 rounded-lg border border-primary-200 bg-primary-50 p-4">
                <h4 className="font-medium text-primary-900">Cloud Setup</h4>
                <ApiKeyInput
                  apiKey={openaiApiKey}
                  setApiKey={setOpenaiApiKey}
                  helpText="Supports OpenAI or compatible endpoints"
                />
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-primary-900">
                    Custom Base URL (optional)
                  </label>
                  <Input
                    value={cloudTranscriptionBaseUrl}
                    onChange={(event) => setCloudTranscriptionBaseUrl(event.target.value)}
                    placeholder="https://api.openai.com/v1"
                    className="text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCloudTranscriptionBaseUrl(API_ENDPOINTS.TRANSCRIPTION_BASE)}
                  >
                    Reset to Default
                  </Button>
                  <p className="text-xs text-secondary-500">
                    Requests use this OpenAI-compatible base URL. Leave empty for default
                    <code className="ml-1 text-primary-900">{API_ENDPOINTS.TRANSCRIPTION_BASE}</code>
                  </p>
                </div>
              </section>
            )}

            {useLocalWhisper && whisperHook.whisperInstalled && (
              <section className="space-y-4 rounded-lg border border-primary-200 bg-primary-50 p-4">
                <h4 className="font-medium text-primary-900">Local Whisper Model</h4>
                <WhisperModelPicker
                  selectedModel={whisperModel}
                  onModelSelect={setWhisperModel}
                  variant="settings"
                />
              </section>
            )}

            <section className="space-y-4 rounded-lg border border-primary-200 bg-primary-50 p-4">
              <h4 className="font-medium text-primary-900">Preferred Language</h4>
              <LanguageSelector
                value={preferredLanguage}
                onChange={(value) => {
                  setPreferredLanguage(value);
                  updateTranscriptionSettings({ preferredLanguage: value });
                }}
                className="w-full"
              />
              <p className="text-xs text-secondary-500">Language for speech recognition</p>
            </section>

            {/* Translation Section */}
            <section className="space-y-3 rounded-lg border border-primary-200 bg-primary-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-primary-900">Automatic Translation</p>
                  <p className="mt-0.5 text-xs text-secondary-500">
                    Translate text to another language
                  </p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={enableTranslation}
                    onChange={(e) => {
                      setEnableTranslation(e.target.checked);
                      updateTranscriptionSettings({ enableTranslation: e.target.checked });
                    }}
                    className="peer sr-only"
                  />
                  <div className="peer h-6 w-11 rounded-full bg-primary-200 peer-checked:bg-primary peer-focus:ring-2 peer-focus:ring-primary/30 peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-primary-200 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                </label>
              </div>

              {enableTranslation && (
                <div className="space-y-3 border-t border-primary-200 pt-3">
                  <div className="flex items-center gap-2 rounded-lg border border-primary-200 bg-white p-3 text-xs">
                    <div className="flex-1">
                      <p className="mb-0.5 text-secondary-500">From</p>
                      <p className="font-medium text-primary-900">
                        {getLanguageLabel(preferredLanguage)}
                      </p>
                    </div>
                    <div className="text-secondary-500">→</div>
                    <div className="flex-1">
                      <p className="mb-0.5 text-secondary-500">To</p>
                      <p className="font-medium text-primary-900">
                        {getLanguageLabel(targetLanguage)}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-primary-900">
                      Target Language
                    </label>
                    <LanguageSelector
                      value={targetLanguage}
                      onChange={(value) => {
                        setTargetLanguage(value);
                        updateTranscriptionSettings({ targetLanguage: value });
                      }}
                      className="w-full"
                    />
                  </div>

                  <div className="rounded-lg border border-primary-200 bg-white p-2.5">
                    <p className="text-xs text-secondary-500">
                      Uses {reasoningModel}. Requires API key.
                    </p>
                  </div>
                </div>
              )}
            </section>

            <Button
              onClick={() => {
                const normalizedTranscriptionBase = (cloudTranscriptionBaseUrl || "").trim();
                setCloudTranscriptionBaseUrl(normalizedTranscriptionBase);

                updateTranscriptionSettings({
                  useLocalWhisper,
                  whisperModel,
                  preferredLanguage,
                  cloudTranscriptionBaseUrl: normalizedTranscriptionBase,
                  enableTranslation,
                  targetLanguage,
                });

                if (!useLocalWhisper && openaiApiKey.trim()) {
                  updateApiKeys({ openaiApiKey });
                }

                const descriptionParts = [
                  `Transcription mode: ${useLocalWhisper ? "Local Whisper" : "Cloud"}.`,
                  `Language: ${preferredLanguage}.`,
                ];

                if (enableTranslation) {
                  descriptionParts.push(
                    `Translation enabled: ${preferredLanguage} → ${targetLanguage}.`
                  );
                }

                if (!useLocalWhisper) {
                  const baseLabel = normalizedTranscriptionBase || API_ENDPOINTS.TRANSCRIPTION_BASE;
                  descriptionParts.push(`Endpoint: ${baseLabel}.`);
                }

                showAlertDialog({
                  title: "Settings Saved",
                  description: descriptionParts.join(" "),
                });
              }}
              className="h-10 w-full"
            >
              Save Transcription Settings
            </Button>
          </div>
        );

      case "aiModels":
        return (
          <div className="space-y-6">
            <section className="space-y-4">
              <div className="border-b border-primary-200 pb-3">
                <h3 className="text-base font-semibold text-primary-900">AI Text Enhancement</h3>
                <p className="mt-1 text-sm text-secondary-500">
                  Configure how AI models clean up and format your transcriptions
                </p>
              </div>
            </section>

            <AIModelSelectorEnhanced
              useReasoningModel={useReasoningModel}
              setUseReasoningModel={(value) => {
                setUseReasoningModel(value);
                updateReasoningSettings({ useReasoningModel: value });
              }}
              setCloudReasoningBaseUrl={setCloudReasoningBaseUrl}
              cloudReasoningBaseUrl={cloudReasoningBaseUrl}
              reasoningModel={reasoningModel}
              setReasoningModel={setReasoningModel}
              localReasoningProvider={localReasoningProvider}
              setLocalReasoningProvider={setLocalReasoningProvider}
              openaiApiKey={openaiApiKey}
              setOpenaiApiKey={setOpenaiApiKey}
              anthropicApiKey={anthropicApiKey}
              setAnthropicApiKey={setAnthropicApiKey}
              geminiApiKey={geminiApiKey}
              setGeminiApiKey={setGeminiApiKey}
              pasteFromClipboard={pasteFromClipboardWithFallback}
              showAlertDialog={showAlertDialog}
            />

            <Button onClick={saveReasoningSettings} className="h-10 w-full">
              Save AI Model Settings
            </Button>
          </div>
        );

      case "agentConfig":
        return (
          <div className="space-y-6">
            <section className="space-y-4">
              <div className="border-b border-primary-200 pb-3">
                <h3 className="text-base font-semibold text-primary-900">Agent Configuration</h3>
                <p className="mt-1 text-sm text-secondary-500">
                  Customize your AI assistant name and behavior
                </p>
              </div>
            </section>

            <section className="space-y-4 rounded-lg border border-primary-200 bg-primary-50 p-4">
              <h4 className="mb-3 font-medium text-primary-900">How to use agent names</h4>
              <ul className="space-y-2 text-sm text-primary-900">
                <li>Say "Hey {agentName}, write a formal email" for specific instructions</li>
                <li>Use "Hey {agentName}, format this as a list" for text enhancement</li>
                <li>
                  The agent recognizes when you're addressing it directly vs. dictating content
                </li>
                <li>Makes conversations natural and helps distinguish commands from dictation</li>
              </ul>
            </section>

            <section className="space-y-4 rounded-lg border border-primary-200 bg-primary-50 p-4">
              <h4 className="font-medium text-primary-900">Current Agent Name</h4>
              <div className="flex gap-3">
                <Input
                  placeholder="e.g., Assistant, Jarvis, Alex..."
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  className="flex-1 text-center font-mono text-lg"
                />
                <Button
                  onClick={() => {
                    setAgentName(agentName.trim());
                    showAlertDialog({
                      title: "Agent Name Updated",
                      description: `Your agent is now named "${agentName.trim()}". You can address it by saying "Hey ${agentName.trim()}" followed by your instructions.`,
                    });
                  }}
                  disabled={!agentName.trim()}
                  className="h-10"
                >
                  Save
                </Button>
              </div>
              <p className="mt-2 text-xs text-secondary-500">
                Choose a name that feels natural to say and remember
              </p>
            </section>

            <section className="rounded-lg border border-primary-200 bg-primary-50 p-4">
              <h4 className="mb-3 font-medium text-primary-900">Example Usage</h4>
              <div className="space-y-2 text-sm text-primary-900">
                <p>"Hey {agentName}, write an email to my team about the meeting"</p>
                <p>"Hey {agentName}, make this more professional" (after dictating text)</p>
                <p>"Hey {agentName}, convert this to bullet points"</p>
                <p className="text-secondary-500">
                  Regular dictation: "This is just normal text" (no agent name needed)
                </p>
              </div>
            </section>
          </div>
        );

      case "prompts":
        return (
          <div className="space-y-6">
            <section className="space-y-4">
              <div className="border-b border-primary-200 pb-3">
                <h3 className="text-base font-semibold text-primary-900">AI Prompt Management</h3>
                <p className="mt-1 text-sm text-secondary-500">
                  View and customize prompts that power AI text processing
                </p>
              </div>
            </section>

            <PromptStudio />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => !open && hideConfirmDialog()}
        title={confirmDialog.title}
        description={confirmDialog.description}
        onConfirm={confirmDialog.onConfirm}
        variant={confirmDialog.variant}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
      />

      <AlertDialog
        open={alertDialog.open}
        onOpenChange={(open) => !open && hideAlertDialog()}
        title={alertDialog.title}
        description={alertDialog.description}
        onOk={() => {}}
      />

      {renderSectionContent()}
    </>
  );
}
