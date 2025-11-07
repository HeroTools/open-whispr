/**
 * CommandService - Detects and executes voice commands
 */

import type { CommandDetectionResult, CommandExecutionResult } from '../types/commands';

export class CommandService {
  private static SLACK_MESSAGE_PATTERN = /^slack message[:\s]+(.+)$/i;

  /**
   * Detects if the transcribed text is a command
   */
  static detectCommand(text: string): CommandDetectionResult {
    const trimmedText = text.trim();

    // Check for "slack message" pattern
    const sendMatch = trimmedText.match(this.SLACK_MESSAGE_PATTERN);
    if (sendMatch) {
      const message = sendMatch[1].trim();
      if (!message) {
        return {
          isCommand: true,
          type: 'slack-webhook',
          error: 'No message content found'
        };
      }
      return {
        isCommand: true,
        type: 'slack-webhook',
        message
      };
    }

    // Not a command
    return { isCommand: false };
  }

  /**
   * Executes a Slack webhook command
   */
  static async executeSlackWebhook(
    message: string,
    webhookUrl: string
  ): Promise<CommandExecutionResult> {
    try {
      if (!webhookUrl) {
        return {
          success: false,
          error: 'Slack webhook URL not configured'
        };
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: message })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Slack API error: ${response.status} ${errorText}`
        };
      }

      return {
        success: true,
        message: 'Message sent to Slack'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Executes a detected command with countdown delay
   */
  static async executeCommand(
    detectionResult: CommandDetectionResult,
    webhookUrl: string,
    onCountdown?: (secondsLeft: number) => void,
    abortSignal?: AbortSignal
  ): Promise<CommandExecutionResult> {
    if (!detectionResult.isCommand) {
      return { success: false, error: 'Not a command' };
    }

    if (detectionResult.error) {
      return { success: false, error: detectionResult.error };
    }

    // Countdown delay (5 seconds)
    const COUNTDOWN_SECONDS = 5;
    for (let i = COUNTDOWN_SECONDS; i > 0; i--) {
      if (abortSignal?.aborted) {
        return { success: false, error: 'Cancelled by user' };
      }

      onCountdown?.(i);

      // Wait 1 second
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Check cancellation one more time before executing
    if (abortSignal?.aborted) {
      return { success: false, error: 'Cancelled by user' };
    }

    // Execute the command based on type
    if (detectionResult.type === 'slack-webhook' && detectionResult.message) {
      return await this.executeSlackWebhook(detectionResult.message, webhookUrl);
    }

    return { success: false, error: 'Unknown command type' };
  }
}
