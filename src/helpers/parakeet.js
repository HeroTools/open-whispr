const { app } = require("electron");
const fs = require("fs");
const fsPromises = require("fs").promises;
const os = require("os");
const path = require("path");
const https = require("https");
const { execSync } = require("child_process");
const debugLogger = require("./debugLogger");
const ParakeetServerManager = require("./parakeetServer");

// Parakeet model definitions with download URLs from sherpa-onnx releases
const PARAKEET_MODELS = {
  "parakeet-tdt-0.6b-v2": {
    url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8.tar.bz2",
    size: 700_000_000, // ~670MB compressed
    language: "en",
    extractDir: "sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8",
  },
  "parakeet-tdt-0.6b-v3": {
    url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8.tar.bz2",
    size: 710_000_000, // ~680MB compressed
    language: "multilingual",
    extractDir: "sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8",
  },
};

class ParakeetManager {
  constructor() {
    this.currentDownloadProcess = null;
    this.isInitialized = false;
    this.serverManager = new ParakeetServerManager();
  }

  getModelsDir() {
    const homeDir = app?.getPath?.("home") || os.homedir();
    return path.join(homeDir, ".cache", "openwhispr", "parakeet-models");
  }

  validateModelName(modelName) {
    const validModels = Object.keys(PARAKEET_MODELS);
    if (!validModels.includes(modelName)) {
      throw new Error(`Invalid Parakeet model: ${modelName}. Valid models: ${validModels.join(", ")}`);
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

      // Log dependency status
      await this.logDependencyStatus();
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
    for (const modelName of Object.keys(PARAKEET_MODELS)) {
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

    const model = options.model || "parakeet-tdt-0.6b-v2";

    if (!this.serverManager.isModelDownloaded(model)) {
      throw new Error(`Parakeet model "${model}" not downloaded. Please download it from Settings.`);
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

    debugLogger.logSTTPipeline("transcribeLocalParakeet - processing", {
      bufferSize: audioBuffer.length,
      model,
    });

    const startTime = Date.now();
    const result = await this.serverManager.transcribe(audioBuffer, { modelName: model });
    const elapsed = Date.now() - startTime;

    debugLogger.logSTTPipeline("transcribeLocalParakeet - completed", {
      elapsed,
      textLength: result.text?.length || 0,
    });

    return this.parseParakeetResult(result);
  }

  parseParakeetResult(output) {
    if (!output || !output.text) {
      return { success: false, message: "No audio detected" };
    }

    const text = output.text.trim();

    if (!text || text.length === 0) {
      return { success: false, message: "No audio detected" };
    }

    return { success: true, text };
  }

  // Model management methods
  async downloadParakeetModel(modelName, progressCallback = null) {
    this.validateModelName(modelName);
    const modelConfig = PARAKEET_MODELS[modelName];

    const modelPath = this.getModelPath(modelName);
    const modelsDir = this.getModelsDir();

    // Create models directory
    await fsPromises.mkdir(modelsDir, { recursive: true });

    // Check if already downloaded
    if (this.serverManager.isModelDownloaded(modelName)) {
      return {
        model: modelName,
        downloaded: true,
        path: modelPath,
        success: true,
      };
    }

    const tempPath = path.join(modelsDir, `${modelName}.tar.bz2.tmp`);
    const archivePath = path.join(modelsDir, `${modelName}.tar.bz2`);

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
      try {
        fs.unlinkSync(tempPath);
      } catch {}
      try {
        fs.unlinkSync(archivePath);
      } catch {}
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

            try {
              // Rename temp to archive
              await fsPromises.rename(tempPath, archivePath);

              // Extract the archive
              await this._extractModel(archivePath, modelName);

              // Cleanup archive
              await fsPromises.unlink(archivePath);

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
                success: true,
              });
            } catch (extractError) {
              cleanup();
              reject(new Error(`Failed to extract model: ${extractError.message}`));
            }
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

  async _extractModel(archivePath, modelName) {
    const modelsDir = this.getModelsDir();
    const modelConfig = PARAKEET_MODELS[modelName];
    const extractDir = path.join(modelsDir, `temp-extract-${modelName}`);

    try {
      // Create temp extract directory
      fs.mkdirSync(extractDir, { recursive: true });

      // Extract tar.bz2
      if (process.platform === "win32") {
        execSync(`tar -xjf "${archivePath}" -C "${extractDir}"`, { stdio: "pipe" });
      } else {
        execSync(`tar -xjf "${archivePath}" -C "${extractDir}"`, { stdio: "pipe" });
      }

      // Find the extracted directory (usually has a specific name)
      const extractedDir = path.join(extractDir, modelConfig.extractDir);
      const targetDir = this.getModelPath(modelName);

      // Move to final location
      if (fs.existsSync(extractedDir)) {
        // Remove target if exists
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true });
        }
        fs.renameSync(extractedDir, targetDir);
      } else {
        // If extracted directory doesn't match expected name, try to find it
        const entries = fs.readdirSync(extractDir);
        const modelDir = entries.find(
          (e) => fs.statSync(path.join(extractDir, e)).isDirectory() && e.includes("parakeet")
        );

        if (modelDir) {
          if (fs.existsSync(targetDir)) {
            fs.rmSync(targetDir, { recursive: true, force: true });
          }
          fs.renameSync(path.join(extractDir, modelDir), targetDir);
        } else {
          throw new Error("Could not find model directory in extracted archive");
        }
      }

      // Cleanup temp directory
      fs.rmSync(extractDir, { recursive: true, force: true });

      debugLogger.info("Parakeet model extracted", { modelName, targetDir });
    } catch (error) {
      // Cleanup on error
      try {
        fs.rmSync(extractDir, { recursive: true, force: true });
      } catch {}
      throw error;
    }
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
    const models = Object.keys(PARAKEET_MODELS);
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
