const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");
const { promises: fsPromises } = require("fs");
const https = require("https");
const { pipeline } = require("stream");
const { app } = require("electron");

const modelRegistryData = require("../models/modelRegistryData.json");

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
    this.llamaCppPath = null;
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

  async ensureLlamaCpp() {
    const llamaCppInstaller = require("./llamaCppInstaller").default;

    if (!(await llamaCppInstaller.isInstalled())) {
      throw new ModelError("llama.cpp is not installed", "LLAMACPP_NOT_INSTALLED");
    }

    this.llamaCppPath = await llamaCppInstaller.getBinaryPath();
    return true;
  }

  async runInference(modelId, prompt, options = {}) {
    await this.ensureLlamaCpp();

    const modelInfo = this.findModelById(modelId);
    if (!modelInfo) {
      throw new ModelNotFoundError(modelId);
    }

    const modelPath = path.join(this.modelsDir, modelInfo.model.fileName);
    if (!(await this.checkModelValid(modelPath))) {
      throw new ModelError(
        `Model ${modelId} is not downloaded or is corrupted`,
        "MODEL_NOT_DOWNLOADED",
        {
          modelId,
        }
      );
    }

    const formattedPrompt = this.formatPrompt(
      modelInfo.provider,
      prompt,
      options.systemPrompt || ""
    );

    return new Promise((resolve, reject) => {
      const args = [
        "-m",
        modelPath,
        "-p",
        formattedPrompt,
        "-n",
        String(options.maxTokens || 512),
        "--temp",
        String(options.temperature || 0.7),
        "--top-k",
        String(options.topK || 40),
        "--top-p",
        String(options.topP || 0.9),
        "--repeat-penalty",
        String(options.repeatPenalty || 1.1),
        "-c",
        String(options.contextSize || modelInfo.model.contextLength),
        "-t",
        String(options.threads || 4),
        "--no-display-prompt",
      ];

      const process = spawn(this.llamaCppPath, args);
      let output = "";
      let error = "";

      process.stdout.on("data", (data) => {
        output += data.toString();
      });

      process.stderr.on("data", (data) => {
        error += data.toString();
      });

      process.on("close", (code) => {
        if (code !== 0) {
          reject(
            new ModelError(`Inference failed with code ${code}: ${error}`, "INFERENCE_FAILED", {
              code,
              error,
            })
          );
        } else {
          resolve(output.trim());
        }
      });

      process.on("error", (err) => {
        reject(
          new ModelError(`Failed to start inference: ${err.message}`, "INFERENCE_START_FAILED", {
            error: err.message,
          })
        );
      });
    });
  }

  formatPrompt(provider, text, systemPrompt) {
    if (provider.promptTemplate) {
      return provider.promptTemplate.replace("{system}", systemPrompt).replace("{user}", text);
    }
    return `${systemPrompt}\n\n${text}`;
  }
}

module.exports = {
  default: new ModelManager(),
  ModelError,
  ModelNotFoundError,
};
