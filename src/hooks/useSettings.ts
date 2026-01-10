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
  groqApiKey: string;
}

export function useSettings() {
  const [useLocalWhisper, setUseLocalWhisper] = useLocalStorage(
    "useLocalWhisper",
    false,
    {
      serialize: String,
      deserialize: (value) => value === "true",
    }
  );

  const [whisperModel, setWhisperModel] = useLocalStorage(
    "whisperModel",
    "base",
    {
      serialize: String,
      deserialize: String,
    }
  );

  const [allowOpenAIFallback, setAllowOpenAIFallback] = useLocalStorage(
    "allowOpenAIFallback",
    false,
    {
      serialize: String,
      deserialize: (value) => value === "true",
    }
  );

  const [allowLocalFallback, setAllowLocalFallback] = useLocalStorage(
    "allowLocalFallback",
    false,
    {
      serialize: String,
      deserialize: (value) => value === "true",
    }
  );

  const [fallbackWhisperModel, setFallbackWhisperModel] = useLocalStorage(
    "fallbackWhisperModel",
    "base",
    {
      serialize: String,
      deserialize: String,
    }
  );

  const [preferredLanguage, setPreferredLanguage] = useLocalStorage(
    "preferredLanguage",
    "en",
    {
      serialize: String,
      deserialize: String,
    }
  );

  const [cloudTranscriptionBaseUrl, setCloudTranscriptionBaseUrl] = useLocalStorage(
    "cloudTranscriptionBaseUrl",
    API_ENDPOINTS.TRANSCRIPTION_BASE,
    {
      serialize: String,
      deserialize: String,
    }
  );

  const [cloudReasoningBaseUrl, setCloudReasoningBaseUrl] = useLocalStorage(
    "cloudReasoningBaseUrl",
    API_ENDPOINTS.OPENAI_BASE,
    {
      serialize: String,
      deserialize: String,
    }
  );

  // Reasoning settings
  const [useReasoningModel, setUseReasoningModel] = useLocalStorage(
    "useReasoningModel",
    true,
    {
      serialize: String,
      deserialize: (value) => value !== "false", // Default true
    }
  );

  const [reasoningModel, setReasoningModel] = useLocalStorage(
    "reasoningModel",
    "gpt-4o-mini",
    {
      serialize: String,
      deserialize: String,
    }
  );

  // API keys
  const [openaiApiKey, setOpenaiApiKey] = useLocalStorage("openaiApiKey", "", {
    serialize: String,
    deserialize: String,
  });

  const [anthropicApiKey, setAnthropicApiKey] = useLocalStorage(
    "anthropicApiKey",
    "",
    {
      serialize: String,
      deserialize: String,
    }
  );

  const [geminiApiKey, setGeminiApiKey] = useLocalStorage(
    "geminiApiKey",
    "",
    {
      serialize: String,
      deserialize: String,
    }
  );

  const [groqApiKey, setGroqApiKey] = useLocalStorage(
    "groqApiKey",
    "",
    {
      serialize: String,
      deserialize: String,
    }
  );

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
      if (settings.useLocalWhisper !== undefined)
        setUseLocalWhisper(settings.useLocalWhisper);
      if (settings.whisperModel !== undefined)
        setWhisperModel(settings.whisperModel);
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
    },
    [
      setUseLocalWhisper,
      setWhisperModel,
      setAllowOpenAIFallback,
      setAllowLocalFallback,
      setFallbackWhisperModel,
      setPreferredLanguage,
      setCloudTranscriptionBaseUrl,
    ]
  );

  const updateReasoningSettings = useCallback(
    (settings: Partial<ReasoningSettings>) => {
      if (settings.useReasoningModel !== undefined)
        setUseReasoningModel(settings.useReasoningModel);
      if (settings.reasoningModel !== undefined)
        setReasoningModel(settings.reasoningModel);
      if (settings.cloudReasoningBaseUrl !== undefined)
        setCloudReasoningBaseUrl(settings.cloudReasoningBaseUrl);
      // reasoningProvider is computed from reasoningModel, not stored separately
    },
    [setUseReasoningModel, setReasoningModel, setCloudReasoningBaseUrl]
  );

  const updateApiKeys = useCallback(
    (keys: Partial<ApiKeySettings>) => {
      if (keys.openaiApiKey !== undefined) setOpenaiApiKey(keys.openaiApiKey);
      if (keys.anthropicApiKey !== undefined)
        setAnthropicApiKey(keys.anthropicApiKey);
      if (keys.geminiApiKey !== undefined)
        setGeminiApiKey(keys.geminiApiKey);
      if (keys.groqApiKey !== undefined)
        setGroqApiKey(keys.groqApiKey);
    },
    [setOpenaiApiKey, setAnthropicApiKey, setGeminiApiKey, setGroqApiKey]
  );

  return {
    useLocalWhisper,
    whisperModel,
    allowOpenAIFallback,
    allowLocalFallback,
    fallbackWhisperModel,
    preferredLanguage,
    cloudTranscriptionBaseUrl,
    cloudReasoningBaseUrl,
    useReasoningModel,
    reasoningModel,
    reasoningProvider,
    openaiApiKey,
    anthropicApiKey,
    geminiApiKey,
    groqApiKey,
    dictationKey,
    setUseLocalWhisper,
    setWhisperModel,
    setAllowOpenAIFallback,
    setAllowLocalFallback,
    setFallbackWhisperModel,
    setPreferredLanguage,
    setCloudTranscriptionBaseUrl,
    setCloudReasoningBaseUrl,
    setUseReasoningModel,
    setReasoningModel,
    setReasoningProvider: (provider: string) => {
      if (provider === 'custom') {
        return;
      }

      const providerModels = {
        openai: "gpt-4o-mini", // Start with cost-efficient multimodal model
        anthropic: "claude-3.5-sonnet-20241022",
        gemini: "gemini-2.5-flash",
        groq: "qwen/qwen3-32b", // Groq's powerful reasoning model
        local: "llama-3.2-3b",
      };
      setReasoningModel(
        providerModels[provider as keyof typeof providerModels] ||
          "gpt-4o-mini"
      );
    },
    setOpenaiApiKey,
    setAnthropicApiKey,
    setGeminiApiKey,
    setGroqApiKey,
    setDictationKey,
    updateTranscriptionSettings,
    updateReasoningSettings,
    updateApiKeys,
  };
}
