import ReasoningService from "../services/ReasoningService";
import { API_ENDPOINTS, buildApiUrl, normalizeBaseUrl } from "../config/constants";

const isDebugMode = typeof process !== 'undefined' && (process.env.OPENWHISPR_DEBUG === 'true' || process.env.NODE_ENV === 'development');
const SHORT_CLIP_DURATION_SECONDS = 2.5;
const REASONING_CACHE_TTL = 30000; // 30 seconds

const debugLogger = {
  logReasoning: async (stage, details) => {
    if (!isDebugMode) return;

    if (window.electronAPI?.logReasoning) {
      try {
        await window.electronAPI.logReasoning(stage, details);
      } catch (error) {
        // Silent fail
      }
    }
  }
};


class AudioManager {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.isProcessing = false;
    this.onStateChange = null;
    this.onError = null;
    this.onTranscriptionComplete = null;
    this.cachedApiKey = null;
    this.cachedTranscriptionEndpoint = null;
    this.recordingStartTime = null;
    this.reasoningAvailabilityCache = { value: false, expiresAt: 0 };
    this.cachedReasoningPreference = null;
  }

  setCallbacks({ onStateChange, onError, onTranscriptionComplete }) {
    this.onStateChange = onStateChange;
    this.onError = onError;
    this.onTranscriptionComplete = onTranscriptionComplete;
  }

  async startRecording() {
    try {
      if (this.isRecording) {
        return false;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });


      this.mediaRecorder = new MediaRecorder(stream);
      this.mimeType = this.mediaRecorder.mimeType;
      this.audioChunks = [];
      this.recordingStartTime = Date.now();

      this.mediaRecorder.ondataavailable = (event) => {
        this.audioChunks.push(event.data);
      };

      this.mediaRecorder.onstop = async () => {
        this.isRecording = false;
        this.isProcessing = true;
        this.onStateChange?.({ isRecording: false, isProcessing: true });

        const audioBlob = new Blob(this.audioChunks, { type: this.mimeType || "audio/webm" });

        if (audioBlob.size === 0) {
        }

        const durationSeconds = this.recordingStartTime
          ? (Date.now() - this.recordingStartTime) / 1000
          : null;
        this.recordingStartTime = null;
        await this.processAudio(audioBlob, { durationSeconds });

        // Clean up stream
        stream.getTracks().forEach((track) => track.stop());
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      this.onStateChange?.({ isRecording: true, isProcessing: false });

      return true;
    } catch (error) {

      // Provide more specific error messages
      let errorTitle = "Recording Error";
      let errorDescription = `Failed to access microphone: ${error.message}`;

      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        errorTitle = "Microphone Access Denied";
        errorDescription = "Please grant microphone permission in your system settings and try again.";
      } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        errorTitle = "No Microphone Found";
        errorDescription = "No microphone was detected. Please connect a microphone and try again.";
      } else if (error.name === "NotReadableError" || error.name === "TrackStartError") {
        errorTitle = "Microphone In Use";
        errorDescription = "The microphone is being used by another application. Please close other apps and try again.";
      }

      this.onError?.({
        title: errorTitle,
        description: errorDescription,
      });
      return false;
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      // State change will be handled in onstop callback
      return true;
    }
    return false;
  }

  async processAudio(audioBlob, metadata = {}) {
    try {
      const useLocalWhisper = localStorage.getItem("useLocalWhisper") === "true";
      const whisperModel = localStorage.getItem("whisperModel") || "base";



      window.electronAPI?.logPerf?.(`[Perf] processAudio. useLocalWhisper=${useLocalWhisper}, model=${whisperModel}`);

      let result;
      if (useLocalWhisper) {
        result = await this.processWithLocalWhisper(audioBlob, whisperModel, metadata);
      } else {
        result = await this.processWithOpenAIAPI(audioBlob, metadata);
      }
      this.onTranscriptionComplete?.(result);
    } catch (error) {
      if (error.message !== "No audio detected") {
        this.onError?.({
          title: "Transcription Error",
          description: `Transcription failed: ${error.message}`,
        });
      }
    } finally {
      this.isProcessing = false;
      this.onStateChange?.({ isRecording: false, isProcessing: false });
    }
  }

  async processWithLocalWhisper(audioBlob, model = "base", metadata = {}) {
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const language = localStorage.getItem("preferredLanguage");
      const options = { model };
      if (language && language !== "auto") {
        options.language = language;
      }

      const result = await window.electronAPI.transcribeLocalWhisper(
        arrayBuffer,
        options
      );

      if (result.success && result.text) {
        const text = await this.processTranscription(result.text, "local");
        if (text !== null && text !== undefined) {
          return { success: true, text: text || result.text, source: "local" };
        } else {
          throw new Error("No text transcribed");
        }
      } else if (result.success === false && result.message === "No audio detected") {
        this.onError?.({
          title: "No Audio Detected",
          description: "The recording contained no detectable audio. Please check your microphone settings.",
        });
        throw new Error("No audio detected");
      } else {
        throw new Error(result.error || "Local Whisper transcription failed");
      }
    } catch (error) {
      if (error.message === "No audio detected") {
        throw error;
      }

      const allowOpenAIFallback = localStorage.getItem("allowOpenAIFallback") === "true";
      const isLocalMode = localStorage.getItem("useLocalWhisper") === "true";

      if (allowOpenAIFallback && isLocalMode) {
        try {
          const fallbackResult = await this.processWithOpenAIAPI(audioBlob, metadata);
          return { ...fallbackResult, source: "openai-fallback" };
        } catch (fallbackError) {
          throw new Error(`Local Whisper failed: ${error.message}. OpenAI fallback also failed: ${fallbackError.message}`);
        }
      } else {
        throw new Error(`Local Whisper failed: ${error.message}`);
      }
    }
  }

  async getAPIKey() {
    if (this.cachedApiKey) {
      return this.cachedApiKey;
    }

    let apiKey = await window.electronAPI.getOpenAIKey();
    if (
      !apiKey ||
      apiKey.trim() === "" ||
      apiKey === "your_openai_api_key_here"
    ) {
      apiKey = localStorage.getItem("openaiApiKey");
    }

    if (
      !apiKey ||
      apiKey.trim() === "" ||
      apiKey === "your_openai_api_key_here"
    ) {
      throw new Error(
        "OpenAI API key not found. Please set your API key in the .env file or Control Panel."
      );
    }

    this.cachedApiKey = apiKey;
    return apiKey;
  }

  async optimizeAudio(audioBlob) {
    return new Promise((resolve) => {
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      const reader = new FileReader();

      reader.onload = async () => {
        try {
          const arrayBuffer = reader.result;
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

          // Convert to 16kHz mono for smaller size and faster upload
          const sampleRate = 16000;
          const channels = 1;
          const length = Math.floor(audioBuffer.duration * sampleRate);
          const offlineContext = new OfflineAudioContext(
            channels,
            length,
            sampleRate
          );

          const source = offlineContext.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(offlineContext.destination);
          source.start();

          const renderedBuffer = await offlineContext.startRendering();
          const wavBlob = this.audioBufferToWav(renderedBuffer);
          resolve(wavBlob);
        } catch (error) {
          // If optimization fails, use original
          resolve(audioBlob);
        }
      };

      reader.onerror = () => resolve(audioBlob);
      reader.readAsArrayBuffer(audioBlob);
    });
  }

  audioBufferToWav(buffer) {
    const length = buffer.length;
    const arrayBuffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(arrayBuffer);
    const sampleRate = buffer.sampleRate;
    const channelData = buffer.getChannelData(0);

    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + length * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, length * 2, true);

    let offset = 44;
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      view.setInt16(
        offset,
        sample < 0 ? sample * 0x8000 : sample * 0x7fff,
        true
      );
      offset += 2;
    }

    return new Blob([arrayBuffer], { type: "audio/wav" });
  }

  async processWithReasoningModel(text, model, agentName) {
    const perfStart = Date.now();
    window.electronAPI?.logPerf?.(`[Perf][Reasoning] Starting reasoning call. Model: ${model}, Text length: ${text.length}`);

    debugLogger.logReasoning("CALLING_REASONING_SERVICE", {
      model,
      agentName,
      textLength: text.length
    });

    const startTime = Date.now();

    try {
      window.electronAPI?.logPerf?.(`[Perf][Reasoning] About to call ReasoningService.processText...`);
      const serviceCallStart = Date.now();
      const result = await ReasoningService.processText(text, model, agentName);
      window.electronAPI?.logPerf?.(`[Perf][Reasoning] ReasoningService.processText returned in: ${Date.now() - serviceCallStart}ms`);

      const processingTime = Date.now() - startTime;

      debugLogger.logReasoning("REASONING_SERVICE_COMPLETE", {
        model,
        processingTimeMs: processingTime,
        resultLength: result.length,
        success: true
      });

      window.electronAPI?.logPerf?.(`[Perf][Reasoning] Total reasoning time: ${Date.now() - perfStart}ms`);
      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;

      debugLogger.logReasoning("REASONING_SERVICE_ERROR", {
        model,
        processingTimeMs: processingTime,
        error: error.message,
        stack: error.stack
      });

      window.electronAPI?.logPerf?.(`[Perf][Reasoning] FAILED in ${Date.now() - perfStart}ms. Error: ${error.message}`);
      throw error;
    }
  }

  async isReasoningAvailable() {
    if (typeof window === "undefined" || !window.localStorage) {
      return false;
    }

    const storedValue = localStorage.getItem("useReasoningModel");
    const now = Date.now();
    const cacheValid =
      this.reasoningAvailabilityCache &&
      now < this.reasoningAvailabilityCache.expiresAt &&
      this.cachedReasoningPreference === storedValue;

    if (cacheValid) {
      return this.reasoningAvailabilityCache.value;
    }

    debugLogger.logReasoning("REASONING_STORAGE_CHECK", {
      storedValue,
      typeOfStoredValue: typeof storedValue,
      isTrue: storedValue === "true",
      isTruthy: !!storedValue && storedValue !== "false",
    });

    const useReasoning =
      storedValue === "true" || (!!storedValue && storedValue !== "false");

    if (!useReasoning) {
      this.reasoningAvailabilityCache = {
        value: false,
        expiresAt: now + REASONING_CACHE_TTL,
      };
      this.cachedReasoningPreference = storedValue;
      return false;
    }

    try {
      const isAvailable = await ReasoningService.isAvailable();

      debugLogger.logReasoning("REASONING_AVAILABILITY", {
        isAvailable,
        reasoningEnabled: useReasoning,
        finalDecision: useReasoning && isAvailable,
      });

      this.reasoningAvailabilityCache = {
        value: isAvailable,
        expiresAt: now + REASONING_CACHE_TTL,
      };
      this.cachedReasoningPreference = storedValue;

      return isAvailable;
    } catch (error) {
      debugLogger.logReasoning("REASONING_AVAILABILITY_ERROR", {
        error: error.message,
        stack: error.stack,
      });

      this.reasoningAvailabilityCache = {
        value: false,
        expiresAt: now + REASONING_CACHE_TTL,
      };
      this.cachedReasoningPreference = storedValue;
      return false;
    }
  }

  async processTranscription(text, source) {
    const normalizedText = typeof text === "string" ? text.trim() : "";

    debugLogger.logReasoning("TRANSCRIPTION_RECEIVED", {
      source,
      textLength: normalizedText.length,
      textPreview: normalizedText.substring(0, 100) + (normalizedText.length > 100 ? "..." : ""),
      timestamp: new Date().toISOString()
    });

    const reasoningModel = (typeof window !== 'undefined' && window.localStorage)
      ? (localStorage.getItem("reasoningModel") || "gpt-4o-mini")
      : "gpt-4o-mini";
    const reasoningProvider = (typeof window !== 'undefined' && window.localStorage)
      ? (localStorage.getItem("reasoningProvider") || "auto")
      : "auto";
    const agentName = (typeof window !== 'undefined' && window.localStorage)
      ? (localStorage.getItem("agentName") || null)
      : null;

    // Skip reasoning for very short texts
    if (normalizedText.length < 10) {
      debugLogger.logReasoning("SKIPPING_REASONING", {
        reason: "Text too short",
        textLength: normalizedText.length,
        text: normalizedText
      });
      return normalizedText;
    }

    const useReasoning = await this.isReasoningAvailable();

    debugLogger.logReasoning("REASONING_CHECK", {
      useReasoning,
      reasoningModel,
      reasoningProvider,
      agentName
    });

    if (useReasoning) {
      try {
        const preparedText = normalizedText;

        debugLogger.logReasoning("SENDING_TO_REASONING", {
          preparedTextLength: preparedText.length,
          model: reasoningModel,
          provider: reasoningProvider
        });

        const result = await this.processWithReasoningModel(preparedText, reasoningModel, agentName);

        debugLogger.logReasoning("REASONING_SUCCESS", {
          resultLength: result.length,
          resultPreview: result.substring(0, 100) + (result.length > 100 ? "..." : ""),
          processingTime: new Date().toISOString()
        });

        return result;
      } catch (error) {
        debugLogger.logReasoning("REASONING_FAILED", {
          error: error.message,
          stack: error.stack,
          fallbackToCleanup: true
        });
        console.error(`Reasoning failed (${source}):`, error.message);
      }
    }

    debugLogger.logReasoning("USING_STANDARD_CLEANUP", {
      reason: useReasoning ? "Reasoning failed" : "Reasoning not enabled"
    });

    // Apply fast local cleanup to remove filler words
    return this.cleanupFillerWords(normalizedText);
  }

  cleanupFillerWords(text) {
    // Remove common filler words and clean up the text
    return text
      // Remove standalone filler words (with word boundaries)
      .replace(/\b(um|uh|ah|er|like|you know|i mean)\b/gi, '')
      // Remove repeated filler sounds
      .replace(/\b(uh+|um+|ah+|er+)\b/gi, '')
      // Clean up multiple spaces
      .replace(/\s+/g, ' ')
      // Clean up spaces before punctuation
      .replace(/\s+([.,!?;:])/g, '$1')
      // Trim whitespace
      .trim();
  }

  async processWithOpenAIAPI(audioBlob, metadata = {}) {
    const language = localStorage.getItem("preferredLanguage");
    const allowLocalFallback =
      localStorage.getItem("allowLocalFallback") === "true";
    const fallbackModel = localStorage.getItem("fallbackWhisperModel") || "base";

    try {

      const startTime = Date.now();
      const durationSeconds = metadata.durationSeconds ?? null;
      window.electronAPI?.logPerf?.(`[Perf] Starting Cloud Processing. Blob size: ${audioBlob.size} bytes (${(audioBlob.size / 1024).toFixed(1)} KB), Duration: ${durationSeconds ? durationSeconds.toFixed(2) + 's' : 'unknown'}`);

      const shouldSkipOptimizationForDuration =
        typeof durationSeconds === "number" &&
        durationSeconds > 0 &&
        durationSeconds < SHORT_CLIP_DURATION_SECONDS;

      const shouldOptimize =
        !shouldSkipOptimizationForDuration && audioBlob.size > 1024 * 1024;

      window.electronAPI?.logPerf?.(`[Perf] Should optimize? ${shouldOptimize} (Duration: ${durationSeconds}s)`);

      const optimizationStart = Date.now();
      const [apiKey, optimizedAudio] = await Promise.all([
        this.getAPIKey(),
        shouldOptimize ? this.optimizeAudio(audioBlob) : Promise.resolve(audioBlob),
      ]);
      window.electronAPI?.logPerf?.(`[Perf] Optimization/Key fetch took: ${Date.now() - optimizationStart}ms. Final audio size: ${optimizedAudio.size} bytes`);

      const formData = new FormData();
      const extension = optimizedAudio.type.includes("wav") ? "wav" : "webm";
      formData.append("file", optimizedAudio, `audio.${extension}`);
      formData.append("model", this.getTranscriptionModel());


      const endpoint = this.getTranscriptionEndpoint();
      window.electronAPI?.logPerf?.(`[Debug] Transcription Endpoint: ${endpoint}`);
      window.electronAPI?.logPerf?.(`[Debug] API Key present: ${!!apiKey} (Length: ${apiKey?.length})`);
      window.electronAPI?.logPerf?.(`[Debug] FormData keys: ${Array.from(formData.keys()).join(", ")}`);

      const apiStart = Date.now();
      const response = await fetch(
        endpoint,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          body: formData,
        }
      );

      window.electronAPI?.logPerf?.(`[Perf] API Response received in: ${Date.now() - apiStart}ms. Status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      window.electronAPI?.logPerf?.(`[Perf] Total processing time: ${Date.now() - startTime}ms`);

      if (result.text) {
        window.electronAPI?.logPerf?.(`[Perf] Starting post-processing...`);
        const postStart = Date.now();
        const text = await this.processTranscription(result.text, "openai");
        window.electronAPI?.logPerf?.(`[Perf] processTranscription took: ${Date.now() - postStart}ms`);

        const reasoningStart = Date.now();
        const source = await this.isReasoningAvailable() ? "openai-reasoned" : "openai";
        window.electronAPI?.logPerf?.(`[Perf] isReasoningAvailable check took: ${Date.now() - reasoningStart}ms`);
        window.electronAPI?.logPerf?.(`[Perf] Total post-processing time: ${Date.now() - postStart}ms`);
        return { success: true, text, source };
      } else {
        throw new Error("No text transcribed");
      }
    } catch (error) {
      window.electronAPI?.logPerf?.(`[Perf] Cloud Processing FAILED. Error: ${error.message}`);
      const isOpenAIMode = localStorage.getItem("useLocalWhisper") !== "true";

      if (allowLocalFallback && isOpenAIMode) {
        window.electronAPI?.logPerf?.(`[Perf] Falling back to Local Whisper...`);
        try {
          const arrayBuffer = await audioBlob.arrayBuffer();
          const options = { model: fallbackModel };
          if (language && language !== "auto") {
            options.language = language;
          }

          const result = await window.electronAPI.transcribeLocalWhisper(
            arrayBuffer,
            options
          );

          if (result.success && result.text) {
            const text = await this.processTranscription(result.text, "local-fallback");
            if (text) {
              return { success: true, text, source: "local-fallback" };
            }
          }
          throw error;
        } catch (fallbackError) {
          throw new Error(
            `OpenAI API failed: ${error.message}. Local fallback also failed: ${fallbackError.message}`
          );
        }
      }

      throw error;
    }
  }

  getTranscriptionModel() {
    try {
      // Check if a custom model is configured
      const customModel = typeof localStorage !== "undefined"
        ? localStorage.getItem("cloudTranscriptionModel") || ""
        : "";

      if (customModel.trim()) {
        return customModel.trim();
      }

      // Auto-detect model based on endpoint
      const endpoint = typeof localStorage !== "undefined"
        ? localStorage.getItem("cloudTranscriptionBaseUrl") || ""
        : "";

      if (endpoint.includes("groq.com")) {
        return "whisper-large-v3-turbo"; // Groq's fast model
      }

      // Default to OpenAI's model
      return "whisper-1";
    } catch (error) {
      return "whisper-1";
    }
  }

  getTranscriptionEndpoint() {
    if (this.cachedTranscriptionEndpoint) {
      return this.cachedTranscriptionEndpoint;
    }

    try {
      const stored = typeof localStorage !== "undefined"
        ? localStorage.getItem("cloudTranscriptionBaseUrl") || ""
        : "";
      const trimmed = stored.trim();
      const base = trimmed ? trimmed : API_ENDPOINTS.TRANSCRIPTION_BASE;
      const normalizedBase = normalizeBaseUrl(base);

      if (!normalizedBase) {
        this.cachedTranscriptionEndpoint = API_ENDPOINTS.TRANSCRIPTION;
        return API_ENDPOINTS.TRANSCRIPTION;
      }

      const isLocalhost = normalizedBase.includes('://localhost') || normalizedBase.includes('://127.0.0.1');
      if (!normalizedBase.startsWith('https://') && !isLocalhost) {
        console.warn('Non-HTTPS endpoint rejected for security. Using default.');
        this.cachedTranscriptionEndpoint = API_ENDPOINTS.TRANSCRIPTION;
        return API_ENDPOINTS.TRANSCRIPTION;
      }

      let endpoint;
      if (/\/audio\/(transcriptions|translations)$/i.test(normalizedBase)) {
        endpoint = normalizedBase;
      } else {
        endpoint = buildApiUrl(normalizedBase, '/audio/transcriptions');
      }

      this.cachedTranscriptionEndpoint = endpoint;
      return endpoint;
    } catch (error) {
      console.warn('Failed to resolve transcription endpoint:', error);
      this.cachedTranscriptionEndpoint = API_ENDPOINTS.TRANSCRIPTION;
      return API_ENDPOINTS.TRANSCRIPTION;
    }
  }

  async safePaste(text) {
    try {
      await window.electronAPI.pasteText(text);
      return true;
    } catch (error) {
      this.onError?.({
        title: "Paste Error",
        description: `Failed to paste text. Please check accessibility permissions. ${error.message}`,
      });
      return false;
    }
  }

  async saveTranscription(text) {
    try {
      await window.electronAPI.saveTranscription(text);
      return true;
    } catch (error) {
      return false;
    }
  }

  getState() {
    return {
      isRecording: this.isRecording,
      isProcessing: this.isProcessing,
    };
  }

  cleanup() {
    if (this.mediaRecorder && this.isRecording) {
      this.stopRecording();
    }
    this.onStateChange = null;
    this.onError = null;
    this.onTranscriptionComplete = null;
  }
}

export default AudioManager;
