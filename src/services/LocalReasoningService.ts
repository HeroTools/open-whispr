import modelManager from "../helpers/ModelManager";
import { inferenceConfig } from "../config/InferenceConfig";
import { BaseReasoningService } from "./BaseReasoningService";
import { TOKEN_LIMITS } from "../config/constants";

interface LocalReasoningConfig {
  maxTokens?: number;
  temperature?: number;
  contextSize?: number;
}

class LocalReasoningService extends BaseReasoningService {
  async processText(
    text: string,
    modelId: string = "qwen2.5-7b-instruct-q5_k_m",
    agentName: string | null = null,
    config: LocalReasoningConfig = {}
  ): Promise<string> {
    if (this.isProcessing) {
      throw new Error("Already processing a request");
    }

    this.isProcessing = true;

    try {
      // Get prompt using the base class method
      const reasoningPrompt = this.getReasoningPrompt(text, agentName, config);

      // Get optimized config for reasoning use case
      const inferenceOptions = inferenceConfig.getConfigForUseCase('reasoning');
      
      // Calculate max tokens with configurable limits
      const maxTokens = config.maxTokens || this.calculateMaxTokens(
        text.length,
        TOKEN_LIMITS.MIN_TOKENS,
        TOKEN_LIMITS.MAX_TOKENS,
        TOKEN_LIMITS.TOKEN_MULTIPLIER
      );

      // Run inference
      const result = await modelManager.runInference(modelId, reasoningPrompt, {
        ...inferenceOptions,
        maxTokens,
        temperature: config.temperature || inferenceOptions.temperature,
        contextSize: config.contextSize || TOKEN_LIMITS.REASONING_CONTEXT_SIZE,
      });

      return result;
    } catch (error) {
      console.error("LocalReasoningService error:", error);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  // Check if local reasoning is available
  async isAvailable(): Promise<boolean> {
    try {
      await modelManager.ensureLlamaCpp();
      return true;
    } catch (error) {
      console.warn("Local reasoning not available:", (error as Error).message);
      return false;
    }
  }

  // Get list of downloaded models
  async getDownloadedModels() {
    try {
      const modelsWithStatus = await modelManager.getModelsWithStatus();
      return modelsWithStatus.filter(model => model.isDownloaded);
    } catch (error) {
      console.error("Failed to get downloaded models:", error);
      return [];
    }
  }
}

export default new LocalReasoningService();