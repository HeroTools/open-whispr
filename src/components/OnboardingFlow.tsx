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
  Download,
  Key,
  Shield,
  Keyboard,
  TestTube,
  Sparkles,
  Lock,
  X,
  User,
} from "lucide-react";
import TitleBar from "./TitleBar";
import WhisperModelPicker from "./WhisperModelPicker";
import ProcessingModeSelector from "./ui/ProcessingModeSelector";
import ApiKeyInput from "./ui/ApiKeyInput";
import PermissionCard from "./ui/PermissionCard";
import StepProgress from "./ui/StepProgress";
import { AlertDialog } from "./ui/dialog";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { useDialogs } from "../hooks/useDialogs";
import { useWhisper } from "../hooks/useWhisper";
import { usePython } from "../hooks/usePython";
import { usePermissions } from "../hooks/usePermissions";
import { useClipboard } from "../hooks/useClipboard";
import { useSettings } from "../hooks/useSettings";
import { getLanguageLabel, REASONING_PROVIDERS } from "../utils/languages";
import LanguageSelector from "./ui/LanguageSelector";
import { UnifiedModelPickerCompact } from "./UnifiedModelPicker";
const InteractiveKeyboard = React.lazy(() => import("./ui/Keyboard"));
import HotkeyCapture from "./ui/HotkeyCapture";
import { setAgentName as saveAgentName } from "../utils/agentName";
import { formatHotkeyLabel } from "../utils/hotkeys";
import { API_ENDPOINTS, buildApiUrl, normalizeBaseUrl } from "../config/constants";

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
  const [currentStep, setCurrentStep, removeCurrentStep] = useLocalStorage(
    "onboardingCurrentStep",
    0,
    {
      serialize: String,
      deserialize: (value) => parseInt(value, 10),
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
    setOpenaiApiKey,
    setDictationKey,
    updateTranscriptionSettings,
    updateReasoningSettings,
    updateApiKeys,
  } = useSettings();

  const [apiKey, setApiKey] = useState(openaiApiKey);
  const [hotkey, setHotkey] = useState(dictationKey || "`");
  const [hotkeyInputMode, setHotkeyInputMode] = useState<"keyboard" | "capture">("capture");
  const [transcriptionBaseUrl, setTranscriptionBaseUrl] = useState(cloudTranscriptionBaseUrl);
  const [reasoningBaseUrl, setReasoningBaseUrl] = useState(cloudReasoningBaseUrl);
  const [agentName, setAgentName] = useState("Agent");
  const readableHotkey = formatHotkeyLabel(hotkey);
  const { alertDialog, showAlertDialog, hideAlertDialog } = useDialogs();
  const practiceTextareaRef = useRef<HTMLInputElement>(null);

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
        } else if (!mappedModels.some((model) => model.value === reasoningModelRef.current)) {
          updateReasoningSettings({ reasoningModel: mappedModels[0].value });
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
      if (!defaultReasoningModels.some((model) => model.value === reasoningModel)) {
        updateReasoningSettings({ reasoningModel: defaultReasoningModels[0].value });
      }
    }
  }, [usingCustomReasoningBase, defaultReasoningModels, reasoningModel, updateReasoningSettings]);

  const activeReasoningModelLabel = useMemo(() => {
    const match = displayedReasoningModels.find((model) => model.value === reasoningModel);
    return match?.label || reasoningModel;
  }, [displayedReasoningModels, reasoningModel]);

  const whisperHook = useWhisper(showAlertDialog);
  const pythonHook = usePython(showAlertDialog);
  const permissionsHook = usePermissions(showAlertDialog);
  const { pasteFromClipboard } = useClipboard(showAlertDialog);

  const steps = [
    { title: "Welcome", icon: Sparkles },
    { title: "Privacy", icon: Lock },
    { title: "Setup", icon: Settings },
    { title: "Permissions", icon: Shield },
    { title: "Hotkey", icon: Keyboard },
    { title: "Test", icon: TestTube },
    { title: "Agent Name", icon: User },
    { title: "Finish", icon: Check },
  ];

  useEffect(() => {
    whisperHook.setupProgressListener();
    return () => {
      // Clean up listeners on unmount
      window.electronAPI?.removeAllListeners?.("whisper-install-progress");
    };
  }, []);

  const updateProcessingMode = (useLocal: boolean) => {
    updateTranscriptionSettings({ useLocalWhisper: useLocal });
  };

  useEffect(() => {
    if (currentStep === 5) {
      if (practiceTextareaRef.current) {
        practiceTextareaRef.current.focus();
      }
    }
  }, [currentStep]);

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
    setDictationKey(hotkey);
    try {
      const result = await window.electronAPI?.updateHotkey?.(hotkey);
      if (result && !result.success) {
        showAlertDialog({
          title: "Hotkey Not Registered",
          description:
            result.message || "We couldn't register that key. Please choose another hotkey.",
        });
      }
    } catch (error) {
      console.error("Failed to register onboarding hotkey", error);
      showAlertDialog({
        title: "Hotkey Error",
        description: "We couldn't register that key. Please choose another hotkey.",
      });
    }
    saveAgentName(agentName);

    localStorage.setItem("micPermissionGranted", permissionsHook.micPermissionGranted.toString());
    localStorage.setItem(
      "accessibilityPermissionGranted",
      permissionsHook.accessibilityPermissionGranted.toString()
    );
    localStorage.setItem("onboardingCompleted", "true");

    if (!useLocalWhisper && apiKey.trim()) {
      await window.electronAPI.saveOpenAIKey(apiKey);
      updateApiKeys({ openaiApiKey: apiKey });
    }
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
    updateApiKeys,
    setCloudTranscriptionBaseUrl,
    setCloudReasoningBaseUrl,
    setDictationKey,
  ]);

  const nextStep = useCallback(() => {
    if (currentStep < steps.length - 1) {
      const newStep = currentStep + 1;
      setCurrentStep(newStep);

      // Show dictation panel when moving from permissions step (3) to hotkey step (4)
      if (currentStep === 3 && newStep === 4) {
        if (window.electronAPI?.showDictationPanel) {
          window.electronAPI.showDictationPanel();
        }
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
    await saveSettings();
    // Clear the onboarding step since we're done
    removeCurrentStep();
    onComplete();
  }, [saveSettings, removeCurrentStep, onComplete]);

  const renderStep = () => {
    switch (currentStep) {
      case 0: // Welcome
        return (
          <div className="space-y-6 text-center" style={{ fontFamily: "Noto Sans, sans-serif" }}>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
              <Sparkles className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <h2
                className="mb-2 text-2xl font-bold text-stone-900"
                style={{ fontFamily: "Noto Sans, sans-serif" }}
              >
                Welcome to OpenWhispr
              </h2>
              <p className="text-stone-600" style={{ fontFamily: "Noto Sans, sans-serif" }}>
                Let's set up your voice dictation in just a few simple steps.
              </p>
            </div>
            <div className="rounded-lg border border-blue-200/60 bg-blue-50/50 p-4">
              <p className="text-sm text-blue-800" style={{ fontFamily: "Noto Sans, sans-serif" }}>
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
          <div className="space-y-6" style={{ fontFamily: "Noto Sans, sans-serif" }}>
            <div className="text-center">
              <h2
                className="mb-2 text-2xl font-bold text-stone-900"
                style={{ fontFamily: "Noto Sans, sans-serif" }}
              >
                Choose Your Processing Mode
              </h2>
              <p className="text-stone-600" style={{ fontFamily: "Noto Sans, sans-serif" }}>
                How would you like to convert your speech to text?
              </p>
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
              <h2 className="mb-2 text-2xl font-bold text-gray-900">
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
                {/* Python Installation Section */}
                {!pythonHook.pythonInstalled ? (
                  <div className="space-y-4 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                      <Download className="h-8 w-8 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="mb-2 font-semibold text-gray-900">Install Python</h3>
                      <p className="mb-4 text-sm text-gray-600">
                        Python is required for local processing. We'll install it automatically for
                        you.
                      </p>
                    </div>

                    {pythonHook.installingPython ? (
                      <div className="rounded-lg bg-blue-50 p-4">
                        <div className="mb-3 flex items-center justify-center gap-3">
                          <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-blue-600"></div>
                          <span className="font-medium text-blue-900">Installing Python...</span>
                        </div>
                        {pythonHook.installProgress && (
                          <div className="rounded bg-white p-2 font-mono text-xs text-blue-600">
                            {pythonHook.installProgress}
                          </div>
                        )}
                        <p className="mt-2 text-xs text-blue-600">
                          This may take a few minutes. Please keep the app open.
                        </p>
                      </div>
                    ) : (
                      <Button
                        onClick={() => {
                          pythonHook.installPython();
                        }}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                      >
                        Install Python
                      </Button>
                    )}
                  </div>
                ) : !whisperHook.whisperInstalled ? (
                  <div className="space-y-4 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-purple-100">
                      <Download className="h-8 w-8 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="mb-2 font-semibold text-gray-900">Install Whisper</h3>
                      <p className="mb-4 text-sm text-gray-600">
                        Python is ready! Now we'll install Whisper for speech recognition.
                      </p>
                    </div>

                    {whisperHook.installingWhisper ? (
                      <div className="rounded-lg bg-purple-50 p-4">
                        <div className="mb-3 flex items-center justify-center gap-3">
                          <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-purple-600"></div>
                          <span className="font-medium text-purple-900">Installing...</span>
                        </div>
                        {whisperHook.installProgress && (
                          <div className="rounded bg-white p-2 font-mono text-xs text-purple-600">
                            {whisperHook.installProgress}
                          </div>
                        )}
                        <p className="mt-2 text-xs text-purple-600">
                          This may take a few minutes. Please keep the app open.
                        </p>
                      </div>
                    ) : (
                      <Button onClick={whisperHook.installWhisper} className="w-full">
                        Install Whisper
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                        <Check className="h-8 w-8 text-green-600" />
                      </div>
                      <h3 className="mb-2 font-semibold text-green-900">Whisper Installed!</h3>
                      <p className="text-sm text-gray-600">Now choose your model quality:</p>
                    </div>

                    <div>
                      <label className="mb-3 block text-sm font-medium text-gray-700">
                        Choose your model quality below
                      </label>
                      <p className="text-xs text-gray-500">
                        Download and select the model that best fits your needs.
                      </p>
                    </div>

                    <WhisperModelPicker
                      selectedModel={whisperModel}
                      onModelSelect={setWhisperModel}
                      variant="onboarding"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                    <Key className="h-8 w-8 text-blue-600" />
                  </div>
                </div>

                <ApiKeyInput
                  apiKey={apiKey}
                  setApiKey={setApiKey}
                  label="OpenAI API Key"
                  helpText="Get your API key from platform.openai.com"
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

                <div className="space-y-3 border-t border-blue-100 pt-4">
                  <h4 className="font-medium text-blue-900">Reasoning Model</h4>
                  {hasEnteredReasoningBase ? (
                    <>
                      {isValidReasoningBase ? (
                        <p className="text-xs break-all text-blue-800">
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
                  <UnifiedModelPickerCompact
                    models={displayedReasoningModels}
                    selectedModel={reasoningModel}
                    onModelSelect={(modelId) =>
                      updateReasoningSettings({ reasoningModel: modelId })
                    }
                  />
                </div>

                <div className="rounded-lg bg-blue-50 p-4">
                  <h4 className="mb-2 font-medium text-blue-900">How to get your API key:</h4>
                  <ol className="space-y-1 text-sm text-blue-800">
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
            <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <h4 className="mb-3 font-medium text-gray-900">🌍 Preferred Language</h4>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Which language do you primarily speak?
              </label>
              <LanguageSelector
                value={preferredLanguage}
                onChange={(value) => {
                  updateTranscriptionSettings({ preferredLanguage: value });
                }}
                className="w-full"
              />
              <p className="mt-1 text-xs text-gray-600">
                {useLocalWhisper
                  ? "Helps Whisper better understand your speech"
                  : "Improves OpenAI transcription speed and accuracy. AI text enhancement is enabled by default."}
              </p>
            </div>
          </div>
        );

      case 3: // Permissions
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="mb-2 text-2xl font-bold text-gray-900">Grant Permissions</h2>
              <p className="text-gray-600">
                OpenWhispr needs a couple of permissions to work properly
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

              <PermissionCard
                icon={Shield}
                title="Accessibility Permission"
                description="Required to paste text automatically"
                granted={permissionsHook.accessibilityPermissionGranted}
                onRequest={permissionsHook.testAccessibilityPermission}
                buttonText="Test & Grant"
              />
            </div>

            <div className="rounded-lg bg-amber-50 p-4">
              <h4 className="mb-2 font-medium text-amber-900">🔒 Privacy Note</h4>
              <p className="text-sm text-amber-800">
                OpenWhispr only uses these permissions for dictation.
                {useLocalWhisper
                  ? " With local processing, your voice never leaves your device."
                  : " Your voice is sent to OpenAI's servers for transcription."}
              </p>
            </div>
          </div>
        );

      case 4: // Choose Hotkey
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="mb-2 text-2xl font-bold text-gray-900">Choose Your Hotkey</h2>
              <p className="text-gray-600">
                Select which key you want to press to start/stop dictation
              </p>
            </div>

            <div className="space-y-4">
              {/* Mode Selector */}
              <div className="flex gap-2 rounded-lg bg-gray-100 p-1">
                <button
                  onClick={() => setHotkeyInputMode("capture")}
                  className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                    hotkeyInputMode === "capture"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Key Combinations
                </button>
                <button
                  onClick={() => setHotkeyInputMode("keyboard")}
                  className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                    hotkeyInputMode === "keyboard"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Visual Keyboard
                </button>
              </div>

              {hotkeyInputMode === "capture" ? (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Hotkey Combination
                  </label>
                  <HotkeyCapture
                    value={hotkey}
                    onChange={setHotkey}
                    placeholder="Click and press a key combination"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    Use modifier keys (Ctrl, Alt, Shift) for more control
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Activation Key
                    </label>
                    <Input
                      placeholder="Default: ` (backtick)"
                      value={hotkey}
                      onChange={(e) => setHotkey(e.target.value)}
                      className="text-center font-mono text-lg"
                    />
                    <p className="mt-2 text-xs text-gray-500">
                      Press this key from anywhere to start/stop dictation
                    </p>
                  </div>

                  <div className="rounded-lg bg-gray-50 p-4">
                    <h4 className="mb-3 font-medium text-gray-900">Click any key to select it:</h4>
                    <React.Suspense fallback={<div>Loading keyboard...</div>}>
                      <InteractiveKeyboard selectedKey={hotkey} setSelectedKey={setHotkey} />
                    </React.Suspense>
                  </div>
                </>
              )}
            </div>
          </div>
        );

      case 5: // Test & Practice
        return (
          <div className="space-y-6" style={{ fontFamily: "Noto Sans, sans-serif" }}>
            <div className="text-center">
              <h2
                className="mb-2 text-2xl font-bold text-stone-900"
                style={{ fontFamily: "Noto Sans, sans-serif" }}
              >
                Test & Practice
              </h2>
              <p className="text-stone-600" style={{ fontFamily: "Noto Sans, sans-serif" }}>
                Let's test your setup and practice using OpenWhispr
              </p>
            </div>

            <div className="space-y-6">
              <div className="rounded-lg border border-blue-200/60 bg-blue-50/50 p-6">
                <h3
                  className="mb-3 font-semibold text-blue-900"
                  style={{ fontFamily: "Noto Sans, sans-serif" }}
                >
                  Practice with Your Hotkey
                </h3>
                <p
                  className="mb-4 text-sm text-blue-800"
                  style={{ fontFamily: "Noto Sans, sans-serif" }}
                >
                  <strong>Step 1:</strong> Click in the text area below to place your cursor there.
                  <br />
                  <strong>Step 2:</strong> Press{" "}
                  <kbd className="rounded border border-blue-200 bg-white px-2 py-1 font-mono text-xs">
                    {readableHotkey}
                  </kbd>{" "}
                  to start recording, then speak something.
                  <br />
                  <strong>Step 3:</strong> Press{" "}
                  <kbd className="rounded border border-blue-200 bg-white px-2 py-1 font-mono text-xs">
                    {readableHotkey}
                  </kbd>{" "}
                  again to stop and see your transcribed text appear where your cursor is!
                </p>

                <div className="space-y-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 text-stone-600">
                      <Mic className="h-4 w-4" />
                      <span style={{ fontFamily: "Noto Sans, sans-serif" }}>
                        Click in the text area below, then press{" "}
                        <kbd className="rounded border bg-white px-1 py-0.5 font-mono text-xs">
                          {readableHotkey}
                        </kbd>{" "}
                        to start dictation
                      </span>
                    </div>
                  </div>

                  <div>
                    <label
                      className="mb-2 block text-sm font-medium text-stone-700"
                      style={{ fontFamily: "Noto Sans, sans-serif" }}
                    >
                      Transcribed Text:
                    </label>
                    <Textarea
                      // ref={practiceTextareaRef}
                      rows={4}
                      placeholder="Click here to place your cursor, then use your hotkey to start dictation..."
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-green-200/60 bg-green-50/50 p-4">
                <h4
                  className="mb-2 font-medium text-green-900"
                  style={{ fontFamily: "Noto Sans, sans-serif" }}
                >
                  💡 How to use OpenWhispr:
                </h4>
                <ol
                  className="space-y-1 text-sm text-green-800"
                  style={{ fontFamily: "Noto Sans, sans-serif" }}
                >
                  <li>1. Click in any text field (email, document, etc.)</li>
                  <li>
                    2. Press{" "}
                    <kbd className="rounded border border-green-200 bg-white px-2 py-1 font-mono text-xs">
                      {readableHotkey}
                    </kbd>{" "}
                    to start recording
                  </li>
                  <li>3. Speak your text clearly</li>
                  <li>
                    4. Press{" "}
                    <kbd className="rounded border border-green-200 bg-white px-2 py-1 font-mono text-xs">
                      {readableHotkey}
                    </kbd>{" "}
                    again to stop
                  </li>
                  <li>5. Your text will automatically appear where you were typing!</li>
                </ol>
              </div>
            </div>
          </div>
        );

      case 6: // Agent Name
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="mb-2 text-2xl font-bold text-stone-900">Name Your Agent</h2>
              <p className="text-stone-600">
                Give your agent a name so you can address it specifically when giving instructions.
              </p>
            </div>

            <div className="space-y-4 rounded-xl border border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50 p-4">
              <h4 className="mb-3 font-medium text-purple-900">💡 How this helps:</h4>
              <ul className="space-y-1 text-sm text-purple-800">
                <li>
                  • Say "Hey {agentName || "Agent"}, write a formal email" for specific instructions
                </li>
                <li>• Use the name to distinguish between dictation and commands</li>
                <li>• Makes interactions feel more natural and personal</li>
              </ul>
            </div>

            <div className="space-y-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">Agent Name</label>
              <Input
                placeholder="e.g., Assistant, Jarvis, Alex..."
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                className="text-center font-mono text-lg"
              />
              <p className="mt-2 text-xs text-gray-500">You can change this anytime in settings</p>
            </div>
          </div>
        );

      case 7: // Complete
        return (
          <div className="space-y-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h2 className="mb-2 text-2xl font-bold text-gray-900">You're All Set!</h2>
              <p className="text-gray-600">OpenWhispr is now configured and ready to use.</p>
            </div>

            <div className="rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50 p-6">
              <h3 className="mb-3 font-semibold text-gray-900">Your Setup Summary:</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Processing:</span>
                  <span className="font-medium">
                    {useLocalWhisper ? `Local (${whisperModel})` : "OpenAI Cloud"}
                  </span>
                </div>
                {!useLocalWhisper && (
                  <div className="flex justify-between">
                    <span>Reasoning Model:</span>
                    <span className="font-medium">{activeReasoningModelLabel}</span>
                  </div>
                )}
                {!useLocalWhisper && hasEnteredReasoningBase && (
                  <div className="flex justify-between">
                    <span>Custom Endpoint:</span>
                    <span className="font-medium break-all">
                      {normalizedReasoningBaseUrl || trimmedReasoningBase}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Hotkey:</span>
                  <kbd className="rounded bg-white px-2 py-1 font-mono text-xs">{hotkey}</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Language:</span>
                  <span className="font-medium">{getLanguageLabel(preferredLanguage)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Agent Name:</span>
                  <span className="font-medium">{agentName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Permissions:</span>
                  <span className="font-medium text-green-600">
                    {permissionsHook.micPermissionGranted &&
                    permissionsHook.accessibilityPermissionGranted
                      ? "✓ Granted"
                      : "⚠ Review needed"}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-blue-50 p-4">
              <p className="text-sm text-blue-800">
                <strong>Pro tip:</strong> You can always change these settings later in the Control
                Panel.
              </p>
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
          return pythonHook.pythonInstalled && whisperHook.whisperInstalled;
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
      case 3:
        return (
          permissionsHook.micPermissionGranted && permissionsHook.accessibilityPermissionGranted
        );
      case 4:
        return hotkey.trim() !== "";
      case 5:
        return true; // Practice step is always ready to proceed
      case 6:
        return agentName.trim() !== ""; // Agent name step
      case 7:
        return true;
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
      className="flex h-screen flex-col bg-gradient-to-br from-stone-50 via-white to-blue-50/30"
      style={{
        backgroundImage: `repeating-linear-gradient(
          transparent,
          transparent 24px,
          #e7e5e4 24px,
          #e7e5e4 25px
        )`,
        fontFamily: "Noto Sans, sans-serif",
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}
    >
      <AlertDialog
        open={alertDialog.open}
        onOpenChange={(open) => !open && hideAlertDialog()}
        title={alertDialog.title}
        description={alertDialog.description}
        onOk={() => {}}
      />
      {/* Left margin line for entire page */}
      <div className="fixed top-0 bottom-0 left-6 z-0 w-px bg-red-300/40 md:left-12"></div>

      {/* Title Bar */}
      <div className="z-10 flex-shrink-0">
        <TitleBar
          showTitle={true}
          className="border-b border-stone-200/60 bg-white/95 shadow-sm backdrop-blur-xl"
        ></TitleBar>
      </div>

      {/* Progress Bar */}
      <div className="z-10 flex-shrink-0 border-b border-stone-200/60 bg-white/90 p-6 backdrop-blur-xl md:px-16">
        <div className="mx-auto max-w-4xl">
          <StepProgress steps={steps} currentStep={currentStep} />
        </div>
      </div>

      {/* Content - This will grow to fill available space */}
      <div className="flex-1 overflow-y-auto px-6 py-12 md:pr-6 md:pl-16">
        <div className="mx-auto max-w-4xl">
          <Card className="overflow-hidden rounded-2xl border border-stone-200/60 bg-white/95 shadow-lg backdrop-blur-xl">
            <CardContent className="p-12 md:p-16" style={{ fontFamily: "Noto Sans, sans-serif" }}>
              <div className="space-y-8">{renderStep()}</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer - This will stick to the bottom */}
      <div className="z-10 flex-shrink-0 border-t border-stone-200/60 bg-white/95 px-6 py-8 shadow-sm backdrop-blur-xl md:pr-6 md:pl-16">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Button
            onClick={prevStep}
            variant="outline"
            disabled={currentStep === 0}
            className="h-12 px-8 py-3 text-sm font-medium"
            style={{ fontFamily: "Noto Sans, sans-serif" }}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>

          <div className="flex items-center gap-3">
            {currentStep === steps.length - 1 ? (
              <Button
                onClick={finishOnboarding}
                variant="success"
                size="lg"
                style={{ fontFamily: "Noto Sans, sans-serif" }}
              >
                <Check className="mr-2 h-4 w-4" />
                Finish Setup
              </Button>
            ) : (
              <Button
                onClick={nextStep}
                disabled={!canProceed()}
                className="h-12 px-8 py-3 text-sm font-medium"
                style={{ fontFamily: "Noto Sans, sans-serif" }}
              >
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
