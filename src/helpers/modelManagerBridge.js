const path = require("path");
const fs = require("fs");
const { promises: fsPromises } = require("fs");
const https = require("https");
const { pipeline } = require("stream");
const { app } = require("electron");

const modelRegistryData = require("../models/modelRegistryData.json");
const LlamaServerManager = require("./llamaServer");
const debugLogger = require("./debugLogger");

const MIN_FILE_SIZE = 1_000_000; // 1MB minimum for valid model files

function getLocalProviders() {
  return modelRegistryData.localProviders || [];
}

class ModelError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = "ModelError";
    this.code = code;
    this.details = details;
  }
}

class ModelNotFoundError extends ModelError {
  constructor(modelId) {
    super(`Model ${modelId} not found`, "MODEL_NOT_FOUND", { modelId });
  }
}

class ModelManager {
  constructor() {
    this.modelsDir = this.getModelsDir();
    this.downloadProgress = new Map();
    this.activeDownloads = new Map();
    this.activeRequests = new Map(); // Track HTTP requests for cancellation
    this.serverManager = new LlamaServerManager();
    this.currentServerModelId = null;
    this.ensureModelsDirExists();
  }

  getModelsDir() {
    const homeDir = app.getPath("home");
    return path.join(homeDir, ".cache", "openwhispr", "models");
  }

  async ensureModelsDirExists() {
    try {
      await fsPromises.mkdir(this.modelsDir, { recursive: true });
    } catch (error) {
      console.error("Failed to create models directory:", error);
    }
  }

  async ensureLlamaCpp() {
    if (!this.serverManager.isAvailable()) {
      throw new ModelError(
        "llama-server binary not found. Please ensure the app is installed correctly.",
        "LLAMASERVER_NOT_FOUND"
      );
    }
    return true;
  }

  async getAllModels() {
    try {
      const models = [];

      for (const provider of getLocalProviders()) {
        for (const model of provider.models) {
          const modelPath = path.join(this.modelsDir, model.fileName);
          const isDownloaded = await this.checkModelValid(modelPath);

          models.push({
            ...model,
            providerId: provider.id,
            providerName: provider.name,
            isDownloaded,
            path: isDownloaded ? modelPath : null,
          });
        }
      }

      return models;
    } catch (error) {
      console.error("[ModelManager] Error getting all models:", error);
      throw error;
    }
  }

  async getModelsWithStatus() {
    return this.getAllModels();
  }

  async isModelDownloaded(modelId) {
    const modelInfo = this.findModelById(modelId);
    if (!modelInfo) return false;

    const modelPath = path.join(this.modelsDir, modelInfo.model.fileName);
    return this.checkModelValid(modelPath);
  }

  async checkFileExists(filePath) {
    try {
      await fsPromises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async checkModelValid(filePath) {
    try {
      const stats = await fsPromises.stat(filePath);
      return stats.size > MIN_FILE_SIZE;
    } catch {
      return false;
    }
  }

  findModelById(modelId) {
    for (const provider of getLocalProviders()) {
      const model = provider.models.find((m) => m.id === modelId);
      if (model) {
        return { model, provider };
      }
    }
    return null;
  }

  async downloadModel(modelId, onProgress) {
    const modelInfo = this.findModelById(modelId);
    if (!modelInfo) {
      throw new ModelNotFoundError(modelId);
    }

    const { model, provider } = modelInfo;
    const modelPath = path.join(this.modelsDir, model.fileName);
    const tempPath = `${modelPath}.tmp`;

    if (await this.checkModelValid(modelPath)) {
      return modelPath;
    }

    if (this.activeDownloads.get(modelId)) {
      throw new ModelError("Model is already being downloaded", "DOWNLOAD_IN_PROGRESS", {
        modelId,
      });
    }

    this.activeDownloads.set(modelId, true);

    try {
      await this.ensureModelsDirExists();
      const downloadUrl = this.getDownloadUrl(provider, model);

      await this.downloadFile(
        downloadUrl,
        tempPath,
        (progress, downloadedSize, totalSize) => {
          this.downloadProgress.set(modelId, {
            modelId,
            progress,
            downloadedSize,
            totalSize,
          });
          if (onProgress) {
            onProgress(progress, downloadedSize, totalSize);
          }
        },
        modelId
      );

      const stats = await fsPromises.stat(tempPath);
      if (stats.size < MIN_FILE_SIZE) {
        throw new ModelError(
          "Downloaded file appears to be corrupted or incomplete",
          "DOWNLOAD_CORRUPTED",
          { size: stats.size, minSize: MIN_FILE_SIZE }
        );
      }

      // Atomic rename to final path (handles cross-device moves on Windows)
      try {
        await fsPromises.rename(tempPath, modelPath);
      } catch (renameError) {
        if (renameError.code === "EXDEV") {
          await fsPromises.copyFile(tempPath, modelPath);
          await fsPromises.unlink(tempPath).catch(() => {});
        } else {
          throw renameError;
        }
      }

      return modelPath;
    } catch (error) {
      // Clean up partial download on failure
      await fsPromises.unlink(tempPath).catch(() => {});
      throw error;
    } finally {
      this.activeDownloads.delete(modelId);
      this.downloadProgress.delete(modelId);
    }
  }

  getDownloadUrl(provider, model) {
    const baseUrl = provider.baseUrl || "https://huggingface.co";
    return `${baseUrl}/${model.hfRepo}/resolve/main/${model.fileName}`;
  }

  async downloadFile(url, destPath, onProgress, modelId) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(destPath);
      let downloadedSize = 0;
      let totalSize = 0;
      let lastProgressUpdate = 0;
      const PROGRESS_THROTTLE_MS = 100; // Throttle progress updates to prevent UI flashing

      const cleanup = (callback) => {
        file.close(() => {
          fsPromises
            .unlink(destPath)
            .catch(() => {})
            .finally(callback);
        });
      };

      const request = https
        .get(
          url,
          {
            headers: { "User-Agent": "OpenWhispr/1.0" },
            timeout: 30000,
          },
          (response) => {
            if (
              response.statusCode === 301 ||
              response.statusCode === 302 ||
              response.statusCode === 303 ||
              response.statusCode === 307 ||
              response.statusCode === 308
            ) {
              const redirectUrl = response.headers.location;
              if (!redirectUrl) {
                cleanup(() => {
                  reject(
                    new ModelError("Redirect without location header", "DOWNLOAD_REDIRECT_ERROR")
                  );
                });
                return;
              }
              cleanup(() => {
                this.downloadFile(redirectUrl, destPath, onProgress, modelId)
                  .then(resolve)
                  .catch(reject);
              });
              return;
            }

            if (response.statusCode !== 200 && response.statusCode !== 206) {
              cleanup(() => {
                reject(
                  new ModelError(
                    `Download failed with status ${response.statusCode}`,
                    "DOWNLOAD_FAILED",
                    { statusCode: response.statusCode }
                  )
                );
              });
              return;
            }

            totalSize = parseInt(response.headers["content-length"], 10);

            response.on("data", (chunk) => {
              downloadedSize += chunk.length;

              // Throttle progress updates to prevent UI flashing
              const now = Date.now();
              if (
                onProgress &&
                totalSize > 0 &&
                (now - lastProgressUpdate >= PROGRESS_THROTTLE_MS || downloadedSize >= totalSize)
              ) {
                lastProgressUpdate = now;
                const progress = (downloadedSize / totalSize) * 100;
                onProgress(progress, downloadedSize, totalSize);
              }
            });

            pipeline(response, file, (error) => {
              // Clean up request tracking
              if (modelId) {
                this.activeRequests.delete(modelId);
              }

              if (error) {
                // Check if this was a cancellation
                if (
                  error.code === "ERR_STREAM_PREMATURE_CLOSE" &&
                  modelId &&
                  !this.activeDownloads.has(modelId)
                ) {
                  cleanup(() => {
                    reject(
                      new ModelError("Download cancelled by user", "DOWNLOAD_CANCELLED", {
                        modelId,
                      })
                    );
                  });
                  return;
                }
                cleanup(() => {
                  reject(
                    new ModelError(`Download error: ${error.message}`, "DOWNLOAD_ERROR", {
                      error: error.message,
                    })
                  );
                });
                return;
              }
              resolve(destPath);
            });
          }
        )
        .on("error", (error) => {
          // Clean up request tracking
          if (modelId) {
            this.activeRequests.delete(modelId);
          }

          cleanup(() => {
            // Check if this was a cancellation
            if (error.code === "ECONNRESET" && modelId && !this.activeDownloads.has(modelId)) {
              reject(
                new ModelError("Download cancelled by user", "DOWNLOAD_CANCELLED", {
                  modelId,
                })
              );
              return;
            }
            reject(
              new ModelError(`Network error: ${error.message}`, "NETWORK_ERROR", {
                error: error.message,
              })
            );
          });
        });

      // Store the request for potential cancellation
      if (modelId) {
        this.activeRequests.set(modelId, { request, file, destPath });
      }
    });
  }

  cancelDownload(modelId) {
    const activeRequest = this.activeRequests.get(modelId);
    if (activeRequest) {
      const { request, file, destPath } = activeRequest;

      // Mark as no longer active before destroying
      this.activeDownloads.delete(modelId);
      this.activeRequests.delete(modelId);
      this.downloadProgress.delete(modelId);

      // Destroy the request and close the file
      request.destroy();
      file.close(() => {
        fsPromises.unlink(destPath).catch(() => {});
      });

      return true;
    }
    return false;
  }

  async deleteModel(modelId) {
    const modelInfo = this.findModelById(modelId);
    if (!modelInfo) {
      throw new ModelNotFoundError(modelId);
    }

    const modelPath = path.join(this.modelsDir, modelInfo.model.fileName);

    if (await this.checkFileExists(modelPath)) {
      await fsPromises.unlink(modelPath);
    }
  }

  async deleteAllModels() {
    try {
      if (fsPromises.rm) {
        await fsPromises.rm(this.modelsDir, { recursive: true, force: true });
      } else {
        const entries = await fsPromises
          .readdir(this.modelsDir, { withFileTypes: true })
          .catch(() => []);
        for (const entry of entries) {
          const fullPath = path.join(this.modelsDir, entry.name);
          if (entry.isDirectory()) {
            await fsPromises.rmdir(fullPath, { recursive: true }).catch(() => {});
          } else {
            await fsPromises.unlink(fullPath).catch(() => {});
          }
        }
      }
    } catch (error) {
      throw new ModelError(
        `Failed to delete models directory: ${error.message}`,
        "DELETE_ALL_ERROR",
        { error: error.message }
      );
    } finally {
      await this.ensureModelsDirExists();
    }
  }

  async runInference(modelId, prompt, options = {}) {
    const startTime = Date.now();
    debugLogger.logReasoning("INFERENCE_START", {
      modelId,
      promptLength: prompt.length,
      options: { ...options, systemPrompt: options.systemPrompt ? "[set]" : "[not set]" },
    });

    // Ensure server is available
    if (!this.serverManager.isAvailable()) {
      debugLogger.logReasoning("INFERENCE_SERVER_NOT_AVAILABLE", {});
      throw new ModelError(
        "llama-server binary not found. Please ensure the app is installed correctly.",
        "LLAMASERVER_NOT_FOUND"
      );
    }

    const modelInfo = this.findModelById(modelId);
    if (!modelInfo) {
      debugLogger.logReasoning("INFERENCE_MODEL_NOT_FOUND", { modelId });
      throw new ModelNotFoundError(modelId);
    }

    const modelPath = path.join(this.modelsDir, modelInfo.model.fileName);
    debugLogger.logReasoning("INFERENCE_MODEL_PATH", {
      modelPath,
      modelName: modelInfo.model.name,
      providerId: modelInfo.provider.id,
    });

    if (!(await this.checkModelValid(modelPath))) {
      debugLogger.logReasoning("INFERENCE_MODEL_INVALID", { modelId, modelPath });
      throw new ModelError(
        `Model ${modelId} is not downloaded or is corrupted`,
        "MODEL_NOT_DOWNLOADED",
        { modelId }
      );
    }

    // Start/restart server if needed or if model changed
    if (!this.serverManager.ready || this.currentServerModelId !== modelId) {
      debugLogger.logReasoning("INFERENCE_STARTING_SERVER", {
        currentModel: this.currentServerModelId,
        requestedModel: modelId,
        serverReady: this.serverManager.ready,
      });

      await this.serverManager.start(modelPath, {
        contextSize: options.contextSize || modelInfo.model.contextLength || 4096,
        threads: options.threads || 4,
      });
      this.currentServerModelId = modelId;

      debugLogger.logReasoning("INFERENCE_SERVER_STARTED", {
        port: this.serverManager.port,
        model: modelId,
      });
    }

    // Build messages for chat completion
    const messages = [
      { role: "system", content: options.systemPrompt || "" },
      { role: "user", content: prompt },
    ];

    debugLogger.logReasoning("INFERENCE_SENDING_REQUEST", {
      messageCount: messages.length,
      systemPromptLength: (options.systemPrompt || "").length,
      userPromptLength: prompt.length,
    });

    try {
      const result = await this.serverManager.inference(messages, {
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 512,
      });

      const totalTime = Date.now() - startTime;
      debugLogger.logReasoning("INFERENCE_SUCCESS", {
        totalTimeMs: totalTime,
        resultLength: result.length,
        resultPreview: result.substring(0, 200) + (result.length > 200 ? "..." : ""),
      });

      return result;
    } catch (error) {
      const totalTime = Date.now() - startTime;
      debugLogger.logReasoning("INFERENCE_FAILED", {
        totalTimeMs: totalTime,
        error: error.message,
      });
      throw new ModelError(`Inference failed: ${error.message}`, "INFERENCE_FAILED", {
        error: error.message,
      });
    }
  }

  async stopServer() {
    await this.serverManager.stop();
    this.currentServerModelId = null;
  }

  getServerStatus() {
    return this.serverManager.getStatus();
  }

  async prewarmServer(modelId) {
    if (!modelId) return false;

    const modelInfo = this.findModelById(modelId);
    if (!modelInfo) return false;

    const modelPath = path.join(this.modelsDir, modelInfo.model.fileName);
    if (!(await this.checkModelValid(modelPath))) return false;

    if (!this.serverManager.isAvailable()) return false;

    try {
      await this.serverManager.start(modelPath, {
        contextSize: modelInfo.model.contextLength || 4096,
        threads: 4,
      });
      this.currentServerModelId = modelId;
      debugLogger.info("llama-server pre-warmed", { modelId });
      return true;
    } catch (error) {
      debugLogger.warn("Failed to pre-warm llama-server", { error: error.message });
      return false;
    }
  }
}

module.exports = {
  default: new ModelManager(),
  ModelError,
  ModelNotFoundError,
};
