const WebSocket = require("ws");
const logger = require("./debugLogger");

const WEBSOCKET_TIMEOUT_MS = 30000;
const CLOSE_TIMEOUT_MS = 5000;

class DeepgramStreaming {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.onPartialTranscript = null;
    this.onFinalTranscript = null;
    this.onError = null;

    this.accumulatedText = "";
    this.connectResolve = null;
    this.connectReject = null;
    this.closeResolve = null;
    this.connectTimeout = null;
    this.closeTimeout = null;
  }

  /**
   * Open a streaming WebSocket to Deepgram Nova-3.
   * @param {Object} options
   * @param {string} options.apiKey - Deepgram API key
   * @param {number} [options.sampleRate=16000]
   * @param {string} [options.language] - BCP-47 language code (e.g. "en", "es")
   */
  async connect(options = {}) {
    const { apiKey, sampleRate = 16000, language } = options;

    if (!apiKey) {
      throw new Error("Deepgram API key is required");
    }

    if (this.isConnected) {
      await this.disconnect();
    }

    return new Promise((resolve, reject) => {
      this.connectResolve = resolve;
      this.connectReject = reject;

      const params = new URLSearchParams({
        encoding: "linear16",
        sample_rate: String(sampleRate),
        channels: "1",
        model: "nova-3",
        punctuate: "true",
        interim_results: "true",
        utterance_end_ms: "1000",
        smart_format: "true",
      });

      if (language && language !== "auto") {
        params.set("language", language);
      } else {
        params.set("detect_language", "true");
      }

      const url = `wss://api.deepgram.com/v1/listen?${params.toString()}`;

      try {
        this.ws = new WebSocket(url, {
          headers: {
            Authorization: `Token ${apiKey}`,
          },
        });
      } catch (err) {
        this.connectResolve = null;
        this.connectReject = null;
        reject(err);
        return;
      }

      this.connectTimeout = setTimeout(() => {
        if (this.connectResolve) {
          const err = new Error("Deepgram connection timeout");
          this.connectReject?.(err);
          this.connectResolve = null;
          this.connectReject = null;
          this.cleanup();
        }
      }, WEBSOCKET_TIMEOUT_MS);

      this.ws.on("open", () => {
        this.isConnected = true;
        clearTimeout(this.connectTimeout);
        this.connectTimeout = null;
        logger.info("Deepgram streaming connected", {}, "streaming");
        this.connectResolve?.({ success: true });
        this.connectResolve = null;
        this.connectReject = null;
      });

      this.ws.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString());
          this._handleMessage(msg);
        } catch (err) {
          logger.warn(
            "Failed to parse Deepgram message",
            { error: err.message },
            "streaming"
          );
        }
      });

      this.ws.on("error", (err) => {
        logger.error("Deepgram WebSocket error", { error: err.message }, "streaming");
        this.onError?.(err.message);
        if (this.connectReject) {
          this.connectReject(err);
          this.connectResolve = null;
          this.connectReject = null;
          clearTimeout(this.connectTimeout);
          this.connectTimeout = null;
        }
      });

      this.ws.on("close", (code, reason) => {
        logger.debug(
          "Deepgram WebSocket closed",
          { code, reason: reason?.toString() },
          "streaming"
        );
        this.isConnected = false;
        if (this.closeResolve) {
          this.closeResolve();
          this.closeResolve = null;
          clearTimeout(this.closeTimeout);
          this.closeTimeout = null;
        }
      });
    });
  }

  _handleMessage(msg) {
    // Deepgram sends Results messages with channel alternatives
    if (msg.type === "Results" && msg.channel?.alternatives?.length > 0) {
      const alt = msg.channel.alternatives[0];
      const transcript = alt.transcript || "";

      if (!transcript) return;

      if (msg.is_final) {
        // Final result for this utterance segment — accumulate
        this.accumulatedText = this.accumulatedText
          ? `${this.accumulatedText} ${transcript}`
          : transcript;

        this.onFinalTranscript?.(this.accumulatedText);
        this.onPartialTranscript?.(this.accumulatedText);
      } else {
        // Interim/partial result — show accumulated + current partial
        const display = this.accumulatedText
          ? `${this.accumulatedText} ${transcript}`
          : transcript;
        this.onPartialTranscript?.(display);
      }
    } else if (msg.type === "UtteranceEnd") {
      // Utterance boundary — emit accumulated as final if present
      if (this.accumulatedText) {
        this.onFinalTranscript?.(this.accumulatedText);
      }
    } else if (msg.type === "Metadata") {
      logger.debug("Deepgram metadata", { requestId: msg.request_id }, "streaming");
    } else if (msg.type === "Error") {
      logger.error("Deepgram server error", { message: msg.message }, "streaming");
      this.onError?.(msg.message || "Deepgram server error");
    }
  }

  /**
   * Send raw int16 PCM audio data to Deepgram.
   * @param {Buffer|ArrayBuffer} pcmBuffer
   * @returns {boolean}
   */
  sendAudio(pcmBuffer) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    this.ws.send(pcmBuffer);
    return true;
  }

  /**
   * Gracefully close the streaming session.
   * @returns {Promise<{ text: string }>}
   */
  async disconnect() {
    const finalText = this.accumulatedText || "";

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Send Deepgram's CloseStream message
      try {
        this.ws.send(JSON.stringify({ type: "CloseStream" }));
      } catch (e) {
        // Ignore send errors during close
      }

      // Wait for the WebSocket to close gracefully
      await new Promise((resolve) => {
        this.closeResolve = resolve;
        this.closeTimeout = setTimeout(() => {
          logger.debug("Deepgram close timeout, forcing cleanup", {}, "streaming");
          this.closeResolve = null;
          resolve();
        }, CLOSE_TIMEOUT_MS);
      });
    }

    this.cleanup();
    return { text: finalText };
  }

  cleanup() {
    if (this.ws) {
      try {
        if (
          this.ws.readyState === WebSocket.OPEN ||
          this.ws.readyState === WebSocket.CONNECTING
        ) {
          this.ws.close();
        }
      } catch (e) {
        // Ignore
      }
      this.ws = null;
    }

    this.isConnected = false;
    this.accumulatedText = "";
    this.connectResolve = null;
    this.connectReject = null;
    this.closeResolve = null;

    clearTimeout(this.connectTimeout);
    clearTimeout(this.closeTimeout);
    this.connectTimeout = null;
    this.closeTimeout = null;
  }
}

module.exports = DeepgramStreaming;
