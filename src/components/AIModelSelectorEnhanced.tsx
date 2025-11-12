import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Cloud, Lock, Brain, Zap, Globe, Cpu, Download, Check, Wrench } from 'lucide-react';
import ApiKeyInput from './ui/ApiKeyInput';
import { UnifiedModelPickerCompact } from './UnifiedModelPicker';
import { API_ENDPOINTS, buildApiUrl, normalizeBaseUrl } from '../config/constants';
import { REASONING_PROVIDERS } from '../utils/languages';
import { modelRegistry } from '../models/ModelRegistry';

type CloudModelOption = {
  value: string;
  label: string;
  description?: string;
  icon?: string;
  ownedBy?: string;
};

const ICON_BASE_PATH = '/assets/icons/providers';

const PROVIDER_ICON_MAP: Record<string, string> = {
  openai: 'openai',
  anthropic: 'anthropic',
  gemini: 'gemini',
  llama: 'llama',
  mistral: 'mistral',
  qwen: 'qwen',
  'openai-oss': 'openai-oss',
};

const OWNED_BY_ICON_RULES: Array<{ match: RegExp; icon: string }> = [
  { match: /(openai|system|default|gpt|davinci)/, icon: 'openai' },
  { match: /(azure)/, icon: 'openai' },
  { match: /(anthropic|claude)/, icon: 'anthropic' },
  { match: /(google|gemini)/, icon: 'gemini' },
  { match: /(meta|llama)/, icon: 'llama' },
  { match: /(mistral)/, icon: 'mistral' },
  { match: /(qwen|ali|tongyi)/, icon: 'qwen' },
  { match: /(openrouter|oss)/, icon: 'openai-oss' },
];

const getProviderIconPath = (providerId: string): string => {
  const iconId = PROVIDER_ICON_MAP[providerId] || 'openai';
  return `${ICON_BASE_PATH}/${iconId}.svg`;
};

const resolveOwnedByIcon = (ownedBy?: string): string | undefined => {
  if (!ownedBy) return undefined;
  const normalized = ownedBy.toLowerCase();
  const rule = OWNED_BY_ICON_RULES.find(({ match }) => match.test(normalized));
  if (rule) {
    return `${ICON_BASE_PATH}/${rule.icon}.svg`;
  }
  return undefined;
};

interface AIModelSelectorEnhancedProps {
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
  pasteFromClipboard: (setter: (value: string) => void) => void;
  showAlertDialog: (dialog: { title: string; description: string }) => void;
}

// Provider Icon Component  
const ProviderIcon = ({ provider }: { provider: string }) => {
  const iconClass = "w-5 h-5";
  const [svgError, setSvgError] = React.useState(false);

  if (provider === 'custom') {
    return <Wrench className={iconClass} />;
  }

  // Default fallback icons for each provider
  const getFallbackIcon = () => {
    switch (provider) {
      // Cloud providers
      case 'openai': return <Brain className={iconClass} />;
      case 'anthropic': return <Zap className={iconClass} />;
      case 'gemini': return <Globe className={iconClass} />;
      // Local providers
      case 'qwen': return <Brain className={iconClass} />;
      case 'mistral': return <Zap className={iconClass} />;
      case 'llama': return <Cpu className={iconClass} />;
      case 'openai-oss': return <Globe className={iconClass} />;
      case 'custom': return <Wrench className={iconClass} />;
      default: return <Brain className={iconClass} />;
    }
  };
  
  // Try to load SVG if it exists and we haven't had an error
  if (!svgError) {
    return (
      <>
        <img 
          src={`/assets/icons/providers/${provider}.svg`}
          alt={`${provider} icon`}
          className={iconClass}
          onError={() => setSvgError(true)}
          style={{ display: svgError ? 'none' : 'block' }}
        />
        {svgError && getFallbackIcon()}
      </>
    );
  }
  
  return getFallbackIcon();
};

export default function AIModelSelectorEnhanced({
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
  pasteFromClipboard,
  showAlertDialog,
}: AIModelSelectorEnhancedProps) {
  const [selectedMode, setSelectedMode] = useState<'cloud' | 'local'>('cloud');
  const [selectedCloudProvider, setSelectedCloudProvider] = useState('openai');
  const [selectedLocalProvider, setSelectedLocalProvider] = useState('qwen');
  const [downloadedModels, setDownloadedModels] = useState<Set<string>>(new Set());
  const [downloadingModel, setDownloadingModel] = useState<string | null>(null);
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

  const hasCustomBase = normalizedCustomReasoningBase !== '';
  const effectiveReasoningBase = hasCustomBase
    ? normalizedCustomReasoningBase
    : defaultOpenAIBase;

  const loadRemoteModels = useCallback(
    async (baseOverride?: string, force = false) => {
      const rawBase = (baseOverride ?? cloudReasoningBaseUrl) || '';
      const normalizedBase = normalizeBaseUrl(rawBase);

      if (!normalizedBase) {
        if (isMountedRef.current) {
          setCustomModelsLoading(false);
          setCustomModelsError(null);
          setCustomModelOptions([]);
        }
        return;
      }

      if (!force && lastLoadedBaseRef.current === normalizedBase) {
        return;
      }

      if (!force && pendingBaseRef.current === normalizedBase) {
        return;
      }

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
        const keyFromState = openaiApiKey?.trim();
        apiKey =
          keyFromState && keyFromState.length > 0
            ? keyFromState
            : await window.electronAPI?.getOpenAIKey?.();

        if (!normalizedBase.includes('://')) {
          if (isMountedRef.current && latestReasoningBaseRef.current === normalizedBase) {
            setCustomModelsError('Enter a full base URL including protocol (e.g. https://server/v1).');
            setCustomModelsLoading(false);
          }
          return;
        }

        // Security: Only allow HTTPS endpoints (except localhost for development)
        const isLocalhost = normalizedBase.includes('://localhost') || normalizedBase.includes('://127.0.0.1');
        if (!normalizedBase.startsWith('https://') && !isLocalhost) {
          if (isMountedRef.current && latestReasoningBaseRef.current === normalizedBase) {
            setCustomModelsError('Only HTTPS endpoints are allowed (except localhost for testing).');
            setCustomModelsLoading(false);
          }
          return;
        }

        const headers: Record<string, string> = {};
        if (apiKey) {
          headers.Authorization = `Bearer ${apiKey}`;
        }

        const response = await fetch(buildApiUrl(normalizedBase, '/models'), {
          method: 'GET',
          headers,
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
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

        const mappedModels = (rawModels as Array<any>)
          .map((item) => {
            const value = item?.id || item?.name;
            if (!value) {
              return null;
            }
            const ownedBy = typeof item?.owned_by === 'string' ? item.owned_by : undefined;
            const icon = resolveOwnedByIcon(ownedBy);
            return {
              value,
              label: item?.id || item?.name || value,
              description:
                item?.description || (ownedBy ? `Owner: ${ownedBy}` : undefined),
              icon,
              ownedBy,
            } as CloudModelOption;
          })
          .filter(Boolean) as CloudModelOption[];

        if (isMountedRef.current && latestReasoningBaseRef.current === normalizedBase) {
          setCustomModelOptions(mappedModels);
          if (
            mappedModels.length > 0 &&
            !mappedModels.some((model) => model.value === reasoningModel)
          ) {
            setReasoningModel(mappedModels[0].value);
          }
          setCustomModelsError(null);
          lastLoadedBaseRef.current = normalizedBase;
        }
      } catch (error) {
        if (isMountedRef.current && latestReasoningBaseRef.current === normalizedBase) {
          const message =
            (error as Error).message || 'Unable to load models from endpoint.';
          const unauthorized = /\b(401|403)\b/.test(message);
          if (unauthorized && !apiKey) {
            setCustomModelsError(
              'Endpoint rejected the request (401/403). Add an API key or adjust server auth settings.'
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
    [cloudReasoningBaseUrl, openaiApiKey, reasoningModel, setReasoningModel]
  );
  const trimmedCustomBase = customBaseInput.trim();
  const hasSavedCustomBase = Boolean((cloudReasoningBaseUrl || '').trim());
  const isCustomBaseDirty =
    trimmedCustomBase !== (cloudReasoningBaseUrl || '').trim();
  const displayedCustomModels = useMemo<CloudModelOption[]>(() => {
    if (isCustomBaseDirty) {
      return [];
    }
    return customModelOptions;
  }, [isCustomBaseDirty, customModelOptions]);

  const cloudProviders = ['openai', 'anthropic', 'gemini', 'custom'];
  const localProviders = modelRegistry.getAllProviders().map((p) => p.id);

  const openaiModelOptions = useMemo<CloudModelOption[]>(() => {
    const iconPath = getProviderIconPath('openai');
    return REASONING_PROVIDERS.openai.models.map((model) => ({
      ...model,
      icon: iconPath,
    }));
  }, []);

  const selectedCloudModels = useMemo<CloudModelOption[]>(() => {
    if (selectedCloudProvider === 'openai') {
      return openaiModelOptions;
    }

    if (selectedCloudProvider === 'custom') {
      return displayedCustomModels;
    }

    const provider = REASONING_PROVIDERS[selectedCloudProvider as keyof typeof REASONING_PROVIDERS];
    if (!provider?.models) {
      return [];
    }

    const iconPath = getProviderIconPath(selectedCloudProvider);
    return provider.models.map((model) => ({
      ...model,
      icon: iconPath,
    }));
  }, [selectedCloudProvider, openaiModelOptions, customModelOptions]);

  const handleApplyCustomBase = useCallback(() => {
    const trimmedBase = customBaseInput.trim();
    setCustomBaseInput(trimmedBase);
    setCloudReasoningBaseUrl(trimmedBase);
    lastLoadedBaseRef.current = null;
    loadRemoteModels(trimmedBase, true);
  }, [customBaseInput, setCustomBaseInput, setCloudReasoningBaseUrl, loadRemoteModels]);

  const handleResetCustomBase = useCallback(() => {
    const defaultBase = API_ENDPOINTS.OPENAI_BASE;
    setCustomBaseInput(defaultBase);
    setCloudReasoningBaseUrl(defaultBase);
    lastLoadedBaseRef.current = null;
    loadRemoteModels(defaultBase, true);
  }, [setCustomBaseInput, setCloudReasoningBaseUrl, loadRemoteModels]);

  const handleRefreshCustomModels = useCallback(() => {
    if (isCustomBaseDirty) {
      handleApplyCustomBase();
      return;
    }

    if (!trimmedCustomBase) {
      return;
    }

    loadRemoteModels(undefined, true);
  }, [handleApplyCustomBase, isCustomBaseDirty, trimmedCustomBase, loadRemoteModels]);

  // Initialize based on current provider
  useEffect(() => {
    if (localProviders.includes(localReasoningProvider)) {
      setSelectedMode('local');
      setSelectedLocalProvider(localReasoningProvider);
    } else if (cloudProviders.includes(localReasoningProvider)) {
      setSelectedMode('cloud');
      setSelectedCloudProvider(localReasoningProvider);
    }
    
    // Check downloaded models
    checkDownloadedModels();
  }, []);
  
  useEffect(() => {
    if (selectedCloudProvider !== 'custom') {
      return;
    }

    if (!hasCustomBase) {
      setCustomModelsError(null);
      setCustomModelOptions([]);
      setCustomModelsLoading(false);
      lastLoadedBaseRef.current = null;
      return;
    }

    const normalizedBase = normalizedCustomReasoningBase;
    if (!normalizedBase) {
      return;
    }

    if (pendingBaseRef.current === normalizedBase || lastLoadedBaseRef.current === normalizedBase) {
      return;
    }

    loadRemoteModels();
  }, [selectedCloudProvider, hasCustomBase, normalizedCustomReasoningBase, loadRemoteModels]);

  // Check which models are downloaded
  const checkDownloadedModels = async () => {
    try {
      const result = await window.electronAPI?.modelGetAll?.();
      if (result && Array.isArray(result)) {
        const downloaded = new Set(result.filter(m => m.isDownloaded).map(m => m.id));
        setDownloadedModels(downloaded);
      }
    } catch (error) {
      console.error('Failed to check downloaded models:', error);
    }
  };
  
  // Handle model download with minimal code
  const downloadModel = async (modelId: string) => {
    setDownloadingModel(modelId);
    try {
      await window.electronAPI?.modelDownload?.(modelId);
      setDownloadedModels(prev => new Set([...prev, modelId]));
      if (!reasoningModel) setReasoningModel(modelId);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setDownloadingModel(null);
    }
  };

  const handleModeChange = async (newMode: 'cloud' | 'local') => {
    setSelectedMode(newMode);
    
    if (newMode === 'cloud') {
      // Switch to cloud mode
      setLocalReasoningProvider(selectedCloudProvider);

      if (selectedCloudProvider === 'custom') {
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

      const provider = REASONING_PROVIDERS[selectedCloudProvider as keyof typeof REASONING_PROVIDERS];
      if (provider?.models?.length > 0) {
        setReasoningModel(provider.models[0].value);
      }
    } else {
      // Switch to local mode
      setLocalReasoningProvider(selectedLocalProvider);
      const provider = modelRegistry.getProvider(selectedLocalProvider);
      if (provider?.models?.length > 0) {
        setReasoningModel(provider.models[0].id);
      }
    }
  };

  const handleCloudProviderChange = (provider: string) => {
    setSelectedCloudProvider(provider);
    setLocalReasoningProvider(provider);
    
    // Update model to first available
    if (provider === 'custom') {
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

  const handleLocalProviderChange = (provider: string) => {
    setSelectedLocalProvider(provider);
    setLocalReasoningProvider(provider);
    // Update model to first available
    const providerData = modelRegistry.getProvider(provider);
    if (providerData?.models?.length > 0) {
      setReasoningModel(providerData.models[0].id);
    }
  };

  const getProviderColor = (provider: string) => {
    const colors: Record<string, string> = {
      'openai': 'green',
      'anthropic': 'purple', 
      'gemini': 'blue',
      'qwen': 'indigo',
      'mistral': 'orange',
      'llama': 'blue',
      'openai-oss': 'teal',
      'custom': 'cyan'
    };
    return colors[provider] || 'gray';
  };

  return (
    <div className="space-y-6">
      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-xl">
        <div>
          <label className="text-sm font-medium text-green-800">
            Enable AI Text Enhancement
          </label>
          <p className="text-xs text-green-700">
            Use AI to automatically improve transcription quality
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only"
            checked={useReasoningModel}
            onChange={(e) => setUseReasoningModel(e.target.checked)}
          />
          <div className={`w-11 h-6 bg-gray-200 rounded-full transition-colors duration-200 ${
            useReasoningModel ? "bg-green-600" : "bg-gray-300"
          }`}>
            <div className={`absolute top-0.5 left-0.5 bg-white border border-gray-300 rounded-full h-5 w-5 transition-transform duration-200 ${
              useReasoningModel ? "translate-x-5" : "translate-x-0"
            }`} />
          </div>
        </label>
      </div>

      {useReasoningModel && (
        <>
          {/* Cloud vs Local Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={() => handleModeChange('cloud')}
              className={`p-4 border-2 rounded-xl text-left transition-all cursor-pointer ${
                selectedMode === 'cloud'
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-neutral-200 bg-white hover:border-neutral-300"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <Cloud className="w-6 h-6 text-blue-600" />
                  <h4 className="font-medium text-neutral-900">Cloud AI</h4>
                </div>
                <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                  Powerful
                </span>
              </div>
              <p className="text-sm text-neutral-600">
                Advanced models via API. Fast and capable, requires internet.
              </p>
            </button>

            <button
              onClick={() => handleModeChange('local')}
              className={`p-4 border-2 rounded-xl text-left transition-all cursor-pointer ${
                selectedMode === 'local'
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-neutral-200 bg-white hover:border-neutral-300"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <Lock className="w-6 h-6 text-purple-600" />
                  <h4 className="font-medium text-neutral-900">Local AI</h4>
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

          {/* Provider Content */}
          {selectedMode === 'cloud' ? (
            <div className="space-y-4">
              {/* Cloud Provider Tabs */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex bg-gray-50 border-b border-gray-200">
                  {cloudProviders.map((provider) => {
                    const isSelected = selectedCloudProvider === provider;
                    const color = getProviderColor(provider);
                    const providerDisplayName =
                      provider === 'custom'
                        ? 'Custom'
                        : REASONING_PROVIDERS[provider as keyof typeof REASONING_PROVIDERS]?.name || provider;
                    return (
                      <button
                        key={provider}
                        onClick={() => handleCloudProviderChange(provider)}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 font-medium transition-all ${
                          isSelected
                            ? `text-${color}-700 border-b-2`
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                        style={isSelected ? {
                          borderBottomColor: `rgb(99 102 241)`,
                          backgroundColor: 'rgb(238 242 255)'
                        } : {}}
                      >
                        <ProviderIcon provider={provider} />
                        <span>{providerDisplayName}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="p-4">
                  {/* Use UnifiedModelPickerCompact for cloud models */}
                  {selectedCloudProvider === 'custom' ? (
                    <>
                      <div className="space-y-3">
                        <h4 className="font-medium text-gray-900">Endpoint Settings</h4>
                        <Input
                          value={customBaseInput}
                          onChange={(event) => setCustomBaseInput(event.target.value)}
                          placeholder="https://api.openai.com/v1"
                          className="text-sm"
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleResetCustomBase}
                          >
                            Reset to Default
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleRefreshCustomModels}
                            disabled={customModelsLoading || (!trimmedCustomBase && !hasSavedCustomBase)}
                          >
                            {customModelsLoading ? 'Loading models...' : isCustomBaseDirty ? 'Apply & Refresh' : 'Refresh Models'}
                          </Button>
                        </div>
                        {isCustomBaseDirty && (
                          <p className="text-xs text-amber-600">Apply the new base URL to refresh models.</p>
                        )}
                        <p className="text-xs text-gray-600">
                          We'll query <code>{hasCustomBase ? `${effectiveReasoningBase}/models` : `${defaultOpenAIBase}/models`}</code> for available models.
                        </p>
                      </div>

                      <div className="space-y-3 pt-4 border-t border-gray-200">
                        <h4 className="font-medium text-gray-900">Authentication</h4>
                        <ApiKeyInput
                          apiKey={openaiApiKey}
                          setApiKey={setOpenaiApiKey}
                          helpText="Optional. Added as a Bearer token for your custom endpoint."
                        />
                      </div>

                      <div className="space-y-3 pt-4 border-t border-gray-200">
                        <h4 className="text-sm font-medium text-gray-700">Available Models</h4>
                        {!hasCustomBase && (
                          <p className="text-xs text-amber-600">
                            Enter a base URL to load models.
                          </p>
                        )}
                        {hasCustomBase && (
                          <>
                            {customModelsLoading && (
                              <p className="text-xs text-blue-600">Fetching model list...</p>
                            )}
                            {customModelsError && (
                              <p className="text-xs text-red-600">{customModelsError}</p>
                            )}
                            {!customModelsLoading && !customModelsError && customModelOptions.length === 0 && (
                              <p className="text-xs text-amber-600">
                                No models returned by this endpoint.
                              </p>
                            )}
                          </>
                        )}
                        <UnifiedModelPickerCompact
                          models={selectedCloudModels}
                          selectedModel={reasoningModel}
                          onModelSelect={setReasoningModel}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium text-gray-700">Select Model</h4>
                        <UnifiedModelPickerCompact
                          models={selectedCloudModels}
                          selectedModel={reasoningModel}
                          onModelSelect={setReasoningModel}
                        />
                      </div>

                  {/* API Key Configuration */}
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        {selectedCloudProvider === 'openai' && (
                          <div className="space-y-3">
                            <h4 className="font-medium text-gray-900">API Configuration</h4>
                            <ApiKeyInput
                              apiKey={openaiApiKey}
                              setApiKey={setOpenaiApiKey}
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
                          </div>
                        )}

                        {selectedCloudProvider === 'anthropic' && (
                          <div className="space-y-3">
                            <h4 className="font-medium text-gray-900">API Configuration</h4>
                            <div className="flex gap-2">
                              <Input
                                type="password"
                                placeholder="sk-ant-..."
                                value={anthropicApiKey}
                                onChange={(e) => setAnthropicApiKey(e.target.value)}
                                className="flex-1 text-sm"
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => pasteFromClipboard(setAnthropicApiKey)}
                              >
                                Paste
                              </Button>
                            </div>
                            <p className="text-xs text-gray-600">
                              Get your API key from console.anthropic.com
                            </p>
                          </div>
                        )}

                        {selectedCloudProvider === 'gemini' && (
                          <div className="space-y-3">
                            <h4 className="font-medium text-gray-900">API Configuration</h4>
                            <div className="flex gap-2">
                              <Input
                                type="password"
                                placeholder="AIza..."
                                value={geminiApiKey}
                                onChange={(e) => setGeminiApiKey(e.target.value)}
                                className="flex-1 text-sm"
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => pasteFromClipboard(setGeminiApiKey)}
                              >
                                Paste
                              </Button>
                            </div>
                            <p className="text-xs text-gray-600">
                              Get your API key from makersuite.google.com/app/apikey
                            </p>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Local Provider Tabs */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex bg-gray-50 border-b border-gray-200 overflow-x-auto">
                  {localProviders.map((provider) => {
                    const isSelected = selectedLocalProvider === provider;
                    const providerData = modelRegistry.getProvider(provider);
                    return (
                      <button
                        key={provider}
                        onClick={() => handleLocalProviderChange(provider)}
                        className={`flex items-center justify-center gap-2 px-4 py-3 font-medium transition-all whitespace-nowrap ${
                          isSelected
                            ? 'text-purple-700 border-b-2'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                        style={isSelected ? {
                          borderBottomColor: 'rgb(147 51 234)',
                          backgroundColor: 'rgb(250 245 255)'
                        } : {}}
                      >
                        <ProviderIcon provider={provider} />
                        <span>{providerData?.name}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Local Model List with Download */}
                <div className="p-4">
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-gray-700">Available Models</h4>
                    {(() => {
                      const provider = modelRegistry.getProvider(selectedLocalProvider);
                      if (!provider || !provider.models) {
                        return <p className="text-sm text-gray-500">No models available for this provider</p>;
                      }
                      
                      return (
                        <div className="space-y-2">
                          {provider.models.map((model) => {
                            const isDownloaded = downloadedModels.has(model.id);
                            const isDownloading = downloadingModel === model.id;
                            const isSelected = reasoningModel === model.id;
                            
                            return (
                              <div
                                key={model.id}
                                className={`p-3 rounded-lg border-2 transition-all ${
                                  isSelected
                                    ? 'border-purple-500 bg-purple-50'
                                    : 'border-gray-200 bg-white hover:border-gray-300'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="font-medium text-gray-900">{model.name}</div>
                                    <div className="text-xs text-gray-600 mt-1">{model.description}</div>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="text-xs text-gray-500">Size: {model.size}</span>
                                      {isDownloaded && (
                                        <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">
                                          <Check className="inline w-3 h-3 mr-1" />
                                          Downloaded
                                        </span>
                                      )}
                                      {model.recommended && (
                                        <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
                                          Recommended
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    {isDownloaded ? (
                                      !isSelected && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => setReasoningModel(model.id)}
                                        >
                                          Select
                                        </Button>
                                      )
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="default"
                                        disabled={isDownloading}
                                        onClick={() => downloadModel(model.id)}
                                      >
                                        {isDownloading ? (
                                          <>Downloading...</>
                                        ) : (
                                          <>
                                            <Download className="w-3 h-3 mr-1" />
                                            Download
                                          </>
                                        )}
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
