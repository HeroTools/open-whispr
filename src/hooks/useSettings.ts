import { useCallback, useEffect, useRef } from "react";
import { useLocalStorage } from "./useLocalStorage";
import { getModelProvider } from "../models/ModelRegistry";
import { API_ENDPOINTS } from "../config/constants";
import ReasoningService from "../services/ReasoningService";

export interface TranscriptionSettings {
  useLocalWhisper: boolean;
  whisperModel: string;
  allowOpenAIFallback: boolean;
  allowLocalFallback: boolean;
  fallbackWhisperModel: string;
  preferredLanguage: string;
  cloudTranscriptionProvider: string;
  cloudTranscriptionModel: string;
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
  activationMode: "tap" | "push";
}

export interface MicrophoneSettings {
  preferBuiltInMic: boolean;
  selectedMicDeviceId: string;
}

export interface ApiKeySettings {
  openaiApiKey: string;
  anthropicApiKey: string;
  geminiApiKey: string;
  groqApiKey: string;
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

  const [cloudTranscriptionProvider, setCloudTranscriptionProvider] = useLocalStorage(
    "cloudTranscriptionProvider",
    "openai",
    {
      serialize: String,
      deserialize: String,
    }
  );

  const [cloudTranscriptionModel, setCloudTranscriptionModel] = useLocalStorage(
    "cloudTranscriptionModel",
    "gpt-4o-mini-transcribe",
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
  const [useReasoningModel, setUseReasoningModel] = useLocalStorage("useReasoningModel", true, {
    serialize: String,
    deserialize: (value) => value !== "false", // Default true
  });

  const [reasoningModel, setReasoningModel] = useLocalStorage("reasoningModel", "", {
    serialize: String,
    deserialize: String,
  });

  // API keys - localStorage for UI, synced to Electron IPC for persistence
  const [openaiApiKey, setOpenaiApiKeyLocal] = useLocalStorage("openaiApiKey", "", {
    serialize: String,
    deserialize: String,
  });

  const [anthropicApiKey, setAnthropicApiKeyLocal] = useLocalStorage("anthropicApiKey", "", {
    serialize: String,
    deserialize: String,
  });

  const [geminiApiKey, setGeminiApiKeyLocal] = useLocalStorage("geminiApiKey", "", {
    serialize: String,
    deserialize: String,
  });

  const [groqApiKey, setGroqApiKeyLocal] = useLocalStorage("groqApiKey", "", {
    serialize: String,
    deserialize: String,
  });

  // Sync API keys from main process on first mount (if localStorage was cleared)
  const hasRunApiKeySync = useRef(false);
  useEffect(() => {
    if (hasRunApiKeySync.current) return;
    hasRunApiKeySync.current = true;

    const syncKeys = async () => {
      if (typeof window === "undefined" || !window.electronAPI) return;

      // Only sync keys that are missing from localStorage
      if (!openaiApiKey) {
        const envKey = await window.electronAPI.getOpenAIKey?.();
        if (envKey) setOpenaiApiKeyLocal(envKey);
      }
      if (!anthropicApiKey) {
        const envKey = await window.electronAPI.getAnthropicKey?.();
        if (envKey) setAnthropicApiKeyLocal(envKey);
      }
      if (!geminiApiKey) {
        const envKey = await window.electronAPI.getGeminiKey?.();
        if (envKey) setGeminiApiKeyLocal(envKey);
      }
      if (!groqApiKey) {
        const envKey = await window.electronAPI.getGroqKey?.();
        if (envKey) setGroqApiKeyLocal(envKey);
      }
    };

    syncKeys().catch(() => {
      // Silently ignore sync errors
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount - ref ensures this never runs twice

  // Wrapped setters that sync to Electron IPC and invalidate cache
  const setOpenaiApiKey = useCallback(
    (key: string) => {
      setOpenaiApiKeyLocal(key);
      window.electronAPI?.saveOpenAIKey?.(key);
      ReasoningService.clearApiKeyCache("openai");
    },
    [setOpenaiApiKeyLocal]
  );

  const setAnthropicApiKey = useCallback(
    (key: string) => {
      setAnthropicApiKeyLocal(key);
      window.electronAPI?.saveAnthropicKey?.(key);
      ReasoningService.clearApiKeyCache("anthropic");
    },
    [setAnthropicApiKeyLocal]
  );

  const setGeminiApiKey = useCallback(
    (key: string) => {
      setGeminiApiKeyLocal(key);
      window.electronAPI?.saveGeminiKey?.(key);
      ReasoningService.clearApiKeyCache("gemini");
    },
    [setGeminiApiKeyLocal]
  );

  const setGroqApiKey = useCallback(
    (key: string) => {
      setGroqApiKeyLocal(key);
      window.electronAPI?.saveGroqKey?.(key);
      ReasoningService.clearApiKeyCache("groq");
    },
    [setGroqApiKeyLocal]
  );

  // Hotkey
  const [dictationKey, setDictationKey] = useLocalStorage("dictationKey", "", {
    serialize: String,
    deserialize: String,
  });

  const [activationMode, setActivationMode] = useLocalStorage<"tap" | "push">(
    "activationMode",
    "tap",
    {
      serialize: String,
      deserialize: (value) => (value === "push" ? "push" : "tap"),
    }
  );

  // Microphone settings
  const [preferBuiltInMic, setPreferBuiltInMic] = useLocalStorage("preferBuiltInMic", true, {
    serialize: String,
    deserialize: (value) => value !== "false",
  });

  const [selectedMicDeviceId, setSelectedMicDeviceId] = useLocalStorage("selectedMicDeviceId", "", {
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
      if (settings.cloudTranscriptionProvider !== undefined)
        setCloudTranscriptionProvider(settings.cloudTranscriptionProvider);
      if (settings.cloudTranscriptionModel !== undefined)
        setCloudTranscriptionModel(settings.cloudTranscriptionModel);
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
      setCloudTranscriptionProvider,
      setCloudTranscriptionModel,
      setCloudTranscriptionBaseUrl,
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
      if (keys.groqApiKey !== undefined) setGroqApiKey(keys.groqApiKey);
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
    cloudTranscriptionProvider,
    cloudTranscriptionModel,
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
    setCloudTranscriptionProvider,
    setCloudTranscriptionModel,
    setCloudTranscriptionBaseUrl,
    setCloudReasoningBaseUrl,
    setUseReasoningModel,
    setReasoningModel,
    setReasoningProvider: (provider: string) => {
      if (provider !== "custom") {
        setReasoningModel("");
      }
    },
    setOpenaiApiKey,
    setAnthropicApiKey,
    setGeminiApiKey,
    setGroqApiKey,
    setDictationKey,
    activationMode,
    setActivationMode,
    preferBuiltInMic,
    selectedMicDeviceId,
    setPreferBuiltInMic,
    setSelectedMicDeviceId,
    updateTranscriptionSettings,
    updateReasoningSettings,
    updateApiKeys,
  };
}
