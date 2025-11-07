/**
 * CommandService - Detects and executes voice commands
 */

import type { CommandDetectionResult, CommandExecutionResult } from '../types/commands';

export class CommandService {
  private static SLACK_MESSAGE_PATTERN = /^slack message[:.;\s]+(.+)$/i;

  /**
   * Detects if the transcribed text is a command
   */
  static detectCommand(text: string): CommandDetectionResult {
    const trimmedText = text.trim();

    console.log('[CommandService] Checking text for commands:', trimmedText);

    // Check for "slack message" pattern
    const sendMatch = trimmedText.match(this.SLACK_MESSAGE_PATTERN);
    if (sendMatch) {
      const message = sendMatch[1].trim();
      console.log('[CommandService] ✓ Slack command detected! Message:', message);
      if (!message) {
        console.warn('[CommandService] ✗ No message content found');
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

    console.log('[CommandService] No command detected - treating as normal dictation');
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
      console.log('[CommandService] Executing Slack webhook...');
      console.log('[CommandService] Message:', message);
      console.log('[CommandService] Webhook URL:', webhookUrl ? `${webhookUrl.substring(0, 40)}...` : 'NOT SET');

      if (!webhookUrl) {
        console.error('[CommandService] ✗ No webhook URL configured!');
        return {
          success: false,
          error: 'Slack webhook URL not configured'
        };
      }

      const payload = { text: message };
      console.log('[CommandService] POST payload:', payload);

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      console.log('[CommandService] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[CommandService] ✗ Slack API error:', response.status, errorText);
        return {
          success: false,
          error: `Slack API error: ${response.status} ${errorText}`
        };
      }

      console.log('[CommandService] ✓ Message sent successfully to Slack!');
      return {
        success: true,
        message: 'Message sent to Slack'
      };
    } catch (error) {
      console.error('[CommandService] ✗ Exception during webhook POST:', error);
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
    console.log('[CommandService] executeCommand called:', detectionResult);

    if (!detectionResult.isCommand) {
      console.warn('[CommandService] Not a command, aborting execution');
      return { success: false, error: 'Not a command' };
    }

    if (detectionResult.error) {
      console.error('[CommandService] Command has error:', detectionResult.error);
      return { success: false, error: detectionResult.error };
    }

    // Countdown delay (5 seconds)
    const COUNTDOWN_SECONDS = 5;
    console.log(`[CommandService] Starting ${COUNTDOWN_SECONDS} second countdown...`);

    for (let i = COUNTDOWN_SECONDS; i > 0; i--) {
      if (abortSignal?.aborted) {
        console.log('[CommandService] ✗ Cancelled by user during countdown');
        return { success: false, error: 'Cancelled by user' };
      }

      console.log(`[CommandService] Countdown: ${i}...`);
      onCountdown?.(i);

      // Wait 1 second
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Check cancellation one more time before executing
    if (abortSignal?.aborted) {
      console.log('[CommandService] ✗ Cancelled by user before execution');
      return { success: false, error: 'Cancelled by user' };
    }

    console.log('[CommandService] Countdown complete, executing command...');

    // Execute the command based on type
    if (detectionResult.type === 'slack-webhook' && detectionResult.message) {
      return await this.executeSlackWebhook(detectionResult.message, webhookUrl);
    }

    console.error('[CommandService] ✗ Unknown command type:', detectionResult.type);
    return { success: false, error: 'Unknown command type' };
  }
}
