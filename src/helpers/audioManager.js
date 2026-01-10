import ReasoningService from "../services/ReasoningService";
import { API_ENDPOINTS, buildApiUrl, normalizeBaseUrl } from "../config/constants";
import logger from "../utils/logger";

const SHORT_CLIP_DURATION_SECONDS = 2.5;
const REASONING_CACHE_TTL = 30000; // 30 seconds


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
    this.latencySession = null;
    this.latencySessionId = 0;
    this.reasoningAvailabilityCache = { value: false, expiresAt: 0 };
    this.cachedReasoningPreference = null;
  }

  setCallbacks({ onStateChange, onError, onTranscriptionComplete }) {
    this.onStateChange = onStateChange;
    this.onError = onError;
    this.onTranscriptionComplete = onTranscriptionComplete;
  }

  startLatencySession() {
    const now = Date.now();
    const session = {
      id: this.latencySessionId + 1,
      startedAt: now,
      lastMarkAt: now,
    };
    this.latencySessionId = session.id;
    this.latencySession = session;
    logger.debug(
      "01_start_requested",
      {
        id: session.id,
        description: "startRecording invoked (user toggle)",
        elapsedMs: 0,
        stageMs: 0,
      },
      "latency"
    );
    return session;
  }

  markLatencyStage(stage, meta = {}, { total = false, complete = false } = {}) {
    if (!this.latencySession) return;
    const now = Date.now();
    const stageMs = now - this.latencySession.lastMarkAt;
    const elapsedMs = now - this.latencySession.startedAt;
    this.latencySession.lastMarkAt = now;
    const payload = { id: this.latencySession.id, stageMs, elapsedMs, ...meta };
    if (total) {
      payload.totalMs = elapsedMs;
    }
    logger.debug(stage, payload, "latency");
    if (complete) {
      this.latencySession = null;
    }
  }

  async startRecording() {
    try {
      if (this.isRecording || this.isProcessing || this.mediaRecorder?.state === "recording") {
        return false;
      }

      this.startLatencySession();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];
      this.recordingStartTime = null;

      this.mediaRecorder.onstart = () => {
        this.isRecording = true;
        this.recordingStartTime = Date.now();
        this.onStateChange?.({ isRecording: true, isProcessing: false });
        this.markLatencyStage("02_media_recorder_started", {
          description: "MediaRecorder onstart fired (audio capture active)",
        });
      };

      this.mediaRecorder.ondataavailable = (event) => {
        this.audioChunks.push(event.data);
      };

      this.mediaRecorder.onstop = async () => {
        this.isRecording = false;
        this.isProcessing = true;
        this.onStateChange?.({ isRecording: false, isProcessing: true });

        const audioBlob = new Blob(this.audioChunks, { type: "audio/wav" });

        const stopTimestamp = Date.now();
        const recordingDurationMs = this.recordingStartTime
          ? stopTimestamp - this.recordingStartTime
          : null;
        const durationSeconds = recordingDurationMs ? recordingDurationMs / 1000 : null;
        this.recordingStartTime = null;
        this.markLatencyStage("03_media_recorder_stopped", {
          description: "MediaRecorder stopped (audio blob ready)",
          recordingDurationMs,
        });
        await this.processAudio(audioBlob, { durationSeconds });
        stream?.getTracks()?.forEach((track) => track.stop());
      };

      this.mediaRecorder.start();

      return true;
    } catch (error) {
      this.markLatencyStage(
        "01_start_failed",
        { description: "Failed to start recording", error: error.message },
        { total: true, complete: true }
      );
      
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
    if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
      this.mediaRecorder.stop();
      // State change will be handled in onstop callback
      return true;
    }
    return false;
  }

  cancelRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
      // Remove the onstop handler to prevent processing
      this.mediaRecorder.onstop = () => {
        // Discard audio - just reset state without processing
        this.isRecording = false;
        this.isProcessing = false;
        this.audioChunks = [];
        this.recordingStartTime = null;
        this.onStateChange?.({ isRecording: false, isProcessing: false });

        // Log cancellation
        this.markLatencyStage(
          "03_recording_cancelled",
          { description: "Recording cancelled by user" },
          { total: true, complete: true }
        );
      };

      this.mediaRecorder.stop();

      // Stop all tracks immediately
      if (this.mediaRecorder.stream) {
        this.mediaRecorder.stream.getTracks().forEach((track) => track.stop());
      }

      return true;
    }
    return false;
  }

  async processAudio(audioBlob, metadata = {}) {
    try {
      const useLocalWhisper = localStorage.getItem("useLocalWhisper") === "true";
      const whisperModel = localStorage.getItem("whisperModel") || "base";

      let result;
      if (useLocalWhisper) {
        this.markLatencyStage("04_transcription_request", {
          description: "Local Whisper transcription request",
          engine: "local",
        });
        result = await this.processWithLocalWhisper(audioBlob, whisperModel, metadata);
      } else {
        this.markLatencyStage("04_transcription_request", {
          description: "OpenAI transcription request",
          engine: "openai",
        });
        result = await this.processWithOpenAIAPI(audioBlob, metadata);
      }
      this.onTranscriptionComplete?.(result);
    } catch (error) {
      this.markLatencyStage(
        "05_transcription_failed",
        { description: "Transcription failed", error: error.message },
        { total: true, complete: true }
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
      // Complete session if not already completed by safePaste or error handler
      if (this.latencySession) {
        this.markLatencyStage(
          "09_processing_complete",
          { description: "Audio processing finished (session cleanup)" },
          { total: true, complete: true }
        );
      }
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
        this.markLatencyStage("05_transcription_response", {
          description: "Transcription response received",
          source: "local",
          textLength: result.text.length,
        });
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
          this.markLatencyStage("04_transcription_request_fallback", {
            description: "OpenAI fallback transcription request",
            engine: "openai-fallback",
          });
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
    logger.logReasoning("CALLING_REASONING_SERVICE", {
      model,
      agentName,
      textLength: text.length
    });
    
    const startTime = Date.now();
    
    try {
      const result = await ReasoningService.processText(text, model, agentName);
      
      const processingTime = Date.now() - startTime;
      
      logger.logReasoning("REASONING_SERVICE_COMPLETE", {
        model,
        processingTimeMs: processingTime,
        resultLength: result.length,
        success: true
      });
      
      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.logReasoning("REASONING_SERVICE_ERROR", {
        model,
        processingTimeMs: processingTime,
        error: error.message,
        stack: error.stack
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
    const useReasoning = await this.isReasoningAvailable();

    logger.logReasoning("REASONING_CHECK", {
      useReasoning,
      reasoningModel,
      reasoningProvider,
      agentName
    });

    if (useReasoning) {
      try {
        const preparedText = normalizedText;

        logger.logReasoning("SENDING_TO_REASONING", {
          preparedTextLength: preparedText.length,
          model: reasoningModel,
          provider: reasoningProvider
        });

        this.markLatencyStage("06_reasoning_request", {
          description: "Reasoning request started",
          model: reasoningModel,
          provider: reasoningProvider,
        });
        const result = await this.processWithReasoningModel(preparedText, reasoningModel, agentName);

        logger.logReasoning("REASONING_SUCCESS", {
          resultLength: result.length,
          resultPreview: result.substring(0, 100) + (result.length > 100 ? "..." : ""),
          processingTime: new Date().toISOString()
        });

        this.markLatencyStage("07_reasoning_response", {
          description: "Reasoning response received",
          resultLength: result.length,
        });
        return result;
      } catch (error) {
        this.markLatencyStage("07_reasoning_failed", {
          description: "Reasoning failed (fallback to cleanup)",
          error: error.message,
        });
        logger.logReasoning("REASONING_FAILED", {
          error: error.message,
          stack: error.stack,
          fallbackToCleanup: true
        });
        console.error(`Reasoning failed (${source}):`, error.message);
        logger.logReasoning("USING_STANDARD_CLEANUP", { reason: "Reasoning failed" });
        return normalizedText;
      }
    }

    this.markLatencyStage("06_reasoning_skipped", {
      description: "Reasoning disabled or unavailable",
    });
    logger.logReasoning("USING_STANDARD_CLEANUP", { reason: "Reasoning not enabled" });
    return normalizedText;
  }

  async processWithOpenAIAPI(audioBlob, metadata = {}) {
    const language = localStorage.getItem("preferredLanguage");
    const allowLocalFallback =
      localStorage.getItem("allowLocalFallback") === "true";
    const fallbackModel = localStorage.getItem("fallbackWhisperModel") || "base";

    try {

      const durationSeconds = metadata.durationSeconds ?? null;
      const shouldSkipOptimizationForDuration =
        typeof durationSeconds === "number" &&
        durationSeconds > 0 &&
        durationSeconds < SHORT_CLIP_DURATION_SECONDS;

      const shouldOptimize =
        !shouldSkipOptimizationForDuration && audioBlob.size > 1024 * 1024;

      const [apiKey, optimizedAudio] = await Promise.all([
        this.getAPIKey(),
        shouldOptimize ? this.optimizeAudio(audioBlob) : Promise.resolve(audioBlob),
      ]);

      const formData = new FormData();
      formData.append("file", optimizedAudio, "audio.wav");
      formData.append("model", "whisper-1");

      if (language && language !== "auto") {
        formData.append("language", language);
      }

      const response = await fetch(
        this.getTranscriptionEndpoint(),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.status} ${errorText}`);
      }

      const result = await response.json();

      if (result.text) {
        this.markLatencyStage("05_transcription_response", {
          description: "Transcription response received",
          source: "openai",
          textLength: result.text.length,
        });
        const text = await this.processTranscription(result.text, "openai");
        const source = await this.isReasoningAvailable() ? "openai-reasoned" : "openai";
        return { success: true, text, source };
      } else {
        throw new Error("No text transcribed");
      }
    } catch (error) {
      const isOpenAIMode = localStorage.getItem("useLocalWhisper") !== "true";

      if (allowLocalFallback && isOpenAIMode) {
        try {
          this.markLatencyStage("04_transcription_request_fallback", {
            description: "Local fallback transcription request",
            engine: "local-fallback",
          });
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
            this.markLatencyStage("05_transcription_response", {
              description: "Transcription response received",
              source: "local-fallback",
              textLength: result.text.length,
            });
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
      this.markLatencyStage(
        "08_paste_complete",
        { description: "Paste completed", textLength: text?.length || 0 },
        { total: true, complete: true }
      );
      return true;
    } catch (error) {
      this.markLatencyStage(
        "08_paste_failed",
        { description: "Paste failed", error: error.message },
        { total: true, complete: true }
      );
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
    if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
      this.stopRecording();
    }
    this.onStateChange = null;
    this.onError = null;
    this.onTranscriptionComplete = null;
  }
}

export default AudioManager;
