import { getSystemPrompt } from "../config/prompts";

export interface ReasoningConfig {
  maxTokens?: number;
  temperature?: number;
  contextSize?: number;
}

export abstract class BaseReasoningService {
  protected isProcessing = false;

  /**
   * Get the system prompt for reasoning
   * Now uses the unified prompt from config/prompts.ts
   */
  protected getSystemPrompt(agentName: string | null): string {
    return getSystemPrompt(agentName);
  }

  /**
   * Get reasoning prompt (user message portion)
   * With unified prompts, we just return the text - all instructions are in the system prompt
   * @deprecated The unified prompt approach puts all instructions in the system prompt
   */
  protected getReasoningPrompt(
    text: string,
    agentName: string | null,
    config: ReasoningConfig = {}
  ): string {
    // With the unified prompt approach, the user message is just the text
    // All instructions about cleanup and agent detection are in the system prompt
    return text;
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
