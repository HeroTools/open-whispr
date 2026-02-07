/**
 * OpenAI Realtime API streaming client for transcription-only mode.
 *
 * IMPORTANT: The OpenAI Realtime API evolves rapidly. The session schema,
 * event types, and model names used here were verified against the
 * documentation and community examples available in early 2025:
 *
 *   - URL: wss://api.openai.com/v1/realtime?intent=transcription
 *   - Session type: "transcription"
 *   - Transcription events: conversation.item.input_audio_transcription.{delta,completed}
 *   - Audio format: PCM16 @ 24kHz
 *   - Model: gpt-4o-mini-transcribe
 *
 * If streaming fails with schema or event errors, verify the above against
 * https://platform.openai.com/docs/guides/realtime-transcription
 */
const WebSocket = require("ws");
const logger = require("./debugLogger");

const WEBSOCKET_TIMEOUT_MS = 30000;
const CLOSE_TIMEOUT_MS = 5000;

class OpenAIRealtimeStreaming {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.onPartialTranscript = null;
    this.onFinalTranscript = null;
    this.onError = null;

    this.accumulatedText = "";
    this.currentDelta = "";
    this.connectResolve = null;
    this.connectReject = null;
    this.connectTimeout = null;
  }

  /**
   * Open a WebSocket to the OpenAI Realtime transcription API.
   * @param {Object} options
   * @param {string} options.apiKey - OpenAI API key
   * @param {string} [options.language] - BCP-47 language code
   * @param {string} [options.model] - Transcription model (default: gpt-4o-mini-transcribe)
   */
  async connect(options = {}) {
    const { apiKey, language, model = "gpt-4o-mini-transcribe" } = options;

    if (!apiKey) {
      throw new Error("OpenAI API key is required");
    }

    if (this.isConnected) {
      await this.disconnect();
    }

    return new Promise((resolve, reject) => {
      this.connectResolve = resolve;
      this.connectReject = reject;

      const url = "wss://api.openai.com/v1/realtime?intent=transcription";

      try {
        this.ws = new WebSocket(url, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "OpenAI-Beta": "realtime=v1",
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
          const err = new Error("OpenAI Realtime connection timeout");
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

        // Configure transcription session
        const sessionConfig = {
          type: "session.update",
          session: {
            type: "transcription",
            audio: {
              input: {
                format: {
                  type: "audio/pcm",
                  rate: 24000,
                },
                transcription: {
                  model,
                },
                turn_detection: {
                  type: "server_vad",
                  threshold: 0.5,
                  prefix_padding_ms: 300,
                  silence_duration_ms: 500,
                },
              },
            },
          },
        };

        if (language && language !== "auto") {
          sessionConfig.session.audio.input.transcription.language = language;
        }

        this.ws.send(JSON.stringify(sessionConfig));
        logger.info("OpenAI Realtime streaming connected", { model }, "streaming");

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
            "Failed to parse OpenAI Realtime message",
            { error: err.message },
            "streaming"
          );
        }
      });

      this.ws.on("error", (err) => {
        logger.error("OpenAI Realtime WebSocket error", { error: err.message }, "streaming");
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
          "OpenAI Realtime WebSocket closed",
          { code, reason: reason?.toString() },
          "streaming"
        );
        this.isConnected = false;
      });
    });
  }

  _handleMessage(msg) {
    switch (msg.type) {
      case "session.created":
      case "session.updated":
        logger.debug("OpenAI Realtime session event", { type: msg.type }, "streaming");
        break;

      case "conversation.item.input_audio_transcription.delta":
        // Partial/streaming transcript delta
        if (msg.delta) {
          this.currentDelta += msg.delta;
          const display = this.accumulatedText
            ? `${this.accumulatedText} ${this.currentDelta}`
            : this.currentDelta;
          this.onPartialTranscript?.(display);
        }
        break;

      case "conversation.item.input_audio_transcription.completed":
        // Final transcription for this utterance
        if (msg.transcript) {
          this.accumulatedText = this.accumulatedText
            ? `${this.accumulatedText} ${msg.transcript}`
            : msg.transcript;
          this.currentDelta = "";
          this.onFinalTranscript?.(this.accumulatedText);
          this.onPartialTranscript?.(this.accumulatedText);
        }
        break;

      case "input_audio_buffer.speech_started":
        logger.debug("OpenAI Realtime speech started", {}, "streaming");
        break;

      case "input_audio_buffer.speech_stopped":
        logger.debug("OpenAI Realtime speech stopped", {}, "streaming");
        break;

      case "error":
        logger.error(
          "OpenAI Realtime server error",
          { error: msg.error?.message, code: msg.error?.code },
          "streaming"
        );
        this.onError?.(msg.error?.message || "OpenAI Realtime server error");
        break;

      default:
        logger.debug("OpenAI Realtime unhandled event", { type: msg.type }, "streaming");
        break;
    }
  }

  /**
   * Send audio data to OpenAI Realtime API.
   * Audio must be base64-encoded PCM16 at 24kHz.
   * @param {Buffer} pcmBuffer - Int16 PCM buffer (will be base64-encoded)
   * @returns {boolean}
   */
  sendAudio(pcmBuffer) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    const base64Audio = Buffer.from(pcmBuffer).toString("base64");
    this.ws.send(
      JSON.stringify({
        type: "input_audio_buffer.append",
        audio: base64Audio,
      })
    );
    return true;
  }

  /**
   * Gracefully close the streaming session.
   * @returns {Promise<{ text: string }>}
   */
  async disconnect() {
    const finalText = this.accumulatedText || "";

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Commit any remaining audio buffer
      try {
        this.ws.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
      } catch (e) {
        // Ignore
      }

      // Brief wait for final transcription
      await new Promise((resolve) => setTimeout(resolve, 1000));

      try {
        this.ws.close();
      } catch (e) {
        // Ignore
      }

      // Wait for close
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    this.cleanup();
    return { text: this.accumulatedText || finalText };
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
    this.currentDelta = "";
    this.connectResolve = null;
    this.connectReject = null;

    clearTimeout(this.connectTimeout);
    this.connectTimeout = null;
  }
}

module.exports = OpenAIRealtimeStreaming;
