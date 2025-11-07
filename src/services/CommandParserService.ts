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

    try {
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
    if (typeof window === 'undefined' || !window.localStorage) {
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
