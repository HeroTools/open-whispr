/**
 * AudioWorklet processor that converts float32 mic samples to int16 PCM
 * and posts them to the main thread for streaming to STT services.
 *
 * Registered as "pcm-streaming-processor" — used by audioManager.js.
 */
class PCMStreamingProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._stopped = false;

    this.port.onmessage = (event) => {
      if (event.data === "stop") {
        this._stopped = true;
        // Flush is implicit — the next process() call (if any) will be the last.
      }
    };
  }

  process(inputs) {
    if (this._stopped) {
      return false; // Tell the AudioWorklet to remove this node
    }

    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) {
      return true;
    }

    const float32 = input[0];
    const int16 = new Int16Array(float32.length);

    for (let i = 0; i < float32.length; i++) {
      // Clamp to [-1, 1] then scale to int16 range
      const s = Math.max(-1, Math.min(1, float32[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    this.port.postMessage(int16.buffer, [int16.buffer]);
    return true;
  }
}

registerProcessor("pcm-streaming-processor", PCMStreamingProcessor);
