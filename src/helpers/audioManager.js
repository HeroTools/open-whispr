import ReasoningService from "../services/ReasoningService";
import { API_ENDPOINTS, buildApiUrl, normalizeBaseUrl } from "../config/constants";
import logger from "../utils/logger";
import { isBuiltInMicrophone } from "../utils/audioDeviceUtils";
import { isSecureEndpoint } from "../utils/urlUtils";

const SHORT_CLIP_DURATION_SECONDS = 2.5;
const REASONING_CACHE_TTL = 30000; // 30 seconds

const PLACEHOLDER_KEYS = {
  openai: "your_openai_api_key_here",
  groq: "your_groq_api_key_here",
};

const isValidApiKey = (key, provider = "openai") => {
  if (!key || key.trim() === "") return false;
  const placeholder = PLACEHOLDER_KEYS[provider] || PLACEHOLDER_KEYS.openai;
  return key !== placeholder;
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
    this.cachedApiKeyProvider = null;
    this.cachedTranscriptionEndpoint = null;
    this.cachedEndpointProvider = null;
    this.cachedEndpointBaseUrl = null;
    this.recordingStartTime = null;
    this.reasoningAvailabilityCache = { value: false, expiresAt: 0 };
    this.cachedReasoningPreference = null;
  }

  getCustomDictionaryPrompt() {
    try {
      const raw = localStorage.getItem("customDictionary");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed.join(", ");
    } catch {
      // ignore parse errors
    }
    return null;
  }

  setCallbacks({ onStateChange, onError, onTranscriptionComplete }) {
    this.onStateChange = onStateChange;
    this.onError = onError;
    this.onTranscriptionComplete = onTranscriptionComplete;
  }

  async getAudioConstraints() {
    const preferBuiltIn = localStorage.getItem("preferBuiltInMic") !== "false";
    const selectedDeviceId = localStorage.getItem("selectedMicDeviceId") || "";

    if (preferBuiltIn) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter((d) => d.kind === "audioinput");
        const builtInMic = audioInputs.find((d) => isBuiltInMicrophone(d.label));

        if (builtInMic) {
          logger.debug(
            "Using built-in microphone",
            { deviceId: builtInMic.deviceId, label: builtInMic.label },
            "audio"
          );
          return { audio: { deviceId: { exact: builtInMic.deviceId } } };
        }
      } catch (error) {
        logger.debug(
          "Failed to enumerate devices for built-in mic detection",
          { error: error.message },
          "audio"
        );
      }
    }

    // Use selected device if specified and not preferring built-in
    if (!preferBuiltIn && selectedDeviceId) {
      logger.debug("Using selected microphone", { deviceId: selectedDeviceId }, "audio");
      return { audio: { deviceId: { exact: selectedDeviceId } } };
    }

    // Fall back to default device
    logger.debug("Using default microphone", {}, "audio");
    return { audio: true };
  }

  async startRecording() {
    try {
      if (this.isRecording || this.isProcessing || this.mediaRecorder?.state === "recording") {
        return false;
      }

      const constraints = await this.getAudioConstraints();
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Log which microphone is actually being used
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        const settings = audioTrack.getSettings();
        logger.info(
          "Recording started with microphone",
          {
            label: audioTrack.label,
            deviceId: settings.deviceId?.slice(0, 20) + "...",
            sampleRate: settings.sampleRate,
            channelCount: settings.channelCount,
          },
          "audio"
        );
      }

      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];
      this.recordingStartTime = Date.now();
      this.recordingMimeType = this.mediaRecorder.mimeType || "audio/webm";

      this.mediaRecorder.ondataavailable = (event) => {
        this.audioChunks.push(event.data);
      };

      this.mediaRecorder.onstop = async () => {
        this.isRecording = false;
        this.isProcessing = true;
        this.onStateChange?.({ isRecording: false, isProcessing: true });

        const audioBlob = new Blob(this.audioChunks, { type: this.recordingMimeType });

        // Debug: Log audio blob info
        logger.info(
          "Recording stopped",
          {
            blobSize: audioBlob.size,
            blobType: audioBlob.type,
            chunksCount: this.audioChunks.length,
          },
          "audio"
        );

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
        errorDescription =
          "Please grant microphone permission in your system settings and try again.";
      } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        errorTitle = "No Microphone Found";
        errorDescription = "No microphone was detected. Please connect a microphone and try again.";
      } else if (error.name === "NotReadableError" || error.name === "TrackStartError") {
        errorTitle = "Microphone In Use";
        errorDescription =
          "The microphone is being used by another application. Please close other apps and try again.";
      }

      this.onError?.({
        title: errorTitle,
        description: errorDescription,
      });
      return false;
    }
  }

  stopRecording() {
    if (this.mediaRecorder?.state === "recording") {
      this.mediaRecorder.stop();
      // State change will be handled in onstop callback
      return true;
    }
    return false;
  }

  cancelRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
      this.mediaRecorder.onstop = () => {
        this.isRecording = false;
        this.isProcessing = false;
        this.audioChunks = [];
        this.recordingStartTime = null;
        this.onStateChange?.({ isRecording: false, isProcessing: false });
      };

      this.mediaRecorder.stop();

      if (this.mediaRecorder.stream) {
        this.mediaRecorder.stream.getTracks().forEach((track) => track.stop());
      }

      return true;
    }
    return false;
  }

  async processAudio(audioBlob, metadata = {}) {
    const pipelineStart = performance.now();

    try {
      const useLocalWhisper = localStorage.getItem("useLocalWhisper") === "true";
      const localProvider = localStorage.getItem("localTranscriptionProvider") || "whisper";
      const whisperModel = localStorage.getItem("whisperModel") || "base";
      const parakeetModel = localStorage.getItem("parakeetModel") || "parakeet-tdt-0.6b-v3";

      let result;
      let activeModel;
      if (useLocalWhisper) {
        if (localProvider === "nvidia") {
          activeModel = parakeetModel;
          result = await this.processWithLocalParakeet(audioBlob, parakeetModel, metadata);
        } else {
          activeModel = whisperModel;
          result = await this.processWithLocalWhisper(audioBlob, whisperModel, metadata);
        }
      } else {
        activeModel = this.getTranscriptionModel();
        result = await this.processWithOpenAIAPI(audioBlob, metadata);
      }

      this.onTranscriptionComplete?.(result);

      const roundTripDurationMs = Math.round(performance.now() - pipelineStart);

      const timingData = {
        mode: useLocalWhisper ? `local-${localProvider}` : "cloud",
        model: activeModel,
        audioDurationMs: metadata.durationSeconds
          ? Math.round(metadata.durationSeconds * 1000)
          : null,
        reasoningProcessingDurationMs: result?.timings?.reasoningProcessingDurationMs ?? null,
        roundTripDurationMs,
        audioSizeBytes: audioBlob.size,
        audioFormat: audioBlob.type,
        outputTextLength: result?.text?.length,
      };

      if (useLocalWhisper) {
        timingData.audioConversionDurationMs = result?.timings?.audioConversionDurationMs ?? null;
      }
      timingData.transcriptionProcessingDurationMs =
        result?.timings?.transcriptionProcessingDurationMs ?? null;

      logger.info("Pipeline timing", timingData, "performance");
    } catch (error) {
      const errorAtMs = Math.round(performance.now() - pipelineStart);

      logger.error(
        "Pipeline failed",
        {
          errorAtMs,
          error: error.message,
        },
        "performance"
      );

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
    const timings = {};

    try {
      // Send original audio to main process - FFmpeg in main process handles conversion
      // (renderer-side AudioContext conversion was unreliable with WebM/Opus format)
      const arrayBuffer = await audioBlob.arrayBuffer();
      const language = localStorage.getItem("preferredLanguage");
      const options = { model };
      if (language && language !== "auto") {
        options.language = language;
      }

      // Add custom dictionary as initial prompt to help Whisper recognize specific words
      const dictionaryPrompt = this.getCustomDictionaryPrompt();
      if (dictionaryPrompt) {
        options.initialPrompt = dictionaryPrompt;
      }

      logger.debug(
        "Local transcription starting",
        {
          audioFormat: audioBlob.type,
          audioSizeBytes: audioBlob.size,
        },
        "performance"
      );

      const transcriptionStart = performance.now();
      const result = await window.electronAPI.transcribeLocalWhisper(arrayBuffer, options);
      timings.transcriptionProcessingDurationMs = Math.round(
        performance.now() - transcriptionStart
      );

      logger.debug(
        "Local transcription complete",
        {
          transcriptionProcessingDurationMs: timings.transcriptionProcessingDurationMs,
          success: result.success,
        },
        "performance"
      );

      if (result.success && result.text) {
        const reasoningStart = performance.now();
        const text = await this.processTranscription(result.text, "local");
        timings.reasoningProcessingDurationMs = Math.round(performance.now() - reasoningStart);

        if (text !== null && text !== undefined) {
          return { success: true, text: text || result.text, source: "local", timings };
        } else {
          throw new Error("No text transcribed");
        }
      } else if (result.success === false && result.message === "No audio detected") {
        throw new Error("No audio detected");
      } else {
        throw new Error(result.message || result.error || "Local Whisper transcription failed");
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
          throw new Error(
            `Local Whisper failed: ${error.message}. OpenAI fallback also failed: ${fallbackError.message}`
          );
        }
      } else {
        throw new Error(`Local Whisper failed: ${error.message}`);
      }
    }
  }

  async processWithLocalParakeet(audioBlob, model = "parakeet-tdt-0.6b-v3", metadata = {}) {
    const timings = {};

    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const language = localStorage.getItem("preferredLanguage");
      const options = { model };
      if (language && language !== "auto") {
        options.language = language;
      }

      logger.debug(
        "Parakeet transcription starting",
        {
          audioFormat: audioBlob.type,
          audioSizeBytes: audioBlob.size,
          model,
        },
        "performance"
      );

      const transcriptionStart = performance.now();
      const result = await window.electronAPI.transcribeLocalParakeet(arrayBuffer, options);
      timings.transcriptionProcessingDurationMs = Math.round(
        performance.now() - transcriptionStart
      );

      logger.debug(
        "Parakeet transcription complete",
        {
          transcriptionProcessingDurationMs: timings.transcriptionProcessingDurationMs,
          success: result.success,
        },
        "performance"
      );

      if (result.success && result.text) {
        const reasoningStart = performance.now();
        const text = await this.processTranscription(result.text, "local-parakeet");
        timings.reasoningProcessingDurationMs = Math.round(performance.now() - reasoningStart);

        if (text !== null && text !== undefined) {
          return { success: true, text: text || result.text, source: "local-parakeet", timings };
        } else {
          throw new Error("No text transcribed");
        }
      } else if (result.success === false && result.message === "No audio detected") {
        throw new Error("No audio detected");
      } else {
        throw new Error(result.message || result.error || "Parakeet transcription failed");
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
          throw new Error(
            `Parakeet failed: ${error.message}. OpenAI fallback also failed: ${fallbackError.message}`
          );
        }
      } else {
        throw new Error(`Parakeet failed: ${error.message}`);
      }
    }
  }

  async getAPIKey() {
    // Get the current transcription provider
    const provider =
      typeof localStorage !== "undefined"
        ? localStorage.getItem("cloudTranscriptionProvider") || "openai"
        : "openai";

    // Check cache (invalidate if provider changed)
    if (this.cachedApiKey !== null && this.cachedApiKeyProvider === provider) {
      return this.cachedApiKey;
    }

    let apiKey = null;

    if (provider === "custom") {
      try {
        apiKey = await window.electronAPI.getCustomTranscriptionKey?.();
      } catch (err) {
        logger.debug(
          "Failed to get custom transcription key via IPC, falling back to localStorage",
          { error: err?.message },
          "transcription"
        );
      }
      if (!apiKey || !apiKey.trim()) {
        apiKey = localStorage.getItem("customTranscriptionApiKey") || "";
      }
      apiKey = apiKey?.trim() || "";

      logger.debug(
        "Custom STT API key retrieval",
        {
          provider,
          hasKey: !!apiKey,
          keyLength: apiKey?.length || 0,
          keyPreview: apiKey ? `${apiKey.substring(0, 8)}...` : "(none)",
        },
        "transcription"
      );

      // For custom, we allow null/empty - the endpoint may not require auth
      if (!apiKey) {
        apiKey = null;
      }
    } else if (provider === "groq") {
      // Try to get Groq API key
      apiKey = await window.electronAPI.getGroqKey?.();
      if (!isValidApiKey(apiKey, "groq")) {
        apiKey = localStorage.getItem("groqApiKey");
      }
      if (!isValidApiKey(apiKey, "groq")) {
        throw new Error("Groq API key not found. Please set your API key in the Control Panel.");
      }
    } else {
      // Default to OpenAI
      apiKey = await window.electronAPI.getOpenAIKey();
      if (!isValidApiKey(apiKey, "openai")) {
        apiKey = localStorage.getItem("openaiApiKey");
      }
      if (!isValidApiKey(apiKey, "openai")) {
        throw new Error(
          "OpenAI API key not found. Please set your API key in the .env file or Control Panel."
        );
      }
    }

    this.cachedApiKey = apiKey;
    this.cachedApiKeyProvider = provider;
    return apiKey;
  }

  async optimizeAudio(audioBlob) {
    return new Promise((resolve) => {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const reader = new FileReader();

      reader.onload = async () => {
        try {
          const arrayBuffer = reader.result;
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

          // Convert to 16kHz mono for smaller size and faster upload
          const sampleRate = 16000;
          const channels = 1;
          const length = Math.floor(audioBuffer.duration * sampleRate);
          const offlineContext = new OfflineAudioContext(channels, length, sampleRate);

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
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }

    return new Blob([arrayBuffer], { type: "audio/wav" });
  }

  async processWithReasoningModel(text, model, agentName) {
    logger.logReasoning("CALLING_REASONING_SERVICE", {
      model,
      agentName,
      textLength: text.length,
    });

    const startTime = Date.now();

    try {
      const result = await ReasoningService.processText(text, model, agentName);

      const processingTime = Date.now() - startTime;

      logger.logReasoning("REASONING_SERVICE_COMPLETE", {
        model,
        processingTimeMs: processingTime,
        resultLength: result.length,
        success: true,
      });

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;

      logger.logReasoning("REASONING_SERVICE_ERROR", {
        model,
        processingTimeMs: processingTime,
        error: error.message,
        stack: error.stack,
      });

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

    logger.logReasoning("REASONING_STORAGE_CHECK", {
      storedValue,
      typeOfStoredValue: typeof storedValue,
      isTrue: storedValue === "true",
      isTruthy: !!storedValue && storedValue !== "false",
    });

    const useReasoning = storedValue === "true" || (!!storedValue && storedValue !== "false");

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

      logger.logReasoning("REASONING_AVAILABILITY", {
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
      logger.logReasoning("REASONING_AVAILABILITY_ERROR", {
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

    logger.logReasoning("TRANSCRIPTION_RECEIVED", {
      source,
      textLength: normalizedText.length,
      textPreview: normalizedText.substring(0, 100) + (normalizedText.length > 100 ? "..." : ""),
      timestamp: new Date().toISOString(),
    });

    const reasoningModel =
      typeof window !== "undefined" && window.localStorage
        ? localStorage.getItem("reasoningModel") || ""
        : "";
    const reasoningProvider =
      typeof window !== "undefined" && window.localStorage
        ? localStorage.getItem("reasoningProvider") || "auto"
        : "auto";
    const agentName =
      typeof window !== "undefined" && window.localStorage
        ? localStorage.getItem("agentName") || null
        : null;
    if (!reasoningModel) {
      logger.logReasoning("REASONING_SKIPPED", {
        reason: "No reasoning model selected",
      });
      return normalizedText;
    }

    const useReasoning = await this.isReasoningAvailable();

    logger.logReasoning("REASONING_CHECK", {
      useReasoning,
      reasoningModel,
      reasoningProvider,
      agentName,
    });

    if (useReasoning) {
      try {
        logger.logReasoning("SENDING_TO_REASONING", {
          preparedTextLength: normalizedText.length,
          model: reasoningModel,
          provider: reasoningProvider,
        });

        const result = await this.processWithReasoningModel(
          normalizedText,
          reasoningModel,
          agentName
        );

        logger.logReasoning("REASONING_SUCCESS", {
          resultLength: result.length,
          resultPreview: result.substring(0, 100) + (result.length > 100 ? "..." : ""),
          processingTime: new Date().toISOString(),
        });

        return result;
      } catch (error) {
        logger.logReasoning("REASONING_FAILED", {
          error: error.message,
          stack: error.stack,
          fallbackToCleanup: true,
        });
        console.error(`Reasoning failed (${source}):`, error.message);
      }
    }

    logger.logReasoning("USING_STANDARD_CLEANUP", {
      reason: useReasoning ? "Reasoning failed" : "Reasoning not enabled",
    });

    return normalizedText;
  }

  shouldStreamTranscription(model, provider) {
    if (provider !== "openai") {
      return false;
    }
    const normalized = typeof model === "string" ? model.trim() : "";
    if (!normalized || normalized === "whisper-1") {
      return false;
    }
    if (normalized === "gpt-4o-transcribe" || normalized === "gpt-4o-transcribe-diarize") {
      return true;
    }
    return normalized.startsWith("gpt-4o-mini-transcribe");
  }

  async readTranscriptionStream(response) {
    const reader = response.body?.getReader();
    if (!reader) {
      logger.error("Streaming response body not available", {}, "transcription");
      throw new Error("Streaming response body not available");
    }

    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let collectedText = "";
    let finalText = null;
    let eventCount = 0;
    const eventTypes = {};

    const handleEvent = (payload) => {
      if (!payload || typeof payload !== "object") {
        return;
      }
      eventCount++;
      const eventType = payload.type || "unknown";
      eventTypes[eventType] = (eventTypes[eventType] || 0) + 1;

      logger.debug(
        "Stream event received",
        {
          type: eventType,
          eventNumber: eventCount,
          payloadKeys: Object.keys(payload),
        },
        "transcription"
      );

      if (payload.type === "transcript.text.delta" && typeof payload.delta === "string") {
        collectedText += payload.delta;
        return;
      }
      if (payload.type === "transcript.text.segment" && typeof payload.text === "string") {
        collectedText += payload.text;
        return;
      }
      if (payload.type === "transcript.text.done" && typeof payload.text === "string") {
        finalText = payload.text;
        logger.debug(
          "Final transcript received",
          {
            textLength: payload.text.length,
          },
          "transcription"
        );
      }
    };

    logger.debug("Starting to read transcription stream", {}, "transcription");

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        logger.debug(
          "Stream reading complete",
          {
            eventCount,
            eventTypes,
            collectedTextLength: collectedText.length,
            hasFinalText: finalText !== null,
          },
          "transcription"
        );
        break;
      }
      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;

      // Log first chunk to see format
      if (eventCount === 0 && chunk.length > 0) {
        logger.debug(
          "First stream chunk received",
          {
            chunkLength: chunk.length,
            chunkPreview: chunk.substring(0, 500),
          },
          "transcription"
        );
      }

      // Process complete lines from the buffer
      // Each SSE event is "data: <json>\n" followed by empty line
      const lines = buffer.split("\n");
      buffer = "";

      for (const line of lines) {
        const trimmedLine = line.trim();

        // Skip empty lines
        if (!trimmedLine) {
          continue;
        }

        // Extract data from "data: " prefix
        let data = "";
        if (trimmedLine.startsWith("data: ")) {
          data = trimmedLine.slice(6);
        } else if (trimmedLine.startsWith("data:")) {
          data = trimmedLine.slice(5).trim();
        } else {
          // Not a data line, could be leftover - keep in buffer
          buffer += line + "\n";
          continue;
        }

        // Handle [DONE] marker
        if (data === "[DONE]") {
          finalText = finalText ?? collectedText;
          continue;
        }

        // Try to parse JSON
        try {
          const parsed = JSON.parse(data);
          handleEvent(parsed);
        } catch (error) {
          // Incomplete JSON - put back in buffer for next iteration
          buffer += line + "\n";
        }
      }
    }

    const result = finalText ?? collectedText;
    logger.debug(
      "Stream processing complete",
      {
        resultLength: result.length,
        usedFinalText: finalText !== null,
        eventCount,
        eventTypes,
      },
      "transcription"
    );

    return result;
  }

  async processWithOpenAIAPI(audioBlob, metadata = {}) {
    const timings = {};
    const language = localStorage.getItem("preferredLanguage");
    const allowLocalFallback = localStorage.getItem("allowLocalFallback") === "true";
    const fallbackModel = localStorage.getItem("fallbackWhisperModel") || "base";

    try {
      const durationSeconds = metadata.durationSeconds ?? null;
      const shouldSkipOptimizationForDuration =
        typeof durationSeconds === "number" &&
        durationSeconds > 0 &&
        durationSeconds < SHORT_CLIP_DURATION_SECONDS;

      const model = this.getTranscriptionModel();
      const provider = localStorage.getItem("cloudTranscriptionProvider") || "openai";

      logger.debug(
        "Transcription request starting",
        {
          provider,
          model,
          blobSize: audioBlob.size,
          blobType: audioBlob.type,
          durationSeconds,
          language,
        },
        "transcription"
      );

      // gpt-4o-transcribe models don't support WAV format - they need webm, mp3, mp4, etc.
      // Only use WAV optimization for whisper-1 and groq models
      const is4oModel = model.includes("gpt-4o");
      const shouldOptimize =
        !is4oModel && !shouldSkipOptimizationForDuration && audioBlob.size > 1024 * 1024;

      logger.debug(
        "Audio optimization decision",
        {
          is4oModel,
          shouldOptimize,
          shouldSkipOptimizationForDuration,
        },
        "transcription"
      );

      const [apiKey, optimizedAudio] = await Promise.all([
        this.getAPIKey(),
        shouldOptimize ? this.optimizeAudio(audioBlob) : Promise.resolve(audioBlob),
      ]);

      const formData = new FormData();
      // Determine the correct file extension based on the blob type
      const mimeType = optimizedAudio.type || "audio/webm";
      const extension = mimeType.includes("webm")
        ? "webm"
        : mimeType.includes("ogg")
          ? "ogg"
          : mimeType.includes("mp4")
            ? "mp4"
            : mimeType.includes("mpeg")
              ? "mp3"
              : mimeType.includes("wav")
                ? "wav"
                : "webm";

      logger.debug(
        "FormData preparation",
        {
          mimeType,
          extension,
          optimizedSize: optimizedAudio.size,
          hasApiKey: !!apiKey,
        },
        "transcription"
      );

      formData.append("file", optimizedAudio, `audio.${extension}`);
      formData.append("model", model);

      if (language && language !== "auto") {
        formData.append("language", language);
      }

      // Add custom dictionary as prompt hint for cloud transcription
      const dictionaryPrompt = this.getCustomDictionaryPrompt();
      if (dictionaryPrompt) {
        formData.append("prompt", dictionaryPrompt);
      }

      const shouldStream = this.shouldStreamTranscription(model, provider);
      if (shouldStream) {
        formData.append("stream", "true");
      }

      const endpoint = this.getTranscriptionEndpoint();
      const isCustomEndpoint =
        provider === "custom" ||
        (!endpoint.includes("api.openai.com") && !endpoint.includes("api.groq.com"));

      logger.debug(
        "Making transcription API request",
        {
          endpoint,
          shouldStream,
          model,
          provider,
          isCustomEndpoint,
          hasApiKey: !!apiKey,
          apiKeyPreview: apiKey ? `${apiKey.substring(0, 8)}...` : "(none)",
        },
        "transcription"
      );

      // Build headers - only include Authorization if we have an API key
      const headers = {};
      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
      }

      logger.debug(
        "STT request details",
        {
          endpoint,
          method: "POST",
          hasAuthHeader: !!apiKey,
          formDataFields: [
            "file",
            "model",
            language && language !== "auto" ? "language" : null,
            shouldStream ? "stream" : null,
          ].filter(Boolean),
        },
        "transcription"
      );

      const apiCallStart = performance.now();
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: formData,
      });

      const responseContentType = response.headers.get("content-type") || "";

      logger.debug(
        "Transcription API response received",
        {
          status: response.status,
          statusText: response.statusText,
          contentType: responseContentType,
          ok: response.ok,
        },
        "transcription"
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          "Transcription API error response",
          {
            status: response.status,
            errorText,
          },
          "transcription"
        );
        throw new Error(`API Error: ${response.status} ${errorText}`);
      }

      let result;
      const contentType = responseContentType;

      if (shouldStream && contentType.includes("text/event-stream")) {
        logger.debug("Processing streaming response", { contentType }, "transcription");
        const streamedText = await this.readTranscriptionStream(response);
        result = { text: streamedText };
        logger.debug(
          "Streaming response parsed",
          {
            hasText: !!streamedText,
            textLength: streamedText?.length,
          },
          "transcription"
        );
      } else {
        const rawText = await response.text();
        logger.debug(
          "Raw API response body",
          {
            rawText: rawText.substring(0, 1000),
            fullLength: rawText.length,
          },
          "transcription"
        );

        try {
          result = JSON.parse(rawText);
        } catch (parseError) {
          logger.error(
            "Failed to parse JSON response",
            {
              parseError: parseError.message,
              rawText: rawText.substring(0, 500),
            },
            "transcription"
          );
          throw new Error(`Failed to parse API response: ${parseError.message}`);
        }

        logger.debug(
          "Parsed transcription result",
          {
            hasText: !!result.text,
            textLength: result.text?.length,
            resultKeys: Object.keys(result),
            fullResult: result,
          },
          "transcription"
        );
      }

      // Check for text - handle both empty string and missing field
      if (result.text && result.text.trim().length > 0) {
        timings.transcriptionProcessingDurationMs = Math.round(performance.now() - apiCallStart);

        const reasoningStart = performance.now();
        const text = await this.processTranscription(result.text, "openai");
        timings.reasoningProcessingDurationMs = Math.round(performance.now() - reasoningStart);

        const source = (await this.isReasoningAvailable()) ? "openai-reasoned" : "openai";
        logger.debug(
          "Transcription successful",
          {
            originalLength: result.text.length,
            processedLength: text.length,
            source,
            transcriptionProcessingDurationMs: timings.transcriptionProcessingDurationMs,
            reasoningProcessingDurationMs: timings.reasoningProcessingDurationMs,
          },
          "transcription"
        );
        return { success: true, text, source, timings };
      } else {
        // Log at info level so it shows without debug mode
        logger.info(
          "Transcription returned empty - check audio input",
          {
            model,
            provider,
            endpoint,
            blobSize: audioBlob.size,
            blobType: audioBlob.type,
            mimeType,
            extension,
            resultText: result.text,
            resultKeys: Object.keys(result),
          },
          "transcription"
        );
        logger.error(
          "No text in transcription result",
          {
            result,
            resultKeys: Object.keys(result),
          },
          "transcription"
        );
        throw new Error(
          "No text transcribed - audio may be too short, silent, or in an unsupported format"
        );
      }
    } catch (error) {
      const isOpenAIMode = localStorage.getItem("useLocalWhisper") !== "true";

      if (allowLocalFallback && isOpenAIMode) {
        try {
          const arrayBuffer = await audioBlob.arrayBuffer();
          const options = { model: fallbackModel };
          if (language && language !== "auto") {
            options.language = language;
          }

          const result = await window.electronAPI.transcribeLocalWhisper(arrayBuffer, options);

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
      const provider =
        typeof localStorage !== "undefined"
          ? localStorage.getItem("cloudTranscriptionProvider") || "openai"
          : "openai";

      const model =
        typeof localStorage !== "undefined"
          ? localStorage.getItem("cloudTranscriptionModel") || ""
          : "";

      const trimmedModel = model.trim();

      // For custom provider, use whatever model is set (or fallback to whisper-1)
      if (provider === "custom") {
        return trimmedModel || "whisper-1";
      }

      // Validate model matches provider to handle settings migration
      if (trimmedModel) {
        const isGroqModel = trimmedModel.startsWith("whisper-large-v3");
        const isOpenAIModel = trimmedModel.startsWith("gpt-4o") || trimmedModel === "whisper-1";

        if (provider === "groq" && isGroqModel) {
          return trimmedModel;
        }
        if (provider === "openai" && isOpenAIModel) {
          return trimmedModel;
        }
        // Model doesn't match provider - fall through to default
      }

      // Return provider-appropriate default
      return provider === "groq" ? "whisper-large-v3-turbo" : "gpt-4o-mini-transcribe";
    } catch (error) {
      return "gpt-4o-mini-transcribe";
    }
  }

  getTranscriptionEndpoint() {
    // Get current provider and base URL to check if cache is valid
    const currentProvider =
      typeof localStorage !== "undefined"
        ? localStorage.getItem("cloudTranscriptionProvider") || "openai"
        : "openai";
    const currentBaseUrl =
      typeof localStorage !== "undefined"
        ? localStorage.getItem("cloudTranscriptionBaseUrl") || ""
        : "";

    // Only use custom URL when provider is explicitly "custom"
    const isCustomEndpoint = currentProvider === "custom";

    // Invalidate cache if provider or base URL changed
    if (
      this.cachedTranscriptionEndpoint &&
      (this.cachedEndpointProvider !== currentProvider ||
        this.cachedEndpointBaseUrl !== currentBaseUrl)
    ) {
      logger.debug(
        "STT endpoint cache invalidated",
        {
          previousProvider: this.cachedEndpointProvider,
          newProvider: currentProvider,
          previousBaseUrl: this.cachedEndpointBaseUrl,
          newBaseUrl: currentBaseUrl,
        },
        "transcription"
      );
      this.cachedTranscriptionEndpoint = null;
    }

    if (this.cachedTranscriptionEndpoint) {
      return this.cachedTranscriptionEndpoint;
    }

    try {
      // Use custom URL only when provider is "custom", otherwise use provider-specific defaults
      let base;
      if (isCustomEndpoint) {
        base = currentBaseUrl.trim() || API_ENDPOINTS.TRANSCRIPTION_BASE;
      } else if (currentProvider === "groq") {
        base = API_ENDPOINTS.GROQ_BASE;
      } else {
        // OpenAI or other standard providers
        base = API_ENDPOINTS.TRANSCRIPTION_BASE;
      }

      const normalizedBase = normalizeBaseUrl(base);

      logger.debug(
        "STT endpoint resolution",
        {
          provider: currentProvider,
          isCustomEndpoint,
          rawBaseUrl: currentBaseUrl,
          normalizedBase,
          defaultBase: API_ENDPOINTS.TRANSCRIPTION_BASE,
        },
        "transcription"
      );

      const cacheResult = (endpoint) => {
        this.cachedTranscriptionEndpoint = endpoint;
        this.cachedEndpointProvider = currentProvider;
        this.cachedEndpointBaseUrl = currentBaseUrl;

        logger.debug(
          "STT endpoint resolved",
          {
            endpoint,
            provider: currentProvider,
            isCustomEndpoint,
            usingDefault: endpoint === API_ENDPOINTS.TRANSCRIPTION,
          },
          "transcription"
        );

        return endpoint;
      };

      if (!normalizedBase) {
        logger.debug(
          "STT endpoint: using default (normalization failed)",
          { rawBase: base },
          "transcription"
        );
        return cacheResult(API_ENDPOINTS.TRANSCRIPTION);
      }

      // Only validate HTTPS for custom endpoints (known providers are already HTTPS)
      if (isCustomEndpoint && !isSecureEndpoint(normalizedBase)) {
        logger.warn(
          "STT endpoint: HTTPS required, falling back to default",
          { attemptedUrl: normalizedBase },
          "transcription"
        );
        return cacheResult(API_ENDPOINTS.TRANSCRIPTION);
      }

      let endpoint;
      if (/\/audio\/(transcriptions|translations)$/i.test(normalizedBase)) {
        endpoint = normalizedBase;
        logger.debug("STT endpoint: using full path from config", { endpoint }, "transcription");
      } else {
        endpoint = buildApiUrl(normalizedBase, "/audio/transcriptions");
        logger.debug(
          "STT endpoint: appending /audio/transcriptions to base",
          { base: normalizedBase, endpoint },
          "transcription"
        );
      }

      return cacheResult(endpoint);
    } catch (error) {
      logger.error(
        "STT endpoint resolution failed",
        { error: error.message, stack: error.stack },
        "transcription"
      );
      this.cachedTranscriptionEndpoint = API_ENDPOINTS.TRANSCRIPTION;
      this.cachedEndpointProvider = currentProvider;
      this.cachedEndpointBaseUrl = currentBaseUrl;
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
    if (this.mediaRecorder?.state === "recording") {
      this.stopRecording();
    }
    this.onStateChange = null;
    this.onError = null;
    this.onTranscriptionComplete = null;
  }
}

export default AudioManager;
