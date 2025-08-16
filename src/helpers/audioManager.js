import TextCleanup from "../utils/textCleanup";
import ReasoningService from "../services/ReasoningService";


class AudioManager {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.isProcessing = false;
    this.onStateChange = null;
    this.onError = null;
    this.onTranscriptionComplete = null;
    this.cachedApiKey = null; // Cache API key
  }

  // Set callback functions
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
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        this.audioChunks.push(event.data);
      };

      this.mediaRecorder.onstop = async () => {
        this.isRecording = false;
        this.isProcessing = true;
        this.onStateChange?.({ isRecording: false, isProcessing: true });

        const audioBlob = new Blob(this.audioChunks, { type: "audio/wav" });
        
        if (audioBlob.size === 0) {
        }
        
        await this.processAudio(audioBlob);

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

  async processAudio(audioBlob) {
    try {
      // Get user preferences
      const useLocalWhisper =
        localStorage.getItem("useLocalWhisper") === "true";
      const whisperModel = localStorage.getItem("whisperModel") || "base";
      

      let result;
      if (useLocalWhisper) {
        result = await this.processWithLocalWhisper(audioBlob, whisperModel);
      } else {
        result = await this.processWithOpenAIAPI(audioBlob);
      }
      this.onTranscriptionComplete?.(result);
    } catch (error) {
      // Don't show error here if it's "No audio detected" - already shown elsewhere
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

  static cleanTranscription(text, options = {}) {
    return TextCleanup.cleanTranscription(text, {
      removeArtifacts: true,
      normalizeSpaces: true,
      fixPunctuation: true,
      removeFillers: true,
      removeRepetitions: true,
      capitalizeFirst: true,
      addPeriod: false,
      ...options,
    });
  }

  static cleanTranscriptionForAPI(text) {
    // Minimal cleanup - only normalize spaces for API processing
    return TextCleanup.normalizeSpaces(text);
  }

  async processWithLocalWhisper(audioBlob, model = "base") {
    
    // Analyze audio levels first
    const audioAnalysis = await this.analyzeAudioLevels(audioBlob);
    if (audioAnalysis && audioAnalysis.isSilent) {
      // Show error to user immediately
      this.onError?.({
        title: "No Audio Detected",
        description: "The recording appears to be silent. Please check that your microphone is working and not muted.",
      });
      // Still continue to try transcription in case analysis was wrong
    }
    
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();

      // Get language preference for local Whisper
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
        if (text) {
          return { success: true, text, source: "local" };
        } else {
          throw new Error("No text transcribed");
        }
      } else if (
        result.success === false &&
        result.message === "No audio detected"
      ) {
        // Show specific error to user with more details
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
          const fallbackResult = await this.processWithOpenAIAPI(audioBlob);
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

  async analyzeAudioLevels(audioBlob) {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const channelData = audioBuffer.getChannelData(0);
      let sum = 0;
      let max = 0;
      
      for (let i = 0; i < channelData.length; i++) {
        const sample = Math.abs(channelData[i]);
        sum += sample;
        max = Math.max(max, sample);
      }
      
      const average = sum / channelData.length;
      const duration = audioBuffer.duration;
      
      
      return {
        duration,
        averageLevel: average,
        maxLevel: max,
        isSilent: max < 0.01
      };
    } catch (error) {
      return null;
    }
  }

  // Convert audio to optimal format for API (reduces upload time)
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

          // Convert to WAV blob
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

  // Convert AudioBuffer to WAV format
  audioBufferToWav(buffer) {
    const length = buffer.length;
    const arrayBuffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(arrayBuffer);
    const sampleRate = buffer.sampleRate;
    const channelData = buffer.getChannelData(0);

    // WAV header
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

    // Convert samples to 16-bit PCM
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

  async processWithReasoningModel(text) {
    const model = localStorage.getItem("reasoningModel") || "gpt-3.5-turbo";
    return await ReasoningService.processText(text, model);
  }

  async isReasoningAvailable() {
    const useReasoning = localStorage.getItem("useReasoningModel") === "true";
    if (!useReasoning) return false;
    
    try {
      return await ReasoningService.isAvailable();
    } catch {
      return false;
    }
  }

  async processTranscription(text, source) {
    // Check if reasoning should handle cleanup
    const useReasoning = await this.isReasoningAvailable();
    
    if (useReasoning) {
      try {
        // Minimal cleanup for reasoning models
        const preparedText = AudioManager.cleanTranscriptionForAPI(text);
        return await this.processWithReasoningModel(preparedText);
      } catch (error) {
        console.error(`Reasoning failed (${source}):`, error.message);
        // Fall back to standard cleanup
      }
    }
    
    // Standard cleanup when reasoning is unavailable or fails
    return AudioManager.cleanTranscription(text);
  }

  async processWithOpenAIAPI(audioBlob) {
    try {
      // Parallel: get API key (cached) and optimize audio
      const [apiKey, optimizedAudio] = await Promise.all([
        this.getAPIKey(),
        this.optimizeAudio(audioBlob),
      ]);

      const formData = new FormData();
      formData.append("file", optimizedAudio, "audio.wav");
      formData.append("model", "whisper-1");

      // Add language hint if set (improves processing speed)
      const language = localStorage.getItem("preferredLanguage");
      if (language && language !== "auto") {
        formData.append("language", language);
      }

      const response = await fetch(
        "https://api.openai.com/v1/audio/transcriptions",
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
        const text = await this.processTranscription(result.text, "openai");
        const source = await this.isReasoningAvailable() ? "openai-reasoned" : "openai";
        return { success: true, text, source };
      } else {
        throw new Error("No text transcribed");
      }
    } catch (error) {

      // Try fallback to Local Whisper ONLY if enabled AND we're in OpenAI mode
      const allowLocalFallback =
        localStorage.getItem("allowLocalFallback") === "true";
      const isOpenAIMode = localStorage.getItem("useLocalWhisper") !== "true";

      if (allowLocalFallback && isOpenAIMode) {
        const fallbackModel =
          localStorage.getItem("fallbackWhisperModel") || "base";
        try {
          const arrayBuffer = await audioBlob.arrayBuffer();

          // Get language preference for fallback as well
          const language = localStorage.getItem("preferredLanguage");
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
          // If local fallback fails, throw the original OpenAI error
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
