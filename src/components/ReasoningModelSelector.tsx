import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Cloud, Lock } from "lucide-react";
import ApiKeyInput from "./ui/ApiKeyInput";
import ModelCardList from "./ui/ModelCardList";
import LocalModelPicker, { type LocalProvider } from "./LocalModelPicker";
import { ProviderTabs } from "./ui/ProviderTabs";
import { API_ENDPOINTS, buildApiUrl, normalizeBaseUrl } from "../config/constants";
import { REASONING_PROVIDERS } from "../models/ModelRegistry";
import { modelRegistry } from "../models/ModelRegistry";
import { getProviderIcon, isMonochromeProvider } from "../utils/providerIcons";
import { isSecureEndpoint } from "../utils/urlUtils";
import { createExternalLinkHandler } from "../utils/externalLinks";

type CloudModelOption = {
  value: string;
  label: string;
  description?: string;
  icon?: string;
  ownedBy?: string;
  invertInDark?: boolean;
};

const OWNED_BY_ICON_RULES: Array<{ match: RegExp; provider: string }> = [
  { match: /(openai|system|default|gpt|davinci)/, provider: "openai" },
  { match: /(azure)/, provider: "openai" },
  { match: /(anthropic|claude)/, provider: "anthropic" },
  { match: /(google|gemini)/, provider: "gemini" },
  { match: /(meta|llama)/, provider: "llama" },
  { match: /(mistral)/, provider: "mistral" },
  { match: /(qwen|ali|tongyi)/, provider: "qwen" },
  { match: /(openrouter|oss)/, provider: "openai-oss" },
];

const resolveOwnedByIcon = (ownedBy?: string): { icon?: string; invertInDark: boolean } => {
  if (!ownedBy) return { icon: undefined, invertInDark: false };
  const normalized = ownedBy.toLowerCase();
  const rule = OWNED_BY_ICON_RULES.find(({ match }) => match.test(normalized));
  if (rule) {
    return {
      icon: getProviderIcon(rule.provider),
      invertInDark: isMonochromeProvider(rule.provider),
    };
  }
  return { icon: undefined, invertInDark: false };
};

interface ReasoningModelSelectorProps {
  useReasoningModel: boolean;
  setUseReasoningModel: (value: boolean) => void;
  reasoningModel: string;
  setReasoningModel: (model: string) => void;
  localReasoningProvider: string;
  setLocalReasoningProvider: (provider: string) => void;
  cloudReasoningBaseUrl: string;
  setCloudReasoningBaseUrl: (value: string) => void;
  openaiApiKey: string;
  setOpenaiApiKey: (key: string) => void;
  anthropicApiKey: string;
  setAnthropicApiKey: (key: string) => void;
  geminiApiKey: string;
  setGeminiApiKey: (key: string) => void;
  groqApiKey: string;
  setGroqApiKey: (key: string) => void;
  customReasoningApiKey?: string;
  setCustomReasoningApiKey?: (key: string) => void;
  showAlertDialog: (dialog: { title: string; description: string }) => void;
}

export default function ReasoningModelSelector({
  useReasoningModel,
  setUseReasoningModel,
  reasoningModel,
  setReasoningModel,
  localReasoningProvider,
  setLocalReasoningProvider,
  cloudReasoningBaseUrl,
  setCloudReasoningBaseUrl,
  openaiApiKey,
  setOpenaiApiKey,
  anthropicApiKey,
  setAnthropicApiKey,
  geminiApiKey,
  setGeminiApiKey,
  groqApiKey,
  setGroqApiKey,
  customReasoningApiKey = "",
  setCustomReasoningApiKey,
}: ReasoningModelSelectorProps) {
  const [selectedMode, setSelectedMode] = useState<"cloud" | "local">("cloud");
  const [selectedCloudProvider, setSelectedCloudProvider] = useState("openai");
  const [selectedLocalProvider, setSelectedLocalProvider] = useState("qwen");
  const [customModelOptions, setCustomModelOptions] = useState<CloudModelOption[]>([]);
  const [customModelsLoading, setCustomModelsLoading] = useState(false);
  const [customModelsError, setCustomModelsError] = useState<string | null>(null);
  const [customBaseInput, setCustomBaseInput] = useState(cloudReasoningBaseUrl);
  const lastLoadedBaseRef = useRef<string | null>(null);
  const pendingBaseRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setCustomBaseInput(cloudReasoningBaseUrl);
  }, [cloudReasoningBaseUrl]);

  const defaultOpenAIBase = useMemo(() => normalizeBaseUrl(API_ENDPOINTS.OPENAI_BASE), []);
  const normalizedCustomReasoningBase = useMemo(
    () => normalizeBaseUrl(cloudReasoningBaseUrl),
    [cloudReasoningBaseUrl]
  );
  const latestReasoningBaseRef = useRef(normalizedCustomReasoningBase);

  useEffect(() => {
    latestReasoningBaseRef.current = normalizedCustomReasoningBase;
  }, [normalizedCustomReasoningBase]);

  const hasCustomBase = normalizedCustomReasoningBase !== "";
  const effectiveReasoningBase = hasCustomBase ? normalizedCustomReasoningBase : defaultOpenAIBase;

  const loadRemoteModels = useCallback(
    async (baseOverride?: string, force = false) => {
      const rawBase = (baseOverride ?? cloudReasoningBaseUrl) || "";
      const normalizedBase = normalizeBaseUrl(rawBase);

      if (!normalizedBase) {
        if (isMountedRef.current) {
          setCustomModelsLoading(false);
          setCustomModelsError(null);
          setCustomModelOptions([]);
        }
        return;
      }

      if (!force && lastLoadedBaseRef.current === normalizedBase) return;
      if (!force && pendingBaseRef.current === normalizedBase) return;

      if (baseOverride !== undefined) {
        latestReasoningBaseRef.current = normalizedBase;
      }

      pendingBaseRef.current = normalizedBase;

      if (isMountedRef.current) {
        setCustomModelsLoading(true);
        setCustomModelsError(null);
        setCustomModelOptions([]);
      }

      let apiKey: string | undefined;

      try {
        // Use the custom reasoning API key for custom endpoints
        const keyFromState = customReasoningApiKey?.trim();
        apiKey = keyFromState && keyFromState.length > 0 ? keyFromState : undefined;

        if (!normalizedBase.includes("://")) {
          if (isMountedRef.current && latestReasoningBaseRef.current === normalizedBase) {
            setCustomModelsError(
              "Enter a full base URL including protocol (e.g. https://server/v1)."
            );
            setCustomModelsLoading(false);
          }
          return;
        }

        if (!isSecureEndpoint(normalizedBase)) {
          if (isMountedRef.current && latestReasoningBaseRef.current === normalizedBase) {
            setCustomModelsError("HTTPS required (HTTP allowed for local network only).");
            setCustomModelsLoading(false);
          }
          return;
        }

        const headers: Record<string, string> = {};
        if (apiKey) {
          headers.Authorization = `Bearer ${apiKey}`;
        }

        const modelsUrl = buildApiUrl(normalizedBase, "/models");
        const response = await fetch(modelsUrl, { method: "GET", headers });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          const summary = errorText
            ? `${response.status} ${errorText.slice(0, 200)}`
            : `${response.status} ${response.statusText}`;
          throw new Error(summary.trim());
        }

        const payload = await response.json().catch(() => ({}));
        const rawModels = Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.models)
            ? payload.models
            : [];

        const mappedModels = (rawModels as Array<Record<string, unknown>>)
          .map((item) => {
            const value = (item?.id || item?.name) as string | undefined;
            if (!value) return null;
            const ownedBy = typeof item?.owned_by === "string" ? item.owned_by : undefined;
            const { icon, invertInDark } = resolveOwnedByIcon(ownedBy);
            return {
              value,
              label: (item?.id || item?.name || value) as string,
              description:
                (item?.description as string) || (ownedBy ? `Owner: ${ownedBy}` : undefined),
              icon,
              ownedBy,
              invertInDark,
            } as CloudModelOption;
          })
          .filter(Boolean) as CloudModelOption[];

        if (isMountedRef.current && latestReasoningBaseRef.current === normalizedBase) {
          setCustomModelOptions(mappedModels);
          if (
            reasoningModel &&
            mappedModels.length > 0 &&
            !mappedModels.some((model) => model.value === reasoningModel)
          ) {
            setReasoningModel("");
          }
          setCustomModelsError(null);
          lastLoadedBaseRef.current = normalizedBase;
        }
      } catch (error) {
        if (isMountedRef.current && latestReasoningBaseRef.current === normalizedBase) {
          const message = (error as Error).message || "Unable to load models from endpoint.";
          const unauthorized = /\b(401|403)\b/.test(message);
          if (unauthorized && !apiKey) {
            setCustomModelsError(
              "Endpoint rejected the request (401/403). Add an API key or adjust server auth settings."
            );
          } else {
            setCustomModelsError(message);
          }
          setCustomModelOptions([]);
        }
      } finally {
        if (pendingBaseRef.current === normalizedBase) {
          pendingBaseRef.current = null;
        }
        if (isMountedRef.current && latestReasoningBaseRef.current === normalizedBase) {
          setCustomModelsLoading(false);
        }
      }
    },
    [cloudReasoningBaseUrl, customReasoningApiKey, reasoningModel, setReasoningModel]
  );

  const trimmedCustomBase = customBaseInput.trim();
  const hasSavedCustomBase = Boolean((cloudReasoningBaseUrl || "").trim());
  const isCustomBaseDirty = trimmedCustomBase !== (cloudReasoningBaseUrl || "").trim();

  const displayedCustomModels = useMemo<CloudModelOption[]>(() => {
    if (isCustomBaseDirty) return [];
    return customModelOptions;
  }, [isCustomBaseDirty, customModelOptions]);

  const cloudProviderIds = ["openai", "anthropic", "gemini", "groq", "custom"];
  const cloudProviders = cloudProviderIds.map((id) => ({
    id,
    name:
      id === "custom"
        ? "Custom"
        : REASONING_PROVIDERS[id as keyof typeof REASONING_PROVIDERS]?.name || id,
  }));

  const localProviders = useMemo<LocalProvider[]>(() => {
    return modelRegistry.getAllProviders().map((provider) => ({
      id: provider.id,
      name: provider.name,
      models: provider.models.map((model) => ({
        id: model.id,
        name: model.name,
        size: model.size,
        sizeBytes: model.sizeBytes,
        description: model.description,
        recommended: model.recommended,
      })),
    }));
  }, []);

  const openaiModelOptions = useMemo<CloudModelOption[]>(() => {
    const iconUrl = getProviderIcon("openai");
    return REASONING_PROVIDERS.openai.models.map((model) => ({
      ...model,
      icon: iconUrl,
      invertInDark: true,
    }));
  }, []);

  const selectedCloudModels = useMemo<CloudModelOption[]>(() => {
    if (selectedCloudProvider === "openai") return openaiModelOptions;
    if (selectedCloudProvider === "custom") return displayedCustomModels;

    const provider = REASONING_PROVIDERS[selectedCloudProvider as keyof typeof REASONING_PROVIDERS];
    if (!provider?.models) return [];

    const iconUrl = getProviderIcon(selectedCloudProvider);
    const invertInDark = isMonochromeProvider(selectedCloudProvider);
    return provider.models.map((model) => ({
      ...model,
      icon: iconUrl,
      invertInDark,
    }));
  }, [selectedCloudProvider, openaiModelOptions, displayedCustomModels]);

  const handleApplyCustomBase = useCallback(() => {
    const trimmedBase = customBaseInput.trim();
    const normalized = trimmedBase ? normalizeBaseUrl(trimmedBase) : trimmedBase;
    setCustomBaseInput(normalized);
    setCloudReasoningBaseUrl(normalized);
    lastLoadedBaseRef.current = null;
    loadRemoteModels(normalized, true);
  }, [customBaseInput, setCloudReasoningBaseUrl, loadRemoteModels]);

  const handleBaseUrlBlur = useCallback(() => {
    const trimmedBase = customBaseInput.trim();
    if (!trimmedBase) return;

    // Auto-apply on blur if changed
    if (trimmedBase !== (cloudReasoningBaseUrl || "").trim()) {
      handleApplyCustomBase();
    }
  }, [customBaseInput, cloudReasoningBaseUrl, handleApplyCustomBase]);

  const handleResetCustomBase = useCallback(() => {
    const defaultBase = API_ENDPOINTS.OPENAI_BASE;
    setCustomBaseInput(defaultBase);
    setCloudReasoningBaseUrl(defaultBase);
    lastLoadedBaseRef.current = null;
    loadRemoteModels(defaultBase, true);
  }, [setCloudReasoningBaseUrl, loadRemoteModels]);

  const handleRefreshCustomModels = useCallback(() => {
    if (isCustomBaseDirty) {
      handleApplyCustomBase();
      return;
    }
    if (!trimmedCustomBase) return;
    loadRemoteModels(undefined, true);
  }, [handleApplyCustomBase, isCustomBaseDirty, trimmedCustomBase, loadRemoteModels]);

  useEffect(() => {
    const localProviderIds = localProviders.map((p) => p.id);
    if (localProviderIds.includes(localReasoningProvider)) {
      setSelectedMode("local");
      setSelectedLocalProvider(localReasoningProvider);
    } else if (cloudProviderIds.includes(localReasoningProvider)) {
      setSelectedMode("cloud");
      setSelectedCloudProvider(localReasoningProvider);
    }
  }, [localProviders, localReasoningProvider]);

  useEffect(() => {
    if (selectedCloudProvider !== "custom") return;
    if (!hasCustomBase) {
      setCustomModelsError(null);
      setCustomModelOptions([]);
      setCustomModelsLoading(false);
      lastLoadedBaseRef.current = null;
      return;
    }

    const normalizedBase = normalizedCustomReasoningBase;
    if (!normalizedBase) return;
    if (pendingBaseRef.current === normalizedBase || lastLoadedBaseRef.current === normalizedBase)
      return;

    loadRemoteModels();
  }, [selectedCloudProvider, hasCustomBase, normalizedCustomReasoningBase, loadRemoteModels]);

  const [downloadedModels, setDownloadedModels] = useState<Set<string>>(new Set());

  const loadDownloadedModels = useCallback(async () => {
    try {
      const result = await window.electronAPI?.modelGetAll?.();
      if (result && Array.isArray(result)) {
        const downloaded = new Set(
          result
            .filter((m: { isDownloaded?: boolean }) => m.isDownloaded)
            .map((m: { id: string }) => m.id)
        );
        setDownloadedModels(downloaded);
        return downloaded;
      }
    } catch (error) {
      console.error("Failed to load downloaded models:", error);
    }
    return new Set<string>();
  }, []);

  useEffect(() => {
    loadDownloadedModels();
  }, [loadDownloadedModels]);

  const handleModeChange = async (newMode: "cloud" | "local") => {
    setSelectedMode(newMode);

    if (newMode === "cloud") {
      setLocalReasoningProvider(selectedCloudProvider);

      if (selectedCloudProvider === "custom") {
        setCustomBaseInput(cloudReasoningBaseUrl);
        lastLoadedBaseRef.current = null;
        pendingBaseRef.current = null;

        if (customModelOptions.length > 0) {
          setReasoningModel(customModelOptions[0].value);
        } else if (hasCustomBase) {
          loadRemoteModels();
        }
        return;
      }

      const provider =
        REASONING_PROVIDERS[selectedCloudProvider as keyof typeof REASONING_PROVIDERS];
      if (provider?.models?.length > 0) {
        setReasoningModel(provider.models[0].value);
      }
    } else {
      setLocalReasoningProvider(selectedLocalProvider);
      const downloaded = await loadDownloadedModels();
      const provider = localProviders.find((p) => p.id === selectedLocalProvider);
      const models = provider?.models ?? [];
      if (models.length > 0) {
        const firstDownloaded = models.find((m) => downloaded.has(m.id));
        if (firstDownloaded) {
          setReasoningModel(firstDownloaded.id);
        } else {
          setReasoningModel("");
        }
      }
    }
  };

  const handleCloudProviderChange = (provider: string) => {
    setSelectedCloudProvider(provider);
    setLocalReasoningProvider(provider);

    if (provider === "custom") {
      setCustomBaseInput(cloudReasoningBaseUrl);
      lastLoadedBaseRef.current = null;
      pendingBaseRef.current = null;

      if (customModelOptions.length > 0) {
        setReasoningModel(customModelOptions[0].value);
      } else if (hasCustomBase) {
        loadRemoteModels();
      }
      return;
    }

    const providerData = REASONING_PROVIDERS[provider as keyof typeof REASONING_PROVIDERS];
    if (providerData?.models?.length > 0) {
      setReasoningModel(providerData.models[0].value);
    }
  };

  const handleLocalProviderChange = async (providerId: string) => {
    setSelectedLocalProvider(providerId);
    setLocalReasoningProvider(providerId);
    const downloaded = await loadDownloadedModels();
    const provider = localProviders.find((p) => p.id === providerId);
    const models = provider?.models ?? [];
    if (models.length > 0) {
      const firstDownloaded = models.find((m) => downloaded.has(m.id));
      if (firstDownloaded) {
        setReasoningModel(firstDownloaded.id);
      } else {
        setReasoningModel("");
      }
    }
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
    <div className="space-y-6">
      <div className="flex items-center justify-between p-4 bg-card border border-border rounded-xl">
        <div>
          <label className="text-sm font-medium text-foreground">Enable AI Text Enhancement</label>
          <p className="text-xs text-muted-foreground">
            Use AI to automatically improve transcription quality
          </p>
        </div>
        <button
          onClick={() => setUseReasoningModel(!useReasoningModel)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${
            useReasoningModel ? "bg-primary" : "bg-muted-foreground/25"
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-200 ${
              useReasoningModel ? "translate-x-4.5" : "translate-x-0.75"
            }`}
          />
        </button>
      </div>

      {useReasoningModel && (
        <>
          <div className="space-y-3">
            <ProviderTabs
              providers={MODE_TABS}
              selectedId={selectedMode}
              onSelect={(id) => handleModeChange(id as "cloud" | "local")}
              renderIcon={renderModeIcon}
              colorScheme="purple"
            />
            <p className="text-xs text-muted-foreground text-center">
              {selectedMode === "local"
                ? "Runs on your device. Complete privacy, works offline."
                : "Advanced models via API. Fast and capable, requires internet."}
            </p>
          </div>

          {selectedMode === "cloud" ? (
            <div className="space-y-4">
              <div className="border border-border rounded-xl overflow-hidden">
                <ProviderTabs
                  providers={cloudProviders}
                  selectedId={selectedCloudProvider}
                  onSelect={handleCloudProviderChange}
                  colorScheme="indigo"
                />

                <div className="p-4">
                  {selectedCloudProvider === "custom" ? (
                    <>
                      {/* 1. Endpoint URL - TOP */}
                      <div className="space-y-3">
                        <h4 className="font-medium text-foreground">Endpoint URL</h4>
                        <Input
                          value={customBaseInput}
                          onChange={(event) => setCustomBaseInput(event.target.value)}
                          onBlur={handleBaseUrlBlur}
                          placeholder="https://api.openai.com/v1"
                          className="text-sm"
                        />
                        <p className="text-xs text-muted-foreground">
                          Examples: <code className="text-primary">http://localhost:11434/v1</code>{" "}
                          (Ollama), <code className="text-primary">http://localhost:8080/v1</code>{" "}
                          (LocalAI).
                        </p>
                      </div>

                      {/* 2. API Key - SECOND */}
                      <div className="space-y-3 pt-4">
                        <h4 className="font-medium text-foreground">API Key (Optional)</h4>
                        <ApiKeyInput
                          apiKey={customReasoningApiKey}
                          setApiKey={setCustomReasoningApiKey || (() => {})}
                          label=""
                          helpText="Optional. Sent as a Bearer token for authentication. This is separate from your OpenAI API key."
                        />
                      </div>

                      {/* 3. Model Selection - THIRD */}
                      <div className="space-y-3 pt-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium text-foreground">Available Models</h4>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={handleResetCustomBase}
                              className="text-xs"
                            >
                              Reset
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={handleRefreshCustomModels}
                              disabled={
                                customModelsLoading || (!trimmedCustomBase && !hasSavedCustomBase)
                              }
                              className="text-xs"
                            >
                              {customModelsLoading
                                ? "Loading..."
                                : isCustomBaseDirty
                                  ? "Apply & Refresh"
                                  : "Refresh"}
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          We'll query{" "}
                          <code>
                            {hasCustomBase
                              ? `${effectiveReasoningBase}/models`
                              : `${defaultOpenAIBase}/models`}
                          </code>{" "}
                          for available models.
                        </p>
                        {isCustomBaseDirty && (
                          <p className="text-xs text-primary">
                            Models will reload when you click away from the URL field or click
                            "Apply & Refresh".
                          </p>
                        )}
                        {!hasCustomBase && (
                          <p className="text-xs text-warning">
                            Enter an endpoint URL above to load models.
                          </p>
                        )}
                        {hasCustomBase && (
                          <>
                            {customModelsLoading && (
                              <p className="text-xs text-primary">
                                Fetching model list from endpoint...
                              </p>
                            )}
                            {customModelsError && (
                              <p className="text-xs text-destructive">{customModelsError}</p>
                            )}
                            {!customModelsLoading &&
                              !customModelsError &&
                              customModelOptions.length === 0 && (
                                <p className="text-xs text-warning">
                                  No models returned. Check your endpoint URL.
                                </p>
                              )}
                          </>
                        )}
                        <ModelCardList
                          models={selectedCloudModels}
                          selectedModel={reasoningModel}
                          onModelSelect={setReasoningModel}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      {/* 1. API Key - TOP */}
                      {selectedCloudProvider === "openai" && (
                        <div className="space-y-3">
                          <div className="flex items-baseline justify-between">
                            <h4 className="font-medium text-foreground">API Key</h4>
                            <a
                              href="https://platform.openai.com/api-keys"
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={createExternalLinkHandler(
                                "https://platform.openai.com/api-keys"
                              )}
                              className="text-xs text-primary hover:text-primary/80 underline cursor-pointer"
                            >
                              Get your API key →
                            </a>
                          </div>
                          <ApiKeyInput
                            apiKey={openaiApiKey}
                            setApiKey={setOpenaiApiKey}
                            label=""
                            helpText=""
                          />
                        </div>
                      )}

                      {selectedCloudProvider === "anthropic" && (
                        <div className="space-y-3">
                          <div className="flex items-baseline justify-between">
                            <h4 className="font-medium text-foreground">API Key</h4>
                            <a
                              href="https://console.anthropic.com/settings/keys"
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={createExternalLinkHandler(
                                "https://console.anthropic.com/settings/keys"
                              )}
                              className="text-xs text-primary hover:text-primary/80 underline cursor-pointer"
                            >
                              Get your API key →
                            </a>
                          </div>
                          <ApiKeyInput
                            apiKey={anthropicApiKey}
                            setApiKey={setAnthropicApiKey}
                            placeholder="sk-ant-..."
                            label=""
                            helpText=""
                          />
                        </div>
                      )}

                      {selectedCloudProvider === "gemini" && (
                        <div className="space-y-3">
                          <div className="flex items-baseline justify-between">
                            <h4 className="font-medium text-foreground">API Key</h4>
                            <a
                              href="https://aistudio.google.com/app/api-keys"
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={createExternalLinkHandler(
                                "https://aistudio.google.com/app/api-keys"
                              )}
                              className="text-xs text-primary hover:text-primary/80 underline cursor-pointer"
                            >
                              Get your API key →
                            </a>
                          </div>
                          <ApiKeyInput
                            apiKey={geminiApiKey}
                            setApiKey={setGeminiApiKey}
                            placeholder="AIza..."
                            label=""
                            helpText=""
                          />
                        </div>
                      )}

                      {selectedCloudProvider === "groq" && (
                        <div className="space-y-3">
                          <div className="flex items-baseline justify-between">
                            <h4 className="font-medium text-foreground">API Key</h4>
                            <a
                              href="https://console.groq.com/keys"
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={createExternalLinkHandler("https://console.groq.com/keys")}
                              className="text-xs text-primary hover:text-primary/80 underline cursor-pointer"
                            >
                              Get your API key →
                            </a>
                          </div>
                          <ApiKeyInput
                            apiKey={groqApiKey}
                            setApiKey={setGroqApiKey}
                            placeholder="gsk_..."
                            label=""
                            helpText=""
                          />
                        </div>
                      )}

                      {/* 2. Model Selection - BOTTOM */}
                      <div className="pt-4 space-y-3">
                        <h4 className="text-sm font-medium text-foreground">Select Model</h4>
                        <ModelCardList
                          models={selectedCloudModels}
                          selectedModel={reasoningModel}
                          onModelSelect={setReasoningModel}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <LocalModelPicker
              providers={localProviders}
              selectedModel={reasoningModel}
              selectedProvider={selectedLocalProvider}
              onModelSelect={setReasoningModel}
              onProviderSelect={handleLocalProviderChange}
              modelType="llm"
              colorScheme="purple"
              onDownloadComplete={loadDownloadedModels}
            />
          )}
        </>
      )}
    </div>
  );
}
