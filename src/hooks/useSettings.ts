import { useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage";
import { getModelProvider } from "../utils/languages";
import { API_ENDPOINTS } from "../config/constants";

export interface TranscriptionSettings {
  useLocalWhisper: boolean;
  whisperModel: string;
  allowOpenAIFallback: boolean;
  allowLocalFallback: boolean;
  fallbackWhisperModel: string;
  preferredLanguage: string;
  cloudTranscriptionBaseUrl?: string;
  enableTranslation?: boolean;
  targetLanguage?: string;
}

export interface ReasoningSettings {
  useReasoningModel: boolean;
  reasoningModel: string;
  reasoningProvider: string;
  cloudReasoningBaseUrl?: string;
}

export interface HotkeySettings {
  dictationKey: string;
}

export interface ApiKeySettings {
  openaiApiKey: string;
  anthropicApiKey: string;
  geminiApiKey: string;
}

export function useSettings() {
  const [useLocalWhisper, setUseLocalWhisper] = useLocalStorage("useLocalWhisper", false, {
    serialize: String,
    deserialize: (value) => value === "true",
  });

  const [whisperModel, setWhisperModel] = useLocalStorage("whisperModel", "base", {
    serialize: String,
    deserialize: String,
  });

  const [allowOpenAIFallback, setAllowOpenAIFallback] = useLocalStorage(
    "allowOpenAIFallback",
    false,
    {
      serialize: String,
      deserialize: (value) => value === "true",
    }
  );

  const [allowLocalFallback, setAllowLocalFallback] = useLocalStorage("allowLocalFallback", false, {
    serialize: String,
    deserialize: (value) => value === "true",
  });

  const [fallbackWhisperModel, setFallbackWhisperModel] = useLocalStorage(
    "fallbackWhisperModel",
    "base",
    {
      serialize: String,
      deserialize: String,
    }
  );

  const [preferredLanguage, setPreferredLanguage] = useLocalStorage("preferredLanguage", "en", {
    serialize: String,
    deserialize: String,
  });

  const [cloudTranscriptionBaseUrl, setCloudTranscriptionBaseUrl] = useLocalStorage(
    "cloudTranscriptionBaseUrl",
    API_ENDPOINTS.TRANSCRIPTION_BASE,
    {
      serialize: String,
      deserialize: String,
    }
  );

  const [enableTranslation, setEnableTranslation] = useLocalStorage("enableTranslation", false, {
    serialize: String,
    deserialize: (value) => value === "true",
  });

  const [targetLanguage, setTargetLanguage] = useLocalStorage("targetLanguage", "en", {
    serialize: String,
    deserialize: String,
  });

  const [cloudReasoningBaseUrl, setCloudReasoningBaseUrl] = useLocalStorage(
    "cloudReasoningBaseUrl",
    API_ENDPOINTS.OPENAI_BASE,
    {
      serialize: String,
      deserialize: String,
    }
  );

  // Reasoning settings
  const [useReasoningModel, setUseReasoningModel] = useLocalStorage("useReasoningModel", true, {
    serialize: String,
    deserialize: (value) => value !== "false", // Default true
  });

  const [reasoningModel, setReasoningModel] = useLocalStorage("reasoningModel", "gpt-4o-mini", {
    serialize: String,
    deserialize: String,
  });

  // Translation model (separate from reasoning model for performance)
  const [translationModel, setTranslationModel] = useLocalStorage("translationModel", "gpt-4o-mini", {
    serialize: String,
    deserialize: String,
  });

  // API keys
  const [openaiApiKey, setOpenaiApiKey] = useLocalStorage("openaiApiKey", "", {
    serialize: String,
    deserialize: String,
  });

  const [anthropicApiKey, setAnthropicApiKey] = useLocalStorage("anthropicApiKey", "", {
    serialize: String,
    deserialize: String,
  });

  const [geminiApiKey, setGeminiApiKey] = useLocalStorage("geminiApiKey", "", {
    serialize: String,
    deserialize: String,
  });

  // Hotkey
  const [dictationKey, setDictationKey] = useLocalStorage("dictationKey", "", {
    serialize: String,
    deserialize: String,
  });

  // Computed values
  const reasoningProvider = getModelProvider(reasoningModel);

  // Batch operations
  const updateTranscriptionSettings = useCallback(
    (settings: Partial<TranscriptionSettings>) => {
      if (settings.useLocalWhisper !== undefined) setUseLocalWhisper(settings.useLocalWhisper);
      if (settings.whisperModel !== undefined) setWhisperModel(settings.whisperModel);
      if (settings.allowOpenAIFallback !== undefined)
        setAllowOpenAIFallback(settings.allowOpenAIFallback);
      if (settings.allowLocalFallback !== undefined)
        setAllowLocalFallback(settings.allowLocalFallback);
      if (settings.fallbackWhisperModel !== undefined)
        setFallbackWhisperModel(settings.fallbackWhisperModel);
      if (settings.preferredLanguage !== undefined)
        setPreferredLanguage(settings.preferredLanguage);
      if (settings.cloudTranscriptionBaseUrl !== undefined)
        setCloudTranscriptionBaseUrl(settings.cloudTranscriptionBaseUrl);
      if (settings.enableTranslation !== undefined)
        setEnableTranslation(settings.enableTranslation);
      if (settings.targetLanguage !== undefined) setTargetLanguage(settings.targetLanguage);
    },
    [
      setUseLocalWhisper,
      setWhisperModel,
      setAllowOpenAIFallback,
      setAllowLocalFallback,
      setFallbackWhisperModel,
      setPreferredLanguage,
      setCloudTranscriptionBaseUrl,
      setEnableTranslation,
      setTargetLanguage,
    ]
  );

  const updateReasoningSettings = useCallback(
    (settings: Partial<ReasoningSettings>) => {
      if (settings.useReasoningModel !== undefined)
        setUseReasoningModel(settings.useReasoningModel);
      if (settings.reasoningModel !== undefined) setReasoningModel(settings.reasoningModel);
      if (settings.cloudReasoningBaseUrl !== undefined)
        setCloudReasoningBaseUrl(settings.cloudReasoningBaseUrl);
      // reasoningProvider is computed from reasoningModel, not stored separately
    },
    [setUseReasoningModel, setReasoningModel, setCloudReasoningBaseUrl]
  );

  const updateApiKeys = useCallback(
    (keys: Partial<ApiKeySettings>) => {
      if (keys.openaiApiKey !== undefined) setOpenaiApiKey(keys.openaiApiKey);
      if (keys.anthropicApiKey !== undefined) setAnthropicApiKey(keys.anthropicApiKey);
      if (keys.geminiApiKey !== undefined) setGeminiApiKey(keys.geminiApiKey);
    },
    [setOpenaiApiKey, setAnthropicApiKey, setGeminiApiKey]
  );

  return {
    useLocalWhisper,
    whisperModel,
    allowOpenAIFallback,
    allowLocalFallback,
    fallbackWhisperModel,
    preferredLanguage,
    cloudTranscriptionBaseUrl,
    enableTranslation,
    targetLanguage,
    cloudReasoningBaseUrl,
    useReasoningModel,
    reasoningModel,
    translationModel,
    reasoningProvider,
    openaiApiKey,
    anthropicApiKey,
    geminiApiKey,
    dictationKey,
    setUseLocalWhisper,
    setWhisperModel,
    setAllowOpenAIFallback,
    setAllowLocalFallback,
    setFallbackWhisperModel,
    setPreferredLanguage,
    setCloudTranscriptionBaseUrl,
    setEnableTranslation,
    setTargetLanguage,
    setCloudReasoningBaseUrl,
    setUseReasoningModel,
    setReasoningModel,
    setTranslationModel,
    setReasoningProvider: (provider: string) => {
      if (provider === "custom") {
        return;
      }

      const providerModels = {
        openai: "gpt-4o-mini", // Start with cost-efficient multimodal model
        anthropic: "claude-3.5-sonnet-20241022",
        gemini: "gemini-2.5-flash",
        local: "llama-3.2-3b",
      };
      setReasoningModel(providerModels[provider as keyof typeof providerModels] || "gpt-4o-mini");
    },
    setOpenaiApiKey,
    setAnthropicApiKey,
    setGeminiApiKey,
    setDictationKey,
    updateTranscriptionSettings,
    updateReasoningSettings,
    updateApiKeys,
  };
}
