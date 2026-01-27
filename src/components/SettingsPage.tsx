import React, { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  RefreshCw,
  Download,
  Command,
  Mic,
  Shield,
  FolderOpen,
  LogOut,
  UserCircle,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { NEON_AUTH_URL } from "../lib/neonAuth";
import MarkdownRenderer from "./ui/MarkdownRenderer";
import MicPermissionWarning from "./ui/MicPermissionWarning";
import MicrophoneSettings from "./ui/MicrophoneSettings";
import TranscriptionModelPicker from "./TranscriptionModelPicker";
import { ConfirmDialog, AlertDialog } from "./ui/dialog";
import { useSettings } from "../hooks/useSettings";
import { useDialogs } from "../hooks/useDialogs";
import { useAgentName } from "../utils/agentName";
import { useWhisper } from "../hooks/useWhisper";
import { usePermissions } from "../hooks/usePermissions";
import { useClipboard } from "../hooks/useClipboard";
import { useUpdater } from "../hooks/useUpdater";
import { getTranscriptionProviders } from "../models/ModelRegistry";
import { formatHotkeyLabel } from "../utils/hotkeys";
import PromptStudio from "./ui/PromptStudio";
import ReasoningModelSelector from "./ReasoningModelSelector";
import type { UpdateInfoResult } from "../types/electron";
import { HotkeyInput } from "./ui/HotkeyInput";
import { useHotkeyRegistration } from "../hooks/useHotkeyRegistration";
import { ActivationModeSelector } from "./ui/ActivationModeSelector";

export type SettingsSectionType =
  | "account"
  | "general"
  | "transcription"
  | "aiModels"
  | "agentConfig"
  | "prompts";

interface SettingsPageProps {
  activeSection?: SettingsSectionType;
}

export default function SettingsPage({ activeSection = "general" }: SettingsPageProps) {
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
    cloudTranscriptionProvider,
    cloudTranscriptionModel,
    cloudReasoningBaseUrl,
    useReasoningModel,
    reasoningModel,
    reasoningProvider,
    openaiApiKey,
    anthropicApiKey,
    geminiApiKey,
    groqApiKey,
    dictationKey,
    activationMode,
    setActivationMode,
    preferBuiltInMic,
    selectedMicDeviceId,
    setPreferBuiltInMic,
    setSelectedMicDeviceId,
    setUseLocalWhisper,
    setWhisperModel,
    setAllowOpenAIFallback,
    setCloudTranscriptionProvider,
    setCloudTranscriptionModel,
    setCloudTranscriptionBaseUrl,
    setCloudReasoningBaseUrl,
    setUseReasoningModel,
    setReasoningModel,
    setReasoningProvider,
    setOpenaiApiKey,
    setAnthropicApiKey,
    setGeminiApiKey,
    setGroqApiKey,
    setDictationKey,
    updateTranscriptionSettings,
    updateReasoningSettings,
  } = useSettings();

  const [currentVersion, setCurrentVersion] = useState<string>("");
  const [isRemovingModels, setIsRemovingModels] = useState(false);
  const cachePathHint =
    typeof navigator !== "undefined" && /Windows/i.test(navigator.userAgent)
      ? "%USERPROFILE%\\.cache\\openwhispr\\whisper-models"
      : "~/.cache/openwhispr/whisper-models";

  // Use centralized updater hook to prevent EventEmitter memory leaks
  const {
    status: updateStatus,
    info: updateInfo,
    downloadProgress: updateDownloadProgress,
    isChecking: checkingForUpdates,
    isDownloading: downloadingUpdate,
    isInstalling: installInitiated,
    checkForUpdates,
    downloadUpdate,
    installUpdate: installUpdateAction,
    getAppVersion,
    error: updateError,
  } = useUpdater();

  const isUpdateAvailable =
    !updateStatus.isDevelopment && (updateStatus.updateAvailable || updateStatus.updateDownloaded);

  const whisperHook = useWhisper(showAlertDialog);
  const permissionsHook = usePermissions(showAlertDialog);
  useClipboard(showAlertDialog);
  const { agentName, setAgentName } = useAgentName();
  const installTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Shared hotkey registration hook
  const { registerHotkey, isRegistering: isHotkeyRegistering } = useHotkeyRegistration({
    onSuccess: (registeredHotkey) => {
      setDictationKey(registeredHotkey);
    },
    showSuccessToast: false,
    showErrorToast: true,
    showAlert: showAlertDialog,
  });

  const [localReasoningProvider, setLocalReasoningProvider] = useState(() => {
    return localStorage.getItem("reasoningProvider") || reasoningProvider;
  });

  useEffect(() => {
    let mounted = true;

    const timer = setTimeout(async () => {
      if (!mounted) return;

      const version = await getAppVersion();
      if (version && mounted) setCurrentVersion(version);

      if (mounted) {
        whisperHook.checkWhisperInstallation();
      }
    }, 100);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [whisperHook, getAppVersion]);

  // Show alert dialog on update errors
  useEffect(() => {
    if (updateError) {
      showAlertDialog({
        title: "Update Error",
        description:
          updateError.message ||
          "The updater encountered a problem. Please try again or download the latest release manually.",
      });
    }
  }, [updateError, showAlertDialog]);

  useEffect(() => {
    if (installInitiated) {
      if (installTimeoutRef.current) {
        clearTimeout(installTimeoutRef.current);
      }
      installTimeoutRef.current = setTimeout(() => {
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

        permissionsHook.openAccessibilitySettings();
      },
    });
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
          ?.deleteAllWhisperModels?.()
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

  const { isSignedIn, isLoaded, user } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = useCallback(async () => {
    setIsSigningOut(true);
    try {
      // Clear session cookies via Electron's main process to avoid
      // CSRF/Origin header issues with the server-side sign-out endpoint
      await window.electronAPI?.authClearSession?.();
      // Clear onboarding to show auth screen again
      localStorage.removeItem("onboardingCompleted");
      localStorage.removeItem("onboardingCurrentStep");
      // Reload the app to show onboarding/auth
      window.location.reload();
    } catch (error) {
      console.error("Sign out failed:", error);
      showAlertDialog({
        title: "Sign Out Failed",
        description: "Unable to sign out. Please try again.",
      });
    } finally {
      setIsSigningOut(false);
    }
  }, [showAlertDialog]);

  const renderSectionContent = () => {
    switch (activeSection) {
      case "account":
        return (
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Account</h3>
              <p className="text-sm text-gray-600 mb-6">
                Manage your account settings and sign-in status.
              </p>
            </div>

            {!NEON_AUTH_URL ? (
              <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <UserCircle className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-amber-900 mb-1">Account Features Disabled</h4>
                    <p className="text-sm text-amber-800">
                      Authentication is not configured for this installation. Set{" "}
                      <code className="bg-amber-100 px-1 rounded">VITE_NEON_AUTH_URL</code> in your
                      .env file to enable account features.
                    </p>
                  </div>
                </div>
              </div>
            ) : isLoaded && isSignedIn && user ? (
              <div className="space-y-6">
                <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      {user.image ? (
                        <img
                          src={user.image}
                          alt={user.name || "User"}
                          className="w-16 h-16 rounded-full object-cover"
                        />
                      ) : (
                        <UserCircle className="w-8 h-8 text-blue-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 text-lg truncate">
                        {user.name || "User"}
                      </h4>
                      <p className="text-sm text-gray-600 truncate">{user.email}</p>
                      <span className="inline-flex items-center mt-2 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                        Signed in
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                  <h4 className="font-medium text-gray-900 mb-3">Account Benefits</h4>
                  <ul className="text-sm text-gray-700 space-y-2">
                    <li className="flex items-center gap-2">
                      <span className="text-green-500">✓</span>
                      Sync settings across all your devices
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-500">✓</span>
                      Access your transcription history anywhere
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-500">✓</span>
                      Priority support and updates
                    </li>
                  </ul>
                </div>

                <Button
                  onClick={handleSignOut}
                  variant="outline"
                  disabled={isSigningOut}
                  className="w-full text-red-600 border-red-300 hover:bg-red-50 hover:border-red-400"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {isSigningOut ? "Signing out..." : "Sign Out"}
                </Button>
              </div>
            ) : isLoaded ? (
              <div className="space-y-6">
                <div className="p-6 bg-gray-50 border border-gray-200 rounded-xl">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                      <UserCircle className="w-5 h-5 text-gray-500" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">Not Signed In</h4>
                      <p className="text-sm text-gray-600">
                        Sign in to sync your settings across devices and access premium features.
                      </p>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => {
                    // Reset onboarding to go back to auth screen
                    localStorage.removeItem("onboardingCompleted");
                    localStorage.setItem("onboardingCurrentStep", "0");
                    window.location.reload();
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  <UserCircle className="mr-2 h-4 w-4" />
                  Sign In or Create Account
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            )}
          </div>
        );

      case "general":
        return (
          <div className="space-y-8">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">App Updates</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Keep OpenWhispr up to date with the latest features and improvements.
                </p>
              </div>
              <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-neutral-800">Current Version</p>
                  <p className="text-xs text-neutral-600">{currentVersion || "Loading..."}</p>
                </div>
                <div className="flex items-center gap-2">
                  {updateStatus.isDevelopment ? (
                    <span className="text-xs text-amber-600 bg-amber-100 px-2 py-1 rounded-full">
                      Development Mode
                    </span>
                  ) : updateStatus.updateAvailable ? (
                    <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                      Update Available
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-600 bg-neutral-100 px-2 py-1 rounded-full">
                      Up to Date
                    </span>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                <Button
                  onClick={async () => {
                    try {
                      const result = await checkForUpdates();
                      if (result?.updateAvailable) {
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
                    }
                  }}
                  disabled={checkingForUpdates || updateStatus.isDevelopment}
                  className="w-full"
                >
                  {checkingForUpdates ? (
                    <>
                      <RefreshCw size={16} className="animate-spin mr-2" />
                      Checking for Updates...
                    </>
                  ) : (
                    <>
                      <RefreshCw size={16} className="mr-2" />
                      Check for Updates
                    </>
                  )}
                </Button>

                {isUpdateAvailable && !updateStatus.updateDownloaded && (
                  <div className="space-y-2">
                    <Button
                      onClick={async () => {
                        try {
                          await downloadUpdate();
                        } catch (error: any) {
                          showAlertDialog({
                            title: "Download Failed",
                            description: `Failed to download update: ${error.message}`,
                          });
                        }
                      }}
                      disabled={downloadingUpdate}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      {downloadingUpdate ? (
                        <>
                          <Download size={16} className="animate-pulse mr-2" />
                          Downloading... {Math.round(updateDownloadProgress)}%
                        </>
                      ) : (
                        <>
                          <Download size={16} className="mr-2" />
                          Download Update{updateInfo?.version ? ` v${updateInfo.version}` : ""}
                        </>
                      )}
                    </Button>

                    {downloadingUpdate && (
                      <div className="space-y-1">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
                          <div
                            className="h-full bg-green-600 transition-all duration-200"
                            style={{
                              width: `${Math.min(100, Math.max(0, updateDownloadProgress))}%`,
                            }}
                          />
                        </div>
                        <p className="text-xs text-neutral-600 text-right">
                          {Math.round(updateDownloadProgress)}% downloaded
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {updateStatus.updateDownloaded && (
                  <Button
                    onClick={() => {
                      showConfirmDialog({
                        title: "Install Update",
                        description: `Ready to install update${updateInfo?.version ? ` v${updateInfo.version}` : ""}. The app will restart to complete installation.`,
                        confirmText: "Install & Restart",
                        onConfirm: async () => {
                          try {
                            await installUpdateAction();
                            showAlertDialog({
                              title: "Installing Update",
                              description:
                                "OpenWhispr will restart automatically to finish installing the newest version.",
                            });
                          } catch (error: any) {
                            showAlertDialog({
                              title: "Install Failed",
                              description: `Failed to install update: ${error.message}`,
                            });
                          }
                        },
                      });
                    }}
                    disabled={installInitiated}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {installInitiated ? (
                      <>
                        <RefreshCw size={16} className="animate-spin mr-2" />
                        Restarting to Finish Update...
                      </>
                    ) : (
                      <>
                        <span className="mr-2">🚀</span>
                        Quit & Install Update
                      </>
                    )}
                  </Button>
                )}

                {updateInfo?.version && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">Update v{updateInfo.version}</h4>
                    {updateInfo.releaseDate && (
                      <p className="text-sm text-blue-700 mb-2">
                        Released: {new Date(updateInfo.releaseDate).toLocaleDateString()}
                      </p>
                    )}
                    {updateInfo.releaseNotes && (
                      <div className="text-sm text-blue-800">
                        <p className="font-medium mb-1">What's New:</p>
                        <MarkdownRenderer content={updateInfo.releaseNotes} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t pt-8">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Dictation Hotkey</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Configure the key or key combination you press to start and stop voice dictation.
                </p>
              </div>
              <HotkeyInput
                value={dictationKey}
                onChange={async (newHotkey) => {
                  await registerHotkey(newHotkey);
                }}
                disabled={isHotkeyRegistering}
              />

              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Activation Mode
                </label>
                <ActivationModeSelector value={activationMode} onChange={setActivationMode} />
              </div>
            </div>

            <div className="border-t pt-8">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Permissions</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Test and manage app permissions for microphone and accessibility.
                </p>
              </div>
              <div className="space-y-3">
                <Button
                  onClick={permissionsHook.requestMicPermission}
                  variant="outline"
                  className="w-full"
                >
                  <Mic className="mr-2 h-4 w-4" />
                  Test Microphone Permission
                </Button>
                <Button
                  onClick={permissionsHook.testAccessibilityPermission}
                  variant="outline"
                  className="w-full"
                >
                  <Shield className="mr-2 h-4 w-4" />
                  Test Accessibility Permission
                </Button>
                <Button
                  onClick={resetAccessibilityPermissions}
                  variant="secondary"
                  className="w-full"
                >
                  <span className="mr-2">⚙️</span>
                  Fix Permission Issues
                </Button>
                {!permissionsHook.micPermissionGranted && (
                  <MicPermissionWarning
                    error={permissionsHook.micPermissionError}
                    onOpenSoundSettings={permissionsHook.openSoundInputSettings}
                    onOpenPrivacySettings={permissionsHook.openMicPrivacySettings}
                  />
                )}
              </div>
            </div>

            <div className="border-t pt-8">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Microphone Input</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Choose which microphone to use for dictation. Enable "Prefer Built-in" to prevent
                  audio interruptions when using Bluetooth headphones.
                </p>
              </div>
              <MicrophoneSettings
                preferBuiltInMic={preferBuiltInMic}
                selectedMicDeviceId={selectedMicDeviceId}
                onPreferBuiltInChange={setPreferBuiltInMic}
                onDeviceSelect={setSelectedMicDeviceId}
              />
            </div>

            <div className="border-t pt-8">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">About OpenWhispr</h3>
                <p className="text-sm text-gray-600 mb-6">
                  OpenWhispr converts your speech to text using AI. Press your hotkey, speak, and
                  we'll type what you said wherever your cursor is.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-6">
                <div className="text-center p-4 border border-gray-200 rounded-xl bg-white">
                  <div className="w-8 h-8 mx-auto mb-2 bg-indigo-600 rounded-lg flex items-center justify-center">
                    <Command className="w-4 h-4 text-white" />
                  </div>
                  <p className="font-medium text-gray-800 mb-1">Default Hotkey</p>
                  <p className="text-gray-600 font-mono text-xs">
                    {formatHotkeyLabel(dictationKey)}
                  </p>
                </div>
                <div className="text-center p-4 border border-gray-200 rounded-xl bg-white">
                  <div className="w-8 h-8 mx-auto mb-2 bg-emerald-600 rounded-lg flex items-center justify-center">
                    <span className="text-white text-sm">🏷️</span>
                  </div>
                  <p className="font-medium text-gray-800 mb-1">Version</p>
                  <p className="text-gray-600 text-xs">{currentVersion || "0.1.0"}</p>
                </div>
                <div className="text-center p-4 border border-gray-200 rounded-xl bg-white">
                  <div className="w-8 h-8 mx-auto mb-2 bg-green-600 rounded-lg flex items-center justify-center">
                    <span className="text-white text-sm">✓</span>
                  </div>
                  <p className="font-medium text-gray-800 mb-1">Status</p>
                  <p className="text-green-600 text-xs font-medium">Active</p>
                </div>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={() => {
                    showConfirmDialog({
                      title: "⚠️ DANGER: Cleanup App Data",
                      description:
                        "This will permanently delete ALL OpenWhispr data including:\n\n• Database and transcriptions\n• Local storage settings\n• Downloaded Whisper models\n• Environment files\n\nYou will need to manually remove app permissions in System Settings.\n\nThis action cannot be undone. Are you sure?",
                      onConfirm: () => {
                        window.electronAPI
                          ?.cleanupApp()
                          .then(() => {
                            showAlertDialog({
                              title: "Cleanup Completed",
                              description: "✅ Cleanup completed! All app data has been removed.",
                            });
                            setTimeout(() => {
                              window.location.reload();
                            }, 1000);
                          })
                          .catch((error) => {
                            showAlertDialog({
                              title: "Cleanup Failed",
                              description: `❌ Cleanup failed: ${error.message}`,
                            });
                          });
                      },
                      variant: "destructive",
                    });
                  }}
                  variant="outline"
                  className="w-full text-red-600 border-red-300 hover:bg-red-50 hover:border-red-400"
                >
                  <span className="mr-2">🗑️</span>
                  Clean Up All App Data
                </Button>
              </div>

              <div className="space-y-3 mt-6 p-4 bg-rose-50 border border-rose-200 rounded-xl">
                <h4 className="font-medium text-rose-900">Local Model Storage</h4>
                <p className="text-sm text-rose-800">
                  Remove all downloaded Whisper models from your cache directory to reclaim disk
                  space. You can re-download any model later.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => window.electronAPI?.openWhisperModelsFolder?.()}
                    className="flex-1"
                  >
                    <FolderOpen className="mr-2 h-4 w-4" />
                    Open Models Folder
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleRemoveModels}
                    disabled={isRemovingModels}
                    className="flex-1"
                  >
                    {isRemovingModels ? "Removing..." : "Remove All"}
                  </Button>
                </div>
                <p className="text-xs text-rose-700">
                  Current cache location: <code>{cachePathHint}</code>
                </p>
              </div>
            </div>
          </div>
        );

      case "transcription":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Speech to Text Processing
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Choose a cloud provider for fast transcription or use local Whisper models for
                complete privacy.
              </p>
            </div>

            <TranscriptionModelPicker
              selectedCloudProvider={cloudTranscriptionProvider}
              onCloudProviderSelect={(providerId) => {
                setCloudTranscriptionProvider(providerId);
                const provider = getTranscriptionProviders().find((p) => p.id === providerId);
                if (provider) {
                  setCloudTranscriptionBaseUrl(provider.baseUrl);
                }
              }}
              selectedCloudModel={cloudTranscriptionModel}
              onCloudModelSelect={setCloudTranscriptionModel}
              selectedLocalModel={whisperModel}
              onLocalModelSelect={setWhisperModel}
              useLocalWhisper={useLocalWhisper}
              onModeChange={(isLocal) => {
                setUseLocalWhisper(isLocal);
                updateTranscriptionSettings({ useLocalWhisper: isLocal });
              }}
              openaiApiKey={openaiApiKey}
              setOpenaiApiKey={setOpenaiApiKey}
              groqApiKey={groqApiKey}
              setGroqApiKey={setGroqApiKey}
              variant="settings"
            />
          </div>
        );

      case "aiModels":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">AI Text Enhancement</h3>
              <p className="text-sm text-gray-600 mb-6">
                Configure how AI models clean up and format your transcriptions. This handles
                commands like "scratch that", creates proper lists, and fixes obvious errors while
                preserving your natural tone.
              </p>
            </div>

            <ReasoningModelSelector
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
              groqApiKey={groqApiKey}
              setGroqApiKey={setGroqApiKey}
              showAlertDialog={showAlertDialog}
            />
          </div>
        );

      case "agentConfig":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Agent Configuration</h3>
              <p className="text-sm text-gray-600 mb-6">
                Customize your AI assistant's name and behavior to make interactions more personal
                and effective.
              </p>
            </div>

            <div className="space-y-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl">
              <h4 className="font-medium text-purple-900 mb-3">💡 How to use agent names:</h4>
              <ul className="text-sm text-purple-800 space-y-2">
                <li>• Say "Hey {agentName}, write a formal email" for specific instructions</li>
                <li>
                  • Use "Hey {agentName}, format this as a list" for text enhancement commands
                </li>
                <li>
                  • The agent will recognize when you're addressing it directly vs. dictating
                  content
                </li>
                <li>
                  • Makes conversations feel more natural and helps distinguish commands from
                  dictation
                </li>
              </ul>
            </div>

            <div className="space-y-4 p-4 bg-gray-50 border border-gray-200 rounded-xl">
              <h4 className="font-medium text-gray-900">Current Agent Name</h4>
              <div className="flex gap-3">
                <Input
                  placeholder="e.g., Assistant, Jarvis, Alex..."
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  className="flex-1 text-center text-lg font-mono"
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
                >
                  Save
                </Button>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                Choose a name that feels natural to say and remember
              </p>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">🎯 Example Usage:</h4>
              <div className="text-sm text-blue-800 space-y-1">
                <p>• "Hey {agentName}, write an email to my team about the meeting"</p>
                <p>• "Hey {agentName}, make this more professional" (after dictating text)</p>
                <p>• "Hey {agentName}, convert this to bullet points"</p>
                <p>• Regular dictation: "This is just normal text" (no agent name needed)</p>
              </div>
            </div>
          </div>
        );

      case "prompts":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">AI Prompt Management</h3>
              <p className="text-sm text-gray-600 mb-6">
                View and customize the prompts that power OpenWhispr's AI text processing. Adjust
                these to change how your transcriptions are formatted and enhanced.
              </p>
            </div>

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
