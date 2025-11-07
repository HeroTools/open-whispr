# OpenWhispr Technical Reference for AI Assistants

This document provides comprehensive technical details about the OpenWhispr project architecture for AI assistants working on the codebase.

## Project Overview

OpenWhispr is an Electron-based desktop dictation application that uses OpenAI Whisper for speech-to-text transcription. It supports both local (privacy-focused) and cloud (OpenAI API) processing modes, with AI-powered command execution for third-party integrations.

## Architecture Overview

### Core Technologies
- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Vite
- **Desktop Framework**: Electron 36 with context isolation
- **Database**: better-sqlite3 for local transcription history
- **UI Components**: shadcn/ui with Radix primitives
- **Speech Processing**: OpenAI Whisper (local Python bridge + API)
- **Audio Processing**: FFmpeg (bundled via ffmpeg-static)
- **AI Integration**: Multi-provider (OpenAI, Anthropic, Gemini, Local)
- **Command System**: AI-powered command parsing with configurable models

### Key Architectural Decisions

1. **Dual Window Architecture**:
   - Main Window: Minimal overlay for dictation (draggable, always on top)
   - Control Panel: Full settings interface (normal window)
   - Both use same React codebase with URL-based routing

2. **Process Separation**:
   - Main Process: Electron main, IPC handlers, database operations, external API calls
   - Renderer Process: React app with context isolation
   - Preload Script: Secure bridge between processes

3. **Audio Pipeline**:
   - MediaRecorder API → Blob → ArrayBuffer → Base64 → IPC → File → FFmpeg → Whisper
   - Automatic cleanup of temporary files after processing

4. **Integration Architecture** (NEW):
   - **Direct API**: Primary approach for consumer-facing integrations (Slack, Discord, etc.)
   - **MCP Protocol**: Optional future approach for advanced/developer use cases
   - **Service Layer**: Abstraction pattern allowing multiple backend implementations
   - **AI-Powered Parsing**: Configurable models parse natural language commands

## File Structure and Responsibilities

### Main Process Files

- **main.js**: Application entry point, initializes all managers
- **preload.js**: Exposes safe IPC methods to renderer via window.api

### Helper Modules (src/helpers/)

- **audioManager.js**: Handles audio device management
- **clipboard.js**: Cross-platform clipboard operations with AppleScript fallback
- **database.js**: SQLite operations for transcription history and commands
- **debugLogger.js**: Debug logging system with file output
- **devServerManager.js**: Vite dev server integration
- **dragManager.js**: Window dragging functionality
- **environment.js**: Environment variable and API key management (.env file)
- **hotkeyManager.js**: Global hotkey registration and management
- **ipcHandlers.js**: Centralized IPC handler registration
- **menuManager.js**: Application menu management
- **pythonInstaller.js**: Automatic Python installation for all platforms
- **tray.js**: System tray icon and menu
- **whisper.js**: Local Whisper integration and Python bridge
- **windowConfig.js**: Centralized window configuration
- **windowManager.js**: Window creation and lifecycle management

**Integration Services** (src/helpers/):
- **slackApiService.js**: Slack Web API client (@slack/web-api)
- *Future: discordApiService.js, emailService.js, etc.*

### React Components (src/components/)

- **App.jsx**: Main dictation interface with recording states and command execution
- **ControlPanel.tsx**: Settings, history, model management UI
- **OnboardingFlow.tsx**: 8-step first-time setup wizard
- **SettingsPage.tsx**: Comprehensive settings interface with integration management
- **WhisperModelPicker.tsx**: Model selection and download UI
- **CommandToast.tsx**: Toast notification for command execution with countdown
- **ui/**: Reusable UI components (buttons, cards, inputs, etc.)

### React Hooks (src/hooks/)

- **useAudioRecording.js**: MediaRecorder API wrapper with error handling
- **useClipboard.ts**: Clipboard operations hook
- **useDialogs.ts**: Electron dialog integration
- **useHotkey.js**: Hotkey state management
- **useLocalStorage.ts**: Type-safe localStorage wrapper
- **usePermissions.ts**: System permission checks
- **usePython.ts**: Python installation state
- **useSettings.ts**: Application settings management
- **useWhisper.ts**: Whisper model management

### Services (src/services/)

- **ReasoningService.ts**: AI processing with multi-provider support
  - Routes to appropriate AI provider (OpenAI/Anthropic/Gemini/Local)
  - Supports GPT-5, Claude Opus 4.1, Gemini 2.5, and local models
  - Configurable model selection

- **CommandService.ts**: Command detection and execution
  - Pattern-based command detection (regex + AI parsing)
  - Countdown with cancellation support
  - Routes to appropriate integration service
  - Executes via IPC to main process

- **CommandParserService.ts**: AI-powered command parsing
  - Uses ReasoningService with configurable model
  - Extracts structured data from natural language
  - Default: Gemini 2.5 Flash Lite (fast & cheap)

### Python Bridge

- **whisper_bridge.py**: Standalone Python script for local Whisper
  - Accepts audio file path and model selection
  - Returns JSON with transcription result
  - Handles FFmpeg path resolution for bundled executable
  - 30-second timeout protection

---

## Integration Architecture

### Philosophy: Direct API First, MCP When It Makes Sense

OpenWhispr follows a pragmatic integration strategy:

1. **Primary Approach: Direct API Integration**
   - Best for consumer productivity apps
   - Simple user experience (OAuth, native UI)
   - Full control over implementation
   - Lower latency, smaller bundle size
   - Examples: Slack, Discord, Email

2. **Secondary Approach: MCP Protocol** (Future)
   - Best for AI agent platforms and developer tools
   - Use when supporting 10+ integrations
   - Use when users need extensibility
   - Examples: Custom internal tools, advanced automation

### When to Use Each Approach

| Factor | Direct API | MCP Protocol |
|--------|-----------|--------------|
| **Integration Count** | 1-5 integrations | 10+ integrations |
| **Target Audience** | End users | Developers/Power users |
| **Setup Complexity** | Simple (OAuth button) | Complex (JSON config, CLI) |
| **Bundle Size** | Small | Larger (MCP runtime) |
| **Maintenance** | Medium (per-service) | Low (standardized) |
| **Performance** | Fast (direct calls) | Slower (protocol layer) |
| **Extensibility** | Medium | High |

**For OpenWhispr**: Start with Direct API. Only migrate to MCP if we reach 10+ integrations or users demand custom integrations.

---

## Adding a New Integration (Direct API)

Follow this pattern for adding services like Discord, Email, Microsoft Teams, etc.

### Step 1: Create Service Module (Main Process)

**File**: `src/helpers/[service]ApiService.js`

```javascript
// Example: src/helpers/slackApiService.js
const { WebClient } = require('@slack/web-api');

class SlackApiService {
  constructor() {
    this.client = null;
    this.token = null;
  }

  // Initialize with stored credentials
  initialize(token) {
    this.token = token;
    this.client = new WebClient(token);
  }

  // Core functionality: send message
  async postMessage(channel, text) {
    if (!this.client) {
      throw new Error('Slack not initialized. Configure in settings.');
    }

    const result = await this.client.chat.postMessage({
      channel: channel.startsWith('#') ? channel : `#${channel}`,
      text,
    });

    return { success: true, timestamp: result.ts };
  }

  // Helper: list destinations (channels, users, etc.)
  async listChannels() {
    const result = await this.client.conversations.list();
    return result.channels;
  }

  // Helper: test connection
  async testConnection() {
    if (!this.client) return { ok: false };
    const result = await this.client.auth.test();
    return result;
  }
}

module.exports = new SlackApiService();
```

**Key Principles**:
- Singleton pattern (export instance, not class)
- `initialize()` method for credentials
- Throw meaningful errors for user-facing messages
- Return consistent response format: `{ success: boolean, ... }`

### Step 2: Add IPC Handlers

**File**: `src/helpers/ipcHandlers.js`

```javascript
// In setupIpcHandlers() method:

// Initialize service
const slackApiService = require('./slackApiService');

// Connection handlers
ipcMain.handle("slack-connect", async (event, token) => {
  try {
    slackApiService.initialize(token);
    const result = await slackApiService.testConnection();
    return { success: true, workspace: result.team };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("slack-disconnect", async () => {
  slackApiService.initialize(null);
  return { success: true };
});

// Action handlers
ipcMain.handle("slack-post-message", async (event, channel, text) => {
  try {
    return await slackApiService.postMessage(channel, text);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("slack-list-channels", async () => {
  try {
    const channels = await slackApiService.listChannels();
    return { success: true, channels };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

**Key Principles**:
- All API calls happen in main process (avoid CORS)
- Always wrap in try-catch
- Return consistent `{ success, ...data }` or `{ success: false, error }`
- Use descriptive IPC channel names: `[service]-[action]`

### Step 3: Expose to Renderer Process

**File**: `preload.js`

```javascript
contextBridge.exposeInMainWorld("electronAPI", {
  // ... existing APIs ...

  // Slack integration
  slackConnect: (token) => ipcRenderer.invoke("slack-connect", token),
  slackDisconnect: () => ipcRenderer.invoke("slack-disconnect"),
  slackPostMessage: (channel, text) => ipcRenderer.invoke("slack-post-message", channel, text),
  slackListChannels: () => ipcRenderer.invoke("slack-list-channels"),
});
```

### Step 4: Store Credentials

**File**: `src/helpers/environment.js`

```javascript
// Add getter
getSlackBotToken() {
  return process.env.SLACK_BOT_TOKEN || "";
}

// Add setter
saveSlackBotToken(token) {
  try {
    process.env.SLACK_BOT_TOKEN = token;
    this.saveAllKeysToEnvFile(); // Persist to .env
    return { success: true };
  } catch (error) {
    throw error;
  }
}

// Update saveAllKeysToEnvFile() to include new token
saveAllKeysToEnvFile() {
  // ... existing code ...
  if (process.env.SLACK_BOT_TOKEN) {
    envContent += `SLACK_BOT_TOKEN=${process.env.SLACK_BOT_TOKEN}\n`;
  }
}
```

**File**: `src/helpers/ipcHandlers.js` (add handlers)

```javascript
ipcMain.handle("get-slack-token", async () => {
  return this.environmentManager.getSlackBotToken();
});

ipcMain.handle("save-slack-token", async (event, token) => {
  return this.environmentManager.saveSlackBotToken(token);
});
```

**File**: `preload.js` (expose)

```javascript
getSlackToken: () => ipcRenderer.invoke("get-slack-token"),
saveSlackToken: (token) => ipcRenderer.invoke("save-slack-token", token),
```

### Step 5: Add Settings UI

**File**: `src/components/SettingsPage.tsx`

```tsx
// Add to state
const [slackToken, setSlackToken] = useState("");
const [slackConnected, setSlackConnected] = useState(false);
const [slackWorkspace, setSlackWorkspace] = useState("");

// Load on mount
useEffect(() => {
  const loadSlackSettings = async () => {
    const token = await window.electronAPI.getSlackToken();
    if (token) {
      setSlackToken(token);
      const result = await window.electronAPI.slackConnect(token);
      if (result.success) {
        setSlackConnected(true);
        setSlackWorkspace(result.workspace);
      }
    }
  };
  loadSlackSettings();
}, []);

// Add to JSX
<div className="space-y-4">
  <h3 className="text-lg font-semibold">Slack Integration</h3>

  {!slackConnected ? (
    <div className="space-y-2">
      <Label htmlFor="slack-token">Bot Token</Label>
      <Input
        id="slack-token"
        type="password"
        value={slackToken}
        onChange={(e) => setSlackToken(e.target.value)}
        placeholder="xoxb-..."
      />
      <Button
        onClick={async () => {
          const result = await window.electronAPI.saveSlackToken(slackToken);
          if (result.success) {
            const connectResult = await window.electronAPI.slackConnect(slackToken);
            if (connectResult.success) {
              setSlackConnected(true);
              setSlackWorkspace(connectResult.workspace);
              toast({ title: "Connected to Slack!" });
            }
          }
        }}
      >
        Connect Slack
      </Button>
      <p className="text-xs text-muted-foreground">
        Get token at{" "}
        <a
          href="https://api.slack.com/apps"
          target="_blank"
          className="underline"
        >
          api.slack.com/apps
        </a>
      </p>
    </div>
  ) : (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <CheckCircle className="h-4 w-4 text-green-500" />
        <span>Connected to: {slackWorkspace}</span>
      </div>
      <Button
        variant="outline"
        onClick={async () => {
          await window.electronAPI.slackDisconnect();
          await window.electronAPI.saveSlackToken("");
          setSlackConnected(false);
          setSlackToken("");
        }}
      >
        Disconnect
      </Button>
    </div>
  )}
</div>
```

### Step 6: Integrate with Command System

**File**: `src/services/CommandService.ts`

```typescript
// Add command pattern detection
private static SLACK_MESSAGE_PATTERN = /^slack (send to|message) .+$/i;

// Update detectCommand()
static detectCommand(text: string): CommandDetectionResult {
  const trimmed = text.trim();

  if (trimmed.match(this.SLACK_MESSAGE_PATTERN)) {
    return {
      isCommand: true,
      type: 'slack',
      rawInput: trimmed
    };
  }

  return { isCommand: false };
}

// Add execution handler
static async executeSlack(rawInput: string, parserModel: string) {
  // Parse with AI
  const parsed = await CommandParserService.parseSlackCommand(
    rawInput,
    parserModel
  );

  // Execute via IPC
  const result = await window.electronAPI.slackPostMessage(
    parsed.channel,
    parsed.message
  );

  return result;
}
```

**File**: `src/services/CommandParserService.ts`

```typescript
static async parseSlackCommand(
  userInput: string,
  model: string = 'gemini-2.5-flash-lite'
): Promise<{ channel: string; message: string }> {

  const systemPrompt = `Extract the Slack channel and message from user input.
Input format: "slack send to [target]: [message]"
Target can be: channel name (with or without #), username, or person's name
Output JSON only: { "channel": "extracted-channel", "message": "extracted-message" }`;

  const userPrompt = `User said: "${userInput}"\nExtract channel and message as JSON.`;

  const response = await ReasoningService.processWithModel(
    userPrompt,
    systemPrompt,
    model
  );

  return JSON.parse(response);
}
```

### Step 7: Update Settings Storage

**File**: `src/hooks/useSettings.ts`

```typescript
// Add to localStorage keys
const [slackBotToken, setSlackBotToken] = useLocalStorage("slackBotToken", "");
const [commandParserModel, setCommandParserModel] = useLocalStorage(
  "commandParserModel",
  "gemini-2.5-flash-lite"
);
```

### Summary: Integration Checklist

When adding a new integration:

- [ ] Install npm package for service API (if available)
- [ ] Create service module in `src/helpers/[service]ApiService.js`
- [ ] Add IPC handlers in `src/helpers/ipcHandlers.js`
- [ ] Expose methods in `preload.js`
- [ ] Add credential storage in `src/helpers/environment.js`
- [ ] Add settings UI in `src/components/SettingsPage.tsx`
- [ ] Add command pattern to `src/services/CommandService.ts`
- [ ] Add AI parser method to `src/services/CommandParserService.ts`
- [ ] Update `useSettings.ts` for new localStorage keys
- [ ] Test connection, message sending, error handling

**Time estimate**: 2-4 hours for a new integration following this pattern.

---

## Adding MCP Integration (Future)

If OpenWhispr eventually needs MCP support (10+ integrations, user-extensible), follow this pattern:

### Step 1: Install MCP SDK

```bash
npm install @modelcontextprotocol/sdk zod
```

### Step 2: Create MCP Manager

**File**: `src/helpers/mcpManager.js`

```javascript
const { spawn } = require('child_process');
const path = require('path');

class MCPManager {
  constructor() {
    this.servers = new Map();
  }

  // Start bundled MCP server as subprocess
  async startServer(serverName, serverPath, env = {}) {
    const serverProcess = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...env }
    });

    this.servers.set(serverName, {
      process: serverProcess,
      ready: false
    });

    // Handle JSON-RPC communication
    serverProcess.stdout.on('data', (data) => {
      this.handleServerMessage(serverName, data);
    });

    return serverProcess;
  }

  // Send tool call to MCP server
  async callTool(serverName, toolName, args) {
    const server = this.servers.get(serverName);
    if (!server) throw new Error(`Server ${serverName} not running`);

    const request = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name: toolName, arguments: args }
    };

    server.process.stdin.write(JSON.stringify(request) + '\n');
    return this.waitForResponse(request.id);
  }

  // Stop server
  stopServer(serverName) {
    const server = this.servers.get(serverName);
    if (server) {
      server.process.kill();
      this.servers.delete(serverName);
    }
  }
}

module.exports = new MCPManager();
```

### Step 3: Bundle MCP Server

**Directory**: `bundled-mcp-servers/slack/`

```bash
# Install MCP server
npm install @modelcontextprotocol/server-slack
# Or clone: git clone https://github.com/korotovsky/slack-mcp-server

# Build
npm run build

# Bundle with Electron (update electron-builder config)
```

**File**: `electron-builder.json`

```json
{
  "asarUnpack": [
    "node_modules/ffmpeg-static/**/*",
    "bundled-mcp-servers/**/*"
  ]
}
```

### Step 4: Start MCP Server on App Launch

**File**: `main.js`

```javascript
const mcpManager = require('./src/helpers/mcpManager');

app.whenReady().then(async () => {
  // Start Slack MCP server
  const slackToken = process.env.SLACK_BOT_TOKEN;
  if (slackToken) {
    await mcpManager.startServer(
      'slack',
      path.join(__dirname, 'bundled-mcp-servers/slack/dist/index.js'),
      { SLACK_BOT_TOKEN: slackToken }
    );
  }
});
```

### Step 5: Use MCP Tools from Command Service

```typescript
// Call MCP tool via IPC
const result = await window.electronAPI.mcpCallTool(
  'slack',
  'send_message',
  { channel: parsed.channel, text: parsed.message }
);
```

**Note**: MCP integration is more complex and should only be implemented when the benefits outweigh the costs (10+ integrations, extensibility requirements).

---

## Key Implementation Details

### 1. FFmpeg Integration

FFmpeg is bundled with the app and doesn't require system installation:
```javascript
// FFmpeg is unpacked from ASAR to app.asar.unpacked/node_modules/ffmpeg-static/
// Python bridge receives FFmpeg path via environment variables:
// FFMPEG_PATH, FFMPEG_EXECUTABLE, FFMPEG_BINARY
```

### 2. Audio Recording Flow

1. User presses hotkey → MediaRecorder starts
2. Audio chunks collected in array
3. User presses hotkey again → Recording stops
4. Blob created from chunks → Converted to ArrayBuffer
5. Sent via IPC as Base64 string (size limits)
6. Main process writes to temporary file
7. Whisper processes file → Result sent back
8. Temporary file deleted

### 3. Command Execution Flow

1. User speaks command → Whisper transcribes
2. `CommandService.detectCommand()` checks patterns
3. If command detected:
   - Show countdown toast (5 seconds, cancellable)
   - Call `CommandParserService` with configurable AI model
   - AI extracts structured data (e.g., channel, message)
   - Route to appropriate integration service
   - Execute via IPC → Main process → External API
   - Show success/error notification
4. If not command:
   - Normal paste flow (clipboard)

### 4. Local Whisper Models

Models stored in `~/.cache/whisper/`:
- tiny: 39MB (fastest, lowest quality)
- base: 74MB (recommended balance)
- small: 244MB (better quality)
- medium: 769MB (high quality)
- large: 1.5GB (best quality)
- turbo: 809MB (fast with good quality)

### 5. Database Schema

```sql
CREATE TABLE transcriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  original_text TEXT NOT NULL,
  processed_text TEXT,
  is_processed BOOLEAN DEFAULT 0,
  processing_method TEXT DEFAULT 'none',
  agent_name TEXT,
  error TEXT
);

-- Future: Commands table for user-defined commands
CREATE TABLE commands (
  id TEXT PRIMARY KEY,
  trigger TEXT NOT NULL,
  description TEXT NOT NULL,
  service TEXT NOT NULL,
  enabled BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 6. Settings Storage

Settings stored in localStorage with these keys:
- `whisperModel`: Selected Whisper model
- `useLocalWhisper`: Boolean for local vs cloud
- `openaiApiKey`: Encrypted API key
- `anthropicApiKey`: Encrypted API key
- `geminiApiKey`: Encrypted API key
- `language`: Selected language code
- `agentName`: User's custom agent name
- `reasoningModel`: Selected AI model for agent reasoning
- `reasoningProvider`: AI provider (openai/anthropic/gemini/local)
- `commandParserModel`: AI model for command parsing (default: gemini-2.5-flash-lite)
- `hotkey`: Custom hotkey configuration
- `hasCompletedOnboarding`: Onboarding completion flag
- `slackBotToken`: Slack Bot OAuth token (also in .env)

### 7. Language Support

58 languages supported (see src/utils/languages.ts):
- Each language has a two-letter code and label
- "auto" for automatic detection
- Passed to Whisper via --language parameter

### 8. Agent Naming System

- User names their agent during onboarding (step 6/8)
- Name stored in localStorage and database
- ReasoningService detects "Hey [AgentName]" patterns
- AI processes command and removes agent reference from output
- Supports multiple AI providers:
  - **OpenAI** (Now using Responses API as of September 2025):
    - GPT-5 Series (Nano/Mini/Full) - Latest models with fastest performance
    - GPT-4.1 Series (Nano/Mini/Full) with 1M context window
    - o-series reasoning models (o3/o3-pro/o4-mini) for deep reasoning tasks
    - GPT-4o multimodal series (4o/4o-mini) - default model
    - Legacy support for GPT-4 Turbo, GPT-4 classic, GPT-3.5 Turbo
  - **Anthropic** (Via IPC bridge to avoid CORS):
    - Claude Opus 4.1 (claude-opus-4-1-20250805) - Frontier intelligence
    - Claude Sonnet 4 (claude-sonnet-4-20250514) - Latest balanced model
    - Claude 3.5 Sonnet (claude-3-5-sonnet-20241022) - Balanced performance
    - Claude 3.5 Haiku (claude-3-5-haiku-20241022) - Fast and efficient
  - **Google Gemini** (Direct API integration):
    - Gemini 2.5 Pro (gemini-2.5-pro) - Most intelligent with thinking capability
    - Gemini 2.5 Flash (gemini-2.5-flash) - High-performance with thinking
    - Gemini 2.5 Flash Lite (gemini-2.5-flash-lite) - Fast and low-cost (default for command parsing)
    - Gemini 2.0 Flash (gemini-2.0-flash) - 1M token context
  - **Local**: Community models via LocalReasoningService (Qwen, LLaMA, Mistral)

### 9. API Integrations and Updates

**OpenAI Responses API (September 2025)**:
- Migrated from Chat Completions to new Responses API
- Endpoint: `https://api.openai.com/v1/responses`
- Simplified request format with `input` array instead of `messages`
- New response format with `output` array containing typed items
- Automatic handling of GPT-5 and o-series model requirements
- No temperature parameter for newer models (GPT-5, o-series)

**Anthropic Integration**:
- Routes through IPC handler to avoid CORS issues in renderer process
- Uses main process for API calls with proper error handling
- Model names use hyphens (e.g., `claude-3-5-sonnet` not `claude-3.5-sonnet`)

**Gemini Integration**:
- Direct API calls from renderer process for ReasoningService
- Main process calls for CommandParserService (avoid CORS)
- Increased token limits for Gemini 2.5 Pro (2000 minimum)
- Proper handling of thinking process in responses
- Error handling for MAX_TOKENS finish reason

**API Key Persistence**:
- All API keys properly persist to `.env` file in app.getPath("userData")
- Keys stored in environment variables and reloaded on app start
- Centralized `saveAllKeysToEnvFile()` method ensures consistency
- Integration tokens (Slack, Discord, etc.) also stored in .env

### 10. Debug Mode

Enable with `--debug` flag or `OPENWHISPR_DEBUG=true`:
- Logs saved to platform-specific app data directory
- Comprehensive logging of audio pipeline
- FFmpeg path resolution details
- Audio level analysis
- Complete reasoning pipeline debugging with stage-by-stage logging
- Command execution flow logging (detection, parsing, execution)

---

## Development Guidelines

### Adding New Features

1. **New IPC Channel**: Add to both ipcHandlers.js and preload.js
2. **New Setting**: Update useSettings.ts and SettingsPage.tsx
3. **New UI Component**: Follow shadcn/ui patterns in src/components/ui
4. **New Manager**: Create in src/helpers/, initialize in main.js
5. **New Integration**: Follow "Adding a New Integration" pattern above

### Service Layer Patterns

All integration services should follow this structure:

```javascript
class ServiceNameApiService {
  constructor() {
    this.client = null;
    this.credentials = null;
  }

  // Initialize with credentials
  initialize(credentials) { }

  // Core action (e.g., sendMessage, postUpdate)
  async primaryAction(...args) { }

  // Helper methods
  async listDestinations() { }
  async testConnection() { }
}

module.exports = new ServiceNameApiService();
```

**Key Principles**:
- Singleton pattern
- Lazy initialization
- Consistent error handling
- Return `{ success: boolean, ...data }` or throw
- All external API calls in main process

### Command Parser Patterns

All command parsers should follow this structure:

```typescript
static async parse[Service]Command(
  userInput: string,
  model: string = 'gemini-2.5-flash-lite'
): Promise<ParsedCommand> {

  const systemPrompt = `[Instructions for AI]
Output format: { "field1": "value1", "field2": "value2" }`;

  const userPrompt = `User said: "${userInput}"\nExtract data as JSON.`;

  const response = await ReasoningService.processWithModel(
    userPrompt,
    systemPrompt,
    model
  );

  return JSON.parse(response);
}
```

**Key Principles**:
- Use configurable model (default: gemini-2.5-flash-lite for speed/cost)
- Clear system prompt with output format
- Return structured data (JSON)
- Handle parsing errors gracefully

### Testing Checklist

- [ ] Test both local and cloud processing modes
- [ ] Verify hotkey works globally
- [ ] Check clipboard pasting on all platforms
- [ ] Test with different audio input devices
- [ ] Verify Python auto-installation
- [ ] Test all Whisper models
- [ ] Check agent naming functionality
- [ ] Test command detection and parsing
- [ ] Verify integration API calls work
- [ ] Test error handling (network errors, invalid credentials)
- [ ] Test with different AI parser models

### Common Issues and Solutions

1. **No Audio Detected**:
   - Check FFmpeg path resolution
   - Verify microphone permissions
   - Check audio levels in debug logs

2. **Transcription Fails**:
   - Ensure Python/Whisper installed
   - Check temporary file creation
   - Verify FFmpeg is executable

3. **Clipboard Not Working**:
   - macOS: Check accessibility permissions
   - Use AppleScript fallback on macOS

4. **Command Not Detected**:
   - Check pattern regex in CommandService
   - Enable debug logging to see detection flow
   - Verify AI parser has correct system prompt

5. **Integration API Fails**:
   - Check credentials stored in .env
   - Verify IPC handlers registered
   - Check network connectivity
   - Review API rate limits

6. **Build Issues**:
   - Use `npm run pack` for unsigned builds (CSC_IDENTITY_AUTO_DISCOVERY=false)
   - Signing requires Apple Developer account
   - ASAR unpacking needed for FFmpeg/Python bridge
   - afterSign.js automatically skips signing when CSC_IDENTITY_AUTO_DISCOVERY=false

### Platform-Specific Notes

**macOS**:
- Requires accessibility permissions for clipboard
- Uses AppleScript for reliable pasting
- Notarization needed for distribution
- Shows in dock with indicator dot when running (LSUIElement: false)

**Windows**:
- Python installer handles PATH automatically
- No special permissions needed
- NSIS installer for distribution

**Linux**:
- Multiple package manager support
- Standard XDG directories
- AppImage for distribution

---

## Code Style and Conventions

- Use TypeScript for new React components and services
- Use JavaScript for helper modules in main process
- Follow existing patterns in helpers/
- Descriptive error messages for users
- Comprehensive debug logging (use debugLogger.js)
- Clean up resources (files, listeners, processes)
- Handle edge cases gracefully
- Always wrap external API calls in try-catch
- Return consistent response formats: `{ success, ...data }` or `{ success: false, error }`

---

## Performance Considerations

- Whisper model size vs speed tradeoff
- Audio blob size limits for IPC (10MB)
- Temporary file cleanup
- Memory usage with large models
- Process timeout protection (30s)
- AI parser model selection (flash-lite for speed)
- Rate limits on external APIs (1 msg/sec for Slack)
- Subprocess lifecycle management (MCP servers)

---

## Security Considerations

- API keys stored in .env file in userData directory
- Context isolation enabled in Electron
- No remote code execution
- Sanitized file paths
- Limited IPC surface area
- All external API calls from main process (avoid CORS)
- OAuth tokens never exposed to renderer process
- Secure credential storage for production (future: OS keychain)

---

## Architecture Decision Records

### ADR-001: Direct API over MCP for Initial Integrations

**Context**: Need to integrate with third-party services (Slack, Discord, etc.)

**Decision**: Use direct API integration as primary approach, with MCP as optional future enhancement.

**Rationale**:
- OpenWhispr is a consumer productivity app, not a developer tool
- User experience is paramount (OAuth button vs JSON config)
- Simpler implementation and maintenance
- Lower bundle size and better performance
- All successful productivity apps (Raycast, Alfred, Notion) use direct APIs
- MCP can be added later if extensibility becomes critical (10+ integrations)

**Consequences**:
- Need to implement each integration manually
- More code to maintain per integration
- But: Better UX, faster performance, simpler for users

### ADR-002: AI-Powered Command Parsing

**Context**: Need to parse natural language commands into structured data

**Decision**: Use configurable AI models (default: Gemini Flash Lite) for command parsing instead of regex.

**Rationale**:
- Natural language is flexible ("send to John" vs "message John" vs "post to John")
- Users expect natural speech, not rigid commands
- AI handles variations, typos, and intent better than regex
- Gemini Flash Lite is fast (<1s) and cheap (~$0.000015/request)
- Leverages existing multi-provider AI infrastructure

**Consequences**:
- Small latency added (0.5-1s)
- Small cost per command (<$0.00002)
- Requires API key for parser model
- But: Much better user experience, more flexible commands

### ADR-003: Main Process for External API Calls

**Context**: External API calls can be made from renderer or main process

**Decision**: All external API calls (Slack, Discord, etc.) happen in main process via IPC.

**Rationale**:
- Avoids CORS issues (main process has full network access)
- Better security (API keys never exposed to renderer)
- Consistent error handling
- Easier debugging (centralized in IPC handlers)
- Follows Electron best practices

**Consequences**:
- Requires IPC bridge for every API call
- Slightly more boilerplate code
- But: More secure, more reliable, better architecture

---

## Future Enhancements to Consider

- Streaming transcription support
- Custom wake word detection
- Multi-language UI
- Cloud model selection
- Batch transcription
- Export formats beyond clipboard
- Command mode hotkey (Cmd + speech hotkey)
- User-defined command patterns (database-backed)
- OAuth flows for integrations (vs manual tokens)
- MCP protocol support (when 10+ integrations)
- Channel/user autocomplete in command parsing
- Voice feedback/confirmation for commands
- Command history and analytics
- Multi-step command workflows
- Conditional command execution

---

## Quick Reference: Common Tasks

### Add a new localStorage setting
1. Add to `useSettings.ts`: `const [setting, setSetting] = useLocalStorage("key", default)`
2. Add UI in `SettingsPage.tsx`

### Add a new IPC channel
1. Add handler in `ipcHandlers.js`: `ipcMain.handle("channel-name", async (event, ...args) => { })`
2. Expose in `preload.js`: `channelName: (...args) => ipcRenderer.invoke("channel-name", ...args)`
3. Call from renderer: `await window.electronAPI.channelName(...args)`

### Add a new integration service
1. Create `src/helpers/[service]ApiService.js` (singleton pattern)
2. Add IPC handlers in `ipcHandlers.js`
3. Expose in `preload.js`
4. Add credentials to `environment.js`
5. Add UI in `SettingsPage.tsx`
6. Add command pattern to `CommandService.ts`
7. Add parser to `CommandParserService.ts`

### Debug a command not working
1. Enable debug mode: `--debug` flag
2. Check logs in app data directory
3. Verify pattern matches in `CommandService.detectCommand()`
4. Check AI parser response in logs
5. Verify IPC handler called correctly
6. Check external API credentials

### Test a new integration
1. Get API credentials (token, OAuth, etc.)
2. Save in Settings UI
3. Test connection (should see success message)
4. Say command via voice
5. Check debug logs for flow
6. Verify message/action appears in service
7. Test error cases (bad credentials, network error)

---

*This document is a living guide. Update it as the architecture evolves.*
