import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Download, Trash2, Check, Cloud, Lock, X } from "lucide-react";
import { ProviderIcon } from "./ui/ProviderIcon";
import { ProviderTabs } from "./ui/ProviderTabs";
import ModelCardList from "./ui/ModelCardList";
import { DownloadProgressBar } from "./ui/DownloadProgressBar";
import ApiKeyInput from "./ui/ApiKeyInput";
import { ConfirmDialog } from "./ui/dialog";
import { useDialogs } from "../hooks/useDialogs";
import { useModelDownload } from "../hooks/useModelDownload";
import {
  getTranscriptionProviders,
  TranscriptionProviderData,
  WHISPER_MODEL_INFO,
} from "../models/ModelRegistry";
import { MODEL_PICKER_COLORS, type ColorScheme } from "../utils/modelPickerStyles";
import { getProviderIcon } from "../utils/providerIcons";
import { API_ENDPOINTS } from "../config/constants";

interface WhisperModel {
  model: string;
  size_mb?: number;
  downloaded?: boolean;
}

interface TranscriptionModelPickerProps {
  selectedCloudProvider: string;
  onCloudProviderSelect: (providerId: string) => void;
  selectedCloudModel: string;
  onCloudModelSelect: (modelId: string) => void;
  selectedLocalModel: string;
  onLocalModelSelect: (modelId: string) => void;
  selectedLocalProvider?: string;
  onLocalProviderSelect?: (providerId: string) => void;
  useLocalWhisper: boolean;
  onModeChange: (useLocal: boolean) => void;
  openaiApiKey: string;
  setOpenaiApiKey: (key: string) => void;
  groqApiKey: string;
  setGroqApiKey: (key: string) => void;
  cloudTranscriptionBaseUrl?: string;
  setCloudTranscriptionBaseUrl?: (url: string) => void;
  className?: string;
  variant?: "onboarding" | "settings";
}

const CLOUD_PROVIDER_TABS = [
  { id: "openai", name: "OpenAI" },
  { id: "groq", name: "Groq" },
  { id: "custom", name: "Custom" },
];

const VALID_CLOUD_PROVIDER_IDS = CLOUD_PROVIDER_TABS.map((p) => p.id);

const LOCAL_PROVIDER_TABS = [
  { id: "whisper", name: "OpenAI Whisper" },
  { id: "nvidia", name: "Nvidia", disabled: true, badge: "Coming Soon" },
];

export default function TranscriptionModelPicker({
  selectedCloudProvider,
  onCloudProviderSelect,
  selectedCloudModel,
  onCloudModelSelect,
  selectedLocalModel,
  onLocalModelSelect,
  selectedLocalProvider = "whisper",
  onLocalProviderSelect,
  useLocalWhisper,
  onModeChange,
  openaiApiKey,
  setOpenaiApiKey,
  groqApiKey,
  setGroqApiKey,
  cloudTranscriptionBaseUrl = "",
  setCloudTranscriptionBaseUrl,
  className = "",
  variant = "settings",
}: TranscriptionModelPickerProps) {
  const [localModels, setLocalModels] = useState<WhisperModel[]>([]);
  const [internalLocalProvider, setInternalLocalProvider] = useState(selectedLocalProvider);
  const hasLoadedRef = useRef(false);
  const isLoadingRef = useRef(false);
  const loadLocalModelsRef = useRef<(() => Promise<void>) | null>(null);
  const ensureValidCloudSelectionRef = useRef<(() => void) | null>(null);
  const selectedLocalModelRef = useRef(selectedLocalModel);
  const onLocalModelSelectRef = useRef(onLocalModelSelect);

  const { confirmDialog, showConfirmDialog, hideConfirmDialog } = useDialogs();
  const colorScheme: ColorScheme = variant === "settings" ? "purple" : "blue";
  const styles = useMemo(() => MODEL_PICKER_COLORS[colorScheme], [colorScheme]);
  const cloudProviders = useMemo(() => getTranscriptionProviders(), []);

  useEffect(() => {
    selectedLocalModelRef.current = selectedLocalModel;
  }, [selectedLocalModel]);
  useEffect(() => {
    onLocalModelSelectRef.current = onLocalModelSelect;
  }, [onLocalModelSelect]);

  const validateAndSelectModel = useCallback((loadedModels: WhisperModel[]) => {
    const current = selectedLocalModelRef.current;
    if (!current) return;

    const downloaded = loadedModels.filter((m) => m.downloaded);
    const isCurrentDownloaded = loadedModels.find((m) => m.model === current)?.downloaded;

    if (!isCurrentDownloaded && downloaded.length > 0) {
      onLocalModelSelectRef.current(downloaded[0].model);
    } else if (!isCurrentDownloaded && downloaded.length === 0) {
      onLocalModelSelectRef.current("");
    }
  }, []);

  const loadLocalModels = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    try {
      const result = await window.electronAPI?.listWhisperModels();
      if (result?.success) {
        setLocalModels(result.models);
        validateAndSelectModel(result.models);
      }
    } catch (error) {
      console.error("[TranscriptionModelPicker] Failed to load models:", error);
      setLocalModels([]);
    } finally {
      isLoadingRef.current = false;
    }
  }, [validateAndSelectModel]);

  const ensureValidCloudSelection = useCallback(() => {
    const isValidProvider = VALID_CLOUD_PROVIDER_IDS.includes(selectedCloudProvider);

    if (!isValidProvider) {
      // Check if we have a custom URL that differs from known providers
      const knownProviderUrls = cloudProviders.map((p) => p.baseUrl);
      const hasCustomUrl =
        cloudTranscriptionBaseUrl &&
        cloudTranscriptionBaseUrl.trim() !== "" &&
        cloudTranscriptionBaseUrl !== API_ENDPOINTS.TRANSCRIPTION_BASE &&
        !knownProviderUrls.includes(cloudTranscriptionBaseUrl);

      if (hasCustomUrl) {
        onCloudProviderSelect("custom");
      } else {
        const firstProvider = cloudProviders[0];
        if (firstProvider) {
          onCloudProviderSelect(firstProvider.id);
          if (firstProvider.models?.length) {
            onCloudModelSelect(firstProvider.models[0].id);
          }
        }
      }
    } else if (selectedCloudProvider !== "custom" && !selectedCloudModel) {
      const provider = cloudProviders.find((p) => p.id === selectedCloudProvider);
      if (provider?.models?.length) {
        onCloudModelSelect(provider.models[0].id);
      }
    }
  }, [
    cloudProviders,
    cloudTranscriptionBaseUrl,
    selectedCloudProvider,
    selectedCloudModel,
    onCloudProviderSelect,
    onCloudModelSelect,
  ]);

  useEffect(() => {
    loadLocalModelsRef.current = loadLocalModels;
  }, [loadLocalModels]);
  useEffect(() => {
    ensureValidCloudSelectionRef.current = ensureValidCloudSelection;
  }, [ensureValidCloudSelection]);

  useEffect(() => {
    if (useLocalWhisper) {
      if (!hasLoadedRef.current) {
        hasLoadedRef.current = true;
        loadLocalModelsRef.current?.();
      }
    } else {
      hasLoadedRef.current = false;
      ensureValidCloudSelectionRef.current?.();
    }
  }, [useLocalWhisper]);

  useEffect(() => {
    const handleModelsCleared = () => loadLocalModels();
    window.addEventListener("openwhispr-models-cleared", handleModelsCleared);
    return () => window.removeEventListener("openwhispr-models-cleared", handleModelsCleared);
  }, [loadLocalModels]);

  const {
    downloadingModel,
    downloadProgress,
    downloadModel,
    deleteModel,
    isDownloadingModel,
    cancelDownload,
    isCancelling,
  } = useModelDownload({
    modelType: "whisper",
    onDownloadComplete: loadLocalModels,
  });

  const handleModeChange = useCallback(
    (isLocal: boolean) => {
      onModeChange(isLocal);
      if (!isLocal) ensureValidCloudSelection();
    },
    [onModeChange, ensureValidCloudSelection]
  );

  const handleCloudProviderChange = useCallback(
    (providerId: string) => {
      onCloudProviderSelect(providerId);
      const provider = cloudProviders.find((p) => p.id === providerId);

      if (providerId === "custom") {
        // Don't change base URL or model when switching to custom
        // The user will enter their own URL
        return;
      }

      if (provider) {
        // Update base URL to the selected provider's default
        setCloudTranscriptionBaseUrl?.(provider.baseUrl);
        if (provider.models?.length) {
          onCloudModelSelect(provider.models[0].id);
        }
      }
    },
    [cloudProviders, onCloudProviderSelect, onCloudModelSelect, setCloudTranscriptionBaseUrl]
  );

  const handleLocalProviderChange = useCallback(
    (providerId: string) => {
      const tab = LOCAL_PROVIDER_TABS.find((t) => t.id === providerId);
      if (tab?.disabled) return;
      setInternalLocalProvider(providerId);
      onLocalProviderSelect?.(providerId);
    },
    [onLocalProviderSelect]
  );

  const handleDelete = useCallback(
    (modelId: string) => {
      showConfirmDialog({
        title: "Delete Model",
        description:
          "Are you sure you want to delete this model? You'll need to re-download it if you want to use it again.",
        onConfirm: async () => {
          await deleteModel(modelId, async () => {
            const result = await window.electronAPI?.listWhisperModels();
            if (result?.success) {
              setLocalModels(result.models);
              validateAndSelectModel(result.models);
            }
          });
        },
        variant: "destructive",
      });
    },
    [showConfirmDialog, deleteModel, validateAndSelectModel]
  );

  const currentCloudProvider = useMemo<TranscriptionProviderData | undefined>(
    () => cloudProviders.find((p) => p.id === selectedCloudProvider),
    [cloudProviders, selectedCloudProvider]
  );

  const cloudModelOptions = useMemo(() => {
    if (!currentCloudProvider) return [];
    return currentCloudProvider.models.map((m) => ({
      value: m.id,
      label: m.name,
      description: m.description,
      icon: getProviderIcon(selectedCloudProvider),
    }));
  }, [currentCloudProvider, selectedCloudProvider]);

  const progressDisplay = useMemo(() => {
    if (!downloadingModel || !useLocalWhisper) return null;
    const modelInfo = WHISPER_MODEL_INFO[downloadingModel];
    return (
      <DownloadProgressBar
        modelName={modelInfo?.name || downloadingModel}
        progress={downloadProgress}
        styles={styles}
      />
    );
  }, [downloadingModel, downloadProgress, useLocalWhisper, styles]);

  const renderLocalModels = () => (
    <div className="space-y-2">
      {localModels.map((model) => {
        const modelId = model.model;
        const info = WHISPER_MODEL_INFO[modelId] || {
          name: modelId,
          description: "Model",
          size: "Unknown",
        };
        const isSelected = modelId === selectedLocalModel;
        const isDownloading = isDownloadingModel(modelId);
        const isDownloaded = model.downloaded;

        return (
          <div
            key={modelId}
            className={`p-3 rounded-lg border-2 transition-all ${
              isSelected ? styles.modelCard.selected : styles.modelCard.default
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <ProviderIcon provider="whisper" className="w-4 h-4" />
                  <span className="font-medium text-gray-900">{info.name}</span>
                  {isSelected && <span className={styles.badges.selected}>✓ Selected</span>}
                  {info.recommended && (
                    <span className={styles.badges.recommended}>Recommended</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-600">{info.description}</span>
                  <span className="text-xs text-gray-500">
                    • {model.size_mb ? `${model.size_mb}MB` : info.size}
                  </span>
                  {isDownloaded && (
                    <span className={styles.badges.downloaded}>
                      <Check className="inline w-3 h-3 mr-1" />
                      Downloaded
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                {isDownloaded ? (
                  <>
                    {!isSelected && (
                      <Button
                        onClick={() => onLocalModelSelect(modelId)}
                        size="sm"
                        variant="outline"
                        className={styles.buttons.select}
                      >
                        Select
                      </Button>
                    )}
                    <Button
                      onClick={() => handleDelete(modelId)}
                      size="sm"
                      variant="outline"
                      className={styles.buttons.delete}
                    >
                      <Trash2 size={14} />
                      <span className="ml-1">Delete</span>
                    </Button>
                  </>
                ) : isDownloading ? (
                  <Button
                    onClick={cancelDownload}
                    disabled={isCancelling}
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-300 hover:bg-red-50"
                  >
                    <X size={14} />
                    <span className="ml-1">{isCancelling ? "..." : "Cancel"}</span>
                  </Button>
                ) : (
                  <Button
                    onClick={() => downloadModel(modelId, onLocalModelSelect)}
                    size="sm"
                    className={styles.buttons.download}
                  >
                    <Download size={14} />
                    <span className="ml-1">Download</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderLocalProviderTab = (
    provider: (typeof LOCAL_PROVIDER_TABS)[0],
    isSelected: boolean
  ) => {
    const isDisabled = provider.disabled;
    const tabColorScheme = colorScheme === "purple" ? "purple" : "indigo";
    const colors = {
      purple: { text: "text-purple-700", border: "rgb(147 51 234)", bg: "rgb(250 245 255)" },
      indigo: { text: "text-indigo-700", border: "rgb(99 102 241)", bg: "rgb(238 242 255)" },
    };
    const tabColors = colors[tabColorScheme];

    return (
      <button
        key={provider.id}
        onClick={() => !isDisabled && handleLocalProviderChange(provider.id)}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 font-medium transition-all whitespace-nowrap ${
          isDisabled
            ? "text-gray-600 cursor-default"
            : isSelected
              ? `${tabColors.text} border-b-2`
              : "text-gray-600 hover:bg-gray-100"
        }`}
        style={
          isSelected && !isDisabled
            ? { borderBottomColor: tabColors.border, backgroundColor: tabColors.bg }
            : undefined
        }
      >
        <ProviderIcon provider={provider.id} className="w-5 h-5" />
        <span>{provider.name}</span>
        {provider.badge && (
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            {provider.badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button
          onClick={() => handleModeChange(false)}
          className={`p-4 border-2 rounded-xl text-left transition-all cursor-pointer ${
            !useLocalWhisper
              ? "border-purple-500 bg-purple-50"
              : "border-neutral-200 bg-white hover:border-neutral-300"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Cloud className="w-6 h-6 text-blue-600" />
              <h4 className="font-medium text-neutral-900">Cloud</h4>
            </div>
            <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">Fast</span>
          </div>
          <p className="text-sm text-neutral-600">
            Transcription via API. Fast and accurate, requires internet.
          </p>
        </button>

        <button
          onClick={() => handleModeChange(true)}
          className={`p-4 border-2 rounded-xl text-left transition-all cursor-pointer ${
            useLocalWhisper
              ? "border-purple-500 bg-purple-50"
              : "border-neutral-200 bg-white hover:border-neutral-300"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Lock className="w-6 h-6 text-purple-600" />
              <h4 className="font-medium text-neutral-900">Local</h4>
            </div>
            <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
              Private
            </span>
          </div>
          <p className="text-sm text-neutral-600">
            Runs on your device. Complete privacy, works offline.
          </p>
        </button>
      </div>

      {!useLocalWhisper ? (
        <div className="space-y-4">
          <div className={styles.container}>
            <ProviderTabs
              providers={CLOUD_PROVIDER_TABS}
              selectedId={selectedCloudProvider}
              onSelect={handleCloudProviderChange}
              colorScheme={colorScheme === "purple" ? "purple" : "indigo"}
              scrollable
            />

            <div className="p-4">
              {selectedCloudProvider === "custom" ? (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-gray-700">Custom Endpoint Configuration</h4>
                    <p className="text-xs text-gray-500">
                      Enter an OpenAI-compatible transcription endpoint URL.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Transcription Base URL
                    </label>
                    <Input
                      value={cloudTranscriptionBaseUrl}
                      onChange={(e) => setCloudTranscriptionBaseUrl?.(e.target.value)}
                      placeholder="https://your-api.example.com/v1"
                      className="text-sm"
                    />
                    <p className="text-xs text-gray-500">
                      The endpoint should be compatible with OpenAI's{" "}
                      <code>/audio/transcriptions</code> API format.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Model Name (optional)
                    </label>
                    <Input
                      value={selectedCloudModel}
                      onChange={(e) => onCloudModelSelect(e.target.value)}
                      placeholder="whisper-1"
                      className="text-sm"
                    />
                    <p className="text-xs text-gray-500">
                      Enter the model name supported by your custom endpoint.
                    </p>
                  </div>

                  <div className="pt-4 border-t border-gray-200">
                    <div className="space-y-3">
                      <h4 className="font-medium text-gray-900">API Key</h4>
                      <ApiKeyInput
                        apiKey={openaiApiKey}
                        setApiKey={setOpenaiApiKey}
                        helpText="Enter the API key for your custom endpoint."
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-gray-700">Select Model</h4>
                    <ModelCardList
                      models={cloudModelOptions}
                      selectedModel={selectedCloudModel}
                      onModelSelect={onCloudModelSelect}
                      colorScheme={colorScheme === "purple" ? "purple" : "indigo"}
                    />
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="space-y-3">
                      <h4 className="font-medium text-gray-900">API Configuration</h4>
                      <ApiKeyInput
                        apiKey={selectedCloudProvider === "groq" ? groqApiKey : openaiApiKey}
                        setApiKey={selectedCloudProvider === "groq" ? setGroqApiKey : setOpenaiApiKey}
                        helpText={
                          selectedCloudProvider === "groq" ? (
                            <>
                              Need an API key?{" "}
                              <a
                                href="https://console.groq.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 underline"
                              >
                                console.groq.com
                              </a>
                            </>
                          ) : (
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
                          )
                        }
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.container}>
          <div className="flex bg-gray-50 border-b border-gray-200">
            {LOCAL_PROVIDER_TABS.map((provider) =>
              renderLocalProviderTab(provider, internalLocalProvider === provider.id)
            )}
          </div>

          {progressDisplay}

          <div className="p-4">
            <h5 className={`${styles.header} mb-3`}>Available Models</h5>

            {internalLocalProvider === "whisper" && renderLocalModels()}
            {internalLocalProvider === "nvidia" && (
              <p className="text-sm text-gray-500">Nvidia GPU acceleration coming soon.</p>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => !open && hideConfirmDialog()}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        onConfirm={confirmDialog.onConfirm}
        variant={confirmDialog.variant}
      />
    </div>
  );
}
