const WebSocket = require("ws");
const debugLogger = require("./debugLogger");

const SAMPLE_RATE = 16000;
const WEBSOCKET_TIMEOUT_MS = 30000;
const TERMINATION_TIMEOUT_MS = 1500;
const TOKEN_REFRESH_BUFFER_MS = 30000;
const TOKEN_EXPIRY_MS = 300000;

class AssemblyAiStreaming {
  constructor() {
    this.ws = null;
    this.sessionId = null;
    this.isConnected = false;
    this.onPartialTranscript = null;
    this.onFinalTranscript = null;
    this.onError = null;
    this.onSessionEnd = null;
    this.pendingResolve = null;
    this.pendingReject = null;
    this.connectionTimeout = null;
    this.accumulatedText = "";
    this.lastTurnText = "";
    this.turns = [];
    this.terminationResolve = null;
    this.cachedToken = null;
    this.tokenFetchedAt = null;
    this.warmConnection = null;
    this.warmConnectionReady = false;
  }

  buildWebSocketUrl(options) {
    const sampleRate = options.sampleRate || SAMPLE_RATE;
    const params = new URLSearchParams({
      sample_rate: String(sampleRate),
      encoding: "pcm_s16le",
      format_turns: "true",
      token: options.token,
    });
    if (options.language && options.language !== "auto") {
      params.set("speech_model", "universal-streaming-multilingual");
    }
    return `wss://streaming.assemblyai.com/v3/ws?${params.toString()}`;
  }

  cacheToken(token) {
    this.cachedToken = token;
    this.tokenFetchedAt = Date.now();
    debugLogger.debug("AssemblyAI token cached", { expiresIn: TOKEN_EXPIRY_MS });
  }

  isTokenValid() {
    if (!this.cachedToken || !this.tokenFetchedAt) return false;
    const age = Date.now() - this.tokenFetchedAt;
    return age < TOKEN_EXPIRY_MS - TOKEN_REFRESH_BUFFER_MS;
  }

  getCachedToken() {
    return this.isTokenValid() ? this.cachedToken : null;
  }

  async warmup(options = {}) {
    const { token } = options;
    if (!token) {
      throw new Error("Streaming token is required for warmup");
    }

    if (this.warmConnection) {
      debugLogger.debug(
        this.warmConnectionReady
          ? "AssemblyAI connection already warm"
          : "AssemblyAI warmup already in progress, skipping"
      );
      return;
    }

    this.warmConnectionReady = false;
    this.cachedToken = token;
    this.tokenFetchedAt = Date.now();

    const url = this.buildWebSocketUrl(options);
    debugLogger.debug("AssemblyAI warming up connection");

    return new Promise((resolve, reject) => {
      const warmupTimeout = setTimeout(() => {
        this.cleanupWarmConnection();
        reject(new Error("AssemblyAI warmup connection timeout"));
      }, WEBSOCKET_TIMEOUT_MS);

      this.warmConnection = new WebSocket(url);

      this.warmConnection.on("open", () => {
        debugLogger.debug("AssemblyAI warm connection socket opened");
      });

      this.warmConnection.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === "Begin") {
            clearTimeout(warmupTimeout);
            this.warmConnectionReady = true;
            debugLogger.debug("AssemblyAI connection warmed up", { sessionId: message.id });
            resolve();
          }
        } catch (err) {
          debugLogger.error("AssemblyAI warmup message parse error", { error: err.message });
        }
      });

      this.warmConnection.on("error", (error) => {
        clearTimeout(warmupTimeout);
        debugLogger.error("AssemblyAI warmup connection error", { error: error.message });
        this.cleanupWarmConnection();
        reject(error);
      });

      this.warmConnection.on("close", () => {
        clearTimeout(warmupTimeout);
        debugLogger.debug("AssemblyAI warm connection closed");
        this.cleanupWarmConnection();
      });
    });
  }

  useWarmConnection() {
    if (!this.warmConnection || !this.warmConnectionReady) {
      return false;
    }

    // Transfer warm connection to active connection
    this.ws = this.warmConnection;
    this.isConnected = true;
    this.warmConnection = null;
    this.warmConnectionReady = false;

    // Re-attach message handler for transcription events
    this.ws.removeAllListeners("message");
    this.ws.on("message", (data) => {
      this.handleMessage(data);
    });

    this.ws.removeAllListeners("error");
    this.ws.on("error", (error) => {
      debugLogger.error("AssemblyAI WebSocket error", { error: error.message });
      this.cleanup();
      this.onError?.(error);
    });

    this.ws.removeAllListeners("close");
    this.ws.on("close", (code, reason) => {
      debugLogger.debug("AssemblyAI WebSocket closed", { code, reason: reason?.toString() });
      this.cleanup();
    });

    debugLogger.debug("AssemblyAI using pre-warmed connection");
    return true;
  }

  cleanupWarmConnection() {
    if (this.warmConnection) {
      try {
        this.warmConnection.close();
      } catch (err) {
        // Ignore
      }
      this.warmConnection = null;
    }
    this.warmConnectionReady = false;
    this.warmConnectionOptions = null;
  }

  hasWarmConnection() {
    return this.warmConnection !== null && this.warmConnectionReady;
  }

  async connect(options = {}) {
    const { token } = options;
    if (!token) {
      throw new Error("Streaming token is required");
    }

    if (this.isConnected) {
      debugLogger.debug("AssemblyAI streaming already connected");
      return;
    }

    // Reset accumulated text for new session
    this.accumulatedText = "";
    this.lastTurnText = "";
    this.turns = [];

    // Try to use pre-warmed connection for instant start
    if (this.hasWarmConnection()) {
      if (this.useWarmConnection()) {
        debugLogger.debug("AssemblyAI using warm connection - instant start");
        return;
      }
    }

    const url = this.buildWebSocketUrl(options);
    debugLogger.debug("AssemblyAI streaming connecting (cold start)");

    return new Promise((resolve, reject) => {
      this.pendingResolve = resolve;
      this.pendingReject = reject;

      this.connectionTimeout = setTimeout(() => {
        this.cleanup();
        reject(new Error("AssemblyAI WebSocket connection timeout"));
      }, WEBSOCKET_TIMEOUT_MS);

      this.ws = new WebSocket(url);

      this.ws.on("open", () => {
        debugLogger.debug("AssemblyAI WebSocket connected");
      });

      this.ws.on("message", (data) => {
        this.handleMessage(data);
      });

      this.ws.on("error", (error) => {
        debugLogger.error("AssemblyAI WebSocket error", { error: error.message });
        this.cleanup();
        if (this.pendingReject) {
          this.pendingReject(error);
          this.pendingReject = null;
          this.pendingResolve = null;
        }
        this.onError?.(error);
      });

      this.ws.on("close", (code, reason) => {
        debugLogger.debug("AssemblyAI WebSocket closed", { code, reason: reason?.toString() });
        this.cleanup();
      });
    });
  }

  handleMessage(data) {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case "Begin":
          this.sessionId = message.id;
          this.isConnected = true;
          clearTimeout(this.connectionTimeout);
          debugLogger.debug("AssemblyAI session started", { sessionId: this.sessionId });
          if (this.pendingResolve) {
            this.pendingResolve();
            this.pendingResolve = null;
            this.pendingReject = null;
          }
          break;

        case "Turn":
          if (message.transcript) {
            if (message.end_of_turn) {
              // Turn has ended - append once, then replace with formatted variant if needed
              const trimmedTranscript = message.transcript.trim();
              const normalizedTranscript = this.normalizeTurnText(trimmedTranscript);
              const previousTurn = this.turns[this.turns.length - 1];

              if (!trimmedTranscript || !normalizedTranscript) {
                break;
              }

              if (previousTurn && previousTurn.normalized === normalizedTranscript) {
                // AssemblyAI can emit the same turn twice (raw then formatted). Replace previous
                // turn only when this variant is formatted, otherwise ignore duplicate.
                if (message.turn_is_formatted && previousTurn.text !== trimmedTranscript) {
                  previousTurn.text = trimmedTranscript;
                  this.lastTurnText = trimmedTranscript;
                  this.accumulatedText = this.turns.map((turn) => turn.text).join(" ");
                  this.onFinalTranscript?.(this.accumulatedText);
                  debugLogger.debug("AssemblyAI formatted turn update applied", {
                    text: trimmedTranscript.slice(0, 100),
                    totalAccumulated: this.accumulatedText.length,
                  });
                } else {
                  debugLogger.debug("AssemblyAI duplicate turn ignored", {
                    text: trimmedTranscript.slice(0, 100),
                  });
                }
                break;
              }

              this.turns.push({
                text: trimmedTranscript,
                normalized: normalizedTranscript,
              });
              this.lastTurnText = trimmedTranscript;
              this.accumulatedText = this.turns.map((turn) => turn.text).join(" ");
              this.onFinalTranscript?.(this.accumulatedText);
              debugLogger.debug("AssemblyAI final transcript (end_of_turn)", {
                text: message.transcript.slice(0, 100),
                totalAccumulated: this.accumulatedText.length,
              });
            } else if (message.turn_is_formatted) {
              // Formatted but turn not ended yet - show as preview without accumulating
              this.onPartialTranscript?.(message.transcript);
            } else {
              // Partial transcript - show real-time updates (current turn only)
              this.onPartialTranscript?.(message.transcript);
            }
          }
          break;

        case "Termination":
          debugLogger.debug("AssemblyAI session terminated", {
            audioDuration: message.audio_duration_seconds,
          });
          // Resolve any pending termination wait
          if (this.terminationResolve) {
            this.terminationResolve({
              audioDuration: message.audio_duration_seconds,
              text: this.accumulatedText,
            });
            this.terminationResolve = null;
          }
          this.onSessionEnd?.({
            audioDuration: message.audio_duration_seconds,
            text: this.accumulatedText,
          });
          this.cleanup();
          break;

        case "Error":
          debugLogger.error("AssemblyAI streaming error", { error: message.error });
          this.onError?.(new Error(message.error));
          break;

        default:
          debugLogger.debug("AssemblyAI unknown message type", { type: message.type });
      }
    } catch (err) {
      debugLogger.error("AssemblyAI message parse error", { error: err.message });
    }
  }

  normalizeTurnText(text) {
    return text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  sendAudio(pcmBuffer) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    this.ws.send(pcmBuffer);
    return true;
  }

  async disconnect(terminate = true) {
    if (!this.ws) return { text: this.accumulatedText };

    if (terminate && this.ws.readyState === WebSocket.OPEN) {
      try {
        // Send terminate message and wait for Termination response (event-driven)
        this.ws.send(JSON.stringify({ type: "Terminate" }));

        // Wait for the Termination message from server, with a timeout fallback
        const result = await Promise.race([
          new Promise((resolve) => {
            this.terminationResolve = resolve;
          }),
          new Promise((resolve) =>
            setTimeout(() => {
              debugLogger.debug("AssemblyAI termination timeout, using accumulated text");
              resolve({ text: this.accumulatedText });
            }, TERMINATION_TIMEOUT_MS)
          ),
        ]);

        this.terminationResolve = null;
        this.cleanup();
        return result;
      } catch (err) {
        debugLogger.debug("AssemblyAI terminate send failed", { error: err.message });
      }
    }

    const result = { text: this.accumulatedText };
    this.cleanup();
    return result;
  }

  cleanup() {
    clearTimeout(this.connectionTimeout);
    this.connectionTimeout = null;

    if (this.ws) {
      try {
        this.ws.close();
      } catch (err) {
        // Ignore close errors
      }
      this.ws = null;
    }

    this.isConnected = false;
    this.sessionId = null;
    this.terminationResolve = null;
  }

  cleanupAll() {
    this.cleanup();
    this.cleanupWarmConnection();
    this.cachedToken = null;
    this.tokenFetchedAt = null;
    this.turns = [];
  }

  getStatus() {
    return {
      isConnected: this.isConnected,
      sessionId: this.sessionId,
      hasWarmConnection: this.hasWarmConnection(),
      hasValidToken: this.isTokenValid(),
    };
  }
}

module.exports = AssemblyAiStreaming;
