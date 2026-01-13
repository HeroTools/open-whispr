const { spawn } = require("child_process");
const { app } = require("electron");
const fs = require("fs");
const fsPromises = require("fs").promises;
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const https = require("https");
const { runCommand, killProcess, TIMEOUTS } = require("../utils/process");
const debugLogger = require("./debugLogger");

// Cache TTL for availability checks
const CACHE_TTL_MS = 30000;

// GGML model definitions with HuggingFace URLs
const WHISPER_MODELS = {
  tiny: {
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin",
    size: 75_000_000,
  },
  base: {
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
    size: 142_000_000,
  },
  small: {
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
    size: 466_000_000,
  },
  medium: {
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin",
    size: 1_500_000_000,
  },
  large: {
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin",
    size: 3_000_000_000,
  },
  turbo: {
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin",
    size: 1_600_000_000,
  },
};

class WhisperManager {
  constructor() {
    this.cachedBinaryPath = null;
    this.cachedFFmpegPath = null;
    this.currentDownloadProcess = null;
    this.ffmpegAvailabilityCache = { result: null, expiresAt: 0 };
    this.isInitialized = false;
  }

  getModelsDir() {
    const homeDir = app?.getPath?.("home") || os.homedir();
    return path.join(homeDir, ".cache", "openwhispr", "whisper-models");
  }

  validateModelName(modelName) {
    // Only allow known model names to prevent path traversal attacks
    const validModels = Object.keys(WHISPER_MODELS);
    if (!validModels.includes(modelName)) {
      throw new Error(`Invalid model name: ${modelName}. Valid models: ${validModels.join(", ")}`);
    }
    return true;
  }

  getModelPath(modelName) {
    this.validateModelName(modelName);
    return path.join(this.getModelsDir(), `ggml-${modelName}.bin`);
  }

  getBundledBinaryPath() {
    const platform = process.platform;
    const arch = process.arch;
    const platformArch = `${platform}-${arch}`;

    // Binary naming matches download-whisper-cpp.js output: whisper-cpp-darwin-arm64, whisper-cpp-win32-x64.exe
    const platformBinaryName =
      platform === "win32" ? `whisper-cpp-${platformArch}.exe` : `whisper-cpp-${platformArch}`;
    const genericBinaryName = platform === "win32" ? "whisper-cpp.exe" : "whisper-cpp";

    const candidates = [];

    // Production: check resources path
    if (process.resourcesPath) {
      candidates.push(
        path.join(process.resourcesPath, "bin", platformBinaryName),
        path.join(process.resourcesPath, "bin", genericBinaryName)
      );
    }

    // Development: check project resources
    candidates.push(
      path.join(__dirname, "..", "..", "resources", "bin", platformBinaryName),
      path.join(__dirname, "..", "..", "resources", "bin", genericBinaryName)
    );

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  async getSystemBinaryPath() {
    const binaryNames =
      process.platform === "win32"
        ? ["whisper.exe", "whisper-cpp.exe"]
        : ["whisper", "whisper-cpp", "main"];

    for (const name of binaryNames) {
      try {
        const checkCmd = process.platform === "win32" ? "where" : "which";
        const { output } = await runCommand(checkCmd, [name], { timeout: TIMEOUTS.QUICK_CHECK });
        const binaryPath = output.trim().split("\n")[0];
        if (binaryPath && fs.existsSync(binaryPath)) {
          return binaryPath;
        }
      } catch {
        continue;
      }
    }

    // Check common installation paths
    const commonPaths =
      process.platform === "darwin"
        ? ["/opt/homebrew/bin/whisper", "/usr/local/bin/whisper"]
        : ["/usr/bin/whisper", "/usr/local/bin/whisper"];

    for (const p of commonPaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    return null;
  }

  async getWhisperBinaryPath() {
    if (this.cachedBinaryPath && fs.existsSync(this.cachedBinaryPath)) {
      return this.cachedBinaryPath;
    }

    // Priority: bundled > system
    let binaryPath = this.getBundledBinaryPath();

    if (!binaryPath) {
      binaryPath = await this.getSystemBinaryPath();
    }

    if (binaryPath) {
      this.cachedBinaryPath = binaryPath;
      debugLogger.log("Using whisper.cpp binary:", binaryPath);
    }

    return binaryPath;
  }

  async initializeAtStartup() {
    try {
      await this.getWhisperBinaryPath();
      this.isInitialized = true;
    } catch (error) {
      debugLogger.log("whisper.cpp not available at startup:", error.message);
      this.isInitialized = true;
    }
  }

  async checkWhisperInstallation() {
    const binaryPath = await this.getWhisperBinaryPath();
    if (!binaryPath) {
      return { installed: false, working: false };
    }

    // Verify binary works
    try {
      await runCommand(binaryPath, ["--help"], { timeout: TIMEOUTS.QUICK_CHECK });
      return { installed: true, working: true, path: binaryPath };
    } catch (error) {
      return { installed: true, working: false, error: error.message };
    }
  }

  async transcribeLocalWhisper(audioBlob, options = {}) {
    debugLogger.logWhisperPipeline("transcribeLocalWhisper - start", {
      options,
      audioBlobType: audioBlob?.constructor?.name,
      audioBlobSize: audioBlob?.byteLength || audioBlob?.size || 0,
    });

    const binaryPath = await this.getWhisperBinaryPath();
    if (!binaryPath) {
      throw new Error(
        "whisper.cpp not found. Please install it via Homebrew (brew install whisper-cpp) or ensure it is bundled with the app."
      );
    }

    const tempAudioPath = await this.createTempAudioFile(audioBlob);
    const model = options.model || "base";
    const language = options.language || null;
    const modelPath = this.getModelPath(model);

    // Check if model exists
    if (!fs.existsSync(modelPath)) {
      await this.cleanupTempFile(tempAudioPath);
      throw new Error(`Whisper model "${model}" not downloaded. Please download it from Settings.`);
    }

    try {
      const result = await this.runWhisperProcess(binaryPath, tempAudioPath, modelPath, language);
      return this.parseWhisperResult(result);
    } finally {
      await this.cleanupTempFile(tempAudioPath);
    }
  }

  async createTempAudioFile(audioBlob) {
    const tempDir = os.tmpdir();
    const uniqueId = crypto.randomUUID();

    debugLogger.logAudioData("createTempAudioFile", audioBlob);

    let buffer;
    if (audioBlob instanceof ArrayBuffer) {
      buffer = Buffer.from(audioBlob);
    } else if (audioBlob instanceof Uint8Array) {
      buffer = Buffer.from(audioBlob);
    } else if (typeof audioBlob === "string") {
      buffer = Buffer.from(audioBlob, "base64");
    } else if (audioBlob && audioBlob.buffer) {
      buffer = Buffer.from(audioBlob.buffer);
    } else {
      throw new Error(`Unsupported audio data type: ${typeof audioBlob}`);
    }

    if (!buffer || buffer.length === 0) {
      throw new Error("Audio buffer is empty - no audio data received");
    }

    const MIN_AUDIO_SIZE = 44;
    if (buffer.length < MIN_AUDIO_SIZE) {
      throw new Error(`Audio data too small (${buffer.length} bytes) - recording may have failed`);
    }

    // Check if the audio is already in WAV format (starts with "RIFF" header)
    const isWav =
      buffer.length >= 4 &&
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46;

    if (isWav) {
      // Already WAV format - write directly
      const tempAudioPath = path.join(tempDir, `whisper_audio_${uniqueId}.wav`);
      await fsPromises.writeFile(tempAudioPath, buffer);
      const stats = await fsPromises.stat(tempAudioPath);
      debugLogger.logWhisperPipeline("Temp audio file created (WAV passthrough)", {
        path: tempAudioPath,
        size: stats.size,
      });
      return tempAudioPath;
    }

    // Audio is in WebM/Opus or other format - convert to WAV using FFmpeg
    const inputPath = path.join(tempDir, `whisper_input_${uniqueId}.webm`);
    const outputPath = path.join(tempDir, `whisper_audio_${uniqueId}.wav`);

    await fsPromises.writeFile(inputPath, buffer);

    const ffmpegPath = await this.getFFmpegPath();
    if (!ffmpegPath) {
      // Clean up input file
      await fsPromises.unlink(inputPath).catch(() => {});
      throw new Error("FFmpeg not found - required for audio format conversion");
    }

    debugLogger.logWhisperPipeline("Converting audio to WAV format", {
      inputPath,
      outputPath,
      ffmpegPath,
      inputSize: buffer.length,
    });

    try {
      // Convert to 16kHz mono WAV (optimal for Whisper)
      await new Promise((resolve, reject) => {
        const ffmpegProcess = spawn(
          ffmpegPath,
          [
            "-i",
            inputPath,
            "-ar",
            "16000", // 16kHz sample rate
            "-ac",
            "1", // Mono
            "-c:a",
            "pcm_s16le", // 16-bit PCM
            "-y", // Overwrite output
            outputPath,
          ],
          {
            stdio: ["ignore", "pipe", "pipe"],
            windowsHide: true,
          }
        );

        let stderrData = "";
        let settled = false;

        const settle = (resolver, value) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          resolver(value);
        };

        // Timeout after 30 seconds
        const timeout = setTimeout(() => {
          ffmpegProcess.kill("SIGTERM");
          settle(reject, new Error("FFmpeg conversion timed out"));
        }, 30000);

        ffmpegProcess.stderr.on("data", (data) => {
          stderrData += data.toString();
        });

        ffmpegProcess.on("close", (code) => {
          if (code === 0) {
            settle(resolve, undefined);
          } else {
            settle(reject, new Error(`FFmpeg conversion failed (code ${code}): ${stderrData}`));
          }
        });

        ffmpegProcess.on("error", (err) => {
          settle(reject, new Error(`FFmpeg process error: ${err.message}`));
        });
      });

      // Clean up input file
      await fsPromises.unlink(inputPath).catch(() => {});

      const stats = await fsPromises.stat(outputPath);
      debugLogger.logWhisperPipeline("Audio converted to WAV", {
        path: outputPath,
        size: stats.size,
      });

      return outputPath;
    } catch (error) {
      // Clean up both files on error
      await fsPromises.unlink(inputPath).catch(() => {});
      await fsPromises.unlink(outputPath).catch(() => {});
      throw error;
    }
  }

  async runWhisperProcess(binaryPath, audioPath, modelPath, language) {
    // whisper.cpp --output-json writes to a file, not stdout
    const outputBasePath = audioPath.replace(/\.[^.]+$/, "");
    const jsonOutputPath = `${outputBasePath}.json`;

    const args = [
      "-m",
      modelPath,
      "-f",
      audioPath,
      "--output-json",
      "-of",
      outputBasePath,
      "--no-prints",
    ];
    if (language && language !== "auto") {
      args.push("-l", language);
    }

    debugLogger.logProcessStart(binaryPath, args, {});

    const cleanupJsonFile = () => fsPromises.unlink(jsonOutputPath).catch(() => {});

    const { code, stderr } = await new Promise((resolve, reject) => {
      const whisperProcess = spawn(binaryPath, args, {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });

      let stderrData = "";
      let settled = false;

      const settle = (resolver, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolver(value);
      };

      const timeout = setTimeout(() => {
        killProcess(whisperProcess, "SIGTERM");
        settle(reject, new Error("Whisper transcription timed out"));
      }, TIMEOUTS.TRANSCRIPTION);

      whisperProcess.stdout.on("data", (data) =>
        debugLogger.logProcessOutput("Whisper", "stdout", data)
      );
      whisperProcess.stderr.on("data", (data) => {
        stderrData += data.toString();
        debugLogger.logProcessOutput("Whisper", "stderr", data);
      });

      whisperProcess.on("close", (exitCode) =>
        settle(resolve, { code: exitCode, stderr: stderrData })
      );
      whisperProcess.on("error", (err) =>
        settle(reject, new Error(`Whisper process error: ${err.message}`))
      );
    });

    debugLogger.logWhisperPipeline("Process closed", {
      code,
      stderrLength: stderr.length,
      jsonOutputPath,
    });

    if (code !== 0) {
      await cleanupJsonFile();
      throw new Error(`Whisper transcription failed (code ${code}): ${stderr}`);
    }

    // Check stderr for errors - whisper.cpp may exit 0 even on failure
    if (stderr.includes("error:")) {
      await cleanupJsonFile();
      throw new Error(`Whisper processing error: ${stderr}`);
    }

    // Verify JSON file was created
    if (!fs.existsSync(jsonOutputPath)) {
      throw new Error(`Whisper did not produce output. stderr: ${stderr || "(empty)"}`);
    }

    try {
      const jsonContent = await fsPromises.readFile(jsonOutputPath, "utf-8");
      await cleanupJsonFile();
      return jsonContent;
    } catch (readError) {
      await cleanupJsonFile();
      throw new Error(`Failed to read Whisper output: ${readError.message}`);
    }
  }

  parseWhisperResult(stdout) {
    debugLogger.logWhisperPipeline("Parsing result", { stdoutLength: stdout.length });

    try {
      // whisper.cpp outputs JSON with transcription array
      const result = JSON.parse(stdout);

      // Handle whisper.cpp JSON format
      if (result.transcription && Array.isArray(result.transcription)) {
        const text = result.transcription
          .map((seg) => seg.text)
          .join("")
          .trim();
        if (!text) {
          return { success: false, message: "No audio detected" };
        }
        return { success: true, text };
      }

      // Fallback for simple text output
      if (result.text) {
        const text = result.text.trim();
        if (!text) {
          return { success: false, message: "No audio detected" };
        }
        return { success: true, text };
      }

      return { success: false, message: "No audio detected" };
    } catch (parseError) {
      // Try parsing as plain text (non-JSON output)
      const text = stdout.trim();
      if (text) {
        return { success: true, text };
      }
      throw new Error(`Failed to parse Whisper output: ${parseError.message}`);
    }
  }

  async cleanupTempFile(tempAudioPath) {
    try {
      await fsPromises.unlink(tempAudioPath);
    } catch {
      // Temp file cleanup error is not critical
    }
  }

  // Model management methods
  async downloadWhisperModel(modelName, progressCallback = null) {
    this.validateModelName(modelName);
    const modelConfig = WHISPER_MODELS[modelName];

    const modelPath = this.getModelPath(modelName);
    const modelsDir = this.getModelsDir();

    // Create models directory
    await fsPromises.mkdir(modelsDir, { recursive: true });

    // Check if already downloaded
    if (fs.existsSync(modelPath)) {
      const stats = await fsPromises.stat(modelPath);
      return {
        model: modelName,
        downloaded: true,
        path: modelPath,
        size_bytes: stats.size,
        size_mb: Math.round(stats.size / (1024 * 1024)),
        success: true,
      };
    }

    const tempPath = `${modelPath}.tmp`;

    // Track active download for cancellation
    let activeRequest = null;
    let activeFile = null;
    let isCancelled = false;

    const cleanup = () => {
      if (activeRequest) {
        activeRequest.destroy();
        activeRequest = null;
      }
      if (activeFile) {
        activeFile.close();
        activeFile = null;
      }
      fs.unlink(tempPath, () => {});
    };

    // Store cancellation function
    this.currentDownloadProcess = {
      abort: () => {
        isCancelled = true;
        cleanup();
      },
    };

    return new Promise((resolve, reject) => {
      const downloadWithRedirect = (url, redirectCount = 0) => {
        if (isCancelled) {
          reject(new Error("Download cancelled by user"));
          return;
        }

        // Prevent infinite redirects
        if (redirectCount > 5) {
          cleanup();
          reject(new Error("Too many redirects"));
          return;
        }

        activeRequest = https.get(url, (response) => {
          if (isCancelled) {
            cleanup();
            reject(new Error("Download cancelled by user"));
            return;
          }

          // Handle redirects
          if (response.statusCode === 302 || response.statusCode === 301) {
            const redirectUrl = response.headers.location;
            if (!redirectUrl) {
              cleanup();
              reject(new Error("Redirect without location header"));
              return;
            }
            downloadWithRedirect(redirectUrl, redirectCount + 1);
            return;
          }

          if (response.statusCode !== 200) {
            cleanup();
            reject(new Error(`Failed to download model: HTTP ${response.statusCode}`));
            return;
          }

          const totalSize = parseInt(response.headers["content-length"], 10) || modelConfig.size;
          let downloadedSize = 0;

          activeFile = fs.createWriteStream(tempPath);

          response.on("data", (chunk) => {
            if (isCancelled) {
              cleanup();
              return;
            }

            downloadedSize += chunk.length;
            const percentage = Math.round((downloadedSize / totalSize) * 100);

            if (progressCallback) {
              progressCallback({
                type: "progress",
                model: modelName,
                downloaded_bytes: downloadedSize,
                total_bytes: totalSize,
                percentage,
              });
            }
          });

          response.pipe(activeFile);

          activeFile.on("finish", async () => {
            if (isCancelled) {
              cleanup();
              reject(new Error("Download cancelled by user"));
              return;
            }

            activeFile.close();
            activeFile = null;
            this.currentDownloadProcess = null;

            // Rename temp to final
            try {
              await fsPromises.rename(tempPath, modelPath);
            } catch {
              // Cross-device move fallback
              await fsPromises.copyFile(tempPath, modelPath);
              await fsPromises.unlink(tempPath);
            }

            const stats = await fsPromises.stat(modelPath);

            if (progressCallback) {
              progressCallback({
                type: "complete",
                model: modelName,
                percentage: 100,
              });
            }

            resolve({
              model: modelName,
              downloaded: true,
              path: modelPath,
              size_bytes: stats.size,
              size_mb: Math.round(stats.size / (1024 * 1024)),
              success: true,
            });
          });

          activeFile.on("error", (err) => {
            cleanup();
            reject(err);
          });

          response.on("error", (err) => {
            cleanup();
            reject(err);
          });
        });

        activeRequest.on("error", (err) => {
          cleanup();
          reject(err);
        });

        // Request timeout (10 minutes for large models)
        activeRequest.setTimeout(600000, () => {
          cleanup();
          reject(new Error("Download request timed out"));
        });
      };

      downloadWithRedirect(modelConfig.url);
    });
  }

  async cancelDownload() {
    if (this.currentDownloadProcess) {
      this.currentDownloadProcess.abort();
      this.currentDownloadProcess = null;
      return { success: true, message: "Download cancelled" };
    }
    return { success: false, error: "No active download to cancel" };
  }

  async checkModelStatus(modelName) {
    const modelPath = this.getModelPath(modelName);

    if (fs.existsSync(modelPath)) {
      const stats = await fsPromises.stat(modelPath);
      return {
        model: modelName,
        downloaded: true,
        path: modelPath,
        size_bytes: stats.size,
        size_mb: Math.round(stats.size / (1024 * 1024)),
        success: true,
      };
    }

    return { model: modelName, downloaded: false, success: true };
  }

  async listWhisperModels() {
    const models = Object.keys(WHISPER_MODELS);
    const modelInfo = [];

    for (const model of models) {
      const status = await this.checkModelStatus(model);
      modelInfo.push(status);
    }

    return {
      models: modelInfo,
      cache_dir: this.getModelsDir(),
      success: true,
    };
  }

  async deleteWhisperModel(modelName) {
    const modelPath = this.getModelPath(modelName);

    if (fs.existsSync(modelPath)) {
      const stats = await fsPromises.stat(modelPath);
      await fsPromises.unlink(modelPath);
      return {
        model: modelName,
        deleted: true,
        freed_bytes: stats.size,
        freed_mb: Math.round(stats.size / (1024 * 1024)),
        success: true,
      };
    }

    return { model: modelName, deleted: false, error: "Model not found", success: false };
  }

  // FFmpeg methods (still needed for audio format conversion)
  async getFFmpegPath() {
    if (this.cachedFFmpegPath) {
      return this.cachedFFmpegPath;
    }

    let ffmpegPath;

    try {
      ffmpegPath = require("ffmpeg-static");
      ffmpegPath = path.normalize(ffmpegPath);

      if (process.platform === "win32" && !ffmpegPath.endsWith(".exe")) {
        ffmpegPath += ".exe";
      }

      if (fs.existsSync(ffmpegPath)) {
        if (process.platform !== "win32") {
          fs.accessSync(ffmpegPath, fs.constants.X_OK);
        }
        this.cachedFFmpegPath = ffmpegPath;
        return ffmpegPath;
      }

      // Try unpacked ASAR path
      if (process.env.NODE_ENV !== "development") {
        const unpackedPath = ffmpegPath.replace(/app\.asar([/\\])/, "app.asar.unpacked$1");
        if (fs.existsSync(unpackedPath)) {
          this.cachedFFmpegPath = unpackedPath;
          return unpackedPath;
        }
      }
    } catch {
      // Bundled FFmpeg not available
    }

    // Try system FFmpeg
    const systemCandidates =
      process.platform === "darwin"
        ? ["ffmpeg", "/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg"]
        : ["ffmpeg", "/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg"];

    for (const candidate of systemCandidates) {
      try {
        await runCommand(candidate, ["-version"], { timeout: TIMEOUTS.QUICK_CHECK });
        this.cachedFFmpegPath = candidate;
        return candidate;
      } catch {
        continue;
      }
    }

    return null;
  }

  async checkFFmpegAvailability() {
    const now = Date.now();
    if (
      this.ffmpegAvailabilityCache.result !== null &&
      now < this.ffmpegAvailabilityCache.expiresAt
    ) {
      return this.ffmpegAvailabilityCache.result;
    }

    const ffmpegPath = await this.getFFmpegPath();
    const result = ffmpegPath
      ? { available: true, path: ffmpegPath }
      : { available: false, error: "FFmpeg not found" };

    this.ffmpegAvailabilityCache = { result, expiresAt: now + CACHE_TTL_MS };
    return result;
  }
}

module.exports = WhisperManager;
