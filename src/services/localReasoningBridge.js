const modelManager = require("../helpers/modelManagerBridge").default;
const debugLogger = require("../helpers/debugLogger");

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
        systemPrompt: "You are a helpful AI assistant that processes and improves text.",
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
    // Default prompts
    const DEFAULT_AGENT_PROMPT = `You are {{agentName}}, a helpful AI assistant. Process and improve the following text, removing any reference to your name from the output:\n\n{{text}}\n\nImproved text:`;
    const DEFAULT_REGULAR_PROMPT = `Process and improve the following text:\n\n{{text}}\n\nImproved text:`;

    let agentPrompt = DEFAULT_AGENT_PROMPT;
    let regularPrompt = DEFAULT_REGULAR_PROMPT;

    if (customPrompts) {
      agentPrompt = customPrompts.agent || DEFAULT_AGENT_PROMPT;
      regularPrompt = customPrompts.regular || DEFAULT_REGULAR_PROMPT;
    }

    // Check if agent name is mentioned
    if (agentName && text.toLowerCase().includes(agentName.toLowerCase())) {
      return agentPrompt.replace(/\{\{agentName\}\}/g, agentName).replace(/\{\{text\}\}/g, text);
    }

    return regularPrompt.replace(/\{\{text\}\}/g, text);
  }

  calculateMaxTokens(textLength, minTokens = 100, maxTokens = 2048, multiplier = 2) {
    return Math.max(minTokens, Math.min(textLength * multiplier, maxTokens));
  }
}

module.exports = {
  default: new LocalReasoningService(),
};
