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
const WhisperServerManager = require("./whisperServer");

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
    // Server manager for HTTP-based transcription (faster for repeated use)
    this.serverManager = new WhisperServerManager();
    this.useServerMode = true; // Prefer server mode when available
    this.currentServerModel = null;
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

    // Production: extraResources copies to {resourcesPath}/bin/ via from/to mapping
    if (process.resourcesPath) {
      // Primary location: extraResources with "to": "bin/"
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
        try {
          const stats = fs.statSync(candidate);
          debugLogger.debug("Found whisper.cpp binary", {
            path: candidate,
            size: stats.size,
          });
          return candidate;
        } catch (statError) {
          debugLogger.warn("Binary exists but cannot be accessed", {
            path: candidate,
            error: statError.message,
          });
        }
      }
    }

    debugLogger.warn("whisper.cpp binary not found", {
      platform,
      arch,
      searchedPaths: candidates,
    });
    return null;
  }

  async getSystemBinaryPath() {
    // On Linux, avoid "whisper" as it conflicts with Python's openai-whisper package
    const binaryNames =
      process.platform === "win32"
        ? ["whisper-cpp.exe", "whisper.exe"]
        : process.platform === "linux"
          ? ["whisper-cpp", "main"]
          : ["whisper-cpp", "whisper", "main"];

    for (const name of binaryNames) {
      try {
        const checkCmd = process.platform === "win32" ? "where" : "which";
        const { output } = await runCommand(checkCmd, [name], { timeout: TIMEOUTS.QUICK_CHECK });
        const binaryPath = output.trim().split("\n")[0];
        if (
          binaryPath &&
          fs.existsSync(binaryPath) &&
          (await this.isWhisperCppBinary(binaryPath))
        ) {
          return binaryPath;
        }
      } catch {
        continue;
      }
    }

    // Check common Homebrew paths on macOS
    if (process.platform === "darwin") {
      const commonPaths = [
        "/opt/homebrew/bin/whisper-cpp",
        "/opt/homebrew/bin/whisper",
        "/usr/local/bin/whisper-cpp",
        "/usr/local/bin/whisper",
      ];
      for (const p of commonPaths) {
        if (fs.existsSync(p) && (await this.isWhisperCppBinary(p))) {
          return p;
        }
      }
    }

    return null;
  }

  async isWhisperCppBinary(binaryPath) {
    try {
      // whisper.cpp uses "-m FNAME" and "-f FNAME" flags; Python whisper uses different args
      const { output } = await runCommand(binaryPath, ["--help"], {
        timeout: TIMEOUTS.QUICK_CHECK,
      });
      return (
        output.includes("-m FNAME") ||
        output.includes("-f FNAME") ||
        output.includes("--model FNAME")
      );
    } catch {
      return false;
    }
  }

  async getWhisperBinaryPath() {
    // Use cached path if file still exists (binary type already validated during discovery)
    if (this.cachedBinaryPath && fs.existsSync(this.cachedBinaryPath)) {
      return this.cachedBinaryPath;
    }
    this.cachedBinaryPath = null;

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

  clearBinaryCache() {
    this.cachedBinaryPath = null;
  }

  async initializeAtStartup(settings = {}) {
    const startTime = Date.now();

    try {
      await this.getWhisperBinaryPath();
      this.isInitialized = true;

      // Pre-warm whisper-server if local mode enabled (eliminates 2-5s cold-start delay)
      const { useLocalWhisper, whisperModel } = settings;

      if (useLocalWhisper && whisperModel && this.serverManager.isAvailable()) {
        const modelPath = this.getModelPath(whisperModel);

        if (fs.existsSync(modelPath)) {
          debugLogger.info("Pre-warming whisper-server", {
            model: whisperModel,
            modelPath,
          });

          try {
            const serverStartTime = Date.now();
            await this.serverManager.start(modelPath);
            this.currentServerModel = whisperModel;

            debugLogger.info("whisper-server pre-warmed successfully", {
              model: whisperModel,
              startupTimeMs: Date.now() - serverStartTime,
              port: this.serverManager.port,
            });
          } catch (err) {
            debugLogger.warn("Server pre-warm failed (will start on first use)", {
              error: err.message,
              model: whisperModel,
            });
            // Non-fatal: server will start on first transcription
          }
        } else {
          debugLogger.debug("Skipping server pre-warm: model not downloaded", {
            model: whisperModel,
            modelPath,
          });
        }
      } else {
        debugLogger.debug("Skipping server pre-warm", {
          reason: !useLocalWhisper
            ? "local mode disabled"
            : !whisperModel
              ? "no model selected"
              : "server binary not available",
        });
      }
    } catch (error) {
      debugLogger.warn("Whisper initialization error", {
        error: error.message,
      });
      this.isInitialized = true; // Mark initialized even on error
    }

    debugLogger.info("Whisper initialization complete", {
      totalTimeMs: Date.now() - startTime,
      serverRunning: this.serverManager.ready,
    });

    // Log dependency status for debugging
    await this.logDependencyStatus();
  }

  async logDependencyStatus() {
    const status = {
      whisperServer: {
        available: this.serverManager.isAvailable(),
        path: this.serverManager.getServerBinaryPath(),
      },
      whisperCli: {
        available: this.cachedBinaryPath !== null,
        path: this.cachedBinaryPath,
      },
      ffmpeg: {
        available: false,
        path: null,
      },
      models: [],
    };

    // Check FFmpeg
    try {
      const ffmpegPath = await this.getFFmpegPath();
      status.ffmpeg.available = !!ffmpegPath;
      status.ffmpeg.path = ffmpegPath;
    } catch {
      // FFmpeg not available
    }

    // Check downloaded models
    for (const modelName of Object.keys(WHISPER_MODELS)) {
      const modelPath = this.getModelPath(modelName);
      if (fs.existsSync(modelPath)) {
        try {
          const stats = fs.statSync(modelPath);
          status.models.push({
            name: modelName,
            size: `${Math.round(stats.size / (1024 * 1024))}MB`,
          });
        } catch {
          // Skip if can't stat
        }
      }
    }

    debugLogger.info("OpenWhispr dependency check", status);

    // Log a summary for easy scanning
    const serverStatus = status.whisperServer.available
      ? `✓ ${status.whisperServer.path}`
      : "✗ Not found";
    const cliStatus = status.whisperCli.available ? `✓ ${status.whisperCli.path}` : "✗ Not found";
    const ffmpegStatus = status.ffmpeg.available ? `✓ ${status.ffmpeg.path}` : "✗ Not found";
    const modelsStatus =
      status.models.length > 0
        ? status.models.map((m) => `${m.name} (${m.size})`).join(", ")
        : "None downloaded";

    debugLogger.info(`[Dependencies] whisper-server: ${serverStatus}`);
    debugLogger.info(`[Dependencies] whisper-cli: ${cliStatus}`);
    debugLogger.info(`[Dependencies] FFmpeg: ${ffmpegStatus}`);
    debugLogger.info(`[Dependencies] Models: ${modelsStatus}`);
  }

  async startServer(modelName) {
    if (!this.serverManager.isAvailable()) {
      debugLogger.debug("whisper-server not available, will use CLI fallback");
      return { success: false, reason: "whisper-server binary not found" };
    }

    const modelPath = this.getModelPath(modelName);
    if (!fs.existsSync(modelPath)) {
      return { success: false, reason: `Model "${modelName}" not downloaded` };
    }

    try {
      await this.serverManager.start(modelPath);
      this.currentServerModel = modelName;
      debugLogger.info("whisper-server started", {
        model: modelName,
        port: this.serverManager.port,
      });
      return { success: true, port: this.serverManager.port };
    } catch (error) {
      debugLogger.error("Failed to start whisper-server", { error: error.message });
      return { success: false, reason: error.message };
    }
  }

  async stopServer() {
    await this.serverManager.stop();
    this.currentServerModel = null;
  }

  getServerStatus() {
    return this.serverManager.getStatus();
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
      serverMode: this.useServerMode,
      serverAvailable: this.serverManager.isAvailable(),
      serverReady: this.serverManager.ready,
    });

    const model = options.model || "base";
    const language = options.language || null;
    const modelPath = this.getModelPath(model);

    // Check if model exists
    if (!fs.existsSync(modelPath)) {
      throw new Error(`Whisper model "${model}" not downloaded. Please download it from Settings.`);
    }

    // Try server mode first (faster for repeated transcriptions)
    if (this.useServerMode && this.serverManager.isAvailable()) {
      try {
        return await this.transcribeViaServer(audioBlob, model, language);
      } catch (serverError) {
        debugLogger.warn("Server transcription failed, falling back to CLI", {
          error: serverError.message,
        });
        // Fall through to CLI mode
      }
    }

    // Fallback to CLI mode (spawns process per transcription)
    return this.transcribeViaCLI(audioBlob, model, language, modelPath);
  }

  async transcribeViaServer(audioBlob, model, language) {
    debugLogger.info("Transcription mode: SERVER", { model, language: language || "auto" });
    const modelPath = this.getModelPath(model);

    // Start server if not running or if model changed
    if (!this.serverManager.ready || this.currentServerModel !== model) {
      debugLogger.debug("Starting/restarting whisper-server for model", { model });
      await this.serverManager.start(modelPath);
      this.currentServerModel = model;
    }

    // Convert audioBlob to Buffer if needed
    let audioBuffer;
    if (audioBlob instanceof ArrayBuffer) {
      audioBuffer = Buffer.from(audioBlob);
    } else if (audioBlob instanceof Uint8Array) {
      audioBuffer = Buffer.from(audioBlob);
    } else if (typeof audioBlob === "string") {
      audioBuffer = Buffer.from(audioBlob, "base64");
    } else if (audioBlob && audioBlob.buffer) {
      audioBuffer = Buffer.from(audioBlob.buffer);
    } else {
      throw new Error(`Unsupported audio data type: ${typeof audioBlob}`);
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error("Audio buffer is empty - no audio data received");
    }

    debugLogger.logWhisperPipeline("transcribeViaServer - sending to server", {
      bufferSize: audioBuffer.length,
      model,
      language,
      port: this.serverManager.port,
    });

    const startTime = Date.now();
    const result = await this.serverManager.transcribe(audioBuffer, { language });
    const elapsed = Date.now() - startTime;

    debugLogger.logWhisperPipeline("transcribeViaServer - completed", {
      elapsed,
      resultKeys: Object.keys(result),
    });

    return this.parseWhisperResult(result);
  }

  async transcribeViaCLI(audioBlob, _model, language, modelPath) {
    debugLogger.info("Transcription mode: CLI (fallback)", {
      model: path.basename(modelPath, ".bin").replace("ggml-", ""),
      language: language || "auto",
      reason: !this.useServerMode
        ? "server mode disabled"
        : !this.serverManager.isAvailable()
          ? "server binary not found"
          : "server failed",
    });
    const binaryPath = await this.getWhisperBinaryPath();
    if (!binaryPath) {
      throw new Error(
        "whisper.cpp not found. Please install it via Homebrew (brew install whisper-cpp) or ensure it is bundled with the app."
      );
    }

    const tempAudioPath = await this.createTempAudioFile(audioBlob);

    try {
      const result = await this.runWhisperProcess(binaryPath, tempAudioPath, modelPath, language);
      return this.parseWhisperResult(result);
    } catch (error) {
      // Exit code 2 typically means argument error - possibly wrong binary (Python whisper vs whisper.cpp)
      if (error.message?.includes("code 2") && this.cachedBinaryPath) {
        debugLogger.debug("Transcription failed with code 2, clearing cache and retrying", {
          binaryPath,
        });
        this.clearBinaryCache();
        const retryBinaryPath = await this.getWhisperBinaryPath();
        if (retryBinaryPath && retryBinaryPath !== binaryPath) {
          debugLogger.log("Retrying with different binary:", retryBinaryPath);
          const result = await this.runWhisperProcess(
            retryBinaryPath,
            tempAudioPath,
            modelPath,
            language
          );
          return this.parseWhisperResult(result);
        }
      }
      throw error;
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
      whisperProcess.on("error", (err) => {
        debugLogger.error("Whisper process spawn failed", {
          error: err.code || err.message,
          binaryPath,
          binaryExists: fs.existsSync(binaryPath),
        });
        settle(reject, new Error(`Failed to start whisper.cpp: ${err.message}`));
      });
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

  // Normalize whitespace: replace newlines with spaces and collapse multiple spaces
  // whisper.cpp returns text with \n between audio segments which causes formatting issues
  normalizeWhitespace(text) {
    return text.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  }

  parseWhisperResult(output) {
    // Handle both string (from CLI) and object (from server) inputs
    let result;
    if (typeof output === "string") {
      debugLogger.logWhisperPipeline("Parsing result (string)", { length: output.length });
      try {
        result = JSON.parse(output);
      } catch (parseError) {
        // Try parsing as plain text (non-JSON output)
        const text = this.normalizeWhitespace(output);
        if (text && !this.isBlankAudioMarker(text)) {
          return { success: true, text };
        }
        throw new Error(`Failed to parse Whisper output: ${parseError.message}`);
      }
    } else if (typeof output === "object" && output !== null) {
      debugLogger.logWhisperPipeline("Parsing result (object)", { keys: Object.keys(output) });
      result = output;
    } else {
      throw new Error(`Unexpected Whisper output type: ${typeof output}`);
    }

    // Handle whisper.cpp JSON format (CLI mode)
    if (result.transcription && Array.isArray(result.transcription)) {
      const text = this.normalizeWhitespace(result.transcription.map((seg) => seg.text).join(""));
      if (!text || this.isBlankAudioMarker(text)) {
        return { success: false, message: "No audio detected" };
      }
      return { success: true, text };
    }

    // Handle whisper-server format (has "text" field directly)
    if (result.text !== undefined) {
      const text = typeof result.text === "string" ? this.normalizeWhitespace(result.text) : "";
      if (!text || this.isBlankAudioMarker(text)) {
        return { success: false, message: "No audio detected" };
      }
      return { success: true, text };
    }

    return { success: false, message: "No audio detected" };
  }

  // Check if text is a whisper.cpp blank audio marker
  isBlankAudioMarker(text) {
    // whisper.cpp outputs "[BLANK_AUDIO]" when there's silence or insufficient audio
    const normalized = text.trim().toLowerCase();
    return normalized === "[blank_audio]" || normalized === "[ blank_audio ]";
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

  async deleteAllWhisperModels() {
    const modelsDir = this.getModelsDir();
    let totalFreed = 0;
    let deletedCount = 0;

    try {
      if (!fs.existsSync(modelsDir)) {
        return { success: true, deleted_count: 0, freed_bytes: 0, freed_mb: 0 };
      }

      const files = await fsPromises.readdir(modelsDir);
      for (const file of files) {
        if (file.endsWith(".bin")) {
          const filePath = path.join(modelsDir, file);
          try {
            const stats = await fsPromises.stat(filePath);
            await fsPromises.unlink(filePath);
            totalFreed += stats.size;
            deletedCount++;
          } catch {
            // Continue with other files if one fails
          }
        }
      }

      return {
        success: true,
        deleted_count: deletedCount,
        freed_bytes: totalFreed,
        freed_mb: Math.round(totalFreed / (1024 * 1024)),
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
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

      debugLogger.debug("FFmpeg static path from module", { ffmpegPath });

      // Try unpacked ASAR path first (production builds unpack ffmpeg-static)
      // Handle both forward slashes and backslashes for cross-platform compatibility
      const unpackedPath = ffmpegPath.includes("app.asar")
        ? ffmpegPath.replace(/app\.asar([/\\])/, "app.asar.unpacked$1")
        : null;

      if (unpackedPath) {
        debugLogger.debug("Checking unpacked ASAR path", { unpackedPath });
        if (fs.existsSync(unpackedPath)) {
          if (process.platform !== "win32") {
            try {
              fs.accessSync(unpackedPath, fs.constants.X_OK);
            } catch {
              debugLogger.debug("FFmpeg not executable, attempting chmod", { unpackedPath });
              try {
                fs.chmodSync(unpackedPath, 0o755);
              } catch (chmodErr) {
                debugLogger.warn("Failed to chmod FFmpeg", { error: chmodErr.message });
              }
            }
          }
          debugLogger.debug("Found FFmpeg in unpacked ASAR", { path: unpackedPath });
          this.cachedFFmpegPath = unpackedPath;
          return unpackedPath;
        } else {
          debugLogger.warn("Unpacked ASAR path does not exist", { unpackedPath });
        }
      }

      // Try original path (development or if not in ASAR)
      if (fs.existsSync(ffmpegPath)) {
        if (process.platform !== "win32") {
          fs.accessSync(ffmpegPath, fs.constants.X_OK);
        }
        debugLogger.debug("Found FFmpeg at bundled path", { path: ffmpegPath });
        this.cachedFFmpegPath = ffmpegPath;
        return ffmpegPath;
      } else {
        debugLogger.warn("Bundled FFmpeg path does not exist", { ffmpegPath });
      }
    } catch (err) {
      debugLogger.warn("Bundled FFmpeg not available", { error: err.message });
    }

    // Try system FFmpeg
    const systemCandidates =
      process.platform === "darwin"
        ? ["ffmpeg", "/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg"]
        : process.platform === "win32"
          ? ["ffmpeg", "C:\\ffmpeg\\bin\\ffmpeg.exe"]
          : ["ffmpeg", "/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg"];

    debugLogger.debug("Trying system FFmpeg candidates", { candidates: systemCandidates });

    for (const candidate of systemCandidates) {
      try {
        await runCommand(candidate, ["-version"], { timeout: TIMEOUTS.QUICK_CHECK });
        debugLogger.debug("Found system FFmpeg", { path: candidate });
        this.cachedFFmpegPath = candidate;
        return candidate;
      } catch {
        continue;
      }
    }

    debugLogger.error("FFmpeg not found anywhere");
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

  async getDiagnostics() {
    const diagnostics = {
      platform: process.platform,
      arch: process.arch,
      resourcesPath: process.resourcesPath || null,
      isPackaged: !!process.resourcesPath && !process.resourcesPath.includes("node_modules"),
      ffmpeg: { available: false, path: null, error: null },
      whisperBinary: { available: false, path: null, error: null },
      whisperServer: { available: false, path: null },
      modelsDir: this.getModelsDir(),
      models: [],
    };

    // Check FFmpeg
    try {
      this.cachedFFmpegPath = null; // Clear cache for fresh check
      const ffmpegPath = await this.getFFmpegPath();
      if (ffmpegPath) {
        diagnostics.ffmpeg = { available: true, path: ffmpegPath, error: null };
      } else {
        diagnostics.ffmpeg = { available: false, path: null, error: "Not found" };
      }
    } catch (err) {
      diagnostics.ffmpeg = { available: false, path: null, error: err.message };
    }

    // Check whisper binary
    try {
      this.cachedBinaryPath = null; // Clear cache for fresh check
      const whisperPath = await this.getWhisperBinaryPath();
      if (whisperPath) {
        diagnostics.whisperBinary = { available: true, path: whisperPath, error: null };
      } else {
        diagnostics.whisperBinary = { available: false, path: null, error: "Not found" };
      }
    } catch (err) {
      diagnostics.whisperBinary = { available: false, path: null, error: err.message };
    }

    // Check whisper server
    if (this.serverManager) {
      const serverPath = this.serverManager.getBinaryPath?.();
      diagnostics.whisperServer = {
        available: !!serverPath && fs.existsSync(serverPath),
        path: serverPath || null,
      };
    }

    // Check downloaded models
    try {
      const modelsDir = this.getModelsDir();
      if (fs.existsSync(modelsDir)) {
        const files = fs.readdirSync(modelsDir);
        diagnostics.models = files
          .filter((f) => f.startsWith("ggml-") && f.endsWith(".bin"))
          .map((f) => f.replace("ggml-", "").replace(".bin", ""));
      }
    } catch {
      // Ignore errors reading models dir
    }

    return diagnostics;
  }
}

module.exports = WhisperManager;
