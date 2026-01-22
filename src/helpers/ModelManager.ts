import path from "path";
import { spawn } from "child_process";
import fs from "fs";
import { promises as fsPromises } from "fs";
import https from "https";
import { app } from "electron";
import { modelRegistry } from "../models/ModelRegistry";
import { inferenceConfig } from "../config/InferenceConfig";
import { MODEL_CONSTRAINTS } from "../config/constants";

// Error types
export class ModelError extends Error {
  constructor(
    message: string,
    public code: string,
    public details: Record<string, any> = {}
  ) {
    super(message);
    this.name = "ModelError";
  }
}

export class ModelNotFoundError extends ModelError {
  constructor(modelId: string) {
    super(`Model ${modelId} not found`, "MODEL_NOT_FOUND", { modelId });
  }
}

export interface DownloadProgress {
  modelId: string;
  progress: number;
  downloadedSize: number;
  totalSize: number;
}

class ModelManager {
  private modelsDir: string;
  private llamaCppPath: string | null = null;
  private downloadProgress = new Map<string, DownloadProgress>();
  private activeDownloads = new Map<string, boolean>();

  constructor() {
    this.modelsDir = this.getModelsDir();
  }

  private getModelsDir(): string {
    const homeDir = app.getPath("home");
    return path.join(homeDir, ".cache", "openwhispr", "models");
  }

  async ensureModelsDir(): Promise<void> {
    await fsPromises.mkdir(this.modelsDir, { recursive: true });
  }

  async isModelDownloaded(modelId: string): Promise<boolean> {
    const modelInfo = modelRegistry.getModel(modelId);
    if (!modelInfo) return false;

    const modelPath = path.join(this.modelsDir, modelInfo.model.fileName);
    try {
      const stats = await fsPromises.stat(modelPath);
      return stats.size > MODEL_CONSTRAINTS.MIN_FILE_SIZE;
    } catch {
      return false;
    }
  }

  async downloadModel(
    modelId: string,
    onProgress?: (progress: number, downloaded: number, total: number) => void
  ): Promise<string> {
    if (this.activeDownloads.has(modelId)) {
      throw new ModelError("Download already in progress", "DOWNLOAD_IN_PROGRESS", { modelId });
    }

    await this.ensureModelsDir();

    const modelInfo = modelRegistry.getModel(modelId);
    if (!modelInfo) {
      throw new ModelNotFoundError(modelId);
    }

    const { model, provider } = modelInfo;
    const modelPath = path.join(this.modelsDir, model.fileName);
    const tempPath = `${modelPath}.tmp`;

    if (await this.isModelDownloaded(modelId)) {
      return modelPath;
    }

    const downloadUrl = provider.getDownloadUrl(model);
    this.activeDownloads.set(modelId, true);

    try {
      await this.downloadFile(downloadUrl, tempPath, (downloadedSize, totalSize) => {
        const progress = (downloadedSize / totalSize) * 100;
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

      const stats = await fsPromises.stat(tempPath);
      if (stats.size < MODEL_CONSTRAINTS.MIN_FILE_SIZE) {
        throw new ModelError("Downloaded file appears to be corrupted", "DOWNLOAD_CORRUPTED", {
          size: stats.size,
        });
      }

      await fsPromises.rename(tempPath, modelPath);

      this.downloadProgress.delete(modelId);
      this.activeDownloads.delete(modelId);

      return modelPath;
    } catch (error) {
      this.downloadProgress.delete(modelId);
      this.activeDownloads.delete(modelId);

      try {
        await fsPromises.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }

      throw error;
    }
  }

  async deleteModel(modelId: string): Promise<void> {
    const modelInfo = modelRegistry.getModel(modelId);
    if (!modelInfo) return;

    const modelPath = path.join(this.modelsDir, modelInfo.model.fileName);
    try {
      await fsPromises.unlink(modelPath);
    } catch (error: any) {
      if (error.code !== "ENOENT") {
        throw new ModelError(`Failed to delete model`, "DELETE_ERROR", {
          modelId,
          error: error.message,
        });
      }
    }
  }

  async deleteAllModels(): Promise<void> {
    try {
      await fsPromises.rm(this.modelsDir, { recursive: true, force: true });
    } catch (error: any) {
      throw new ModelError(
        `Failed to delete models directory: ${error.message}`,
        "DELETE_ALL_ERROR",
        { error: error.message }
      );
    } finally {
      await this.ensureModelsDir();
    }
  }

  getDownloadProgress(modelId: string): DownloadProgress | undefined {
    return this.downloadProgress.get(modelId);
  }

  private async downloadFile(
    url: string,
    destPath: string,
    onProgress: (downloaded: number, total: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(destPath);

      const request = https.get(url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            this.downloadFile(redirectUrl, destPath, onProgress).then(resolve).catch(reject);
            return;
          }
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Download failed: ${response.statusCode}`));
          return;
        }

        const totalSize = parseInt(response.headers["content-length"] || "0", 10);
        let downloadedSize = 0;

        response.on("data", (chunk) => {
          downloadedSize += chunk.length;
          onProgress(downloadedSize, totalSize);
        });

        response.pipe(file);

        file.on("finish", () => {
          file.close();
          resolve();
        });

        file.on("error", (err) => {
          fs.unlink(destPath, () => {});
          reject(err);
        });
      });

      request.on("error", reject);
    });
  }

  async ensureLlamaCpp(): Promise<boolean> {
    if (this.llamaCppPath) return true;

    // Dynamic import to avoid loading in frontend
    const llamaCppInstaller = require("./llamaCppInstaller").default;

    if (await llamaCppInstaller.isInstalled()) {
      this.llamaCppPath = llamaCppInstaller.getInstalledBinaryPath();
      return true;
    }

    const paths = [
      "llama-cli",
      "/usr/local/bin/llama-cli",
      "/opt/homebrew/bin/llama-cli",
      path.join(app.getPath("home"), ".local", "bin", "llama-cli"),
    ];

    for (const p of paths) {
      try {
        if (p === "llama-cli") {
          await new Promise((resolve, reject) => {
            spawn("which", ["llama-cli"]).on("close", (code) =>
              code === 0 ? resolve(p) : reject()
            );
          });
          this.llamaCppPath = p;
          return true;
        } else {
          await fsPromises.access(p, fs.constants.X_OK);
          this.llamaCppPath = p;
          return true;
        }
      } catch {
        // Continue to next path
      }
    }

    throw new ModelError(
      "llama.cpp not found. Please install it from the Local AI Models settings.",
      "LLAMA_CPP_NOT_FOUND"
    );
  }

  async runInference(modelId: string, prompt: string, options: any = {}): Promise<string> {
    await this.ensureLlamaCpp();

    const modelInfo = modelRegistry.getModel(modelId);
    if (!modelInfo) {
      throw new ModelNotFoundError(modelId);
    }

    const { model, provider } = modelInfo;
    const modelPath = path.join(this.modelsDir, model.fileName);

    if (!(await this.isModelDownloaded(modelId))) {
      throw new ModelError(`Model ${modelId} is not downloaded`, "MODEL_NOT_DOWNLOADED");
    }

    const config = inferenceConfig.getConfig();
    const finalOptions = { ...config, ...options };
    const formattedPrompt = provider.formatPrompt(prompt, "");

    const args = [
      "-m",
      modelPath,
      "-p",
      formattedPrompt,
      "-n",
      finalOptions.maxTokens.toString(),
      "--temp",
      finalOptions.temperature.toString(),
      "--top-k",
      finalOptions.topK.toString(),
      "--top-p",
      finalOptions.topP.toString(),
      "--repeat-penalty",
      finalOptions.repeatPenalty.toString(),
      "--ctx-size",
      finalOptions.contextSize.toString(),
      "--no-display-prompt",
      "-t",
      finalOptions.threads.toString(),
    ];

    return new Promise((resolve, reject) => {
      const llamaProcess = spawn(this.llamaCppPath!, args);
      let output = "";
      let error = "";

      llamaProcess.stdout.on("data", (data) => {
        output += data.toString();
      });

      llamaProcess.stderr.on("data", (data) => {
        error += data.toString();
      });

      llamaProcess.on("close", (code) => {
        if (code === 0) {
          resolve(this.parseLlamaCppOutput(output));
        } else {
          reject(new ModelError(`Inference failed: ${error}`, "INFERENCE_ERROR"));
        }
      });

      setTimeout(() => {
        llamaProcess.kill();
        reject(new ModelError("Inference timeout", "INFERENCE_TIMEOUT"));
      }, finalOptions.timeout);
    });
  }

  async getModelsWithStatus() {
    const allModels = modelRegistry.getAllModels();

    return Promise.all(
      allModels.map(async (model) => ({
        ...model,
        isDownloaded: await this.isModelDownloaded(model.id),
        downloadProgress: this.downloadProgress.get(model.id)?.progress || 0,
        isDownloading: this.activeDownloads.has(model.id),
      }))
    );
  }

  /**
   * Parse llama.cpp output to extract only the generated text.
   * Filters out diagnostic messages, timing stats, and other noise.
   */
  private parseLlamaCppOutput(rawOutput: string): string {
    if (!rawOutput) return "";

    const lines = rawOutput.split("\n");
    const filteredLines: string[] = [];

    // Patterns that indicate diagnostic/system output to filter out
    const diagnosticPatterns = [
      /^llama_/i, // llama_model_loader, llama_print_timings, etc.
      /^ggml_/i, // ggml backend messages
      /^log_/i, // log_set_target_file, etc.
      /^main:/i, // main function messages
      /^sampling:/i, // sampling parameter info
      /^generate:/i, // generation info
      /^system_info:/i, // system info
      /^\s*load time\s*=/i,
      /^\s*sample time\s*=/i,
      /^\s*prompt eval time\s*=/i,
      /^\s*eval time\s*=/i,
      /^\s*total time\s*=/i,
      /^Log start$/i,
      /^build: \d+/i, // build info
      /^n_threads/i, // thread info
      /^Using .* backend/i, // backend selection messages
      /^\s*\d+\s+tokens?\s+/i, // token count lines
    ];

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Skip empty lines at the start (but keep them in the middle of content)
      if (filteredLines.length === 0 && !trimmedLine) {
        continue;
      }

      // Check if line matches any diagnostic pattern
      let isDiagnostic = false;
      for (const pattern of diagnosticPatterns) {
        if (pattern.test(trimmedLine)) {
          isDiagnostic = true;
          break;
        }
      }

      if (!isDiagnostic) {
        filteredLines.push(line);
      }
    }

    // Trim trailing empty lines and return
    let result = filteredLines.join("\n").trim();

    // Handle special tokens that might appear in output
    // Remove common end tokens if they appear at the very end
    const endTokenPatterns = [/<\|im_end\|>$/, /<\|end\|>$/, /<\/s>$/, /\[end of text\]$/i];
    for (const pattern of endTokenPatterns) {
      result = result.replace(pattern, "").trim();
    }

    return result;
  }
}

export default new ModelManager();
