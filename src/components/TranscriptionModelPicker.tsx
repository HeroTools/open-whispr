import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
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
import { createExternalLinkHandler } from "../utils/externalLinks";

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
                  <span className="font-medium text-foreground">{info.name}</span>
                  {isSelected && <span className={styles.badges.selected}>✓ Selected</span>}
                  {info.recommended && (
                    <span className={styles.badges.recommended}>Recommended</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">{info.description}</span>
                  <span className="text-xs text-muted-foreground">
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
                    className="text-destructive border-destructive/30 hover:bg-destructive/10"
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

    return (
      <button
        key={provider.id}
        onClick={() => !isDisabled && handleLocalProviderChange(provider.id)}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 font-medium transition-all whitespace-nowrap ${
          isDisabled
            ? "text-muted-foreground cursor-default"
            : isSelected
              ? "text-primary border-b-2 border-primary bg-primary/10"
              : "text-muted-foreground hover:bg-muted"
        }`}
      >
        <ProviderIcon provider={provider.id} className="w-5 h-5" />
        <span>{provider.name}</span>
        {provider.badge && <Badge variant="outline">{provider.badge}</Badge>}
      </button>
    );
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Only show mode selector in settings, not in onboarding (which has its own) */}
      {variant === "settings" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={() => handleModeChange(false)}
            className={`p-4 border-2 rounded-xl text-left transition-all cursor-pointer ${
              !useLocalWhisper
                ? "border-primary bg-primary/10"
                : "border-border bg-card hover:border-border"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <Cloud className="w-6 h-6 text-primary" />
                <h4 className="font-medium text-foreground">Cloud</h4>
              </div>
              <Badge variant="success">Fast</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Transcription via API. Fast and accurate, requires internet.
            </p>
          </button>

          <button
            onClick={() => handleModeChange(true)}
            className={`p-4 border-2 rounded-xl text-left transition-all cursor-pointer ${
              useLocalWhisper
                ? "border-primary bg-primary/10"
                : "border-border bg-card hover:border-border"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <Lock className="w-6 h-6 text-primary" />
                <h4 className="font-medium text-foreground">Local</h4>
              </div>
              <Badge variant="default">Private</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Runs on your device. Complete privacy, works offline.
            </p>
          </button>
        </div>
      )}

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
                      apiKey={openaiApiKey}
                      setApiKey={setOpenaiApiKey}
                      label=""
                      helpText="Optional. Sent as a Bearer token for authentication."
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
          <div className="flex bg-muted border-b border-border">
            {LOCAL_PROVIDER_TABS.map((provider) =>
              renderLocalProviderTab(provider, internalLocalProvider === provider.id)
            )}
          </div>

          {progressDisplay}

          <div className="p-4">
            <h5 className={`${styles.header} mb-3`}>Available Models</h5>

            {internalLocalProvider === "whisper" && renderLocalModels()}
            {internalLocalProvider === "nvidia" && (
              <p className="text-sm text-muted-foreground">Nvidia GPU acceleration coming soon.</p>
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
