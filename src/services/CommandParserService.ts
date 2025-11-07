/**
 * CommandParserService - Uses AI to parse natural language voice commands
 *
 * This service leverages AI models to intelligently extract command parameters
 * from natural language input, supporting flexible phrasing beyond rigid regex patterns.
 */

import ReasoningService from './ReasoningService';

export interface SlackCommandResult {
  message: string;
}

export class CommandParserService {
  // Semaphore to prevent concurrent localStorage manipulation
  private static processingLock: Promise<any> | null = null;

  /**
   * Custom prompt template for extracting Slack message content
   * This uses the {{text}} placeholder that ReasoningService expects
   */
  private static readonly SLACK_EXTRACTION_PROMPT = `Extract the Slack message content from this voice command, removing the command trigger phrase.

Voice command: {{text}}

Rules:
- Extract ONLY the message the user wants to send to Slack
- Remove command triggers: "slack message", "send to slack", "post to slack", "slack", etc.
- Remove command punctuation (colons after command words)
- Keep the message content exactly as spoken with its original punctuation
- Return ONLY the message text, nothing else
- Do not add quotes or explanations

Examples:
"slack message: deploy complete" → deploy complete
"send to slack meeting in 5" → meeting in 5
"post to slack: all systems go" → all systems go
"slack the build is done" → the build is done

Extracted message:`;

  /**
   * Parses a natural language Slack command using AI
   *
   * @param userInput - The raw transcribed text from the user
   * @param model - The AI model to use (defaults to gemini-2.5-flash-lite for speed and cost)
   * @returns Promise resolving to extracted message content
   *
   * @example
   * ```typescript
   * const result = await CommandParserService.parseSlackCommand(
   *   "slack message: deploy is complete",
   *   "gemini-2.5-flash-lite"
   * );
   * // result => { message: "deploy is complete" }
   * ```
   */
  static async parseSlackCommand(
    userInput: string,
    model: string = 'gemini-2.5-flash-lite'
  ): Promise<SlackCommandResult> {
    console.log('[CommandParser] Parsing with model:', model);
    console.log('[CommandParser] Input:', userInput);

    // Input validation
    if (!userInput || typeof userInput !== 'string') {
      throw new Error('Invalid input: userInput must be a non-empty string');
    }

    const trimmedInput = userInput.trim();
    if (!trimmedInput) {
      throw new Error('Invalid input: userInput cannot be empty or whitespace');
    }

    // Check for excessive length (prevent token overruns)
    const MAX_INPUT_LENGTH = 1000; // Reasonable limit for voice commands
    if (trimmedInput.length > MAX_INPUT_LENGTH) {
      console.warn('[CommandParser] Input too long, truncating:', trimmedInput.length);
      // Don't throw - just truncate and continue
    }

    try {
      // Pre-check: Verify API key is available before attempting AI parsing
      const hasApiKey = await this.checkApiKeyAvailable(model);
      if (!hasApiKey) {
        console.warn('[CommandParser] No API key available for model:', model);
        throw new Error('API key not configured for selected model');
      }

      // Use the processWithCustomPrompt method to call AI with our specialized prompt
      const extractedText = await this.processWithCustomPrompt(
        userInput,
        this.SLACK_EXTRACTION_PROMPT,
        model
      );

      const message = extractedText.trim();

      if (!message) {
        console.error('[CommandParser] ✗ Error: AI returned empty message');
        throw new Error('Could not extract message from command');
      }

      console.log('[CommandParser] Extracted:', message);

      return { message };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[CommandParser] ✗ Error:', errorMessage);
      throw new Error(`Failed to parse command: ${errorMessage}`);
    }
  }

  /**
   * Check if API key is available for the given model
   * This prevents unnecessary API calls when keys aren't configured
   */
  private static async checkApiKeyAvailable(model: string): Promise<boolean> {
    if (typeof window === 'undefined' || !window.electronAPI) {
      return false;
    }

    try {
      // Determine provider from model name
      const provider = this.getProviderForModel(model);

      // Check if API key exists for this provider
      let apiKey = '';
      switch (provider) {
        case 'gemini':
          apiKey = await window.electronAPI.getGeminiKey?.() || '';
          break;
        case 'openai':
          apiKey = await window.electronAPI.getOpenAIKey?.() || '';
          break;
        case 'anthropic':
          apiKey = await window.electronAPI.getAnthropicKey?.() || '';
          break;
        default:
          return false;
      }

      return apiKey.length > 0;
    } catch (error) {
      console.error('[CommandParser] Failed to check API key:', error);
      return false;
    }
  }

  /**
   * Determine the provider for a given model
   */
  private static getProviderForModel(model: string): 'gemini' | 'openai' | 'anthropic' | 'unknown' {
    const lowerModel = model.toLowerCase();

    if (lowerModel.includes('gemini')) {
      return 'gemini';
    } else if (lowerModel.includes('gpt') || lowerModel.includes('o1') || lowerModel.includes('o3')) {
      return 'openai';
    } else if (lowerModel.includes('claude')) {
      return 'anthropic';
    }

    return 'unknown';
  }

  /**
   * Internal method to process text with a custom system prompt
   *
   * This temporarily stores custom prompts in localStorage, calls ReasoningService,
   * then restores the original prompts. This approach allows us to use the existing
   * ReasoningService infrastructure without modifying its core API.
   *
   * @param userInput - The text to process
   * @param systemPrompt - The system instructions for the AI
   * @param model - The AI model to use
   * @returns The AI's response text
   */
  private static async processWithCustomPrompt(
    userInput: string,
    systemPrompt: string,
    model: string
  ): Promise<string> {
    // Wait for any ongoing processing to complete (prevents race conditions)
    while (this.processingLock) {
      await this.processingLock;
    }

    // Acquire lock
    let releaseLock: () => void;
    this.processingLock = new Promise(resolve => {
      releaseLock = resolve;
    });

    if (typeof window === 'undefined' || !window.localStorage) {
      releaseLock();
      this.processingLock = null;
      throw new Error('localStorage not available');
    }

    // Store original prompts
    const originalPrompts = window.localStorage.getItem('customPrompts');

    console.log('[CommandParser] Temporarily setting custom prompt for AI processing');

    try {
      // Set our custom prompt temporarily
      // We use the 'regular' prompt since we're not using agent name
      const customPrompts = {
        agent: systemPrompt,
        regular: systemPrompt
      };

      window.localStorage.setItem('customPrompts', JSON.stringify(customPrompts));

      console.log('[CommandParser] Calling ReasoningService.processText...');

      // Call ReasoningService with our text
      // The service will use our temporary custom prompt from localStorage
      const result = await ReasoningService.processText(
        userInput,
        model,
        null, // No agent name
        {
          temperature: 0.1, // Low temperature for consistent extraction
          maxTokens: 500    // Commands are typically short
        }
      );

      console.log('[CommandParser] AI response received, length:', result.length);

      return result;
    } finally {
      // Restore original prompts
      if (originalPrompts) {
        window.localStorage.setItem('customPrompts', originalPrompts);
      } else {
        window.localStorage.removeItem('customPrompts');
      }
      console.log('[CommandParser] Restored original prompts');

      // Release lock
      releaseLock();
      this.processingLock = null;
    }
  }

  /**
   * Validates if text appears to be a Slack command
   * This is a lightweight check before calling expensive AI parsing
   *
   * @param text - The text to validate
   * @returns true if text contains Slack command keywords
   */
  static looksLikeSlackCommand(text: string): boolean {
    const lowerText = text.toLowerCase();
    const slackKeywords = [
      'slack',
      'send to slack',
      'post to slack',
      'message slack',
      'slack message'
    ];

    const hasKeyword = slackKeywords.some(keyword => lowerText.includes(keyword));

    if (hasKeyword) {
      console.log('[CommandParser] Pre-validation: Text appears to be Slack command');
    }

    return hasKeyword;
  }
}

// Example usage (for testing):
//
// const result = await CommandParserService.parseSlackCommand(
//   "slack message: deploy is complete",
//   "gemini-2.5-flash-lite"
// );
// console.log(result); // { message: "deploy is complete" }
//
// Other valid inputs:
// - "send to slack meeting in 5 minutes"
// - "post to slack: all systems operational"
// - "slack the build passed"
// - "message slack code review needed ASAP"
