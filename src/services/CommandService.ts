/**
 * CommandService - Detects and executes voice commands
 */

import type { CommandDetectionResult, CommandExecutionResult } from '../types/commands';
import { CommandParserService } from './CommandParserService';

export class CommandService {
  // Broader pattern to catch any text starting with "slack"
  // AI will handle the parsing instead of rigid regex
  private static SLACK_MESSAGE_PATTERN = /^slack.+$/i;

  // Fallback regex for when AI parsing fails
  private static SLACK_MESSAGE_FALLBACK_PATTERN = /^slack\s+(?:message|the|to|:)?[:\s]*(.+)$/i;

  /**
   * Detects if the transcribed text is a command
   * Now uses AI-powered parsing with regex fallback
   */
  static async detectCommand(text: string, model?: string): Promise<CommandDetectionResult> {
    const trimmedText = text.trim();

    console.log('[CommandService] Checking text for commands:', trimmedText);

    // Check for broad "slack" pattern
    if (trimmedText.match(this.SLACK_MESSAGE_PATTERN)) {
      console.log('[CommandService] ✓ Detected potential Slack command');

      // Pre-validate with lightweight check
      if (CommandParserService.looksLikeSlackCommand(trimmedText)) {
        // Try AI parsing first
        try {
          console.log('[CommandService] Attempting AI parsing...');

          // Use provided model or default to gemini-2.5-flash-lite
          const parserModel = model || 'gemini-2.5-flash-lite';
          console.log('[CommandService] Using command parser model:', parserModel);

          const result = await CommandParserService.parseSlackCommand(trimmedText, parserModel);

          console.log('[CommandService] ✓ AI parsed message:', result.message);

          return {
            isCommand: true,
            type: 'slack-webhook',
            message: result.message
          };
        } catch (error) {
          console.error('[CommandService] ✗ AI parsing failed:', error);
          console.log('[CommandService] Falling back to regex extraction...');
          // Continue to fallback regex below
        }
      }

      // Fallback: Use regex extraction
      const fallbackMatch = trimmedText.match(this.SLACK_MESSAGE_FALLBACK_PATTERN);
      if (fallbackMatch) {
        const message = fallbackMatch[1].trim();
        console.log('[CommandService] ✓ Fallback regex extracted message:', message);

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

      // Pattern matched "slack" but couldn't extract message
      console.warn('[CommandService] ✗ Slack keyword found but no message extracted');
      return {
        isCommand: true,
        type: 'slack-webhook',
        error: 'Could not extract message from command'
      };
    }

    console.log('[CommandService] No command detected - treating as normal dictation');
    // Not a command
    return { isCommand: false };
  }

  /**
   * Executes a Slack webhook command via IPC to main process
   */
  static async executeSlackWebhook(
    message: string,
    webhookUrl: string
  ): Promise<CommandExecutionResult> {
    try {
      console.log('[CommandService] Executing Slack webhook via IPC...');
      console.log('[CommandService] Message:', message);
      console.log('[CommandService] Webhook URL:', webhookUrl ? `${webhookUrl.substring(0, 40)}...` : 'NOT SET');

      if (!webhookUrl) {
        console.error('[CommandService] ✗ No webhook URL configured!');
        return {
          success: false,
          error: 'Slack webhook URL not configured'
        };
      }

      // Call main process via IPC to execute the webhook
      // @ts-ignore - electronAPI is exposed via preload
      const result = await window.electronAPI.executeSlackWebhook(message, webhookUrl);

      console.log('[CommandService] IPC result:', result);
      return result;
    } catch (error) {
      console.error('[CommandService] ✗ Exception during webhook execution:', error);
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
