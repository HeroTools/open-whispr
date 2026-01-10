const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");
const { promises: fsPromises } = require("fs");
const https = require("https");
const { app } = require("electron");

// Import the model registry data directly
let modelRegistryData;
try {
  modelRegistryData = require("../models/modelRegistryData.json");
  console.log("[ModelManager] Loaded registry data successfully");
} catch (error) {
  console.error("[ModelManager] Failed to load registry data:", error);
  // Fallback to inline data
  modelRegistryData = {
    providers: [
      {
        id: "qwen",
        name: "Qwen",
        baseUrl: "https://huggingface.co",
        models: [
          {
            id: "qwen2.5-0.5b-instruct-q5_k_m",
            name: "Qwen2.5 0.5B",
            size: "0.4GB",
            sizeBytes: 429496729,
            description: "Smallest model, fast but limited capabilities",
            fileName: "qwen2.5-0.5b-instruct-q5_k_m.gguf",
            quantization: "q5_k_m",
            contextLength: 32768,
          },
          {
            id: "qwen2.5-1.5b-instruct-q5_k_m",
            name: "Qwen2.5 1.5B",
            size: "1.3GB",
            sizeBytes: 1395864371,
            description: "Small model, good for basic tasks",
            fileName: "qwen2.5-1.5b-instruct-q5_k_m.gguf",
            quantization: "q5_k_m",
            contextLength: 32768,
          },
          {
            id: "qwen2.5-3b-instruct-q5_k_m",
            name: "Qwen2.5 3B",
            size: "2.3GB",
            sizeBytes: 2469606195,
            description: "Balanced model for general use",
            fileName: "qwen2.5-3b-instruct-q5_k_m.gguf",
            quantization: "q5_k_m",
            contextLength: 32768,
          },
          {
            id: "qwen2.5-7b-instruct-q4km",
            name: "Qwen2.5 7B",
            size: "4.7GB",
            sizeBytes: 5046586241,
            description: "Large model with high quality (Q4_K_M quantization)",
            fileName: "qwen2.5-7b-instruct-q4_k_m.gguf",
            quantization: "q4_k_m",
            contextLength: 128000,
            recommended: true,
          },
          {
            id: "qwen2.5-7b-instruct-q5_k_m",
            name: "Qwen2.5 7B",
            size: "5.4GB",
            sizeBytes: 5798205849,
            description: "Large model, high quality reasoning (Q5_K_M quantization)",
            fileName: "qwen2.5-7b-instruct-q5_k_m.gguf",
            quantization: "q5_k_m",
            contextLength: 128000,
          },
        ],
      },
    ],
  };
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

      console.log("[ModelManager] Getting all models from registry");
      console.log("[ModelManager] Registry data:", modelRegistryData);

      // Get all models from registry
      for (const provider of modelRegistryData.providers) {
        for (const model of provider.models) {
          const modelPath = path.join(this.modelsDir, model.fileName);
          const isDownloaded = await this.checkFileExists(modelPath);

          models.push({
            ...model,
            providerId: provider.id,
            providerName: provider.name,
            isDownloaded,
            path: isDownloaded ? modelPath : null,
          });
        }
      }

      console.log("[ModelManager] Found models:", models.length);
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
    return this.checkFileExists(modelPath);
  }

  async checkFileExists(filePath) {
    try {
      await fsPromises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  findModelById(modelId) {
    for (const provider of modelRegistryData.providers) {
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

    // Check if already downloaded
    if (await this.checkFileExists(modelPath)) {
      return modelPath;
    }

    // Check if already downloading
    if (this.activeDownloads.get(modelId)) {
      throw new ModelError("Model is already being downloaded", "DOWNLOAD_IN_PROGRESS", {
        modelId,
      });
    }

    this.activeDownloads.set(modelId, true);

    try {
      // Construct download URL based on provider
      const downloadUrl = this.getDownloadUrl(provider, model);

      await this.downloadFile(downloadUrl, modelPath, (progress, downloadedSize, totalSize) => {
        this.downloadProgress.set(modelId, {
          modelId,
          progress,
          downloadedSize,
          totalSize,
        });
        if (onProgress) {
          onProgress(progress, downloadedSize, totalSize);
        }
      });

      return modelPath;
    } finally {
      this.activeDownloads.delete(modelId);
      this.downloadProgress.delete(modelId);
    }
  }

  getDownloadUrl(provider, model) {
    // Based on the provider type, construct the download URL
    if (provider.id === "qwen") {
      return `https://huggingface.co/Qwen/Qwen2.5-${model.name.split(" ")[1]}-Instruct-GGUF/resolve/main/${model.fileName}`;
    }
    // Add more providers as needed
    throw new ModelError(`Unknown provider: ${provider.id}`, "UNKNOWN_PROVIDER");
  }

  async downloadFile(url, destPath, onProgress) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(destPath);
      let downloadedSize = 0;
      let totalSize = 0;

      https
        .get(
          url,
          {
            headers: { "User-Agent": "OpenWhispr/1.0" },
            timeout: 30000,
          },
          (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
              // Handle redirect
              file.close();
              fs.unlinkSync(destPath);
              return this.downloadFile(response.headers.location, destPath, onProgress)
                .then(resolve)
                .catch(reject);
            }

            if (response.statusCode !== 200) {
              file.close();
              fs.unlinkSync(destPath);
              reject(
                new ModelError(
                  `Download failed with status ${response.statusCode}`,
                  "DOWNLOAD_FAILED",
                  { statusCode: response.statusCode }
                )
              );
              return;
            }

            totalSize = parseInt(response.headers["content-length"], 10);

            response.on("data", (chunk) => {
              downloadedSize += chunk.length;
              file.write(chunk);

              if (onProgress && totalSize > 0) {
                const progress = (downloadedSize / totalSize) * 100;
                onProgress(progress, downloadedSize, totalSize);
              }
            });

            response.on("end", () => {
              file.close();
              resolve(destPath);
            });

            response.on("error", (error) => {
              file.close();
              fs.unlinkSync(destPath);
              reject(
                new ModelError(`Download error: ${error.message}`, "DOWNLOAD_ERROR", {
                  error: error.message,
                })
              );
            });
          }
        )
        .on("error", (error) => {
          file.close();
          if (fs.existsSync(destPath)) {
            fs.unlinkSync(destPath);
          }
          reject(
            new ModelError(`Network error: ${error.message}`, "NETWORK_ERROR", {
              error: error.message,
            })
          );
        });
    });
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
    // Simplify - isInstalled already checks system installation
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
    if (!(await this.checkFileExists(modelPath))) {
      throw new ModelError(`Model ${modelId} is not downloaded`, "MODEL_NOT_DOWNLOADED", {
        modelId,
      });
    }

    // Format the prompt based on the provider
    const formattedPrompt = this.formatPrompt(
      modelInfo.provider,
      prompt,
      options.systemPrompt || ""
    );

    // Run inference with llama.cpp
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
    if (provider.id === "qwen") {
      return `<|im_start|>system\n${systemPrompt}<|im_end|>\n<|im_start|>user\n${text}<|im_end|>\n<|im_start|>assistant\n`;
    }
    // Add more providers as needed
    return `${systemPrompt}\n\n${text}`;
  }
}

module.exports = {
  default: new ModelManager(),
  ModelError,
  ModelNotFoundError,
};
