const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const debugLogger = require("./debugLogger");

const TRANSCRIPTION_TIMEOUT_MS = 300000; // 5 minutes

/**
 * ParakeetServerManager handles NVIDIA Parakeet model transcription via sherpa-onnx-offline CLI.
 * Unlike whisper-server which runs as a persistent HTTP server, sherpa-onnx-offline is invoked
 * per-transcription. Parakeet's speed (50x faster than Whisper) makes this approach efficient.
 */
class ParakeetServerManager {
  constructor() {
    this.cachedBinaryPath = null;
    this.currentModelPath = null;
  }

  getBinaryPath() {
    if (this.cachedBinaryPath) return this.cachedBinaryPath;

    const platform = process.platform;
    const arch = process.arch;
    const platformArch = `${platform}-${arch}`;
    const binaryName =
      platform === "win32" ? `sherpa-onnx-${platformArch}.exe` : `sherpa-onnx-${platformArch}`;

    const candidates = [];

    if (process.resourcesPath) {
      candidates.push(path.join(process.resourcesPath, "bin", binaryName));
    }

    candidates.push(path.join(__dirname, "..", "..", "resources", "bin", binaryName));

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        try {
          fs.statSync(candidate);
          this.cachedBinaryPath = candidate;
          return candidate;
        } catch {
          // Can't access binary
        }
      }
    }

    return null;
  }

  isAvailable() {
    return this.getBinaryPath() !== null;
  }

  /**
   * Get the models directory for Parakeet models
   */
  getModelsDir() {
    const homeDir = os.homedir();
    return path.join(homeDir, ".cache", "openwhispr", "parakeet-models");
  }

  /**
   * Check if a specific model is downloaded
   */
  isModelDownloaded(modelName) {
    const modelDir = path.join(this.getModelsDir(), modelName);
    const requiredFiles = [
      "encoder.int8.onnx",
      "decoder.int8.onnx",
      "joiner.int8.onnx",
      "tokens.txt",
    ];

    if (!fs.existsSync(modelDir)) return false;

    for (const file of requiredFiles) {
      if (!fs.existsSync(path.join(modelDir, file))) {
        return false;
      }
    }

    return true;
  }

  /**
   * Transcribe audio using sherpa-onnx-offline CLI
   * @param {Buffer} audioBuffer - Audio data (WAV format preferred)
   * @param {Object} options - Transcription options
   * @param {string} options.modelName - Model name (default: parakeet-tdt-0.6b-v2)
   * @param {string} options.language - Language code for transcription (used for logging/validation)
   * @returns {Promise<{text: string, language?: string}>}
   */
  async transcribe(audioBuffer, options = {}) {
    const { modelName = "parakeet-tdt-0.6b-v2", language = "auto" } = options;

    const binaryPath = this.getBinaryPath();
    if (!binaryPath) {
      throw new Error("sherpa-onnx binary not found");
    }

    const modelDir = path.join(this.getModelsDir(), modelName);
    if (!this.isModelDownloaded(modelName)) {
      throw new Error(`Parakeet model "${modelName}" not downloaded`);
    }

    debugLogger.debug("Parakeet transcription request", {
      modelName,
      language,
      audioSize: audioBuffer?.length || 0,
    });

    // Write audio to temporary file
    const tempDir = os.tmpdir();
    const tempAudioPath = path.join(tempDir, `parakeet-${Date.now()}.wav`);

    try {
      fs.writeFileSync(tempAudioPath, audioBuffer);

      const result = await this._runTranscription(binaryPath, modelDir, tempAudioPath, {
        language,
      });
      // Include the requested language in the result for reference
      return { ...result, language };
    } finally {
      // Cleanup temp file
      try {
        if (fs.existsSync(tempAudioPath)) {
          fs.unlinkSync(tempAudioPath);
        }
      } catch (err) {
        debugLogger.warn("Failed to cleanup temp audio file", { error: err.message });
      }
    }
  }

  /**
   * Run the sherpa-onnx-offline transcription process
   * @param {string} binaryPath - Path to sherpa-onnx-offline binary
   * @param {string} modelDir - Path to model directory
   * @param {string} audioPath - Path to audio file
   * @param {Object} options - Transcription options
   * @param {string} options.language - Language code (for logging, Parakeet auto-detects)
   */
  async _runTranscription(binaryPath, modelDir, audioPath, options = {}) {
    const { language = "auto" } = options;

    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      // Build command arguments for sherpa-onnx-offline (transducer model)
      // Note: Parakeet models auto-detect language, no explicit language parameter needed
      const args = [
        "--tokens",
        path.join(modelDir, "tokens.txt"),
        "--encoder",
        path.join(modelDir, "encoder.int8.onnx"),
        "--decoder",
        path.join(modelDir, "decoder.int8.onnx"),
        "--joiner",
        path.join(modelDir, "joiner.int8.onnx"),
        "--num-threads",
        String(Math.max(1, Math.floor(os.cpus().length * 0.75))),
        audioPath,
      ];

      debugLogger.debug("Running sherpa-onnx-offline", {
        binaryPath,
        modelDir,
        audioPath,
        language,
        numArgs: args.length,
      });

      const proc = spawn(binaryPath, args, {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
        cwd: os.tmpdir(),
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data) => {
        stderr += data.toString();
        debugLogger.debug("sherpa-onnx stderr", { data: data.toString().trim() });
      });

      const timeoutId = setTimeout(() => {
        proc.kill("SIGKILL");
        reject(new Error("Transcription timed out"));
      }, TRANSCRIPTION_TIMEOUT_MS);

      proc.on("error", (error) => {
        clearTimeout(timeoutId);
        reject(new Error(`sherpa-onnx process error: ${error.message}`));
      });

      proc.on("close", (code) => {
        clearTimeout(timeoutId);
        const elapsed = Date.now() - startTime;

        debugLogger.debug("sherpa-onnx completed", {
          code,
          elapsed,
          stdoutLength: stdout.length,
        });

        if (code !== 0) {
          reject(new Error(`sherpa-onnx exited with code ${code}: ${stderr.slice(0, 500)}`));
          return;
        }

        // Parse the output - sherpa-onnx-offline outputs the transcription directly
        const text = this._parseOutput(stdout);

        resolve({ text, elapsed });
      });
    });
  }

  /**
   * Parse sherpa-onnx-offline output to extract transcription text
   */
  _parseOutput(stdout) {
    // sherpa-onnx-offline typically outputs the transcription on a single line
    // Format may be: "filename.wav\nTranscription text here"
    // or just the text directly
    const lines = stdout.trim().split("\n");

    // Find the line that contains the actual transcription
    // Usually it's the last non-empty line that doesn't start with timestamps or metadata
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line && !line.match(/^\d+\.\d+/) && !line.includes(".wav")) {
        return line;
      }
    }

    // Fallback: return all non-empty lines joined
    return lines
      .filter((line) => line.trim() && !line.includes(".wav"))
      .join(" ")
      .trim();
  }

  getStatus() {
    return {
      available: this.isAvailable(),
      binaryPath: this.getBinaryPath(),
      modelsDir: this.getModelsDir(),
    };
  }
}

module.exports = ParakeetServerManager;
