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
  UserCircle,
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
import LanguageSelector from "./ui/LanguageSelector";
import AuthenticationStep from "./AuthenticationStep";
import { setAgentName as saveAgentName } from "../utils/agentName";
import { formatHotkeyLabel, getDefaultHotkey } from "../utils/hotkeys";
import { useAuth } from "../hooks/useAuth";
import { HotkeyInput } from "./ui/HotkeyInput";
import { useHotkeyRegistration } from "../hooks/useHotkeyRegistration";
import { ActivationModeSelector } from "./ui/ActivationModeSelector";
import ProcessingModeSelector from "./ui/ProcessingModeSelector";

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
    setWhisperModel,
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
    cloudTranscriptionMode,
    setCloudTranscriptionMode,
    cloudReasoningModel,
    setCloudReasoningModel,
    preferredLanguage,
  } = useSettings();

  const [hotkey, setHotkey] = useState(dictationKey || getDefaultHotkey());
  const [agentName, setAgentName] = useState("Agent");
  const [skipAuth, setSkipAuth] = useState(false);
  const [isModelDownloaded, setIsModelDownloaded] = useState(false);
  const [isUsingGnomeHotkeys, setIsUsingGnomeHotkeys] = useState(false);
  const readableHotkey = formatHotkeyLabel(hotkey);
  const { isSignedIn } = useAuth();
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
    { title: "Welcome", icon: UserCircle },
    { title: "Setup", icon: Settings },
    { title: "Permissions", icon: Shield },
    { title: "Activation", icon: Command },
  ];

  // Only show progress for signed-up users after account creation step
  const showProgress = currentStep > 0;

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
    const skippedAuth = skipAuth;
    localStorage.setItem("authenticationSkipped", skippedAuth.toString());
    localStorage.setItem("onboardingCompleted", "true");
    localStorage.setItem("skipAuth", skippedAuth.toString());

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
      case 0: // Authentication (with Welcome)
        return (
          <AuthenticationStep
            onContinueWithoutAccount={() => {
              setSkipAuth(true);
              nextStep();
            }}
            onAuthComplete={() => {
              nextStep();
            }}
          />
        );

      case 1: // Setup - Choose Mode & Configure
        // Simplified path for signed-in users (cloud-first)
        if (isSignedIn && !skipAuth) {
          return (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-7 h-7 text-emerald-600" />
                </div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">You're ready to go</h2>
                <p className="text-neutral-600">
                  OpenWhispr handles transcription and AI processing for you. No setup needed.
                </p>
              </div>

              <div className="space-y-4 p-4 bg-neutral-50 border border-neutral-200 rounded-xl">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Language
                  </label>
                  <LanguageSelector
                    value={preferredLanguage}
                    onChange={(value) => {
                      updateTranscriptionSettings({ preferredLanguage: value });
                    }}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    AI Model
                  </label>
                  <select
                    value={cloudReasoningModel}
                    onChange={(e) => setCloudReasoningModel(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <optgroup label="Fast">
                      <option value="llama-3.3-70b-versatile">Llama 3.3 70B — Recommended</option>
                      <option value="llama-3.1-8b-instant">Llama 3.1 8B — Fastest</option>
                    </optgroup>
                    <optgroup label="Balanced">
                      <option value="anthropic/claude-sonnet-4">Claude Sonnet 4</option>
                      <option value="google/gemini-2.5-flash">Gemini 2.5 Flash</option>
                    </optgroup>
                    <optgroup label="Quality">
                      <option value="anthropic/claude-opus-4">Claude Opus 4</option>
                      <option value="openai/gpt-4.1">GPT-4.1</option>
                    </optgroup>
                  </select>
                </div>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                <p className="text-sm text-blue-800">
                  <span className="font-medium">Included with your account:</span> 2,000 words/day
                  free, AI processing, multiple AI models, custom dictionary
                </p>
              </div>

              <details className="group">
                <summary className="text-sm text-neutral-500 cursor-pointer hover:text-neutral-700 transition-colors">
                  Advanced options
                </summary>
                <div className="mt-4 space-y-4">
                  <ProcessingModeSelector
                    useLocalWhisper={useLocalWhisper}
                    setUseLocalWhisper={(useLocal) => {
                      updateTranscriptionSettings({ useLocalWhisper: useLocal });
                      if (!useLocal) {
                        setCloudTranscriptionMode("openwhispr");
                      }
                    }}
                  />
                  {(useLocalWhisper || cloudTranscriptionMode === "byok") && (
                    <TranscriptionModelPicker
                      selectedCloudProvider={cloudTranscriptionProvider}
                      onCloudProviderSelect={(provider) =>
                        updateTranscriptionSettings({ cloudTranscriptionProvider: provider })
                      }
                      selectedCloudModel={cloudTranscriptionModel}
                      onCloudModelSelect={(model) =>
                        updateTranscriptionSettings({ cloudTranscriptionModel: model })
                      }
                      selectedLocalModel={whisperModel}
                      onLocalModelSelect={setWhisperModel}
                      useLocalWhisper={useLocalWhisper}
                      onModeChange={() => {}}
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
                  )}
                </div>
              </details>
            </div>
          );
        }

        // Not signed in — full setup (unchanged)
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

            {/* Language Selection - shown for both modes */}
            <div className="space-y-4 p-4 bg-muted border border-border rounded-xl">
              <h4 className="font-medium text-foreground mb-3">Preferred Language</h4>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Which language do you primarily speak?
              </label>
              <LanguageSelector
                value={preferredLanguage}
                onChange={(value) => {
                  updateTranscriptionSettings({ preferredLanguage: value });
                }}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {useLocalWhisper
                  ? "Helps Whisper better understand your speech"
                  : "Improves transcription speed and accuracy. AI text enhancement is enabled by default."}
              </p>
            </div>
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
        return isSignedIn || skipAuth; // Authentication step
      case 1:
        // Signed-in users using cloud mode can always proceed
        if (
          isSignedIn &&
          !skipAuth &&
          cloudTranscriptionMode === "openwhispr" &&
          !useLocalWhisper
        ) {
          return true;
        }
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
      <div className="shrink-0 z-10">
        <TitleBar
          showTitle={true}
          className="bg-background backdrop-blur-xl border-b border-border shadow-sm"
        ></TitleBar>
      </div>

      {/* Progress Bar - hidden on welcome/auth step */}
      {showProgress && (
        <div className="shrink-0 bg-background/80 backdrop-blur-2xl border-b border-white/5 px-6 md:px-12 py-3 z-10">
          <div className="max-w-3xl mx-auto">
            <StepProgress steps={steps.slice(1)} currentStep={currentStep - 1} />
          </div>
        </div>
      )}

      {/* Content - This will grow to fill available space */}
      <div
        className={`flex-1 px-6 md:px-12 overflow-y-auto ${currentStep === 0 ? "flex items-center" : "py-6"}`}
      >
        <div className={`w-full ${currentStep === 0 ? "max-w-sm" : "max-w-3xl"} mx-auto`}>
          <Card className="bg-card/90 backdrop-blur-2xl border border-border/50 dark:border-white/5 shadow-lg rounded-xl overflow-hidden">
            <CardContent className={currentStep === 0 ? "p-6" : "p-6 md:p-8"}>
              {renderStep()}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer Navigation - hidden on welcome/auth step */}
      {showProgress && (
        <div className="shrink-0 bg-background/80 backdrop-blur-2xl border-t border-white/5 px-6 md:px-12 py-3 z-10">
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
      )}
    </div>
  );
}
