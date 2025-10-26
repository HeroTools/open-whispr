import modelManager from "../helpers/modelManager";
import { inferenceConfig } from "../config/InferenceConfig";
import { BaseReasoningService } from "./BaseReasoningService";
import { TOKEN_LIMITS } from "../config/constants";

// Import debugLogger for comprehensive logging
const debugLogger = {
  logReasoning: (stage: string, details: any) => {
    console.log(`[LOCAL_REASONING ${stage}]`, details);
  },
};

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
    debugLogger.logReasoning("LOCAL_MODEL_START", {
      modelId,
      agentName,
      textLength: text.length,
      configKeys: Object.keys(config),
    });

    if (this.isProcessing) {
      throw new Error("Already processing a request");
    }

    this.isProcessing = true;
    const startTime = Date.now();

    try {
      // Get prompt using the base class method
      const reasoningPrompt = this.getReasoningPrompt(text, agentName, config);

      debugLogger.logReasoning("LOCAL_MODEL_PROMPT_PREPARED", {
        promptLength: reasoningPrompt.length,
        hasAgentName: !!agentName,
      });

      // Get optimized config for reasoning use case
      const inferenceOptions = inferenceConfig.getConfigForUseCase("reasoning");

      // Calculate max tokens with configurable limits
      const maxTokens =
        config.maxTokens ||
        this.calculateMaxTokens(
          text.length,
          TOKEN_LIMITS.MIN_TOKENS,
          TOKEN_LIMITS.MAX_TOKENS,
          TOKEN_LIMITS.TOKEN_MULTIPLIER
        );

      debugLogger.logReasoning("LOCAL_MODEL_INFERENCE_CONFIG", {
        modelId,
        maxTokens,
        temperature: config.temperature || inferenceOptions.temperature,
        contextSize: config.contextSize || TOKEN_LIMITS.REASONING_CONTEXT_SIZE,
      });

      // Run inference
      const result = await modelManager.runInference(modelId, reasoningPrompt, {
        ...inferenceOptions,
        maxTokens,
        temperature: config.temperature || inferenceOptions.temperature,
        contextSize: config.contextSize || TOKEN_LIMITS.REASONING_CONTEXT_SIZE,
      });

      const processingTime = Date.now() - startTime;

      debugLogger.logReasoning("LOCAL_MODEL_SUCCESS", {
        modelId,
        processingTimeMs: processingTime,
        resultLength: result.length,
        resultPreview: result.substring(0, 100) + (result.length > 100 ? "..." : ""),
      });

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;

      debugLogger.logReasoning("LOCAL_MODEL_ERROR", {
        modelId,
        processingTimeMs: processingTime,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });

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
      return modelsWithStatus.filter((model) => model.isDownloaded);
    } catch (error) {
      console.error("Failed to get downloaded models:", error);
      return [];
    }
  }
}

export default new LocalReasoningService();
