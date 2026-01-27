const fs = require("fs");
const fsPromises = require("fs").promises;
const path = require("path");
const { spawn } = require("child_process");
const debugLogger = require("./debugLogger");
const { downloadFile, createDownloadSignal } = require("./downloadUtils");
const ParakeetServerManager = require("./parakeetServer");
const { getModelsDirForService } = require("./modelDirUtils");

const modelRegistryData = require("../models/modelRegistryData.json");

function getParakeetModelConfig(modelName) {
  const modelInfo = modelRegistryData.parakeetModels[modelName];
  if (!modelInfo) return null;
  return {
    url: modelInfo.downloadUrl,
    size: modelInfo.sizeMb * 1_000_000,
    language: modelInfo.language,
    supportedLanguages: modelInfo.supportedLanguages || [],
    extractDir: modelInfo.extractDir,
  };
}

function getValidModelNames() {
  return Object.keys(modelRegistryData.parakeetModels);
}

class ParakeetManager {
  constructor() {
    this.currentDownloadProcess = null;
    this.isInitialized = false;
    this.serverManager = new ParakeetServerManager();
  }

  getModelsDir() {
    return getModelsDirForService("parakeet");
  }

  validateModelName(modelName) {
    const validModels = getValidModelNames();
    if (!validModels.includes(modelName)) {
      throw new Error(
        `Invalid Parakeet model: ${modelName}. Valid models: ${validModels.join(", ")}`
      );
    }
    return true;
  }

  getModelPath(modelName) {
    this.validateModelName(modelName);
    return path.join(this.getModelsDir(), modelName);
  }

  async initializeAtStartup(settings = {}) {
    const startTime = Date.now();

    try {
      this.isInitialized = true;

      await this.logDependencyStatus();

      const { localTranscriptionProvider, parakeetModel } = settings;

      if (
        localTranscriptionProvider === "nvidia" &&
        parakeetModel &&
        this.serverManager.isAvailable()
      ) {
        if (this.serverManager.isModelDownloaded(parakeetModel)) {
          debugLogger.info("Pre-warming parakeet server", { model: parakeetModel });

          try {
            const serverStartTime = Date.now();
            await this.serverManager.startServer(parakeetModel);
            debugLogger.info("Parakeet server pre-warmed successfully", {
              model: parakeetModel,
              startupTimeMs: Date.now() - serverStartTime,
            });
          } catch (err) {
            debugLogger.warn("Parakeet server pre-warm failed (will start on first use)", {
              error: err.message,
              model: parakeetModel,
            });
          }
        } else {
          debugLogger.debug("Skipping parakeet server pre-warm: model not downloaded", {
            model: parakeetModel,
          });
        }
      } else {
        debugLogger.debug("Skipping parakeet server pre-warm", {
          reason:
            localTranscriptionProvider !== "nvidia"
              ? "provider not nvidia"
              : !parakeetModel
                ? "no model selected"
                : "server binary not available",
        });
      }
    } catch (error) {
      debugLogger.warn("Parakeet initialization error", { error: error.message });
      this.isInitialized = true;
    }

    debugLogger.info("Parakeet initialization complete", {
      totalTimeMs: Date.now() - startTime,
      binaryAvailable: this.serverManager.isAvailable(),
    });
  }

  async logDependencyStatus() {
    const status = {
      sherpaOnnx: {
        available: this.serverManager.isAvailable(),
        path: this.serverManager.getBinaryPath(),
      },
      models: [],
    };

    // Check downloaded models
    for (const modelName of getValidModelNames()) {
      const modelPath = this.getModelPath(modelName);
      if (this.serverManager.isModelDownloaded(modelName)) {
        try {
          const encoderPath = path.join(modelPath, "encoder.int8.onnx");
          const stats = fs.statSync(encoderPath);
          status.models.push({
            name: modelName,
            size: `${Math.round(stats.size / (1024 * 1024))}MB`,
          });
        } catch {
          // Skip if can't stat
        }
      }
    }

    debugLogger.info("Parakeet dependency check", status);

    const binaryStatus = status.sherpaOnnx.available
      ? `✓ ${status.sherpaOnnx.path}`
      : "✗ Not found";
    const modelsStatus =
      status.models.length > 0
        ? status.models.map((m) => `${m.name}`).join(", ")
        : "None downloaded";

    debugLogger.info(`[Parakeet] sherpa-onnx: ${binaryStatus}`);
    debugLogger.info(`[Parakeet] Models: ${modelsStatus}`);
  }

  async checkInstallation() {
    const binaryPath = this.serverManager.getBinaryPath();
    if (!binaryPath) {
      return { installed: false, working: false };
    }

    return {
      installed: true,
      working: this.serverManager.isAvailable(),
      path: binaryPath,
    };
  }

  async startServer(modelName) {
    this.validateModelName(modelName);
    return this.serverManager.startServer(modelName);
  }

  async stopServer() {
    await this.serverManager.stopServer();
  }

  getServerStatus() {
    return this.serverManager.getServerStatus();
  }

  async transcribeLocalParakeet(audioBlob, options = {}) {
    debugLogger.logSTTPipeline("transcribeLocalParakeet - start", {
      options,
      audioBlobType: audioBlob?.constructor?.name,
      audioBlobSize: audioBlob?.byteLength || audioBlob?.size || 0,
      serverAvailable: this.serverManager.isAvailable(),
    });

    if (!this.serverManager.isAvailable()) {
      throw new Error(
        "sherpa-onnx binary not found. Please ensure the app is installed correctly."
      );
    }

    const model = options.model || "parakeet-tdt-0.6b-v3";

    if (!this.serverManager.isModelDownloaded(model)) {
      throw new Error(
        `Parakeet model "${model}" not downloaded. Please download it from Settings.`
      );
    }

    let audioBuffer;
    if (Buffer.isBuffer(audioBlob)) {
      audioBuffer = audioBlob;
    } else if (ArrayBuffer.isView(audioBlob)) {
      audioBuffer = Buffer.from(audioBlob.buffer, audioBlob.byteOffset, audioBlob.byteLength);
    } else if (audioBlob instanceof ArrayBuffer) {
      audioBuffer = Buffer.from(audioBlob);
    } else if (typeof audioBlob === "string") {
      audioBuffer = Buffer.from(audioBlob, "base64");
    } else if (audioBlob && audioBlob.buffer && typeof audioBlob.byteLength === "number") {
      audioBuffer = Buffer.from(audioBlob.buffer, audioBlob.byteOffset || 0, audioBlob.byteLength);
    } else {
      throw new Error(`Unsupported audio data type: ${typeof audioBlob}`);
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error("Audio buffer is empty - no audio data received");
    }

    debugLogger.logSTTPipeline("transcribeLocalParakeet - processing", {
      bufferSize: audioBuffer.length,
      model,
    });

    const startTime = Date.now();
    const language = options.language || "auto";
    const result = await this.serverManager.transcribe(audioBuffer, { modelName: model, language });
    const elapsed = Date.now() - startTime;

    debugLogger.logSTTPipeline("transcribeLocalParakeet - completed", {
      elapsed,
      textLength: result.text?.length || 0,
    });

    return this.parseParakeetResult(result);
  }

  parseParakeetResult(output) {
    debugLogger.debug("parseParakeetResult", {
      hasOutput: !!output,
      hasText: !!output?.text,
      textLength: output?.text?.length || 0,
    });

    if (!output || !output.text) {
      return { success: false, message: "No audio detected" };
    }

    const text = output.text.trim();

    if (!text || text.length === 0) {
      return { success: false, message: "No audio detected" };
    }

    return { success: true, text };
  }

  async downloadParakeetModel(modelName, progressCallback = null) {
    this.validateModelName(modelName);
    const modelConfig = getParakeetModelConfig(modelName);

    const modelPath = this.getModelPath(modelName);
    const modelsDir = this.getModelsDir();

    await fsPromises.mkdir(modelsDir, { recursive: true });

    if (this.serverManager.isModelDownloaded(modelName)) {
      return { model: modelName, downloaded: true, path: modelPath, success: true };
    }

    const archivePath = path.join(modelsDir, `${modelName}.tar.bz2`);
    const { signal, abort } = createDownloadSignal();
    this.currentDownloadProcess = { abort };

    try {
      await downloadFile(modelConfig.url, archivePath, {
        timeout: 600000,
        signal,
        onProgress: (downloadedBytes, totalBytes) => {
          if (progressCallback) {
            progressCallback({
              type: "progress",
              model: modelName,
              downloaded_bytes: downloadedBytes,
              total_bytes: totalBytes,
              percentage: totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0,
            });
          }
        },
      });

      if (progressCallback) {
        progressCallback({ type: "installing", model: modelName, percentage: 100 });
      }

      await this._extractModel(archivePath, modelName);
      await fsPromises.unlink(archivePath).catch(() => {});

      if (progressCallback) {
        progressCallback({ type: "complete", model: modelName, percentage: 100 });
      }

      return { model: modelName, downloaded: true, path: modelPath, success: true };
    } catch (error) {
      await fsPromises.unlink(archivePath).catch(() => {});
      if (error.isAbort) {
        throw new Error("Download interrupted by user");
      }
      throw error;
    } finally {
      this.currentDownloadProcess = null;
    }
  }

  async _extractModel(archivePath, modelName) {
    const modelsDir = this.getModelsDir();
    const modelConfig = getParakeetModelConfig(modelName);
    const extractDir = path.join(modelsDir, `temp-extract-${modelName}`);

    try {
      // Create temp extract directory
      await fsPromises.mkdir(extractDir, { recursive: true });

      // Extract tar.bz2 asynchronously (tar is available on Windows 10+ and all Unix systems)
      await this._runTarExtract(archivePath, extractDir);

      // Find the extracted directory (usually has a specific name)
      const extractedDir = path.join(extractDir, modelConfig.extractDir);
      const targetDir = this.getModelPath(modelName);

      // Move to final location
      if (fs.existsSync(extractedDir)) {
        // Remove target if exists
        if (fs.existsSync(targetDir)) {
          await fsPromises.rm(targetDir, { recursive: true, force: true });
        }
        await fsPromises.rename(extractedDir, targetDir);
      } else {
        // If extracted directory doesn't match expected name, try to find it
        const entries = await fsPromises.readdir(extractDir);
        let modelDir = null;

        for (const entry of entries) {
          const entryPath = path.join(extractDir, entry);
          const stat = await fsPromises.stat(entryPath);
          if (stat.isDirectory() && entry.includes("parakeet")) {
            modelDir = entry;
            break;
          }
        }

        if (modelDir) {
          if (fs.existsSync(targetDir)) {
            await fsPromises.rm(targetDir, { recursive: true, force: true });
          }
          await fsPromises.rename(path.join(extractDir, modelDir), targetDir);
        } else {
          throw new Error("Could not find model directory in extracted archive");
        }
      }

      // Cleanup temp directory
      await fsPromises.rm(extractDir, { recursive: true, force: true });

      debugLogger.info("Parakeet model extracted", { modelName, targetDir });
    } catch (error) {
      // Cleanup on error
      try {
        await fsPromises.rm(extractDir, { recursive: true, force: true });
      } catch {}
      throw error;
    }
  }

  _runTarExtract(archivePath, extractDir) {
    return new Promise((resolve, reject) => {
      const tarProcess = spawn("tar", ["-xjf", archivePath, "-C", extractDir], {
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stderr = "";

      tarProcess.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      tarProcess.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`tar extraction failed with code ${code}: ${stderr}`));
        }
      });

      tarProcess.on("error", (err) => {
        reject(new Error(`Failed to start tar process: ${err.message}`));
      });
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

    if (this.serverManager.isModelDownloaded(modelName)) {
      try {
        const encoderPath = path.join(modelPath, "encoder.int8.onnx");
        const stats = fs.statSync(encoderPath);
        return {
          model: modelName,
          downloaded: true,
          path: modelPath,
          size_bytes: stats.size,
          size_mb: Math.round(stats.size / (1024 * 1024)),
          success: true,
        };
      } catch {
        return { model: modelName, downloaded: false, success: true };
      }
    }

    return { model: modelName, downloaded: false, success: true };
  }

  async listParakeetModels() {
    const models = getValidModelNames();
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

  async deleteParakeetModel(modelName) {
    const modelPath = this.getModelPath(modelName);

    if (fs.existsSync(modelPath)) {
      try {
        const encoderPath = path.join(modelPath, "encoder.int8.onnx");
        let freedBytes = 0;

        if (fs.existsSync(encoderPath)) {
          const stats = fs.statSync(encoderPath);
          freedBytes = stats.size;
        }

        fs.rmSync(modelPath, { recursive: true, force: true });

        return {
          model: modelName,
          deleted: true,
          freed_bytes: freedBytes,
          freed_mb: Math.round(freedBytes / (1024 * 1024)),
          success: true,
        };
      } catch (error) {
        return { model: modelName, deleted: false, error: error.message, success: false };
      }
    }

    return { model: modelName, deleted: false, error: "Model not found", success: false };
  }

  async deleteAllParakeetModels() {
    const modelsDir = this.getModelsDir();
    let totalFreed = 0;
    let deletedCount = 0;

    try {
      if (!fs.existsSync(modelsDir)) {
        return { success: true, deleted_count: 0, freed_bytes: 0, freed_mb: 0 };
      }

      const entries = fs.readdirSync(modelsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const dirPath = path.join(modelsDir, entry.name);
          try {
            // Estimate size from encoder file
            const encoderPath = path.join(dirPath, "encoder.int8.onnx");
            if (fs.existsSync(encoderPath)) {
              const stats = fs.statSync(encoderPath);
              totalFreed += stats.size;
            }

            fs.rmSync(dirPath, { recursive: true, force: true });
            deletedCount++;
          } catch {
            // Continue with other models if one fails
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

  async getDiagnostics() {
    const diagnostics = {
      platform: process.platform,
      arch: process.arch,
      resourcesPath: process.resourcesPath || null,
      isPackaged: !!process.resourcesPath && !process.resourcesPath.includes("node_modules"),
      sherpaOnnx: { available: false, path: null },
      modelsDir: this.getModelsDir(),
      models: [],
    };

    // Check sherpa-onnx
    const binaryPath = this.serverManager.getBinaryPath();
    if (binaryPath) {
      diagnostics.sherpaOnnx = { available: true, path: binaryPath };
    }

    // Check downloaded models
    try {
      const modelsDir = this.getModelsDir();
      if (fs.existsSync(modelsDir)) {
        const entries = fs.readdirSync(modelsDir, { withFileTypes: true });
        diagnostics.models = entries
          .filter((e) => e.isDirectory() && this.serverManager.isModelDownloaded(e.name))
          .map((e) => e.name);
      }
    } catch {
      // Ignore errors reading models dir
    }

    return diagnostics;
  }
}

module.exports = ParakeetManager;
