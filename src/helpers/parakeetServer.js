const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const debugLogger = require("./debugLogger");
const { getModelsDirForService } = require("./modelDirUtils");
const { getFFmpegPath, isWavFormat, convertToWav } = require("./ffmpegUtils");

const TRANSCRIPTION_TIMEOUT_MS = 300000; // 5 minutes

/**
 * ParakeetServerManager handles NVIDIA Parakeet model transcription via sherpa-onnx-offline CLI.
 * Unlike whisper-server which runs as a persistent HTTP server, sherpa-onnx-offline is invoked
 * per-transcription. Parakeet's speed makes this approach efficient.
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
    return getModelsDirForService("parakeet");
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
   * @param {Buffer} audioBuffer - Audio data (WAV or other format - will be converted if needed)
   * @param {Object} options - Transcription options
   * @param {string} options.modelName - Model name (default: parakeet-tdt-0.6b-v3)
   * @param {string} options.language - Language code for transcription (used for logging/validation)
   * @returns {Promise<{text: string, language?: string}>}
   */
  async transcribe(audioBuffer, options = {}) {
    const { modelName = "parakeet-tdt-0.6b-v3", language = "auto" } = options;

    const binaryPath = this.getBinaryPath();
    if (!binaryPath) {
      throw new Error("sherpa-onnx binary not found");
    }

    const modelDir = path.join(this.getModelsDir(), modelName);
    if (!this.isModelDownloaded(modelName)) {
      throw new Error(`Parakeet model "${modelName}" not downloaded`);
    }

    const isWav = isWavFormat(audioBuffer);
    debugLogger.debug("Parakeet transcription request", {
      modelName,
      language,
      audioSize: audioBuffer?.length || 0,
      isWavFormat: isWav,
    });

    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    const tempInputPath = path.join(
      tempDir,
      `parakeet-input-${timestamp}${isWav ? ".wav" : ".webm"}`
    );
    const tempWavPath = path.join(tempDir, `parakeet-${timestamp}.wav`);
    const filesToCleanup = [tempInputPath];

    try {
      fs.writeFileSync(tempInputPath, audioBuffer);

      let audioPath = tempInputPath;

      // Convert to WAV if not already in WAV format
      if (!isWav) {
        const ffmpegPath = getFFmpegPath();
        if (!ffmpegPath) {
          throw new Error(
            "FFmpeg not found - required for audio conversion. Please ensure FFmpeg is installed."
          );
        }

        const inputStats = fs.statSync(tempInputPath);
        debugLogger.debug("Converting audio to WAV", { inputSize: inputStats.size });

        await convertToWav(tempInputPath, tempWavPath, { sampleRate: 16000, channels: 1 });

        const outputStats = fs.statSync(tempWavPath);
        debugLogger.debug("FFmpeg conversion complete", { outputSize: outputStats.size });

        audioPath = tempWavPath;
        filesToCleanup.push(tempWavPath);
      }

      const result = await this._runTranscription(binaryPath, modelDir, audioPath, {
        language,
      });
      return { ...result, language };
    } finally {
      // Cleanup temp files
      for (const filePath of filesToCleanup) {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (err) {
          debugLogger.warn("Failed to cleanup temp audio file", {
            path: filePath,
            error: err.message,
          });
        }
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
      // Note: sherpa-onnx requires --option=value format, not --option value
      // Parakeet models auto-detect language, no explicit language parameter needed
      const args = [
        `--tokens=${path.join(modelDir, "tokens.txt")}`,
        `--encoder=${path.join(modelDir, "encoder.int8.onnx")}`,
        `--decoder=${path.join(modelDir, "decoder.int8.onnx")}`,
        `--joiner=${path.join(modelDir, "joiner.int8.onnx")}`,
        `--num-threads=${Math.max(1, Math.floor(os.cpus().length * 0.75))}`,
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
          const stderrPreview =
            stderr.length > 1000 ? `${stderr.slice(0, 500)} ... ${stderr.slice(-500)}` : stderr;
          reject(new Error(`sherpa-onnx exited with code ${code}: ${stderrPreview.trim()}`));
          return;
        }

        // Parse the output - sherpa-onnx-offline may output to stderr in some builds
        const text = this._parseOutput(stdout, stderr);
        debugLogger.debug("sherpa-onnx parsed output", { text, textLength: text?.length || 0 });

        resolve({ text, elapsed });
      });
    });
  }

  /**
   * Parse sherpa-onnx-offline output to extract transcription text.
   * Output format is JSON: {"lang": "", "emotion": "", "event": "", "text": "transcribed text", ...}
   */
  _parseOutput(stdout, stderr = "") {
    const output = [stdout, stderr].filter((value) => value && value.trim()).join("\n");
    if (!output) return "";

    const lines = output.trim().split("\n");

    // Look for JSON output containing the transcription
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (!line) continue;

      // Try to parse as JSON (sherpa-onnx outputs JSON with text field)
      if (line.startsWith("{") && line.includes('"text"')) {
        try {
          const parsed = JSON.parse(line);
          if (typeof parsed.text === "string") return parsed.text.trim();
        } catch {
          // Not valid JSON, continue to fallback
        }
      }
    }

    // Fallback for non-JSON output: find last meaningful line
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line && !line.match(/^\d+\.\d+/) && !line.includes(".wav") && !line.startsWith("{")) {
        return line;
      }
    }

    return "";
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
