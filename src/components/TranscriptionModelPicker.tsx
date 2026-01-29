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
  PARAKEET_MODEL_INFO,
} from "../models/ModelRegistry";
import { MODEL_PICKER_COLORS, type ColorScheme } from "../utils/modelPickerStyles";
import { getProviderIcon } from "../utils/providerIcons";
import { API_ENDPOINTS } from "../config/constants";
import { createExternalLinkHandler } from "../utils/externalLinks";

interface LocalModel {
  model: string;
  size_mb?: number;
  downloaded?: boolean;
}

interface LocalModelCardProps {
  modelId: string;
  name: string;
  description: string;
  size: string;
  actualSizeMb?: number;
  isSelected: boolean;
  isDownloaded: boolean;
  isDownloading: boolean;
  isCancelling: boolean;
  recommended?: boolean;
  provider: string;
  languageLabel?: string;
  onSelect: () => void;
  onDelete: () => void;
  onDownload: () => void;
  onCancel: () => void;
  styles: ReturnType<(typeof MODEL_PICKER_COLORS)[keyof typeof MODEL_PICKER_COLORS]>;
}

// Backwards compatibility alias
type WhisperModel = LocalModel;

function LocalModelCard({
  modelId,
  name,
  description,
  size,
  actualSizeMb,
  isSelected,
  isDownloaded,
  isDownloading,
  isCancelling,
  recommended,
  provider,
  languageLabel,
  onSelect,
  onDelete,
  onDownload,
  onCancel,
  styles: cardStyles,
}: LocalModelCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg border transition-all duration-200 group ${
        isSelected ? cardStyles.modelCard.selected : cardStyles.modelCard.default
      }`}
    >
      {/* Left accent bar for selected model */}
      {isSelected && (
        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary rounded-l-lg" />
      )}
      <div className="flex items-center gap-2.5 p-3 pl-3.5">
        {/* Status dot */}
        <div className="shrink-0">
          {isDownloaded ? (
            <div
              className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-primary" : "bg-success"}`}
            />
          ) : (
            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/20" />
          )}
        </div>

        {/* Model info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <ProviderIcon provider={provider} className="w-3.5 h-3.5" />
            <span className="font-medium text-sm text-foreground">{name}</span>
            <span className="text-[11px] text-muted-foreground/70 tabular-nums">
              {actualSizeMb ? `${actualSizeMb}MB` : size}
            </span>
            {recommended && (
              <span className="text-[10px] font-medium text-primary/70 bg-primary/6 px-1.5 py-px rounded">
                Recommended
              </span>
            )}
            {languageLabel && (
              <span className="text-[10px] text-muted-foreground/60 font-medium">
                {languageLabel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-px">
            <p className="text-xs text-muted-foreground/70 truncate">{description}</p>
            {isDownloaded && (
              <span className={cardStyles.badges.downloaded}>
                <Check className="inline w-3 h-3 mr-0.5" />
                Ready
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isDownloaded ? (
            <>
              {!isSelected && (
                <Button onClick={onSelect} size="sm" variant="default" className="h-7 px-3 text-xs">
                  Select
                </Button>
              )}
              {isSelected && (
                <span className="text-[11px] font-medium text-primary mr-0.5">Active</span>
              )}
              <Button
                onClick={onDelete}
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-muted-foreground/50 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={13} />
              </Button>
            </>
          ) : isDownloading ? (
            <Button
              onClick={onCancel}
              disabled={isCancelling}
              size="sm"
              variant="outline"
              className="h-7 px-3 text-xs text-destructive border-destructive/25 hover:bg-destructive/8"
            >
              <X size={12} className="mr-1" />
              {isCancelling ? "..." : "Cancel"}
            </Button>
          ) : (
            <Button onClick={onDownload} size="sm" variant="default" className="h-7 px-3 text-xs">
              <Download size={12} className="mr-1" />
              Download
            </Button>
          )}
        </div>
      </div>
    </div>
  );
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
  customTranscriptionApiKey?: string;
  setCustomTranscriptionApiKey?: (key: string) => void;
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
  { id: "nvidia", name: "NVIDIA Parakeet" },
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
  customTranscriptionApiKey = "",
  setCustomTranscriptionApiKey,
  cloudTranscriptionBaseUrl = "",
  setCloudTranscriptionBaseUrl,
  className = "",
  variant = "settings",
}: TranscriptionModelPickerProps) {
  const [localModels, setLocalModels] = useState<WhisperModel[]>([]);
  const [parakeetModels, setParakeetModels] = useState<WhisperModel[]>([]);
  const [internalLocalProvider, setInternalLocalProvider] = useState(selectedLocalProvider);
  const hasLoadedRef = useRef(false);
  const hasLoadedParakeetRef = useRef(false);
  const isLoadingRef = useRef(false);
  const isLoadingParakeetRef = useRef(false);
  const loadLocalModelsRef = useRef<(() => Promise<void>) | null>(null);
  const loadParakeetModelsRef = useRef<(() => Promise<void>) | null>(null);
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

  const loadParakeetModels = useCallback(async () => {
    if (isLoadingParakeetRef.current) return;
    isLoadingParakeetRef.current = true;

    try {
      const result = await window.electronAPI?.listParakeetModels();
      if (result?.success) {
        setParakeetModels(result.models);
      }
    } catch (error) {
      console.error("[TranscriptionModelPicker] Failed to load Parakeet models:", error);
      setParakeetModels([]);
    } finally {
      isLoadingParakeetRef.current = false;
    }
  }, []);

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
    loadParakeetModelsRef.current = loadParakeetModels;
  }, [loadParakeetModels]);
  useEffect(() => {
    ensureValidCloudSelectionRef.current = ensureValidCloudSelection;
  }, [ensureValidCloudSelection]);

  useEffect(() => {
    if (useLocalWhisper) {
      if (internalLocalProvider === "whisper" && !hasLoadedRef.current) {
        hasLoadedRef.current = true;
        loadLocalModelsRef.current?.();
      } else if (internalLocalProvider === "nvidia" && !hasLoadedParakeetRef.current) {
        hasLoadedParakeetRef.current = true;
        loadParakeetModelsRef.current?.();
      }
    } else {
      hasLoadedRef.current = false;
      hasLoadedParakeetRef.current = false;
      ensureValidCloudSelectionRef.current?.();
    }
  }, [useLocalWhisper, internalLocalProvider]);

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
    isInstalling,
    cancelDownload,
    isCancelling,
  } = useModelDownload({
    modelType: "whisper",
    onDownloadComplete: loadLocalModels,
  });

  const {
    downloadingModel: downloadingParakeetModel,
    downloadProgress: parakeetDownloadProgress,
    downloadModel: downloadParakeetModel,
    deleteModel: deleteParakeetModel,
    isDownloadingModel: isDownloadingParakeetModel,
    isInstalling: isInstallingParakeet,
    cancelDownload: cancelParakeetDownload,
    isCancelling: isCancellingParakeet,
  } = useModelDownload({
    modelType: "parakeet",
    onDownloadComplete: loadParakeetModels,
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
        // Clear model to whisper-1 (standard fallback) to avoid sending
        // provider-specific models to custom endpoints
        onCloudModelSelect("whisper-1");
        // Don't change base URL - user will enter their own
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

  // Wrapper to set both model and provider when selecting a local model
  const handleWhisperModelSelect = useCallback(
    (modelId: string) => {
      onLocalProviderSelect?.("whisper");
      setInternalLocalProvider("whisper");
      onLocalModelSelect(modelId);
    },
    [onLocalModelSelect, onLocalProviderSelect]
  );

  const handleParakeetModelSelect = useCallback(
    (modelId: string) => {
      onLocalProviderSelect?.("nvidia");
      setInternalLocalProvider("nvidia");
      onLocalModelSelect(modelId);
    },
    [onLocalModelSelect, onLocalProviderSelect]
  );

  const handleBaseUrlBlur = useCallback(() => {
    if (!setCloudTranscriptionBaseUrl || selectedCloudProvider !== "custom") return;

    const trimmed = (cloudTranscriptionBaseUrl || "").trim();
    if (!trimmed) return;

    // Normalize the URL using the existing util from constants
    const { normalizeBaseUrl } = require("../config/constants");
    const normalized = normalizeBaseUrl(trimmed);

    if (normalized && normalized !== cloudTranscriptionBaseUrl) {
      setCloudTranscriptionBaseUrl(normalized);
    }

    // Auto-detect if this matches a known provider
    if (normalized) {
      for (const provider of cloudProviders) {
        const providerNormalized = normalizeBaseUrl(provider.baseUrl);
        if (normalized === providerNormalized) {
          onCloudProviderSelect(provider.id);
          onCloudModelSelect("whisper-1");
          break;
        }
      }
    }
  }, [
    cloudTranscriptionBaseUrl,
    selectedCloudProvider,
    setCloudTranscriptionBaseUrl,
    onCloudProviderSelect,
    onCloudModelSelect,
    cloudProviders,
  ]);

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
    if (!useLocalWhisper) return null;

    if (downloadingModel && internalLocalProvider === "whisper") {
      const modelInfo = WHISPER_MODEL_INFO[downloadingModel];
      return (
        <DownloadProgressBar
          modelName={modelInfo?.name || downloadingModel}
          progress={downloadProgress}
          isInstalling={isInstalling}
        />
      );
    }

    if (downloadingParakeetModel && internalLocalProvider === "nvidia") {
      const modelInfo = PARAKEET_MODEL_INFO[downloadingParakeetModel];
      return (
        <DownloadProgressBar
          modelName={modelInfo?.name || downloadingParakeetModel}
          progress={parakeetDownloadProgress}
          isInstalling={isInstallingParakeet}
        />
      );
    }

    return null;
  }, [
    downloadingModel,
    downloadProgress,
    isInstalling,
    downloadingParakeetModel,
    parakeetDownloadProgress,
    isInstallingParakeet,
    useLocalWhisper,
    internalLocalProvider,
  ]);

  const renderLocalModels = () => (
    <div className="space-y-1.5">
      {localModels.map((model) => {
        const modelId = model.model;
        const info = WHISPER_MODEL_INFO[modelId] || {
          name: modelId,
          description: "Model",
          size: "Unknown",
        };

        return (
          <LocalModelCard
            key={modelId}
            modelId={modelId}
            name={info.name}
            description={info.description}
            size={info.size}
            actualSizeMb={model.size_mb}
            isSelected={modelId === selectedLocalModel}
            isDownloaded={model.downloaded ?? false}
            isDownloading={isDownloadingModel(modelId)}
            isCancelling={isCancelling}
            recommended={info.recommended}
            provider="whisper"
            onSelect={() => handleWhisperModelSelect(modelId)}
            onDelete={() => handleDelete(modelId)}
            onDownload={() => downloadModel(modelId, handleWhisperModelSelect)}
            onCancel={cancelDownload}
            styles={styles}
          />
        );
      })}
    </div>
  );

  const handleParakeetDelete = useCallback(
    (modelId: string) => {
      showConfirmDialog({
        title: "Delete Model",
        description:
          "Are you sure you want to delete this model? You'll need to re-download it if you want to use it again.",
        onConfirm: async () => {
          await deleteParakeetModel(modelId, async () => {
            const result = await window.electronAPI?.listParakeetModels();
            if (result?.success) {
              setParakeetModels(result.models);
            }
          });
        },
        variant: "destructive",
      });
    },
    [showConfirmDialog, deleteParakeetModel]
  );

  // Helper to get language label for Parakeet models
  const getParakeetLanguageLabel = (language: string) => {
    return language === "multilingual" ? "25 languages" : "English";
  };

  const renderParakeetModels = () => {
    // When no models are loaded yet, show all available models from registry
    const modelsToRender =
      parakeetModels.length === 0
        ? Object.entries(PARAKEET_MODEL_INFO).map(([modelId, info]) => ({
            model: modelId,
            downloaded: false,
            size_mb: info.sizeMb,
          }))
        : parakeetModels;

    return (
      <div className="space-y-2">
        {modelsToRender.map((model) => {
          const modelId = model.model;
          const info = PARAKEET_MODEL_INFO[modelId] || {
            name: modelId,
            description: "NVIDIA Parakeet Model",
            size: "Unknown",
            language: "en",
          };

          return (
            <LocalModelCard
              key={modelId}
              modelId={modelId}
              name={info.name}
              description={info.description}
              size={info.size}
              actualSizeMb={model.size_mb}
              isSelected={modelId === selectedLocalModel}
              isDownloaded={model.downloaded ?? false}
              isDownloading={isDownloadingParakeetModel(modelId)}
              isCancelling={isCancellingParakeet}
              recommended={info.recommended}
              provider="nvidia"
              languageLabel={getParakeetLanguageLabel(info.language)}
              onSelect={() => handleParakeetModelSelect(modelId)}
              onDelete={() => handleParakeetDelete(modelId)}
              onDownload={() => downloadParakeetModel(modelId, handleParakeetModelSelect)}
              onCancel={cancelParakeetDownload}
              styles={styles}
            />
          );
        })}
      </div>
    );
  };

  const MODE_TABS = [
    { id: "cloud", name: "Cloud" },
    { id: "local", name: "Local" },
  ];

  const renderModeIcon = (id: string) => {
    if (id === "cloud") return <Cloud className="w-4 h-4" />;
    return <Lock className="w-4 h-4" />;
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Only show mode selector in settings, not in onboarding (which has its own) */}
      {variant === "settings" && (
        <div className="space-y-3">
          <ProviderTabs
            providers={MODE_TABS}
            selectedId={useLocalWhisper ? "local" : "cloud"}
            onSelect={(id) => handleModeChange(id === "local")}
            renderIcon={renderModeIcon}
            colorScheme="purple"
          />
          <p className="text-xs text-muted-foreground text-center">
            {useLocalWhisper
              ? "Runs on your device. Complete privacy, works offline."
              : "Transcription via API. Fast and accurate, requires internet."}
          </p>
        </div>
      )}

      {!useLocalWhisper ? (
        <div className="space-y-4">
          <div className={styles.container}>
            <div className="p-3 pb-0">
              <ProviderTabs
                providers={CLOUD_PROVIDER_TABS}
                selectedId={selectedCloudProvider}
                onSelect={handleCloudProviderChange}
                colorScheme={colorScheme === "purple" ? "purple" : "indigo"}
                scrollable
              />
            </div>

            <div className="p-4">
              {selectedCloudProvider === "custom" ? (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-foreground">
                      Custom Endpoint Configuration
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Connect to any OpenAI-compatible transcription API.
                    </p>
                  </div>

                  {/* 1. Endpoint URL - TOP */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-foreground">Endpoint URL</h4>
                    <Input
                      value={cloudTranscriptionBaseUrl}
                      onChange={(e) => setCloudTranscriptionBaseUrl?.(e.target.value)}
                      onBlur={handleBaseUrlBlur}
                      placeholder="https://your-api.example.com/v1"
                      className="text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Examples: <code className="text-primary">http://localhost:11434/v1</code>{" "}
                      (Ollama), <code className="text-primary">http://localhost:8080/v1</code>{" "}
                      (LocalAI).
                      <br />
                      Known providers (Groq, OpenAI) will be auto-detected.
                    </p>
                  </div>

                  {/* 2. API Key - SECOND */}
                  <div className="space-y-3 pt-4">
                    <h4 className="font-medium text-foreground">API Key (Optional)</h4>
                    <ApiKeyInput
                      apiKey={customTranscriptionApiKey}
                      setApiKey={setCustomTranscriptionApiKey || (() => {})}
                      label=""
                      helpText="Optional. Sent as a Bearer token for authentication. This is separate from your OpenAI API key."
                    />
                  </div>

                  {/* 3. Model Name - THIRD */}
                  <div className="space-y-2 pt-4">
                    <label className="block text-sm font-medium text-foreground">Model Name</label>
                    <Input
                      value={selectedCloudModel}
                      onChange={(e) => onCloudModelSelect(e.target.value)}
                      placeholder="whisper-1"
                      className="text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      The model name supported by your endpoint (defaults to whisper-1).
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* API Configuration First */}
                  <div className="space-y-3 mb-4">
                    <div className="flex items-baseline justify-between">
                      <h4 className="font-medium text-foreground">API Key</h4>
                      <a
                        href={
                          selectedCloudProvider === "groq"
                            ? "https://console.groq.com/keys"
                            : "https://platform.openai.com/api-keys"
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={createExternalLinkHandler(
                          selectedCloudProvider === "groq"
                            ? "https://console.groq.com/keys"
                            : "https://platform.openai.com/api-keys"
                        )}
                        className="text-xs text-primary hover:text-primary/80 underline cursor-pointer"
                      >
                        Get your API key →
                      </a>
                    </div>
                    <ApiKeyInput
                      apiKey={selectedCloudProvider === "groq" ? groqApiKey : openaiApiKey}
                      setApiKey={selectedCloudProvider === "groq" ? setGroqApiKey : setOpenaiApiKey}
                      label=""
                      helpText=""
                    />
                  </div>

                  {/* Model Selection Below */}
                  <div className="pt-4 space-y-3">
                    <h4 className="text-sm font-medium text-foreground">Select Model</h4>
                    <ModelCardList
                      models={cloudModelOptions}
                      selectedModel={selectedCloudModel}
                      onModelSelect={onCloudModelSelect}
                      colorScheme={colorScheme === "purple" ? "purple" : "indigo"}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.container}>
          <div className="p-3 pb-0">
            <ProviderTabs
              providers={LOCAL_PROVIDER_TABS}
              selectedId={internalLocalProvider}
              onSelect={handleLocalProviderChange}
              colorScheme={colorScheme === "purple" ? "purple" : "indigo"}
            />
          </div>

          {progressDisplay}

          <div className="p-4">
            <h5 className={`${styles.header} mb-3`}>Available Models</h5>

            {internalLocalProvider === "whisper" && renderLocalModels()}
            {internalLocalProvider === "nvidia" && renderParakeetModels()}
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
