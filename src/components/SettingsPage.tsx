import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import {
  RefreshCw,
  Download,
  Command,
  Mic,
  Shield,
  FolderOpen,
  LogOut,
  UserCircle,
  Sun,
  Moon,
  Monitor,
  Cloud,
  Key,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { NEON_AUTH_URL } from "../lib/neonAuth";
import MarkdownRenderer from "./ui/MarkdownRenderer";
import MicPermissionWarning from "./ui/MicPermissionWarning";
import MicrophoneSettings from "./ui/MicrophoneSettings";
import PermissionCard from "./ui/PermissionCard";
import PasteToolsInfo from "./ui/PasteToolsInfo";
import TranscriptionModelPicker from "./TranscriptionModelPicker";
import { ConfirmDialog, AlertDialog } from "./ui/dialog";
import { useSettings } from "../hooks/useSettings";
import { useDialogs } from "../hooks/useDialogs";
import { useAgentName } from "../utils/agentName";
import { useWhisper } from "../hooks/useWhisper";
import { usePermissions } from "../hooks/usePermissions";
import { useClipboard } from "../hooks/useClipboard";
import { useUpdater } from "../hooks/useUpdater";

import PromptStudio from "./ui/PromptStudio";
import ReasoningModelSelector from "./ReasoningModelSelector";

import { HotkeyInput } from "./ui/HotkeyInput";
import { useHotkeyRegistration } from "../hooks/useHotkeyRegistration";
import { ActivationModeSelector } from "./ui/ActivationModeSelector";
import { Toggle } from "./ui/toggle";
import DeveloperSection from "./DeveloperSection";
import UsageDisplay from "./UsageDisplay";
import { useToast } from "./ui/Toast";
import { useTheme } from "../hooks/useTheme";
import { SettingsRow } from "./ui/SettingsSection";

export type SettingsSectionType =
  | "account"
  | "general"
  | "transcription"
  | "dictionary"
  | "aiModels"
  | "agentConfig"
  | "prompts"
  | "permissions"
  | "developer";

interface SettingsPageProps {
  activeSection?: SettingsSectionType;
}

// ── Reusable layout primitives ──────────────────────────────────────

function SettingsPanel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-border/50 dark:border-border-subtle/70 bg-card/50 dark:bg-surface-2/50 backdrop-blur-sm divide-y divide-border/30 dark:divide-border-subtle/50 ${className}`}
    >
      {children}
    </div>
  );
}

function SettingsPanelRow({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`px-4 py-3 ${className}`}>{children}</div>;
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-[13px] font-semibold text-foreground tracking-tight">{title}</h3>
      {description && (
        <p className="text-[11px] text-muted-foreground/80 mt-0.5 leading-relaxed">{description}</p>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────

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
    localTranscriptionProvider,
    parakeetModel,
    cloudTranscriptionProvider,
    cloudTranscriptionModel,
    cloudTranscriptionBaseUrl,
    cloudReasoningBaseUrl,
    customDictionary,
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
    setLocalTranscriptionProvider,
    setParakeetModel,
    setCloudTranscriptionProvider,
    setCloudTranscriptionModel,
    setCloudTranscriptionBaseUrl,
    setCloudReasoningBaseUrl,
    setCustomDictionary,
    setUseReasoningModel,
    setReasoningModel,
    setReasoningProvider,
    setOpenaiApiKey,
    setAnthropicApiKey,
    setGeminiApiKey,
    setGroqApiKey,
    customTranscriptionApiKey,
    setCustomTranscriptionApiKey,
    customReasoningApiKey,
    setCustomReasoningApiKey,
    setDictationKey,
    updateTranscriptionSettings,
    updateReasoningSettings,
    cloudTranscriptionMode,
    setCloudTranscriptionMode,
    cloudReasoningModel,
    setCloudReasoningModel,
  } = useSettings();

  const { toast } = useToast();

  const [currentVersion, setCurrentVersion] = useState<string>("");
  const [isRemovingModels, setIsRemovingModels] = useState(false);
  const cachePathHint =
    typeof navigator !== "undefined" && /Windows/i.test(navigator.userAgent)
      ? "%USERPROFILE%\\.cache\\openwhispr\\whisper-models"
      : "~/.cache/openwhispr/whisper-models";

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

  const whisperHook = useWhisper();
  const permissionsHook = usePermissions(showAlertDialog);
  useClipboard(showAlertDialog);
  const { agentName, setAgentName } = useAgentName();
  const { theme, setTheme } = useTheme();
  const installTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { registerHotkey, isRegistering: isHotkeyRegistering } = useHotkeyRegistration({
    onSuccess: (registeredHotkey) => {
      setDictationKey(registeredHotkey);
    },
    showSuccessToast: false,
    showErrorToast: true,
    showAlert: showAlertDialog,
  });

  const [isUsingGnomeHotkeys, setIsUsingGnomeHotkeys] = useState(false);

  const platform = useMemo(() => {
    if (typeof window !== "undefined" && window.electronAPI?.getPlatform) {
      return window.electronAPI.getPlatform();
    }
    return "linux";
  }, []);

  const [newDictionaryWord, setNewDictionaryWord] = useState("");

  const handleAddDictionaryWord = useCallback(() => {
    const word = newDictionaryWord.trim();
    if (word && !customDictionary.includes(word)) {
      setCustomDictionary([...customDictionary, word]);
      setNewDictionaryWord("");
    }
  }, [newDictionaryWord, customDictionary, setCustomDictionary]);

  const handleRemoveDictionaryWord = useCallback(
    (wordToRemove: string) => {
      setCustomDictionary(customDictionary.filter((word) => word !== wordToRemove));
    },
    [customDictionary, setCustomDictionary]
  );

  const [autoStartEnabled, setAutoStartEnabled] = useState(false);
  const [autoStartLoading, setAutoStartLoading] = useState(true);

  useEffect(() => {
    if (platform === "linux") {
      setAutoStartLoading(false);
      return;
    }
    const loadAutoStart = async () => {
      if (window.electronAPI?.getAutoStartEnabled) {
        try {
          const enabled = await window.electronAPI.getAutoStartEnabled();
          setAutoStartEnabled(enabled);
        } catch (error) {
          console.error("Failed to get auto-start status:", error);
        }
      }
      setAutoStartLoading(false);
    };
    loadAutoStart();
  }, [platform]);

  const handleAutoStartChange = async (enabled: boolean) => {
    if (window.electronAPI?.setAutoStartEnabled) {
      try {
        setAutoStartLoading(true);
        const result = await window.electronAPI.setAutoStartEnabled(enabled);
        if (result.success) {
          setAutoStartEnabled(enabled);
        }
      } catch (error) {
        console.error("Failed to set auto-start:", error);
      } finally {
        setAutoStartLoading(false);
      }
    }
  };

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

  useEffect(() => {
    const checkHotkeyMode = async () => {
      try {
        const info = await window.electronAPI?.getHotkeyModeInfo();
        if (info?.isUsingGnome) {
          setIsUsingGnomeHotkeys(true);
          setActivationMode("tap");
        }
      } catch (error) {
        console.error("Failed to check hotkey mode:", error);
      }
    };
    checkHotkeyMode();
  }, [setActivationMode]);

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
    const message = `To fix accessibility permissions:\n\n1. Open System Settings > Privacy & Security > Accessibility\n2. Remove any old OpenWhispr or Electron entries\n3. Click (+) and add the current OpenWhispr app\n4. Make sure the checkbox is enabled\n5. Restart OpenWhispr\n\nClick OK to open System Settings.`;

    showConfirmDialog({
      title: "Reset Accessibility Permissions",
      description: message,
      onConfirm: () => {
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
              <h3 className="text-lg font-semibold text-foreground mb-2">Account</h3>
              <p className="text-sm text-muted-foreground mb-6">
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
                <div className="p-6 bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                      {user.image ? (
                        <img
                          src={user.image}
                          alt={user.name || "User"}
                          className="w-16 h-16 rounded-full object-cover"
                        />
                      ) : (
                        <UserCircle className="w-8 h-8 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-foreground text-lg truncate">
                        {user.name || "User"}
                      </h4>
                      <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                      <span className="inline-flex items-center mt-2 text-xs text-success bg-success/15 px-2 py-0.5 rounded-full">
                        Signed in
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-muted border border-border rounded-xl">
                  <h4 className="font-medium text-foreground mb-3">Account Benefits</h4>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li className="flex items-center gap-2">
                      <span className="text-success">✓</span>
                      Sync settings across all your devices
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-success">✓</span>
                      Access your transcription history anywhere
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-success">✓</span>
                      Priority support and updates
                    </li>
                  </ul>
                </div>

                <UsageDisplay />

                <Button
                  onClick={handleSignOut}
                  variant="outline"
                  disabled={isSigningOut}
                  className="w-full text-destructive border-destructive/30 hover:bg-destructive/10 hover:border-destructive/50"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {isSigningOut ? "Signing out..." : "Sign Out"}
                </Button>
              </div>
            ) : isLoaded ? (
              <div className="space-y-6">
                <div className="p-6 bg-muted border border-border rounded-xl">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-muted-foreground/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <UserCircle className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground mb-1">Not Signed In</h4>
                      <p className="text-sm text-muted-foreground">
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
                  className="w-full"
                >
                  <UserCircle className="mr-2 h-4 w-4" />
                  Sign In or Create Account
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        );

      // ───────────────────────────────────────────────────
      // GENERAL — Updates, Appearance, Hotkey, Startup, Mic
      // ───────────────────────────────────────────────────
      case "general":
        return (
          <div className="space-y-6">
            {/* Updates */}
            <div>
              <SectionHeader title="Updates" />
              <SettingsPanel>
                <SettingsPanelRow>
                  <SettingsRow
                    label="Current version"
                    description={
                      updateStatus.isDevelopment
                        ? "Running in development mode"
                        : isUpdateAvailable
                          ? "A newer version is available"
                          : "You're on the latest version"
                    }
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-[13px] tabular-nums text-muted-foreground font-mono">
                        {currentVersion || "..."}
                      </span>
                      {updateStatus.isDevelopment ? (
                        <Badge variant="warning">Dev</Badge>
                      ) : isUpdateAvailable ? (
                        <Badge variant="success">Update</Badge>
                      ) : (
                        <Badge variant="outline">Latest</Badge>
                      )}
                    </div>
                  </SettingsRow>
                </SettingsPanelRow>

                <SettingsPanelRow>
                  <div className="space-y-2.5">
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
                      variant="outline"
                      className="w-full"
                      size="sm"
                    >
                      <RefreshCw
                        size={13}
                        className={`mr-1.5 ${checkingForUpdates ? "animate-spin" : ""}`}
                      />
                      {checkingForUpdates ? "Checking..." : "Check for Updates"}
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
                          variant="success"
                          className="w-full"
                          size="sm"
                        >
                          <Download
                            size={13}
                            className={`mr-1.5 ${downloadingUpdate ? "animate-pulse" : ""}`}
                          />
                          {downloadingUpdate
                            ? `Downloading... ${Math.round(updateDownloadProgress)}%`
                            : `Download Update${updateInfo?.version ? ` v${updateInfo.version}` : ""}`}
                        </Button>

                        {downloadingUpdate && (
                          <div className="h-1 w-full overflow-hidden rounded-full bg-muted/50">
                            <div
                              className="h-full bg-success transition-all duration-200 rounded-full"
                              style={{
                                width: `${Math.min(100, Math.max(0, updateDownloadProgress))}%`,
                              }}
                            />
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
                        className="w-full"
                        size="sm"
                      >
                        <RefreshCw
                          size={14}
                          className={`mr-2 ${installInitiated ? "animate-spin" : ""}`}
                        />
                        {installInitiated ? "Restarting..." : "Install & Restart"}
                      </Button>
                    )}
                  </div>

                  {updateInfo?.releaseNotes && (
                    <div className="mt-4 pt-4 border-t border-border/30">
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                        What's new in v{updateInfo.version}
                      </p>
                      <div className="text-[12px] text-muted-foreground">
                        <MarkdownRenderer content={updateInfo.releaseNotes} />
                      </div>
                    </div>
                  )}
                </SettingsPanelRow>
              </SettingsPanel>
            </div>

            {/* Appearance */}
            <div>
              <SectionHeader title="Appearance" description="Control how OpenWhispr looks" />
              <SettingsPanel>
                <SettingsPanelRow>
                  <SettingsRow label="Theme" description="Choose light, dark, or match your system">
                    <div className="inline-flex items-center gap-px p-0.5 bg-muted/60 dark:bg-surface-2 rounded-md">
                      {(
                        [
                          { value: "light", icon: Sun, label: "Light" },
                          { value: "dark", icon: Moon, label: "Dark" },
                          { value: "auto", icon: Monitor, label: "Auto" },
                        ] as const
                      ).map((option) => {
                        const Icon = option.icon;
                        const isSelected = theme === option.value;
                        return (
                          <button
                            key={option.value}
                            onClick={() => setTheme(option.value)}
                            className={`
                              flex items-center gap-1 px-2.5 py-1 rounded-[5px] text-[11px] font-medium
                              transition-all duration-100
                              ${
                                isSelected
                                  ? "bg-background dark:bg-surface-raised text-foreground shadow-sm"
                                  : "text-muted-foreground hover:text-foreground"
                              }
                            `}
                          >
                            <Icon className={`w-3 h-3 ${isSelected ? "text-primary" : ""}`} />
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </SettingsRow>
                </SettingsPanelRow>
              </SettingsPanel>
            </div>

            {/* Dictation Hotkey */}
            <div>
              <SectionHeader
                title="Dictation Hotkey"
                description="The key combination that starts and stops voice dictation"
              />
              <SettingsPanel>
                <SettingsPanelRow>
                  <HotkeyInput
                    value={dictationKey}
                    onChange={async (newHotkey) => {
                      await registerHotkey(newHotkey);
                    }}
                    disabled={isHotkeyRegistering}
                  />
                </SettingsPanelRow>

                {!isUsingGnomeHotkeys && (
                  <SettingsPanelRow>
                    <p className="text-[11px] font-medium text-muted-foreground/80 mb-2">
                      Activation Mode
                    </p>
                    <ActivationModeSelector value={activationMode} onChange={setActivationMode} />
                  </SettingsPanelRow>
                )}
              </SettingsPanel>
            </div>

            {/* Startup */}
            {platform !== "linux" && (
              <div>
                <SectionHeader title="Startup" />
                <SettingsPanel>
                  <SettingsPanelRow>
                    <SettingsRow
                      label="Launch at login"
                      description="Start OpenWhispr automatically when you log in"
                    >
                      <Toggle
                        checked={autoStartEnabled}
                        onChange={(checked: boolean) => handleAutoStartChange(checked)}
                        disabled={autoStartLoading}
                      />
                    </SettingsRow>
                  </SettingsPanelRow>
                </SettingsPanel>
              </div>
            )}

            {/* Microphone */}
            <div>
              <SectionHeader
                title="Microphone"
                description="Select which input device to use for dictation"
              />
              <SettingsPanel>
                <SettingsPanelRow>
                  <MicrophoneSettings
                    preferBuiltInMic={preferBuiltInMic}
                    selectedMicDeviceId={selectedMicDeviceId}
                    onPreferBuiltInChange={setPreferBuiltInMic}
                    onDeviceSelect={setSelectedMicDeviceId}
                  />
                </SettingsPanelRow>
              </SettingsPanel>
            </div>
          </div>
        );

      // ───────────────────────────────────────────────────
      // TRANSCRIPTION
      // ───────────────────────────────────────────────────
      case "transcription":
        return (
          <div className="space-y-5">
            <SectionHeader
              title="Speech to Text"
              description="Choose a cloud provider for fast transcription or use local Whisper models for complete privacy"
            />

            {/* Cloud/BYOK mode toggle — only shown when signed in */}
            {isSignedIn && !useLocalWhisper && (
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button
                  onClick={() => {
                    if (cloudTranscriptionMode !== "openwhispr") {
                      setCloudTranscriptionMode("openwhispr");
                      toast({
                        title: "Switched to OpenWhispr Cloud",
                        description: "Transcription will use OpenWhispr's cloud service.",
                        variant: "success",
                        duration: 3000,
                      });
                    }
                  }}
                  className={`p-4 border-2 rounded-xl text-left transition-all cursor-pointer ${
                    cloudTranscriptionMode === "openwhispr"
                      ? "border-indigo-500 bg-indigo-50/30 shadow-sm ring-1 ring-indigo-500/20"
                      : "border-neutral-200 bg-white hover:border-neutral-300"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Cloud className="w-4 h-4 text-indigo-600" />
                    <span className="font-medium text-neutral-900">OpenWhispr Cloud</span>
                  </div>
                  <p className="text-xs text-neutral-500">Just works. No configuration needed.</p>
                </button>
                <button
                  onClick={() => {
                    if (cloudTranscriptionMode !== "byok") {
                      setCloudTranscriptionMode("byok");
                      toast({
                        title: "Switched to Bring Your Own Key",
                        description: "You'll need to provide your own API key for transcription.",
                        variant: "success",
                        duration: 3000,
                      });
                    }
                  }}
                  className={`p-4 border-2 rounded-xl text-left transition-all cursor-pointer ${
                    cloudTranscriptionMode === "byok"
                      ? "border-indigo-500 bg-indigo-50/30 shadow-sm ring-1 ring-indigo-500/20"
                      : "border-neutral-200 bg-white hover:border-neutral-300"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Key className="w-4 h-4 text-neutral-600" />
                    <span className="font-medium text-neutral-900">Bring Your Own Key</span>
                  </div>
                  <p className="text-xs text-neutral-500">Use your own API key. No usage limits.</p>
                </button>
              </div>
            )}

            {/* When OpenWhispr Cloud mode is active, hide the full picker */}
            {isSignedIn && cloudTranscriptionMode === "openwhispr" && !useLocalWhisper ? (
              <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl">
                <p className="text-sm text-neutral-600">
                  Transcription is handled by OpenWhispr's servers. Change your language in General
                  settings.
                </p>
              </div>
            ) : (
              <TranscriptionModelPicker
                selectedCloudProvider={cloudTranscriptionProvider}
                onCloudProviderSelect={setCloudTranscriptionProvider}
                selectedCloudModel={cloudTranscriptionModel}
                onCloudModelSelect={setCloudTranscriptionModel}
                selectedLocalModel={
                  localTranscriptionProvider === "nvidia" ? parakeetModel : whisperModel
                }
                onLocalModelSelect={(modelId) => {
                  if (localTranscriptionProvider === "nvidia") {
                    setParakeetModel(modelId);
                  } else {
                    setWhisperModel(modelId);
                  }
                }}
                selectedLocalProvider={localTranscriptionProvider}
                onLocalProviderSelect={setLocalTranscriptionProvider}
                useLocalWhisper={useLocalWhisper}
                onModeChange={(isLocal) => {
                  setUseLocalWhisper(isLocal);
                  updateTranscriptionSettings({ useLocalWhisper: isLocal });
                }}
                openaiApiKey={openaiApiKey}
                setOpenaiApiKey={setOpenaiApiKey}
                groqApiKey={groqApiKey}
                setGroqApiKey={setGroqApiKey}
                customTranscriptionApiKey={customTranscriptionApiKey}
                setCustomTranscriptionApiKey={setCustomTranscriptionApiKey}
                cloudTranscriptionBaseUrl={cloudTranscriptionBaseUrl}
                setCloudTranscriptionBaseUrl={setCloudTranscriptionBaseUrl}
                variant="settings"
              />
            )}
          </div>
        );

      // ───────────────────────────────────────────────────
      // DICTIONARY
      // ───────────────────────────────────────────────────
      case "dictionary":
        return (
          <div className="space-y-5">
            <SectionHeader
              title="Custom Dictionary"
              description="Add words, names, or technical terms to improve transcription accuracy"
            />

            {/* Add Words */}
            <SettingsPanel>
              <SettingsPanelRow>
                <div className="space-y-2">
                  <p className="text-[12px] font-medium text-foreground">Add a word or phrase</p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. OpenWhispr, Kubernetes, Dr. Martinez..."
                      value={newDictionaryWord}
                      onChange={(e) => setNewDictionaryWord(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleAddDictionaryWord();
                        }
                      }}
                      className="flex-1 h-8 text-[12px]"
                    />
                    <Button
                      onClick={handleAddDictionaryWord}
                      disabled={!newDictionaryWord.trim()}
                      size="sm"
                      className="h-8"
                    >
                      Add
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground/50">Press Enter to add</p>
                </div>
              </SettingsPanelRow>
            </SettingsPanel>

            {/* Word List */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[12px] font-medium text-foreground">
                  Your words
                  {customDictionary.length > 0 && (
                    <span className="ml-1.5 text-muted-foreground/50 font-normal text-[11px]">
                      {customDictionary.length}
                    </span>
                  )}
                </p>
                {customDictionary.length > 0 && (
                  <button
                    onClick={() => {
                      showConfirmDialog({
                        title: "Clear dictionary?",
                        description:
                          "This will remove all words from your custom dictionary. This action cannot be undone.",
                        confirmText: "Clear All",
                        variant: "destructive",
                        onConfirm: () => setCustomDictionary([]),
                      });
                    }}
                    className="text-[10px] text-muted-foreground/40 hover:text-destructive transition-colors"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {customDictionary.length > 0 ? (
                <SettingsPanel>
                  <SettingsPanelRow>
                    <div className="flex flex-wrap gap-1">
                      {customDictionary.map((word) => (
                        <span
                          key={word}
                          className="group inline-flex items-center gap-0.5 pl-2 pr-1 py-0.5 bg-primary/5 dark:bg-primary/10 text-foreground rounded-[5px] text-[11px] border border-border/30 dark:border-border-subtle transition-all hover:border-destructive/40 hover:bg-destructive/5"
                        >
                          {word}
                          <button
                            onClick={() => handleRemoveDictionaryWord(word)}
                            className="ml-0.5 p-0.5 rounded-sm text-muted-foreground/40 hover:text-destructive transition-colors"
                            title="Remove word"
                          >
                            <svg
                              width="9"
                              height="9"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                            >
                              <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                          </button>
                        </span>
                      ))}
                    </div>
                  </SettingsPanelRow>
                </SettingsPanel>
              ) : (
                <div className="rounded-lg border border-dashed border-border/40 dark:border-border-subtle py-6 flex flex-col items-center justify-center text-center">
                  <p className="text-[11px] text-muted-foreground/50">No words added yet</p>
                  <p className="text-[10px] text-muted-foreground/40 mt-0.5">
                    Words you add will appear here
                  </p>
                </div>
              )}
            </div>

            {/* How it works */}
            <div>
              <SectionHeader title="How it works" />
              <SettingsPanel>
                <SettingsPanelRow>
                  <p className="text-[12px] text-muted-foreground leading-relaxed">
                    Words in your dictionary are provided as context hints to the speech recognition
                    model. This helps it correctly identify uncommon names, technical jargon, brand
                    names, or anything that's frequently misrecognized.
                  </p>
                </SettingsPanelRow>
                <SettingsPanelRow>
                  <p className="text-[12px] text-muted-foreground leading-relaxed">
                    <span className="font-medium text-foreground">Tip</span> — For difficult words,
                    add context phrases like "The word is Synty" alongside the word itself. Adding
                    related terms (e.g. "Synty" and "SyntyStudios") also helps the model understand
                    the intended spelling.
                  </p>
                </SettingsPanelRow>
              </SettingsPanel>
            </div>
          </div>
        );

      // ───────────────────────────────────────────────────
      // AI MODELS
      // ───────────────────────────────────────────────────
      case "aiModels":
        return (
          <div className="space-y-5">
            <SectionHeader
              title="AI Text Enhancement"
              description='Configure how AI models clean up and format your transcriptions. Handles commands like "scratch that", creates proper lists, and fixes errors while preserving your natural tone.'
            />

            {/* Simplified cloud model picker when in OpenWhispr cloud mode */}
            {isSignedIn && cloudTranscriptionMode === "openwhispr" ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-muted-foreground">AI Model</label>
                </div>
                <select
                  value={cloudReasoningModel}
                  onChange={(e) => setCloudReasoningModel(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <optgroup label="Fast (Groq)">
                    <option value="llama-3.3-70b-versatile">Llama 3.3 70B — Recommended</option>
                    <option value="llama-3.1-8b-instant">Llama 3.1 8B — Fastest</option>
                  </optgroup>
                  <optgroup label="Balanced (OpenRouter)">
                    <option value="anthropic/claude-sonnet-4">Claude Sonnet 4</option>
                    <option value="google/gemini-2.5-flash">Gemini 2.5 Flash</option>
                  </optgroup>
                  <optgroup label="Quality (OpenRouter)">
                    <option value="anthropic/claude-opus-4">Claude Opus 4</option>
                    <option value="openai/gpt-4.1">GPT-4.1</option>
                  </optgroup>
                </select>
                <p className="text-xs text-muted-foreground">
                  No API key needed. Powered by OpenWhispr.
                </p>
              </div>
            ) : (
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
                localReasoningProvider={reasoningProvider}
                setLocalReasoningProvider={setReasoningProvider}
                openaiApiKey={openaiApiKey}
                setOpenaiApiKey={setOpenaiApiKey}
                anthropicApiKey={anthropicApiKey}
                setAnthropicApiKey={setAnthropicApiKey}
                geminiApiKey={geminiApiKey}
                setGeminiApiKey={setGeminiApiKey}
                groqApiKey={groqApiKey}
                setGroqApiKey={setGroqApiKey}
                customReasoningApiKey={customReasoningApiKey}
                setCustomReasoningApiKey={setCustomReasoningApiKey}
                showAlertDialog={showAlertDialog}
              />
            )}
          </div>
        );

      // ───────────────────────────────────────────────────
      // AGENT CONFIG
      // ───────────────────────────────────────────────────
      case "agentConfig":
        return (
          <div className="space-y-5">
            <SectionHeader
              title="Voice Agent"
              description="Name your AI assistant so you can address it directly during dictation"
            />

            {/* Agent Name */}
            <div>
              <p className="text-[13px] font-medium text-foreground mb-3">Agent Name</p>
              <SettingsPanel>
                <SettingsPanelRow>
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        placeholder="e.g. Jarvis, Nova, Atlas..."
                        value={agentName}
                        onChange={(e) => setAgentName(e.target.value)}
                        className="flex-1 text-center text-base font-mono"
                      />
                      <Button
                        onClick={() => {
                          setAgentName(agentName.trim());
                          showAlertDialog({
                            title: "Agent Name Updated",
                            description: `Your agent is now named "${agentName.trim()}". Address it by saying "Hey ${agentName.trim()}" followed by your instructions.`,
                          });
                        }}
                        disabled={!agentName.trim()}
                        size="sm"
                      >
                        Save
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground/60">
                      Pick something short and natural to say aloud
                    </p>
                  </div>
                </SettingsPanelRow>
              </SettingsPanel>
            </div>

            {/* How it works */}
            <div>
              <SectionHeader title="How it works" />
              <SettingsPanel>
                <SettingsPanelRow>
                  <p className="text-[12px] text-muted-foreground leading-relaxed">
                    When you say{" "}
                    <span className="font-medium text-foreground">"Hey {agentName}"</span> followed
                    by an instruction, the AI switches from cleanup mode to instruction mode.
                    Without the trigger phrase, it simply cleans up your dictation.
                  </p>
                </SettingsPanelRow>
              </SettingsPanel>
            </div>

            {/* Examples */}
            <div>
              <SectionHeader title="Examples" />
              <SettingsPanel>
                <SettingsPanelRow>
                  <div className="space-y-2.5">
                    {[
                      {
                        input: `Hey ${agentName}, write a formal email about the budget`,
                        mode: "Instruction",
                      },
                      {
                        input: `Hey ${agentName}, make this more professional`,
                        mode: "Instruction",
                      },
                      {
                        input: `Hey ${agentName}, convert this to bullet points`,
                        mode: "Instruction",
                      },
                      { input: "We should schedule a meeting for next week", mode: "Cleanup" },
                    ].map((example, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span
                          className={`shrink-0 mt-0.5 text-[10px] font-medium uppercase tracking-wider px-1.5 py-px rounded ${
                            example.mode === "Instruction"
                              ? "bg-primary/10 text-primary dark:bg-primary/15"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {example.mode}
                        </span>
                        <p className="text-[12px] text-muted-foreground leading-relaxed">
                          "{example.input}"
                        </p>
                      </div>
                    ))}
                  </div>
                </SettingsPanelRow>
              </SettingsPanel>
            </div>
          </div>
        );

      // ───────────────────────────────────────────────────
      // PROMPTS
      // ───────────────────────────────────────────────────
      case "prompts":
        return (
          <div className="space-y-5">
            <SectionHeader
              title="Prompt Studio"
              description="View, customize, and test the unified system prompt that powers text cleanup and instruction detection"
            />

            <PromptStudio />
          </div>
        );

      // ───────────────────────────────────────────────────
      // PERMISSIONS (new — extracted from General)
      // ───────────────────────────────────────────────────
      case "permissions":
        return (
          <div className="space-y-5">
            <SectionHeader
              title="Permissions"
              description="Test and manage system permissions required for OpenWhispr to function correctly"
            />

            {/* Permission Cards - matching onboarding style */}
            <div className="space-y-3">
              <PermissionCard
                icon={Mic}
                title="Microphone"
                description="Required for voice recording and dictation"
                granted={permissionsHook.micPermissionGranted}
                onRequest={permissionsHook.requestMicPermission}
                buttonText="Test"
                onOpenSettings={permissionsHook.openMicPrivacySettings}
              />

              {platform === "darwin" && (
                <PermissionCard
                  icon={Shield}
                  title="Accessibility"
                  description="Required for auto-paste to work after transcription"
                  granted={permissionsHook.accessibilityPermissionGranted}
                  onRequest={permissionsHook.testAccessibilityPermission}
                  buttonText="Test & Grant"
                  onOpenSettings={permissionsHook.openAccessibilitySettings}
                />
              )}
            </div>

            {/* Error state for microphone */}
            {!permissionsHook.micPermissionGranted && permissionsHook.micPermissionError && (
              <MicPermissionWarning
                error={permissionsHook.micPermissionError}
                onOpenSoundSettings={permissionsHook.openSoundInputSettings}
                onOpenPrivacySettings={permissionsHook.openMicPrivacySettings}
              />
            )}

            {/* Linux paste tools info */}
            {platform === "linux" &&
              permissionsHook.pasteToolsInfo &&
              !permissionsHook.pasteToolsInfo.available && (
                <PasteToolsInfo
                  pasteToolsInfo={permissionsHook.pasteToolsInfo}
                  isChecking={permissionsHook.isCheckingPasteTools}
                  onCheck={permissionsHook.checkPasteToolsAvailability}
                />
              )}

            {/* Troubleshooting section for macOS */}
            {platform === "darwin" && (
              <div>
                <p className="text-[13px] font-medium text-foreground mb-3">Troubleshooting</p>
                <SettingsPanel>
                  <SettingsPanelRow>
                    <SettingsRow
                      label="Reset accessibility permissions"
                      description="Fix issues after reinstalling or rebuilding the app by removing and re-adding OpenWhispr in System Settings"
                    >
                      <Button
                        onClick={resetAccessibilityPermissions}
                        variant="ghost"
                        size="sm"
                        className="text-foreground/70 hover:text-foreground"
                      >
                        Troubleshoot
                      </Button>
                    </SettingsRow>
                  </SettingsPanelRow>
                </SettingsPanel>
              </div>
            )}
          </div>
        );

      // ───────────────────────────────────────────────────
      // DEVELOPER (+ data management moved here)
      // ───────────────────────────────────────────────────
      case "developer":
        return (
          <div className="space-y-6">
            <DeveloperSection />

            {/* Data Management — moved from General */}
            <div className="border-t border-border/40 pt-8">
              <SectionHeader
                title="Data Management"
                description="Manage cached models and app data"
              />

              <div className="space-y-4">
                <SettingsPanel>
                  <SettingsPanelRow>
                    <SettingsRow label="Model cache" description={cachePathHint}>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.electronAPI?.openWhisperModelsFolder?.()}
                        >
                          <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
                          Open
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleRemoveModels}
                          disabled={isRemovingModels}
                        >
                          {isRemovingModels ? "Removing..." : "Clear Cache"}
                        </Button>
                      </div>
                    </SettingsRow>
                  </SettingsPanelRow>
                </SettingsPanel>

                <SettingsPanel>
                  <SettingsPanelRow>
                    <SettingsRow
                      label="Reset app data"
                      description="Permanently delete all settings, transcriptions, and cached data"
                    >
                      <Button
                        onClick={() => {
                          showConfirmDialog({
                            title: "Reset All App Data",
                            description:
                              "This will permanently delete ALL OpenWhispr data including:\n\n- Database and transcriptions\n- Local storage settings\n- Downloaded models\n- Environment files\n\nYou will need to manually remove app permissions in System Settings.\n\nThis action cannot be undone.",
                            onConfirm: () => {
                              window.electronAPI
                                ?.cleanupApp()
                                .then(() => {
                                  showAlertDialog({
                                    title: "Reset Complete",
                                    description:
                                      "All app data has been removed. The app will reload.",
                                  });
                                  setTimeout(() => {
                                    window.location.reload();
                                  }, 1000);
                                })
                                .catch((error) => {
                                  showAlertDialog({
                                    title: "Reset Failed",
                                    description: `Failed to reset: ${error.message}`,
                                  });
                                });
                            },
                            variant: "destructive",
                            confirmText: "Delete Everything",
                          });
                        }}
                        variant="outline"
                        size="sm"
                        className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:border-destructive"
                      >
                        Reset
                      </Button>
                    </SettingsRow>
                  </SettingsPanelRow>
                </SettingsPanel>
              </div>
            </div>
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
