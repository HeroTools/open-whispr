/**
 * CommandParserService - Integration Examples
 *
 * This file demonstrates how to integrate CommandParserService with the existing CommandService
 * to enable AI-powered natural language command parsing.
 */

import { CommandParserService } from './CommandParserService';
import { CommandService } from './CommandService';
import type { CommandDetectionResult } from '../types/commands';

/**
 * Example 1: Basic usage - Parse a single command
 */
async function example1_basicUsage() {
  console.log('=== Example 1: Basic Usage ===\n');

  try {
    const result = await CommandParserService.parseSlackCommand(
      "slack message: deploy is complete",
      "gemini-2.5-flash-lite"
    );

    console.log('Input:  "slack message: deploy is complete"');
    console.log('Output:', result);
    // Expected: { message: "deploy is complete" }
  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * Example 2: Natural language variations
 */
async function example2_naturalLanguage() {
  console.log('\n=== Example 2: Natural Language Variations ===\n');

  const testCases = [
    "slack message: deploy is complete",
    "send to slack meeting in 5 minutes",
    "post to slack: all systems operational",
    "slack the build passed successfully",
    "message slack code review needed ASAP",
    "slack lunch at noon today"
  ];

  for (const input of testCases) {
    try {
      const result = await CommandParserService.parseSlackCommand(input, "gemini-2.5-flash-lite");
      console.log(`Input:  "${input}"`);
      console.log(`Output: "${result.message}"\n`);
    } catch (error) {
      console.error(`Failed to parse "${input}":`, error);
    }
  }
}

/**
 * Example 3: Integration with CommandService
 * Shows how to modify CommandService.detectCommand to use AI parsing
 */
async function example3_commandServiceIntegration(text: string): Promise<CommandDetectionResult> {
  console.log('\n=== Example 3: CommandService Integration ===\n');

  const trimmedText = text.trim();

  console.log('[CommandService] Checking text for commands:', trimmedText);

  // First, quick check if it looks like a Slack command
  if (CommandParserService.looksLikeSlackCommand(trimmedText)) {
    console.log('[CommandService] Slack command detected, using AI to parse...');

    try {
      // Use AI to extract the message
      const result = await CommandParserService.parseSlackCommand(
        trimmedText,
        'gemini-2.5-flash-lite'
      );

      console.log('[CommandService] ✓ AI parsed message:', result.message);

      return {
        isCommand: true,
        type: 'slack-webhook',
        message: result.message
      };
    } catch (error) {
      console.error('[CommandService] ✗ AI parsing failed:', error);

      // Fall back to regex if AI fails
      console.log('[CommandService] Falling back to regex pattern...');
      const SLACK_MESSAGE_PATTERN = /^slack message[:.;,\s]+(.+)$/i;
      const match = trimmedText.match(SLACK_MESSAGE_PATTERN);

      if (match && match[1]) {
        return {
          isCommand: true,
          type: 'slack-webhook',
          message: match[1].trim()
        };
      }

      return {
        isCommand: true,
        type: 'slack-webhook',
        error: 'Failed to parse command'
      };
    }
  }

  console.log('[CommandService] No command detected - treating as normal dictation');
  return { isCommand: false };
}

/**
 * Example 4: Pre-validation to save API costs
 */
async function example4_efficientParsing() {
  console.log('\n=== Example 4: Efficient Parsing with Pre-validation ===\n');

  const inputs = [
    "slack message: deploy complete",  // Should parse
    "Hello world how are you",         // Should skip
    "send to slack urgent update"      // Should parse
  ];

  for (const input of inputs) {
    console.log(`\nInput: "${input}"`);

    // Pre-validation avoids expensive AI call for non-commands
    if (CommandParserService.looksLikeSlackCommand(input)) {
      console.log('✓ Looks like Slack command, calling AI...');
      try {
        const result = await CommandParserService.parseSlackCommand(input, 'gemini-2.5-flash-lite');
        console.log(`✓ Parsed: "${result.message}"`);
      } catch (error) {
        console.error('✗ Parsing failed:', error);
      }
    } else {
      console.log('✗ Not a Slack command, skipping AI call');
    }
  }
}

/**
 * Example 5: Different AI models
 */
async function example5_differentModels() {
  console.log('\n=== Example 5: Using Different AI Models ===\n');

  const input = "slack message: critical bug fix deployed";

  // Fast and cheap - Gemini Flash Lite (default)
  const geminiResult = await CommandParserService.parseSlackCommand(
    input,
    'gemini-2.5-flash-lite'
  );
  console.log('Gemini 2.5 Flash Lite:', geminiResult.message);

  // More capable - GPT-4o
  const gptResult = await CommandParserService.parseSlackCommand(
    input,
    'gpt-4o-mini'
  );
  console.log('GPT-4o Mini:', gptResult.message);

  // Claude alternative
  const claudeResult = await CommandParserService.parseSlackCommand(
    input,
    'claude-3-5-haiku-20241022'
  );
  console.log('Claude 3.5 Haiku:', claudeResult.message);
}

/**
 * Example 6: Error handling
 */
async function example6_errorHandling() {
  console.log('\n=== Example 6: Error Handling ===\n');

  // Test with invalid/empty input
  const edgeCases = [
    "",
    "slack message:",
    "slack",
    "slack message: ",
  ];

  for (const input of edgeCases) {
    console.log(`\nTesting: "${input}"`);
    try {
      const result = await CommandParserService.parseSlackCommand(input, 'gemini-2.5-flash-lite');
      console.log('✓ Result:', result.message);
    } catch (error) {
      console.error('✗ Expected error:', error instanceof Error ? error.message : error);
    }
  }
}

// Run all examples
export async function runAllExamples() {
  await example1_basicUsage();
  await example2_naturalLanguage();
  await example3_commandServiceIntegration("slack message: production deployment completed");
  await example4_efficientParsing();
  await example5_differentModels();
  await example6_errorHandling();
}

// Export individual examples for selective testing
export {
  example1_basicUsage,
  example2_naturalLanguage,
  example3_commandServiceIntegration,
  example4_efficientParsing,
  example5_differentModels,
  example6_errorHandling
};
