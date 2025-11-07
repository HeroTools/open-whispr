# CommandParserService Implementation Summary

## Overview
Created a new AI-powered command parsing service that replaces rigid regex patterns with flexible natural language understanding for Slack voice commands.

## Files Created

### 1. `/src/services/CommandParserService.ts` (Main Implementation)

**Purpose:** Core service that uses AI to extract Slack message content from natural language voice commands.

**Key Features:**
- Uses ReasoningService infrastructure for multi-provider AI support
- Supports Gemini, OpenAI (GPT), and Anthropic (Claude) models
- Default model: `gemini-2.5-flash-lite` (fast, cheap, effective)
- Comprehensive error handling and logging
- Temporary prompt injection via localStorage

**Main Methods:**

1. **`parseSlackCommand(userInput: string, model: string): Promise<SlackCommandResult>`**
   - Parses natural language Slack commands
   - Returns extracted message content
   - Example:
     ```typescript
     const result = await CommandParserService.parseSlackCommand(
       "slack message: deploy complete",
       "gemini-2.5-flash-lite"
     );
     // Returns: { message: "deploy complete" }
     ```

2. **`looksLikeSlackCommand(text: string): boolean`**
   - Pre-validation to avoid expensive AI calls
   - Checks for Slack-related keywords
   - Use before calling `parseSlackCommand()` to save API costs

**Supported Input Formats:**
- `"slack message: [message]"`
- `"send to slack [message]"`
- `"post to slack: [message]"`
- `"slack [message]"`
- `"message slack [message]"`
- And many other natural variations

### 2. `/src/services/CommandParserService.example.ts` (Integration Examples)

**Purpose:** Comprehensive examples showing how to integrate CommandParserService with existing code.

**Examples Included:**
1. Basic usage - Single command parsing
2. Natural language variations - Multiple input formats
3. CommandService integration - How to modify `detectCommand()`
4. Efficient parsing - Pre-validation to reduce costs
5. Different AI models - Using various providers
6. Error handling - Edge cases and validation

## Technical Architecture

### How It Works

1. **Prompt Template System:**
   ```typescript
   const SLACK_EXTRACTION_PROMPT = `Extract the Slack message content...
   Voice command: {{text}}
   ...
   Extracted message:`;
   ```
   - Uses `{{text}}` placeholder that ReasoningService expects
   - ReasoningService substitutes actual input for `{{text}}`
   - AI receives full instruction + specific command to parse

2. **Temporary Prompt Injection:**
   ```typescript
   // Store custom prompt in localStorage temporarily
   window.localStorage.setItem('customPrompts', JSON.stringify({
     agent: customPrompt,
     regular: customPrompt
   }));

   // Call ReasoningService (will use our prompt)
   const result = await ReasoningService.processText(input, model, null, config);

   // Restore original prompts
   window.localStorage.setItem('customPrompts', originalPrompts);
   ```
   - Leverages existing ReasoningService infrastructure
   - No modifications to ReasoningService needed
   - Clean separation of concerns

3. **Provider Support:**
   - **Gemini:** Direct API calls (fast, cheap)
   - **OpenAI:** Supports GPT-4o, GPT-5, o-series via Responses API
   - **Anthropic:** Claude models via IPC handler
   - Model selection automatic based on model string

### Integration with CommandService

**Before (Regex-based):**
```typescript
static detectCommand(text: string): CommandDetectionResult {
  const SLACK_MESSAGE_PATTERN = /^slack message[:.;,\s]+(.+)$/i;
  const match = text.match(SLACK_MESSAGE_PATTERN);

  if (match) {
    return { isCommand: true, type: 'slack-webhook', message: match[1] };
  }
  return { isCommand: false };
}
```

**After (AI-powered):**
```typescript
static async detectCommand(text: string): Promise<CommandDetectionResult> {
  // Quick pre-check to avoid AI call for non-commands
  if (CommandParserService.looksLikeSlackCommand(text)) {
    try {
      // Use AI to parse
      const result = await CommandParserService.parseSlackCommand(
        text,
        'gemini-2.5-flash-lite'
      );
      return { isCommand: true, type: 'slack-webhook', message: result.message };
    } catch (error) {
      // Fall back to regex if AI fails
      const match = text.match(SLACK_MESSAGE_PATTERN);
      if (match) {
        return { isCommand: true, type: 'slack-webhook', message: match[1] };
      }
    }
  }
  return { isCommand: false };
}
```

## Configuration Options

### Model Selection

**Recommended Models by Use Case:**

1. **Production (Fast & Cheap):**
   - `gemini-2.5-flash-lite` (default)
   - Lowest cost, fastest response
   - Sufficient for command parsing

2. **High Accuracy:**
   - `gpt-4o-mini` - Good balance
   - `gemini-2.5-flash` - More capable
   - `claude-3-5-haiku-20241022` - Anthropic option

3. **Maximum Capability:**
   - `gpt-4o` - Most capable OpenAI
   - `gemini-2.5-pro` - Most capable Gemini
   - `claude-3-5-sonnet-20241022` - Most capable Claude

### AI Configuration

```typescript
const result = await CommandParserService.parseSlackCommand(
  userInput,
  model,
);

// The service automatically sets:
// - temperature: 0.1 (consistent extraction)
// - maxTokens: 500 (commands are short)
```

## Error Handling

The service handles multiple error scenarios:

1. **Empty/Invalid Input:**
   ```typescript
   // Throws: "Could not extract message from command"
   await CommandParserService.parseSlackCommand("slack message:", model);
   ```

2. **API Failures:**
   ```typescript
   // Throws: "Failed to parse command: [API error]"
   // Suggestion: Fall back to regex pattern
   ```

3. **Missing API Keys:**
   ```typescript
   // Throws: "[Provider] API key not configured"
   ```

## Logging and Debugging

Comprehensive console logging at every stage:

```
[CommandParser] Parsing with model: gemini-2.5-flash-lite
[CommandParser] Input: slack message: deploy complete
[CommandParser] Temporarily setting custom prompt for AI processing
[CommandParser] Calling ReasoningService.processText...
[CommandParser] AI response received, length: 15
[CommandParser] Restored original prompts
[CommandParser] Extracted: deploy complete
```

## Performance Considerations

### API Costs (per 1000 commands)

Assuming average 20 input tokens, 10 output tokens:

1. **Gemini 2.5 Flash Lite:**
   - Input: 30 tokens × $0.075/1M = $0.00225
   - Output: 10 tokens × $0.30/1M = $0.00300
   - **Total: ~$0.005 per 1000 commands**

2. **GPT-4o Mini:**
   - Input: 30 tokens × $0.15/1M = $0.0045
   - Output: 10 tokens × $0.60/1M = $0.0060
   - **Total: ~$0.01 per 1000 commands**

3. **Claude 3.5 Haiku:**
   - Input: 30 tokens × $0.25/1M = $0.0075
   - Output: 10 tokens × $1.25/1M = $0.0125
   - **Total: ~$0.02 per 1000 commands**

### Latency

- Gemini Flash Lite: ~200-500ms
- GPT-4o Mini: ~300-600ms
- Claude Haiku: ~400-800ms

**Optimization:** Use `looksLikeSlackCommand()` pre-check to avoid AI calls for non-commands.

## Testing Strategy

### Manual Testing

Use the provided examples:

```typescript
import { runAllExamples } from './src/services/CommandParserService.example.ts';

// Run in browser console or Node script
await runAllExamples();
```

### Test Cases

From `CommandParserService.example.ts`:

1. **Standard format:** `"slack message: deploy complete"`
2. **Natural format:** `"send to slack meeting in 5"`
3. **Casual format:** `"slack the build passed"`
4. **Colon variant:** `"post to slack: urgent update"`
5. **No punctuation:** `"slack lunch at noon"`

### Edge Cases

1. Empty commands: `"slack message:"`
2. Just trigger: `"slack"`
3. Ambiguous: `"slack slack slack"`

## Future Enhancements

Possible improvements:

1. **Add more command types:**
   - Email commands
   - Calendar commands
   - Task management commands

2. **Multi-parameter extraction:**
   ```typescript
   interface EmailCommandResult {
     recipient: string;
     subject: string;
     body: string;
   }
   ```

3. **Intent classification:**
   ```typescript
   interface CommandIntent {
     type: 'slack' | 'email' | 'calendar';
     confidence: number;
     parameters: Record<string, any>;
   }
   ```

4. **Caching:**
   - Cache common commands to reduce API calls
   - Use fuzzy matching for similar inputs

5. **Streaming responses:**
   - Real-time parsing for long commands
   - Progressive feedback to user

## Migration Guide

### Step 1: Update CommandService.detectCommand()

Change from synchronous to async:

```typescript
// Before
static detectCommand(text: string): CommandDetectionResult {
  // regex matching
}

// After
static async detectCommand(text: string): Promise<CommandDetectionResult> {
  // AI parsing with regex fallback
}
```

### Step 2: Update Call Sites

Add `await` where `detectCommand()` is called:

```typescript
// Before
const detection = CommandService.detectCommand(transcription);

// After
const detection = await CommandService.detectCommand(transcription);
```

### Step 3: Add Error Handling

```typescript
try {
  const detection = await CommandService.detectCommand(transcription);
  if (detection.isCommand) {
    // Execute command
  }
} catch (error) {
  console.error('Command detection failed:', error);
  // Fall back to normal dictation
}
```

### Step 4: Configure Model (Optional)

Add setting to let users choose model:

```typescript
const model = localStorage.getItem('commandParserModel') || 'gemini-2.5-flash-lite';
const result = await CommandParserService.parseSlackCommand(text, model);
```

## API Reference

### CommandParserService

#### Static Methods

##### `parseSlackCommand(userInput: string, model?: string): Promise<SlackCommandResult>`

Parses a natural language Slack command using AI.

**Parameters:**
- `userInput` - The raw transcribed text from the user
- `model` - The AI model to use (default: `'gemini-2.5-flash-lite'`)

**Returns:**
- Promise resolving to `{ message: string }`

**Throws:**
- Error if parsing fails or message is empty

**Example:**
```typescript
const result = await CommandParserService.parseSlackCommand(
  "slack message: deploy complete"
);
console.log(result.message); // "deploy complete"
```

##### `looksLikeSlackCommand(text: string): boolean`

Quick validation to check if text contains Slack command keywords.

**Parameters:**
- `text` - The text to validate

**Returns:**
- `true` if text contains Slack keywords, `false` otherwise

**Example:**
```typescript
if (CommandParserService.looksLikeSlackCommand(text)) {
  // Call AI parsing
} else {
  // Skip to save API costs
}
```

### Types

#### `SlackCommandResult`

```typescript
interface SlackCommandResult {
  message: string;  // The extracted message content
}
```

## Dependencies

The service relies on:

1. **ReasoningService** (`/src/services/ReasoningService.ts`)
   - Provides multi-provider AI infrastructure
   - Handles API key management
   - Routes to appropriate provider

2. **Browser APIs:**
   - `window.localStorage` - For temporary prompt injection
   - Must run in browser/Electron renderer context

3. **API Keys:**
   - At least one AI provider key must be configured
   - Keys managed by ReasoningService via IPC

## Troubleshooting

### "localStorage not available"

**Cause:** Running in Node.js context instead of browser/renderer.

**Solution:** Ensure code runs in Electron renderer process where `window` and `localStorage` are available.

### "API key not configured"

**Cause:** No API key set for the selected model's provider.

**Solution:**
1. Check which provider the model uses
2. Configure API key in settings
3. Or switch to a different model/provider

### Empty message returned

**Cause:** AI couldn't extract message or input was invalid.

**Solution:**
1. Check input format
2. Try with more explicit command phrase
3. Fall back to regex pattern

### High latency

**Cause:** Using slower model or network issues.

**Solution:**
1. Switch to `gemini-2.5-flash-lite` for fastest response
2. Add loading indicator in UI
3. Implement pre-validation to skip non-commands

## License

Same as OpenWhispr project.
