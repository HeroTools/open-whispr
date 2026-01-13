import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import {
  ChevronRight,
  ChevronLeft,
  Check,
  Settings,
  Mic,
  Key,
  Shield,
  Command,
  Sparkles,
  Lock,
  User,
} from "lucide-react";
import TitleBar from "./TitleBar";
import LocalWhisperPicker from "./LocalWhisperPicker";
import ProcessingModeSelector from "./ui/ProcessingModeSelector";
import ApiKeyInput from "./ui/ApiKeyInput";
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
import { getLanguageLabel } from "../utils/languages";
import { REASONING_PROVIDERS } from "../models/ModelRegistry";
import LanguageSelector from "./ui/LanguageSelector";
import ModelCardList from "./ui/ModelCardList";
import { setAgentName as saveAgentName } from "../utils/agentName";
import { formatHotkeyLabel, getDefaultHotkey } from "../utils/hotkeys";
import { API_ENDPOINTS, buildApiUrl, normalizeBaseUrl } from "../config/constants";
import { HotkeyInput } from "./ui/HotkeyInput";
import { useHotkeyRegistration } from "../hooks/useHotkeyRegistration";

interface OnboardingFlowProps {
  onComplete: () => void;
}

type ReasoningModelOption = {
  value: string;
  label: string;
  description?: string;
  icon?: string;
};

export default function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  // Max valid step index for the current onboarding flow (6 steps, index 0-5)
  const MAX_STEP = 5;

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
    preferredLanguage,
    cloudTranscriptionBaseUrl,
    cloudReasoningBaseUrl,
    useReasoningModel,
    reasoningModel,
    openaiApiKey,
    dictationKey,
    setUseLocalWhisper,
    setWhisperModel,
    setPreferredLanguage,
    setCloudTranscriptionBaseUrl,
    setCloudReasoningBaseUrl,
    setDictationKey,
    updateTranscriptionSettings,
    updateReasoningSettings,
    updateApiKeys,
  } = useSettings();

  const [apiKey, setApiKey] = useState(openaiApiKey);
  const [hotkey, setHotkey] = useState(dictationKey || "`");
  const [transcriptionBaseUrl, setTranscriptionBaseUrl] = useState(cloudTranscriptionBaseUrl);
  const [reasoningBaseUrl, setReasoningBaseUrl] = useState(cloudReasoningBaseUrl);
  const [agentName, setAgentName] = useState("Agent");
  const [isModelDownloaded, setIsModelDownloaded] = useState(false);
  const readableHotkey = formatHotkeyLabel(hotkey);
  const {
    alertDialog,
    confirmDialog,
    showAlertDialog,
    showConfirmDialog,
    hideAlertDialog,
    hideConfirmDialog,
  } = useDialogs();
  const practiceTextareaRef = useRef<HTMLInputElement>(null);

  // Ref to prevent React.StrictMode double-invocation of auto-registration
  const autoRegisterInFlightRef = useRef(false);
  const hotkeyStepInitializedRef = useRef(false);

  // Shared hotkey registration hook
  const { registerHotkey, isRegistering: isHotkeyRegistering } = useHotkeyRegistration({
    onSuccess: (registeredHotkey) => {
      setHotkey(registeredHotkey);
      setDictationKey(registeredHotkey);
    },
    showSuccessToast: false, // Don't show toast during onboarding auto-registration
    showErrorToast: false,
  });

  const trimmedReasoningBase = (reasoningBaseUrl || "").trim();
  const normalizedReasoningBaseUrl = useMemo(
    () => normalizeBaseUrl(trimmedReasoningBase),
    [trimmedReasoningBase]
  );
  const hasEnteredReasoningBase = trimmedReasoningBase.length > 0;
  const isValidReasoningBase = Boolean(
    normalizedReasoningBaseUrl && normalizedReasoningBaseUrl.includes("://")
  );
  const usingCustomReasoningBase = hasEnteredReasoningBase && isValidReasoningBase;

  const [customReasoningModels, setCustomReasoningModels] = useState<ReasoningModelOption[]>([]);
  const [customModelsLoading, setCustomModelsLoading] = useState(false);
  const [customModelsError, setCustomModelsError] = useState<string | null>(null);

  const defaultReasoningModels = useMemo<ReasoningModelOption[]>(() => {
    const provider = REASONING_PROVIDERS.openai;
    return (
      provider?.models?.map((model) => ({
        value: model.value,
        label: model.label,
        description: model.description,
      })) ?? []
    );
  }, []);

  const displayedReasoningModels = usingCustomReasoningBase
    ? customReasoningModels
    : defaultReasoningModels;

  const reasoningModelsEndpoint = useMemo(() => {
    const base =
      usingCustomReasoningBase && normalizedReasoningBaseUrl
        ? normalizedReasoningBaseUrl
        : API_ENDPOINTS.OPENAI_BASE;
    return buildApiUrl(base, "/models");
  }, [usingCustomReasoningBase, normalizedReasoningBaseUrl]);

  const persistOpenAIKey = useCallback(
    async (nextKey: string) => {
      const trimmedKey = nextKey.trim();
      if (useLocalWhisper || !trimmedKey) {
        return false;
      }
      if (trimmedKey === openaiApiKey.trim()) {
        return true;
      }

      try {
        if (window.electronAPI?.saveOpenAIKey) {
          await window.electronAPI.saveOpenAIKey(trimmedKey);
        }
        updateApiKeys({ openaiApiKey: trimmedKey });
        return true;
      } catch (error) {
        console.error("Failed to save OpenAI key", error);
        return false;
      }
    },
    [useLocalWhisper, updateApiKeys, openaiApiKey]
  );

  const reasoningModelRef = useRef(reasoningModel);
  useEffect(() => {
    reasoningModelRef.current = reasoningModel;
  }, [reasoningModel]);

  useEffect(() => {
    if (!usingCustomReasoningBase) {
      setCustomModelsLoading(false);
      setCustomReasoningModels([]);
      setCustomModelsError(null);
      return;
    }

    if (!normalizedReasoningBaseUrl) {
      return;
    }

    let isCancelled = false;
    const controller = new AbortController();

    const loadModels = async () => {
      setCustomModelsLoading(true);
      setCustomModelsError(null);
      try {
        // Security: Only allow HTTPS endpoints (except localhost for development)
        const isLocalhost =
          normalizedReasoningBaseUrl.includes("://localhost") ||
          normalizedReasoningBaseUrl.includes("://127.0.0.1");
        if (!normalizedReasoningBaseUrl.startsWith("https://") && !isLocalhost) {
          throw new Error("Only HTTPS endpoints are allowed (except localhost for testing).");
        }

        const headers: Record<string, string> = {};
        const trimmedKey = apiKey.trim();
        if (trimmedKey) {
          headers.Authorization = `Bearer ${trimmedKey}`;
        }

        const response = await fetch(buildApiUrl(normalizedReasoningBaseUrl, "/models"), {
          method: "GET",
          headers,
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          throw new Error(
            errorText
              ? `${response.status} ${errorText.slice(0, 200)}`
              : `${response.status} ${response.statusText}`
          );
        }

        const payload = await response.json().catch(() => ({}));
        const rawModels = Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.models)
            ? payload.models
            : [];

        const mappedModels = (rawModels as Array<any>)
          .map((item) => {
            const value = item?.id || item?.name;
            if (!value) {
              return null;
            }

            const description =
              typeof item?.description === "string" && item.description.trim()
                ? item.description.trim()
                : undefined;
            const ownedBy = typeof item?.owned_by === "string" ? item.owned_by : undefined;

            return {
              value,
              label: item?.id || item?.name || value,
              description: description || (ownedBy ? `Owner: ${ownedBy}` : undefined),
            } as ReasoningModelOption;
          })
          .filter(Boolean) as ReasoningModelOption[];

        if (isCancelled) {
          return;
        }

        setCustomReasoningModels(mappedModels);

        if (mappedModels.length === 0) {
          setCustomModelsError("No models returned by this endpoint.");
        } else if (
          reasoningModelRef.current &&
          !mappedModels.some((model) => model.value === reasoningModelRef.current)
        ) {
          updateReasoningSettings({ reasoningModel: "" });
        }
      } catch (error) {
        if (isCancelled) {
          return;
        }
        if ((error as Error).name === "AbortError") {
          return;
        }
        setCustomModelsError((error as Error).message || "Unable to load models from endpoint.");
        setCustomReasoningModels([]);
      } finally {
        if (!isCancelled) {
          setCustomModelsLoading(false);
        }
      }
    };

    loadModels();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [usingCustomReasoningBase, normalizedReasoningBaseUrl, apiKey, updateReasoningSettings]);

  useEffect(() => {
    if (!usingCustomReasoningBase && defaultReasoningModels.length > 0) {
      if (
        reasoningModel &&
        !defaultReasoningModels.some((model) => model.value === reasoningModel)
      ) {
        updateReasoningSettings({ reasoningModel: "" });
      }
    }
  }, [usingCustomReasoningBase, defaultReasoningModels, reasoningModel, updateReasoningSettings]);

  const activeReasoningModelLabel = useMemo(() => {
    const match = displayedReasoningModels.find((model) => model.value === reasoningModel);
    return match?.label || reasoningModel;
  }, [displayedReasoningModels, reasoningModel]);

  const permissionsHook = usePermissions(showAlertDialog);
  const { pasteFromClipboard } = useClipboard(showAlertDialog);

  const steps = [
    { title: "Welcome", icon: Sparkles },
    { title: "Privacy", icon: Lock },
    { title: "Setup", icon: Settings },
    { title: "Permissions", icon: Shield },
    { title: "Hotkey & Test", icon: Command },
    { title: "Agent Name", icon: User },
  ];

  const updateProcessingMode = (useLocal: boolean) => {
    updateTranscriptionSettings({ useLocalWhisper: useLocal });
  };

  // Check if selected whisper model is downloaded
  useEffect(() => {
    if (!useLocalWhisper || !whisperModel) {
      setIsModelDownloaded(false);
      return;
    }

    const checkModelStatus = async () => {
      try {
        const result = await window.electronAPI?.checkModelStatus(whisperModel);
        setIsModelDownloaded(result?.downloaded ?? false);
      } catch (error) {
        console.error("Failed to check model status:", error);
        setIsModelDownloaded(false);
      }
    };

    checkModelStatus();
  }, [useLocalWhisper, whisperModel]);

  useEffect(() => {
    if (currentStep === 4) {
      if (practiceTextareaRef.current) {
        practiceTextareaRef.current.focus();
      }
    }
  }, [currentStep]);

  // Auto-register default hotkey when entering the hotkey step (step 4)
  useEffect(() => {
    if (currentStep !== 4) {
      // Reset initialization flag when leaving step 4
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
    const normalizedTranscriptionBase = (transcriptionBaseUrl || "").trim();
    const normalizedReasoningBaseValue = (reasoningBaseUrl || "").trim();

    setCloudTranscriptionBaseUrl(normalizedTranscriptionBase);
    setCloudReasoningBaseUrl(normalizedReasoningBaseValue);

    updateTranscriptionSettings({
      whisperModel,
      preferredLanguage,
      cloudTranscriptionBaseUrl: normalizedTranscriptionBase,
    });
    updateReasoningSettings({
      useReasoningModel,
      reasoningModel,
      cloudReasoningBaseUrl: normalizedReasoningBaseValue,
    });
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
    const trimmedApiKey = apiKey.trim();
    const skipAuth = trimmedApiKey.length === 0;
    localStorage.setItem("skipAuth", skipAuth.toString());

    if (!useLocalWhisper && trimmedApiKey) {
      await persistOpenAIKey(trimmedApiKey);
    }
    return true;
  }, [
    whisperModel,
    hotkey,
    preferredLanguage,
    agentName,
    permissionsHook.micPermissionGranted,
    permissionsHook.accessibilityPermissionGranted,
    useLocalWhisper,
    apiKey,
    transcriptionBaseUrl,
    reasoningBaseUrl,
    updateTranscriptionSettings,
    updateReasoningSettings,
    persistOpenAIKey,
    setCloudTranscriptionBaseUrl,
    setCloudReasoningBaseUrl,
    setDictationKey,
    ensureHotkeyRegistered,
  ]);

  const nextStep = useCallback(async () => {
    if (currentStep >= steps.length - 1) {
      return;
    }

    const newStep = currentStep + 1;

    if (currentStep === 2 && !useLocalWhisper) {
      await persistOpenAIKey(apiKey);
    }

    setCurrentStep(newStep);

    // Show dictation panel when moving from permissions step (3) to hotkey & test step (4)
    if (currentStep === 3 && newStep === 4) {
      if (window.electronAPI?.showDictationPanel) {
        window.electronAPI.showDictationPanel();
      }
    }
  }, [currentStep, setCurrentStep, steps.length, useLocalWhisper, persistOpenAIKey, apiKey]);

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
    // Clear the onboarding step since we're done
    removeCurrentStep();
    onComplete();
  }, [saveSettings, removeCurrentStep, onComplete]);

  const renderStep = () => {
    switch (currentStep) {
      case 0: // Welcome
        return (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-stone-900 mb-2">Welcome to OpenWhispr</h2>
              <p className="text-stone-600">
                Let's set up your voice dictation in just a few simple steps.
              </p>
            </div>
            <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-200/60">
              <p className="text-sm text-blue-800">
                🎤 Turn your voice into text instantly
                <br />
                ⚡ Works anywhere on your computer
                <br />
                🔒 Your privacy is protected
              </p>
            </div>
          </div>
        );

      case 1: // Choose Mode
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-stone-900 mb-2">
                Choose Your Processing Mode
              </h2>
              <p className="text-stone-600">How would you like to convert your speech to text?</p>
            </div>

            <ProcessingModeSelector
              useLocalWhisper={useLocalWhisper}
              setUseLocalWhisper={updateProcessingMode}
            />
          </div>
        );

      case 2: // Setup Processing
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {useLocalWhisper ? "Local Processing Setup" : "Cloud Processing Setup"}
              </h2>
              <p className="text-gray-600">
                {useLocalWhisper
                  ? "Let's install and configure Whisper on your device"
                  : "Enter your OpenAI API key to get started"}
              </p>
            </div>

            {useLocalWhisper ? (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-4">
                    <Mic className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Choose Your Model</h3>
                  <p className="text-sm text-gray-600">
                    Select a transcription model based on your needs.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Model quality
                  </label>
                  <p className="text-xs text-gray-500">
                    Larger models are more accurate but slower. Base is recommended for most users.
                  </p>
                </div>

                <LocalWhisperPicker
                  selectedModel={whisperModel}
                  onModelSelect={setWhisperModel}
                  onModelDownloaded={(modelId) => {
                    setIsModelDownloaded(true);
                    setWhisperModel(modelId);
                  }}
                  variant="onboarding"
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-4">
                    <Key className="w-8 h-8 text-blue-600" />
                  </div>
                </div>

                <ApiKeyInput
                  apiKey={apiKey}
                  setApiKey={setApiKey}
                  label="OpenAI API Key"
                  helpText={
                    <>
                      Need an API key?{" "}
                      <a
                        href="https://platform.openai.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline"
                      >
                        platform.openai.com
                      </a>
                    </>
                  }
                />

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-blue-900">
                    Custom transcription base URL (optional)
                  </label>
                  <Input
                    value={transcriptionBaseUrl}
                    onChange={(event) => setTranscriptionBaseUrl(event.target.value)}
                    placeholder="https://api.openai.com/v1"
                    className="text-sm"
                  />
                  <p className="text-xs text-blue-800">
                    Cloud transcription requests default to{" "}
                    <code>{API_ENDPOINTS.TRANSCRIPTION_BASE}</code>. Enter an OpenAI-compatible base
                    URL to override.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-blue-900">
                    Custom reasoning base URL (optional)
                  </label>
                  <Input
                    value={reasoningBaseUrl}
                    onChange={(event) => setReasoningBaseUrl(event.target.value)}
                    placeholder="https://api.openai.com/v1"
                    className="text-sm"
                  />
                  <p className="text-xs text-blue-800">
                    We'll load AI models from this endpoint's /v1/models route during setup. Leave
                    empty to use the default OpenAI endpoint.
                  </p>
                </div>

                <div className="space-y-3 pt-4 border-t border-blue-100">
                  <h4 className="font-medium text-blue-900">Reasoning Model</h4>
                  {hasEnteredReasoningBase ? (
                    <>
                      {isValidReasoningBase ? (
                        <p className="text-xs text-blue-800 break-all">
                          Models load from <code>{reasoningModelsEndpoint}</code>.
                        </p>
                      ) : (
                        <p className="text-xs text-amber-600">
                          Enter a full base URL including protocol (e.g. https://server/v1).
                        </p>
                      )}
                      {isValidReasoningBase && customModelsLoading && (
                        <p className="text-xs text-blue-600">Fetching models...</p>
                      )}
                      {isValidReasoningBase && customModelsError && (
                        <p className="text-xs text-red-600">{customModelsError}</p>
                      )}
                      {isValidReasoningBase &&
                        !customModelsLoading &&
                        !customModelsError &&
                        displayedReasoningModels.length === 0 && (
                          <p className="text-xs text-amber-600">
                            No models returned by this endpoint.
                          </p>
                        )}
                    </>
                  ) : (
                    <p className="text-xs text-blue-800">
                      Using OpenAI defaults from <code>{reasoningModelsEndpoint}</code>.
                    </p>
                  )}
                  <ModelCardList
                    models={displayedReasoningModels}
                    selectedModel={reasoningModel}
                    onModelSelect={(modelId) =>
                      updateReasoningSettings({ reasoningModel: modelId })
                    }
                  />
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">How to get your API key:</h4>
                  <ol className="text-sm text-blue-800 space-y-1">
                    <li>1. Go to platform.openai.com</li>
                    <li>2. Sign in to your account</li>
                    <li>3. Navigate to API Keys</li>
                    <li>4. Create a new secret key</li>
                    <li>5. Copy and paste it here</li>
                  </ol>
                </div>
              </div>
            )}

            {/* Language Selection - shown for both modes */}
            <div className="space-y-4 p-4 bg-gray-50 border border-gray-200 rounded-xl">
              <h4 className="font-medium text-gray-900 mb-3">🌍 Preferred Language</h4>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Which language do you primarily speak?
              </label>
              <LanguageSelector
                value={preferredLanguage}
                onChange={(value) => {
                  updateTranscriptionSettings({ preferredLanguage: value });
                }}
                className="w-full"
              />
              <p className="text-xs text-gray-600 mt-1">
                {useLocalWhisper
                  ? "Helps Whisper better understand your speech"
                  : "Improves OpenAI transcription speed and accuracy. AI text enhancement is enabled by default."}
              </p>
            </div>
          </div>
        );

      case 3: // Permissions
        const platform = permissionsHook.pasteToolsInfo?.platform;
        const isMacOS = platform === "darwin";

        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Grant Permissions</h2>
              <p className="text-gray-600">
                {isMacOS
                  ? "OpenWhispr needs a couple of permissions to work properly"
                  : "OpenWhispr needs microphone access to record your voice"}
              </p>
            </div>

            <div className="space-y-4">
              <PermissionCard
                icon={Mic}
                title="Microphone Access"
                description="Required to record your voice"
                granted={permissionsHook.micPermissionGranted}
                onRequest={permissionsHook.requestMicPermission}
                buttonText="Grant Access"
              />

              {!permissionsHook.micPermissionGranted && (
                <MicPermissionWarning
                  error={permissionsHook.micPermissionError}
                  onOpenSoundSettings={permissionsHook.openSoundInputSettings}
                  onOpenPrivacySettings={permissionsHook.openMicPrivacySettings}
                />
              )}

              {isMacOS && (
                <PermissionCard
                  icon={Shield}
                  title="Accessibility Permission"
                  description="Required to paste text automatically"
                  granted={permissionsHook.accessibilityPermissionGranted}
                  onRequest={permissionsHook.testAccessibilityPermission}
                  buttonText="Test & Grant"
                />
              )}

              {/* Only show PasteToolsInfo on Linux when tools are NOT available (to show install instructions) */}
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

            <div className="bg-amber-50 p-4 rounded-lg">
              <h4 className="font-medium text-amber-900 mb-2">🔒 Privacy Note</h4>
              <p className="text-sm text-amber-800">
                OpenWhispr only uses these permissions for dictation.
                {useLocalWhisper
                  ? " With local processing, your voice never leaves your device."
                  : " Your voice is sent to OpenAI's servers for transcription."}
              </p>
            </div>
          </div>
        );

      case 4: // Hotkey & Test (combined)
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Set Your Hotkey & Test</h2>
              <p className="text-gray-600">Choose your hotkey and try it out</p>
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
            />

            <div className="bg-blue-50/50 p-5 rounded-lg border border-blue-200/60">
              <h3 className="font-semibold text-blue-900 mb-3">Try It Now</h3>
              <p className="text-sm text-blue-800 mb-3">
                Click in the text area, press{" "}
                <kbd className="bg-white px-2 py-1 rounded text-xs font-mono border border-blue-200">
                  {readableHotkey}
                </kbd>{" "}
                to start recording, speak, then press it again to stop.
              </p>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Test your dictation:
                </label>
                <Textarea rows={3} placeholder="Click here, then use your hotkey to dictate..." />
              </div>
            </div>

            <div className="bg-green-50/50 p-4 rounded-lg border border-green-200/60">
              <h4 className="font-medium text-green-900 mb-2">How it works:</h4>
              <ol className="text-sm text-green-800 space-y-1">
                <li>1. Click in any text field</li>
                <li>
                  2. Press{" "}
                  <kbd className="bg-white px-1 py-0.5 rounded text-xs font-mono border border-green-200">
                    {readableHotkey}
                  </kbd>{" "}
                  to start, speak, press again to stop
                </li>
                <li>3. Your text appears automatically!</li>
              </ol>
            </div>
          </div>
        );

      case 5: // Agent Name (final step)
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-stone-900 mb-2">Name Your Agent</h2>
              <p className="text-stone-600">
                Give your agent a name so you can address it specifically when giving instructions.
              </p>
            </div>

            <div className="space-y-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl">
              <h4 className="font-medium text-purple-900 mb-3">How this helps:</h4>
              <ul className="text-sm text-purple-800 space-y-1">
                <li>
                  • Say "Hey {agentName || "Agent"}, write a formal email" for specific instructions
                </li>
                <li>• Use the name to distinguish between dictation and commands</li>
                <li>• Makes interactions feel more natural and personal</li>
              </ul>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Agent Name</label>
              <Input
                placeholder="e.g., Assistant, Jarvis, Alex..."
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                className="text-center text-lg font-mono"
              />
              <p className="text-xs text-gray-500 mt-2">You can change this anytime in settings</p>
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
        return true;
      case 1:
        return true; // Mode selection
      case 2:
        if (useLocalWhisper) {
          return whisperModel !== "" && isModelDownloaded;
        } else {
          const trimmedKey = apiKey.trim();
          if (!trimmedKey) {
            return false;
          }
          if (!hasEnteredReasoningBase) {
            return true;
          }
          if (!isValidReasoningBase) {
            return false;
          }
          return customReasoningModels.length > 0 && !customModelsLoading && !customModelsError;
        }
      case 3: {
        if (!permissionsHook.micPermissionGranted) {
          return false;
        }
        const currentPlatform = permissionsHook.pasteToolsInfo?.platform;
        if (currentPlatform === "darwin") {
          return permissionsHook.accessibilityPermissionGranted;
        }
        return true;
      }
      case 4:
        return hotkey.trim() !== ""; // Hotkey & Test step
      case 5:
        return agentName.trim() !== ""; // Agent name step (final)
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
      className="h-screen flex flex-col bg-gradient-to-br from-stone-50 via-white to-blue-50/30"
      style={{
        backgroundImage: `repeating-linear-gradient(
          transparent,
          transparent 24px,
          #e7e5e4 24px,
          #e7e5e4 25px
        )`,
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
      {/* Left margin line for entire page */}
      <div className="fixed left-6 md:left-12 top-0 bottom-0 w-px bg-red-300/40 z-0"></div>

      {/* Title Bar */}
      <div className="flex-shrink-0 z-10">
        <TitleBar
          showTitle={true}
          className="bg-white/95 backdrop-blur-xl border-b border-stone-200/60 shadow-sm"
        ></TitleBar>
      </div>

      {/* Progress Bar */}
      <div className="flex-shrink-0 bg-white/90 backdrop-blur-xl border-b border-stone-200/60 p-6 md:px-16 z-10">
        <div className="max-w-4xl mx-auto">
          <StepProgress steps={steps} currentStep={currentStep} />
        </div>
      </div>

      {/* Content - This will grow to fill available space */}
      <div className="flex-1 px-6 md:pl-16 md:pr-6 py-12 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-white/95 backdrop-blur-xl border border-stone-200/60 shadow-lg rounded-2xl overflow-hidden">
            <CardContent className="p-12 md:p-16">
              <div className="space-y-8">{renderStep()}</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer - This will stick to the bottom */}
      <div className="flex-shrink-0 bg-white/95 backdrop-blur-xl border-t border-stone-200/60 px-6 md:pl-16 md:pr-6 py-8 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Button
            onClick={prevStep}
            variant="outline"
            disabled={currentStep === 0}
            className="px-8 py-3 h-12 text-sm font-medium"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>

          <div className="flex items-center gap-3">
            {currentStep === steps.length - 1 ? (
              <Button
                onClick={finishOnboarding}
                disabled={!canProceed()}
                className="bg-green-600 hover:bg-green-700 px-8 py-3 h-12 text-sm font-medium"
              >
                <Check className="w-4 h-4 mr-2" />
                Complete Setup
              </Button>
            ) : (
              <Button
                onClick={nextStep}
                disabled={!canProceed()}
                className="px-8 py-3 h-12 text-sm font-medium"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
