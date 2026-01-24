import { useCallback, useEffect, useRef } from "react";
import { useLocalStorage } from "./useLocalStorage";
import { useDebouncedCallback } from "./useDebouncedCallback";
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
  // Dictation (transcription) API keys
  dictation_openaiApiKey: string;
  dictation_groqApiKey: string;
  dictation_customApiKey: string;

  // Post-processing (reasoning) API keys
  reasoning_openaiApiKey: string;
  reasoning_anthropicApiKey: string;
  reasoning_geminiApiKey: string;
  reasoning_groqApiKey: string;
  reasoning_customApiKey: string;
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
  // New separate keys for dictation and reasoning
  const [dictation_openaiApiKey, setDictation_OpenaiApiKeyLocal] = useLocalStorage(
    "dictation_openaiApiKey",
    "",
    { serialize: String, deserialize: String }
  );

  const [dictation_groqApiKey, setDictation_GroqApiKeyLocal] = useLocalStorage(
    "dictation_groqApiKey",
    "",
    { serialize: String, deserialize: String }
  );

  const [dictation_customApiKey, setDictation_CustomApiKeyLocal] = useLocalStorage(
    "dictation_customApiKey",
    "",
    { serialize: String, deserialize: String }
  );

  const [reasoning_openaiApiKey, setReasoning_OpenaiApiKeyLocal] = useLocalStorage(
    "reasoning_openaiApiKey",
    "",
    { serialize: String, deserialize: String }
  );

  const [reasoning_anthropicApiKey, setReasoning_AnthropicApiKeyLocal] = useLocalStorage(
    "reasoning_anthropicApiKey",
    "",
    { serialize: String, deserialize: String }
  );

  const [reasoning_geminiApiKey, setReasoning_GeminiApiKeyLocal] = useLocalStorage(
    "reasoning_geminiApiKey",
    "",
    { serialize: String, deserialize: String }
  );

  const [reasoning_groqApiKey, setReasoning_GroqApiKeyLocal] = useLocalStorage(
    "reasoning_groqApiKey",
    "",
    { serialize: String, deserialize: String }
  );

  const [reasoning_customApiKey, setReasoning_CustomApiKeyLocal] = useLocalStorage(
    "reasoning_customApiKey",
    "",
    { serialize: String, deserialize: String }
  );

  // Legacy keys for backward compatibility - will be migrated on first load
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
  // Also migrate from legacy keys to new separated keys
  const hasRunApiKeySync = useRef(false);
  useEffect(() => {
    if (hasRunApiKeySync.current) return;
    hasRunApiKeySync.current = true;

    const syncKeys = async () => {
      if (typeof window === "undefined" || !window.electronAPI) return;

      // MIGRATION: Copy legacy keys to new separated keys if they exist
      if (openaiApiKey && !dictation_openaiApiKey && !reasoning_openaiApiKey) {
        setDictation_OpenaiApiKeyLocal(openaiApiKey);
        setReasoning_OpenaiApiKeyLocal(openaiApiKey);
        window.electronAPI?.saveDictationOpenAIKey?.(openaiApiKey);
        window.electronAPI?.saveReasoningOpenAIKey?.(openaiApiKey);
      }

      if (groqApiKey && !dictation_groqApiKey && !reasoning_groqApiKey) {
        setDictation_GroqApiKeyLocal(groqApiKey);
        setReasoning_GroqApiKeyLocal(groqApiKey);
        window.electronAPI?.saveDictationGroqKey?.(groqApiKey);
        window.electronAPI?.saveReasoningGroqKey?.(groqApiKey);
      }

      if (anthropicApiKey && !reasoning_anthropicApiKey) {
        setReasoning_AnthropicApiKeyLocal(anthropicApiKey);
        window.electronAPI?.saveReasoningAnthropicKey?.(anthropicApiKey);
      }

      if (geminiApiKey && !reasoning_geminiApiKey) {
        setReasoning_GeminiApiKeyLocal(geminiApiKey);
        window.electronAPI?.saveReasoningGeminiKey?.(geminiApiKey);
      }

      // Sync new separated keys from environment if localStorage is empty
      if (!dictation_openaiApiKey) {
        const envKey = await window.electronAPI.getDictationOpenAIKey?.();
        if (envKey) setDictation_OpenaiApiKeyLocal(envKey);
      }

      if (!dictation_groqApiKey) {
        const envKey = await window.electronAPI.getDictationGroqKey?.();
        if (envKey) setDictation_GroqApiKeyLocal(envKey);
      }

      if (!dictation_customApiKey) {
        const envKey = await window.electronAPI.getDictationCustomKey?.();
        if (envKey) setDictation_CustomApiKeyLocal(envKey);
      }

      if (!reasoning_openaiApiKey) {
        const envKey = await window.electronAPI.getReasoningOpenAIKey?.();
        if (envKey) setReasoning_OpenaiApiKeyLocal(envKey);
      }

      if (!reasoning_anthropicApiKey) {
        const envKey = await window.electronAPI.getReasoningAnthropicKey?.();
        if (envKey) setReasoning_AnthropicApiKeyLocal(envKey);
      }

      if (!reasoning_geminiApiKey) {
        const envKey = await window.electronAPI.getReasoningGeminiKey?.();
        if (envKey) setReasoning_GeminiApiKeyLocal(envKey);
      }

      if (!reasoning_groqApiKey) {
        const envKey = await window.electronAPI.getReasoningGroqKey?.();
        if (envKey) setReasoning_GroqApiKeyLocal(envKey);
      }

      if (!reasoning_customApiKey) {
        const envKey = await window.electronAPI.getReasoningCustomKey?.();
        if (envKey) setReasoning_CustomApiKeyLocal(envKey);
      }
    };

    syncKeys().catch(() => {
      // Silently ignore sync errors
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const debouncedPersistToEnv = useDebouncedCallback(() => {
    if (typeof window !== "undefined" && window.electronAPI?.saveAllKeysToEnv) {
      window.electronAPI.saveAllKeysToEnv().catch(() => {
        // Silently ignore persistence errors
      });
    }
  }, 1000);

  // Wrapped setters that sync to Electron IPC and invalidate cache
  // NEW: Separate setters for dictation and reasoning keys
  const setDictation_OpenaiApiKey = useCallback(
    (key: string) => {
      setDictation_OpenaiApiKeyLocal(key);
      window.electronAPI?.saveDictationOpenAIKey?.(key);
      debouncedPersistToEnv();
    },
    [setDictation_OpenaiApiKeyLocal, debouncedPersistToEnv]
  );

  const setDictation_GroqApiKey = useCallback(
    (key: string) => {
      setDictation_GroqApiKeyLocal(key);
      window.electronAPI?.saveDictationGroqKey?.(key);
      debouncedPersistToEnv();
    },
    [setDictation_GroqApiKeyLocal, debouncedPersistToEnv]
  );

  const setDictation_CustomApiKey = useCallback(
    (key: string) => {
      setDictation_CustomApiKeyLocal(key);
      window.electronAPI?.saveDictationCustomKey?.(key);
      debouncedPersistToEnv();
    },
    [setDictation_CustomApiKeyLocal, debouncedPersistToEnv]
  );

  const setReasoning_OpenaiApiKey = useCallback(
    (key: string) => {
      setReasoning_OpenaiApiKeyLocal(key);
      window.electronAPI?.saveReasoningOpenAIKey?.(key);
      ReasoningService.clearApiKeyCache("openai");
      debouncedPersistToEnv();
    },
    [setReasoning_OpenaiApiKeyLocal, debouncedPersistToEnv]
  );

  const setReasoning_AnthropicApiKey = useCallback(
    (key: string) => {
      setReasoning_AnthropicApiKeyLocal(key);
      window.electronAPI?.saveReasoningAnthropicKey?.(key);
      ReasoningService.clearApiKeyCache("anthropic");
      debouncedPersistToEnv();
    },
    [setReasoning_AnthropicApiKeyLocal, debouncedPersistToEnv]
  );

  const setReasoning_GeminiApiKey = useCallback(
    (key: string) => {
      setReasoning_GeminiApiKeyLocal(key);
      window.electronAPI?.saveReasoningGeminiKey?.(key);
      ReasoningService.clearApiKeyCache("gemini");
      debouncedPersistToEnv();
    },
    [setReasoning_GeminiApiKeyLocal, debouncedPersistToEnv]
  );

  const setReasoning_GroqApiKey = useCallback(
    (key: string) => {
      setReasoning_GroqApiKeyLocal(key);
      window.electronAPI?.saveReasoningGroqKey?.(key);
      ReasoningService.clearApiKeyCache("groq");
      debouncedPersistToEnv();
    },
    [setReasoning_GroqApiKeyLocal, debouncedPersistToEnv]
  );

  const setReasoning_CustomApiKey = useCallback(
    (key: string) => {
      setReasoning_CustomApiKeyLocal(key);
      window.electronAPI?.saveReasoningCustomKey?.(key);
      debouncedPersistToEnv();
    },
    [setReasoning_CustomApiKeyLocal, debouncedPersistToEnv]
  );

  // LEGACY: Keep old setters for backward compatibility (will update both dictation and reasoning)
  const setOpenaiApiKey = useCallback(
    (key: string) => {
      setOpenaiApiKeyLocal(key);
      setDictation_OpenaiApiKeyLocal(key);
      setReasoning_OpenaiApiKeyLocal(key);
      window.electronAPI?.saveOpenAIKey?.(key);
      window.electronAPI?.saveDictationOpenAIKey?.(key);
      window.electronAPI?.saveReasoningOpenAIKey?.(key);
      ReasoningService.clearApiKeyCache("openai");
      debouncedPersistToEnv();
    },
    [setOpenaiApiKeyLocal, setDictation_OpenaiApiKeyLocal, setReasoning_OpenaiApiKeyLocal, debouncedPersistToEnv]
  );

  const setAnthropicApiKey = useCallback(
    (key: string) => {
      setAnthropicApiKeyLocal(key);
      setReasoning_AnthropicApiKeyLocal(key);
      window.electronAPI?.saveAnthropicKey?.(key);
      window.electronAPI?.saveReasoningAnthropicKey?.(key);
      ReasoningService.clearApiKeyCache("anthropic");
      debouncedPersistToEnv();
    },
    [setAnthropicApiKeyLocal, setReasoning_AnthropicApiKeyLocal, debouncedPersistToEnv]
  );

  const setGeminiApiKey = useCallback(
    (key: string) => {
      setGeminiApiKeyLocal(key);
      setReasoning_GeminiApiKeyLocal(key);
      window.electronAPI?.saveGeminiKey?.(key);
      window.electronAPI?.saveReasoningGeminiKey?.(key);
      ReasoningService.clearApiKeyCache("gemini");
      debouncedPersistToEnv();
    },
    [setGeminiApiKeyLocal, setReasoning_GeminiApiKeyLocal, debouncedPersistToEnv]
  );

  const setGroqApiKey = useCallback(
    (key: string) => {
      setGroqApiKeyLocal(key);
      setDictation_GroqApiKeyLocal(key);
      setReasoning_GroqApiKeyLocal(key);
      window.electronAPI?.saveGroqKey?.(key);
      window.electronAPI?.saveDictationGroqKey?.(key);
      window.electronAPI?.saveReasoningGroqKey?.(key);
      ReasoningService.clearApiKeyCache("groq");
      debouncedPersistToEnv();
    },
    [setGroqApiKeyLocal, setDictation_GroqApiKeyLocal, setReasoning_GroqApiKeyLocal, debouncedPersistToEnv]
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
      // NEW separated keys
      if (keys.dictation_openaiApiKey !== undefined)
        setDictation_OpenaiApiKey(keys.dictation_openaiApiKey);
      if (keys.dictation_groqApiKey !== undefined) setDictation_GroqApiKey(keys.dictation_groqApiKey);
      if (keys.dictation_customApiKey !== undefined)
        setDictation_CustomApiKey(keys.dictation_customApiKey);
      if (keys.reasoning_openaiApiKey !== undefined)
        setReasoning_OpenaiApiKey(keys.reasoning_openaiApiKey);
      if (keys.reasoning_anthropicApiKey !== undefined)
        setReasoning_AnthropicApiKey(keys.reasoning_anthropicApiKey);
      if (keys.reasoning_geminiApiKey !== undefined)
        setReasoning_GeminiApiKey(keys.reasoning_geminiApiKey);
      if (keys.reasoning_groqApiKey !== undefined)
        setReasoning_GroqApiKey(keys.reasoning_groqApiKey);
      if (keys.reasoning_customApiKey !== undefined)
        setReasoning_CustomApiKey(keys.reasoning_customApiKey);

      // LEGACY keys (still supported for backward compatibility)
      if (keys.openaiApiKey !== undefined) setOpenaiApiKey(keys.openaiApiKey);
      if (keys.anthropicApiKey !== undefined) setAnthropicApiKey(keys.anthropicApiKey);
      if (keys.geminiApiKey !== undefined) setGeminiApiKey(keys.geminiApiKey);
      if (keys.groqApiKey !== undefined) setGroqApiKey(keys.groqApiKey);
    },
    [
      setDictation_OpenaiApiKey,
      setDictation_GroqApiKey,
      setDictation_CustomApiKey,
      setReasoning_OpenaiApiKey,
      setReasoning_AnthropicApiKey,
      setReasoning_GeminiApiKey,
      setReasoning_GroqApiKey,
      setReasoning_CustomApiKey,
      setOpenaiApiKey,
      setAnthropicApiKey,
      setGeminiApiKey,
      setGroqApiKey,
    ]
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

    // NEW: Separated API keys
    dictation_openaiApiKey,
    dictation_groqApiKey,
    dictation_customApiKey,
    reasoning_openaiApiKey,
    reasoning_anthropicApiKey,
    reasoning_geminiApiKey,
    reasoning_groqApiKey,
    reasoning_customApiKey,

    // LEGACY: Keep for backward compatibility
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

    // NEW: Separated setters
    setDictation_OpenaiApiKey,
    setDictation_GroqApiKey,
    setDictation_CustomApiKey,
    setReasoning_OpenaiApiKey,
    setReasoning_AnthropicApiKey,
    setReasoning_GeminiApiKey,
    setReasoning_GroqApiKey,
    setReasoning_CustomApiKey,

    // LEGACY: Keep for backward compatibility
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
