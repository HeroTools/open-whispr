import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import {
  ChevronRight,
  ChevronLeft,
  Check,
  Settings,
  Mic,
  Shield,
  Command,
  Sparkles,
} from "lucide-react";
import TitleBar from "./TitleBar";
import TranscriptionModelPicker from "./TranscriptionModelPicker";
import PermissionCard from "./ui/PermissionCard";
import MicPermissionWarning from "./ui/MicPermissionWarning";
import PasteToolsInfo from "./ui/PasteToolsInfo";
import StepProgress from "./ui/StepProgress";
import { AlertDialog, ConfirmDialog } from "./ui/dialog";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { useDialogs } from "../hooks/useDialogs";
import { usePermissions } from "../hooks/usePermissions";
import { useClipboard } from "../hooks/useClipboard";
import { useSettings } from "../hooks/useSettings";
import { setAgentNameIfEmpty as saveAgentName } from "../utils/agentName";
import { formatHotkeyLabel, getDefaultHotkey } from "../utils/hotkeys";
import { HotkeyInput } from "./ui/HotkeyInput";
import { useHotkeyRegistration } from "../hooks/useHotkeyRegistration";
import { ActivationModeSelector } from "./ui/ActivationModeSelector";

interface OnboardingFlowProps {
  onComplete: () => void;
}

export default function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  // Max valid step index for the current onboarding flow (4 steps, index 0-3)
  const MAX_STEP = 3;

  const [currentStep, setCurrentStep, removeCurrentStep] = useLocalStorage(
    "onboardingCurrentStep",
    0,
    {
      serialize: String,
      deserialize: (value) => {
        const parsed = parseInt(value, 10);
        // Clamp to valid range to handle users upgrading from older versions
        // with different step counts
        if (isNaN(parsed) || parsed < 0) return 0;
        if (parsed > MAX_STEP) return MAX_STEP;
        return parsed;
      },
    }
  );

  const {
    useLocalWhisper,
    whisperModel,
    localTranscriptionProvider,
    parakeetModel,
    cloudTranscriptionProvider,
    cloudTranscriptionModel,
    cloudTranscriptionBaseUrl,
    openaiApiKey,
    groqApiKey,
    customTranscriptionApiKey,
    setCustomTranscriptionApiKey,
    dictationKey,
    activationMode,
    setActivationMode,
    setDictationKey,
    setOpenaiApiKey,
    setGroqApiKey,
    updateTranscriptionSettings,
  } = useSettings();

  const [hotkey, setHotkey] = useState(dictationKey || getDefaultHotkey());
  const agentName = "OpenWhispr"; // Default agent name, editable in settings
  const [isModelDownloaded, setIsModelDownloaded] = useState(false);
  const [isUsingGnomeHotkeys, setIsUsingGnomeHotkeys] = useState(false);
  const readableHotkey = formatHotkeyLabel(hotkey);
  const { alertDialog, confirmDialog, showAlertDialog, hideAlertDialog, hideConfirmDialog } =
    useDialogs();

  const autoRegisterInFlightRef = useRef(false);
  const hotkeyStepInitializedRef = useRef(false);

  const { registerHotkey, isRegistering: isHotkeyRegistering } = useHotkeyRegistration({
    onSuccess: (registeredHotkey) => {
      setHotkey(registeredHotkey);
      setDictationKey(registeredHotkey);
    },
    showSuccessToast: false, // Don't show toast during onboarding auto-registration
    showErrorToast: false,
  });

  const permissionsHook = usePermissions(showAlertDialog);
  useClipboard(showAlertDialog); // Initialize clipboard hook for permission checks

  const steps = [
    { title: "Welcome", icon: Sparkles },
    { title: "Setup", icon: Settings },
    { title: "Permissions", icon: Shield },
    { title: "Activation", icon: Command },
  ];

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
    const modelToCheck = localTranscriptionProvider === "nvidia" ? parakeetModel : whisperModel;
    if (!useLocalWhisper || !modelToCheck) {
      setIsModelDownloaded(false);
      return;
    }

    const checkStatus = async () => {
      try {
        const result =
          localTranscriptionProvider === "nvidia"
            ? await window.electronAPI?.checkParakeetModelStatus(modelToCheck)
            : await window.electronAPI?.checkModelStatus(modelToCheck);
        setIsModelDownloaded(result?.downloaded ?? false);
      } catch (error) {
        console.error("Failed to check model status:", error);
        setIsModelDownloaded(false);
      }
    };

    checkStatus();
  }, [useLocalWhisper, whisperModel, parakeetModel, localTranscriptionProvider]);

  // Auto-register default hotkey when entering the hotkey step (step 3)
  useEffect(() => {
    if (currentStep !== 3) {
      // Reset initialization flag when leaving step 3
      hotkeyStepInitializedRef.current = false;
      return;
    }

    // Prevent double-invocation from React.StrictMode
    if (autoRegisterInFlightRef.current || hotkeyStepInitializedRef.current) {
      return;
    }

    const autoRegisterDefaultHotkey = async () => {
      autoRegisterInFlightRef.current = true;
      hotkeyStepInitializedRef.current = true;

      try {
        // Get platform-appropriate default hotkey
        const defaultHotkey = getDefaultHotkey();

        // Only auto-register if no hotkey is currently set or it's the old default
        if (!hotkey || hotkey === "`" || hotkey === "GLOBE") {
          // Try to register the default hotkey silently
          const success = await registerHotkey(defaultHotkey);
          if (success) {
            setHotkey(defaultHotkey);
          }
        }
      } catch (error) {
        console.error("Failed to auto-register default hotkey:", error);
      } finally {
        autoRegisterInFlightRef.current = false;
      }
    };

    void autoRegisterDefaultHotkey();
  }, [currentStep, hotkey, registerHotkey]);

  const ensureHotkeyRegistered = useCallback(async () => {
    if (!window.electronAPI?.updateHotkey) {
      return true;
    }

    try {
      const result = await window.electronAPI.updateHotkey(hotkey);
      if (result && !result.success) {
        showAlertDialog({
          title: "Hotkey Not Registered",
          description:
            result.message || "We couldn't register that key. Please choose another hotkey.",
        });
        return false;
      }
      return true;
    } catch (error) {
      console.error("Failed to register onboarding hotkey", error);
      showAlertDialog({
        title: "Hotkey Error",
        description: "We couldn't register that key. Please choose another hotkey.",
      });
      return false;
    }
  }, [hotkey, showAlertDialog]);

  const saveSettings = useCallback(async () => {
    const hotkeyRegistered = await ensureHotkeyRegistered();
    if (!hotkeyRegistered) {
      return false;
    }
    setDictationKey(hotkey);
    saveAgentName(agentName);

    localStorage.setItem("micPermissionGranted", permissionsHook.micPermissionGranted.toString());
    localStorage.setItem(
      "accessibilityPermissionGranted",
      permissionsHook.accessibilityPermissionGranted.toString()
    );
    localStorage.setItem("onboardingCompleted", "true");

    try {
      await window.electronAPI?.saveAllKeysToEnv?.();
    } catch (error) {
      console.error("Failed to persist API keys:", error);
    }

    return true;
  }, [
    hotkey,
    agentName,
    permissionsHook.micPermissionGranted,
    permissionsHook.accessibilityPermissionGranted,
    setDictationKey,
    ensureHotkeyRegistered,
  ]);

  const nextStep = useCallback(async () => {
    if (currentStep >= steps.length - 1) {
      return;
    }

    const newStep = currentStep + 1;
    setCurrentStep(newStep);

    if (currentStep === 2 && newStep === 3) {
      if (window.electronAPI?.showDictationPanel) {
        window.electronAPI.showDictationPanel();
      }
    }
  }, [currentStep, setCurrentStep, steps.length]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      const newStep = currentStep - 1;
      setCurrentStep(newStep);
    }
  }, [currentStep, setCurrentStep]);

  const finishOnboarding = useCallback(async () => {
    const saved = await saveSettings();
    if (!saved) {
      return;
    }
    removeCurrentStep();
    onComplete();
  }, [saveSettings, removeCurrentStep, onComplete]);

  const renderStep = () => {
    switch (currentStep) {
      case 0: // Welcome
        return (
          <div className="text-center space-y-5">
            {/* App logo */}
            <div className="relative w-16 h-16 mx-auto">
              <div className="absolute inset-0 bg-primary/30 rounded-2xl blur-xl" />
              <img
                src="./assets/icon.png"
                alt="OpenWhispr"
                className="relative w-16 h-16 rounded-2xl shadow-lg"
              />
            </div>

            {/* Title */}
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-foreground tracking-tight">
                Welcome to OpenWhispr
              </h2>
              <p className="text-sm text-muted-foreground">
                Professional voice-to-text for your computer
              </p>
            </div>

            {/* Feature grid - compact and refined */}
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 dark:bg-white/3 border border-white/10 dark:border-white/5">
                <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                  <Mic className="w-4 h-4 text-primary" />
                </div>
                <span className="text-xs font-medium text-foreground">Voice to Text</span>
                <span className="text-[10px] text-muted-foreground">Instant</span>
              </div>
              <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 dark:bg-white/3 border border-white/10 dark:border-white/5">
                <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                  <Command className="w-4 h-4 text-primary" />
                </div>
                <span className="text-xs font-medium text-foreground">Works Anywhere</span>
                <span className="text-[10px] text-muted-foreground">Any app</span>
              </div>
              <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 dark:bg-white/3 border border-white/10 dark:border-white/5">
                <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-primary" />
                </div>
                <span className="text-xs font-medium text-foreground">Private</span>
                <span className="text-[10px] text-muted-foreground">Your choice</span>
              </div>
            </div>
          </div>
        );

      case 1: // Setup - Choose Mode & Configure
        return (
          <div className="space-y-3">
            <div className="text-center space-y-0.5">
              <h2 className="text-lg font-semibold text-foreground tracking-tight">
                Transcription Setup
              </h2>
              <p className="text-xs text-muted-foreground">Choose your mode and provider</p>
            </div>

            {/* Unified configuration with integrated mode toggle */}
            <TranscriptionModelPicker
              selectedCloudProvider={cloudTranscriptionProvider}
              onCloudProviderSelect={(provider) =>
                updateTranscriptionSettings({ cloudTranscriptionProvider: provider })
              }
              selectedCloudModel={cloudTranscriptionModel}
              onCloudModelSelect={(model) =>
                updateTranscriptionSettings({ cloudTranscriptionModel: model })
              }
              selectedLocalModel={
                localTranscriptionProvider === "nvidia" ? parakeetModel : whisperModel
              }
              onLocalModelSelect={(modelId) => {
                if (localTranscriptionProvider === "nvidia") {
                  updateTranscriptionSettings({ parakeetModel: modelId });
                } else {
                  updateTranscriptionSettings({ whisperModel: modelId });
                }
              }}
              selectedLocalProvider={localTranscriptionProvider}
              onLocalProviderSelect={(provider) =>
                updateTranscriptionSettings({
                  localTranscriptionProvider: provider as "whisper" | "nvidia",
                })
              }
              useLocalWhisper={useLocalWhisper}
              onModeChange={(isLocal) => updateTranscriptionSettings({ useLocalWhisper: isLocal })}
              openaiApiKey={openaiApiKey}
              setOpenaiApiKey={setOpenaiApiKey}
              groqApiKey={groqApiKey}
              setGroqApiKey={setGroqApiKey}
              customTranscriptionApiKey={customTranscriptionApiKey}
              setCustomTranscriptionApiKey={setCustomTranscriptionApiKey}
              cloudTranscriptionBaseUrl={cloudTranscriptionBaseUrl}
              setCloudTranscriptionBaseUrl={(url) =>
                updateTranscriptionSettings({ cloudTranscriptionBaseUrl: url })
              }
              variant="onboarding"
            />
          </div>
        );

      case 2: // Permissions
        const platform = permissionsHook.pasteToolsInfo?.platform;
        const isMacOS = platform === "darwin";

        return (
          <div className="space-y-4">
            {/* Header - compact */}
            <div className="text-center">
              <h2 className="text-lg font-semibold text-foreground tracking-tight">Permissions</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isMacOS ? "Required for OpenWhispr to work" : "Microphone access required"}
              </p>
            </div>

            {/* Permission cards - tight stack */}
            <div className="space-y-1.5">
              <PermissionCard
                icon={Mic}
                title="Microphone"
                description="To capture your voice"
                granted={permissionsHook.micPermissionGranted}
                onRequest={permissionsHook.requestMicPermission}
                buttonText="Grant"
              />

              {isMacOS && (
                <PermissionCard
                  icon={Shield}
                  title="Accessibility"
                  description="To paste text into apps"
                  granted={permissionsHook.accessibilityPermissionGranted}
                  onRequest={permissionsHook.testAccessibilityPermission}
                  buttonText="Test & Grant"
                  onOpenSettings={permissionsHook.openAccessibilitySettings}
                />
              )}
            </div>

            {/* Error state - only show when there's actually an issue */}
            {!permissionsHook.micPermissionGranted && permissionsHook.micPermissionError && (
              <MicPermissionWarning
                error={permissionsHook.micPermissionError}
                onOpenSoundSettings={permissionsHook.openSoundInputSettings}
                onOpenPrivacySettings={permissionsHook.openMicPrivacySettings}
              />
            )}

            {/* Linux paste tools - only when needed */}
            {platform === "linux" &&
              permissionsHook.pasteToolsInfo &&
              !permissionsHook.pasteToolsInfo.available && (
                <PasteToolsInfo
                  pasteToolsInfo={permissionsHook.pasteToolsInfo}
                  isChecking={permissionsHook.isCheckingPasteTools}
                  onCheck={permissionsHook.checkPasteToolsAvailability}
                />
              )}
          </div>
        );

      case 3: // Hotkey & Activation Mode
        return (
          <div className="space-y-4">
            {/* Header */}
            <div className="text-center space-y-0.5">
              <h2 className="text-lg font-semibold text-foreground tracking-tight">
                Activation Setup
              </h2>
              <p className="text-xs text-muted-foreground">Configure how you trigger dictation</p>
            </div>

            {/* Unified control surface */}
            <div className="rounded-lg border border-border-subtle bg-surface-1 overflow-hidden">
              {/* Hotkey section */}
              <div className="p-4 border-b border-border-subtle">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Hotkey
                  </span>
                </div>
                <HotkeyInput
                  value={hotkey}
                  onChange={async (newHotkey) => {
                    const success = await registerHotkey(newHotkey);
                    if (success) {
                      setHotkey(newHotkey);
                    }
                  }}
                  disabled={isHotkeyRegistering}
                  variant="hero"
                />
              </div>

              {/* Mode section - inline with hotkey */}
              {!isUsingGnomeHotkeys && (
                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Mode
                    </span>
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                      {activationMode === "tap" ? "Press to start/stop" : "Hold while speaking"}
                    </p>
                  </div>
                  <ActivationModeSelector
                    value={activationMode}
                    onChange={setActivationMode}
                    variant="compact"
                  />
                </div>
              )}
            </div>

            {/* Test area - minimal chrome */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Test
                </span>
                <span className="text-[10px] text-muted-foreground/60">
                  {activationMode === "tap" || isUsingGnomeHotkeys
                    ? `${readableHotkey} to start/stop`
                    : `Hold ${readableHotkey}`}
                </span>
              </div>
              <Textarea
                rows={2}
                placeholder="Click here and use your hotkey to dictate..."
                className="text-sm resize-none"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return true; // Welcome
      case 1:
        // Setup - check if configuration is complete
        if (useLocalWhisper) {
          const modelToCheck =
            localTranscriptionProvider === "nvidia" ? parakeetModel : whisperModel;
          return modelToCheck !== "" && isModelDownloaded;
        } else {
          // For cloud mode, check if appropriate API key is set
          if (cloudTranscriptionProvider === "openai") {
            return openaiApiKey.trim().length > 0;
          } else if (cloudTranscriptionProvider === "groq") {
            return groqApiKey.trim().length > 0;
          } else if (cloudTranscriptionProvider === "custom") {
            // Custom can work without API key for local endpoints
            return true;
          }
          return openaiApiKey.trim().length > 0; // Default to OpenAI
        }
      case 2: {
        // Permissions
        if (!permissionsHook.micPermissionGranted) {
          return false;
        }
        const currentPlatform = permissionsHook.pasteToolsInfo?.platform;
        if (currentPlatform === "darwin") {
          return permissionsHook.accessibilityPermissionGranted;
        }
        return true;
      }
      case 3:
        return hotkey.trim() !== ""; // Activation step (final)
      default:
        return false;
    }
  };

  // Load Google Font only in the browser
  React.useEffect(() => {
    const link = document.createElement("link");
    link.href =
      "https://fonts.googleapis.com/css2?family=Noto+Sans:wght@300;400;500;600;700&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  return (
    <div
      className="h-screen flex flex-col bg-background"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}
    >
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => !open && hideConfirmDialog()}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        onConfirm={confirmDialog.onConfirm}
      />

      <AlertDialog
        open={alertDialog.open}
        onOpenChange={(open) => !open && hideAlertDialog()}
        title={alertDialog.title}
        description={alertDialog.description}
        onOk={() => {}}
      />

      {/* Title Bar */}
      <div className="flex-shrink-0 z-10">
        <TitleBar
          showTitle={true}
          className="bg-background backdrop-blur-xl border-b border-border shadow-sm"
        ></TitleBar>
      </div>

      {/* Progress Bar */}
      <div className="flex-shrink-0 bg-background/80 backdrop-blur-2xl border-b border-white/5 px-6 md:px-12 py-4 z-10">
        <div className="max-w-3xl mx-auto">
          <StepProgress steps={steps} currentStep={currentStep} />
        </div>
      </div>

      {/* Content - This will grow to fill available space */}
      <div className="flex-1 px-6 md:px-12 py-6 overflow-y-auto">
        <div className="max-w-3xl mx-auto">
          <Card className="bg-card/80 backdrop-blur-2xl border border-white/10 dark:border-white/5 shadow-xl rounded-2xl overflow-hidden">
            <CardContent className="p-8 md:p-10">
              <div className="space-y-6">{renderStep()}</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer - This will stick to the bottom */}
      <div className="flex-shrink-0 bg-background/80 backdrop-blur-2xl border-t border-white/5 px-6 md:px-12 py-3 z-10">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Button
            onClick={prevStep}
            variant="outline"
            disabled={currentStep === 0}
            className="h-8 px-5 rounded-full text-xs"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back
          </Button>

          <div className="flex items-center gap-2">
            {currentStep === steps.length - 1 ? (
              <Button
                onClick={finishOnboarding}
                disabled={!canProceed()}
                variant="success"
                className="h-8 px-6 rounded-full text-xs"
              >
                <Check className="w-3.5 h-3.5" />
                Complete
              </Button>
            ) : (
              <Button
                onClick={nextStep}
                disabled={!canProceed()}
                className="h-8 px-6 rounded-full text-xs"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
