const modelManager = require("../helpers/modelManagerBridge").default;
const debugLogger = require("../helpers/debugLogger");
const { getSystemPrompt } = require("../helpers/prompts");

class LocalReasoningService {
  constructor() {
    this.isProcessing = false;
  }

  async isAvailable() {
    try {
      // Check if llama.cpp is installed
      await modelManager.ensureLlamaCpp();

      // Check if at least one model is downloaded
      const models = await modelManager.getAllModels();
      return models.some((model) => model.isDownloaded);
    } catch (error) {
      return false;
    }
  }

  async processText(text, modelId, agentName = null, config = {}) {
    debugLogger.logReasoning("LOCAL_BRIDGE_START", {
      modelId,
      agentName,
      textLength: text.length,
      hasConfig: Object.keys(config).length > 0,
    });

    if (this.isProcessing) {
      throw new Error("Already processing a request");
    }

    this.isProcessing = true;
    const startTime = Date.now();

    try {
      // Get custom prompts from the request context
      const customPrompts = config.customPrompts || null;

      // Build the reasoning prompt
      const reasoningPrompt = this.getReasoningPrompt(text, agentName, customPrompts);

      debugLogger.logReasoning("LOCAL_BRIDGE_PROMPT", {
        promptLength: reasoningPrompt.length,
        hasAgentName: !!agentName,
        hasCustomPrompts: !!customPrompts,
      });

      const inferenceConfig = {
        maxTokens: config.maxTokens || this.calculateMaxTokens(text.length),
        temperature: config.temperature || 0.7,
        topK: config.topK || 40,
        topP: config.topP || 0.9,
        repeatPenalty: config.repeatPenalty || 1.1,
        contextSize: config.contextSize || 4096,
        threads: config.threads || 4,
        systemPrompt: getSystemPrompt(agentName),
      };

      debugLogger.logReasoning("LOCAL_BRIDGE_INFERENCE", {
        modelId,
        config: inferenceConfig,
      });

      // Run inference
      const result = await modelManager.runInference(modelId, reasoningPrompt, inferenceConfig);

      const processingTime = Date.now() - startTime;

      debugLogger.logReasoning("LOCAL_BRIDGE_SUCCESS", {
        modelId,
        processingTimeMs: processingTime,
        resultLength: result.length,
        resultPreview: result.substring(0, 100) + (result.length > 100 ? "..." : ""),
      });

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;

      debugLogger.logReasoning("LOCAL_BRIDGE_ERROR", {
        modelId,
        processingTimeMs: processingTime,
        error: error.message,
        stack: error.stack,
      });

      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  getCustomPrompts() {
    // In main process, we can't access localStorage directly
    // This should be passed from the renderer process
    return null;
  }

  getReasoningPrompt(text, agentName, customPrompts) {
    // With the unified prompt approach, all instructions are in the system prompt
    // The user message is just the transcribed text
    // Agent detection is now handled by the LLM itself based on the system prompt
    return text;
  }

  calculateMaxTokens(textLength, minTokens = 100, maxTokens = 2048, multiplier = 2) {
    return Math.max(minTokens, Math.min(textLength * multiplier, maxTokens));
  }
}

module.exports = {
  default: new LocalReasoningService(),
};
