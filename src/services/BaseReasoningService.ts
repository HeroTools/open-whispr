export interface ReasoningConfig {
  maxTokens?: number;
  temperature?: number;
  contextSize?: number;
}

export abstract class BaseReasoningService {
  protected isProcessing = false;

  /**
   * Get reasoning prompt
   */
  protected getReasoningPrompt(
    text: string, 
    agentName: string | null,
    config: ReasoningConfig = {}
  ): string {
    // Default prompts
    const DEFAULT_AGENT_PROMPT = `You are {{agentName}}, a helpful AI assistant. Process and improve the following text, removing any reference to your name from the output:\n\n{{text}}\n\nImproved text:`;
    const DEFAULT_REGULAR_PROMPT = `Process and improve the following text:\n\n{{text}}\n\nImproved text:`;

    // Get custom prompts from localStorage if available
    let agentPrompt = DEFAULT_AGENT_PROMPT;
    let regularPrompt = DEFAULT_REGULAR_PROMPT;

    if (typeof window !== 'undefined' && window.localStorage) {
      const customPrompts = window.localStorage.getItem('customPrompts');
      if (customPrompts) {
        try {
          const parsed = JSON.parse(customPrompts);
          agentPrompt = parsed.agent || DEFAULT_AGENT_PROMPT;
          regularPrompt = parsed.regular || DEFAULT_REGULAR_PROMPT;
        } catch (error) {
          console.error('Failed to parse custom prompts:', error);
        }
      }
    }

    // Simple prompt construction
    if (agentName && text.toLowerCase().includes(agentName.toLowerCase())) {
      // Agent-based prompt - replace placeholders
      return agentPrompt
        .replace(/\{\{agentName\}\}/g, agentName)
        .replace(/\{\{text\}\}/g, text);
    }
    
    // Regular prompt - replace placeholders
    return regularPrompt.replace(/\{\{text\}\}/g, text);
  }

  /**
   * Calculate optimal max tokens based on input length
   */
  protected calculateMaxTokens(
    textLength: number,
    minTokens = 100,
    maxTokens = 2048,
    multiplier = 2
  ): number {
    return Math.max(minTokens, Math.min(textLength * multiplier, maxTokens));
  }

  /**
   * Check if service is available
   */
  abstract isAvailable(): Promise<boolean>;

  /**
   * Process text with reasoning
   */
  abstract processText(
    text: string,
    modelId: string,
    agentName?: string | null,
    config?: ReasoningConfig
  ): Promise<string>;
}