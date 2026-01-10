# OpenWhispr Technical Reference for AI Assistants

This document provides comprehensive technical details about the OpenWhispr project architecture for AI assistants working on the codebase.

## Project Overview

OpenWhispr is an Electron-based desktop dictation application that uses OpenAI Whisper for speech-to-text transcription. It supports both local (privacy-focused) and cloud (OpenAI API) processing modes.

## Architecture Overview

### Core Technologies
- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Vite
- **Desktop Framework**: Electron 36 with context isolation
- **Database**: better-sqlite3 for local transcription history
- **UI Components**: shadcn/ui with Radix primitives
- **Speech Processing**: OpenAI Whisper (local Python bridge + API)
- **Audio Processing**: FFmpeg (bundled via ffmpeg-static)

### Key Architectural Decisions

1. **Dual Window Architecture**:
   - Main Window: Minimal overlay for dictation (draggable, always on top)
   - Control Panel: Full settings interface (normal window)
   - Both use same React codebase with URL-based routing

2. **Process Separation**:
   - Main Process: Electron main, IPC handlers, database operations
   - Renderer Process: React app with context isolation
   - Preload Script: Secure bridge between processes

3. **Audio Pipeline**:
   - MediaRecorder API → Blob → ArrayBuffer → Base64 → IPC → File → FFmpeg → Whisper
   - Automatic cleanup of temporary files after processing

## File Structure and Responsibilities

### Main Process Files

- **main.js**: Application entry point, initializes all managers
- **preload.js**: Exposes safe IPC methods to renderer via window.api

### Helper Modules (src/helpers/)

- **audioManager.js**: Handles audio device management
- **clipboard.js**: Cross-platform clipboard operations with AppleScript fallback
- **database.js**: SQLite operations for transcription history
- **debugLogger.js**: Debug logging system with file output
- **devServerManager.js**: Vite dev server integration
- **dragManager.js**: Window dragging functionality
- **environment.js**: Environment variable and OpenAI API management
- **hotkeyManager.js**: Global hotkey registration and management
- **ipcHandlers.js**: Centralized IPC handler registration
- **menuManager.js**: Application menu management
- **pythonInstaller.js**: Automatic Python installation for all platforms
- **tray.js**: System tray icon and menu
- **whisper.js**: Local Whisper integration and Python bridge
- **windowConfig.js**: Centralized window configuration
- **windowManager.js**: Window creation and lifecycle management

### React Components (src/components/)

- **App.jsx**: Main dictation interface with recording states
- **ControlPanel.tsx**: Settings, history, model management UI
- **OnboardingFlow.tsx**: 8-step first-time setup wizard
- **SettingsPage.tsx**: Comprehensive settings interface
- **WhisperModelPicker.tsx**: Model selection and download UI
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

### Services

- **ReasoningService.ts**: AI processing for agent-addressed commands
  - Detects when user addresses their named agent
  - Routes to appropriate AI provider (OpenAI/Anthropic/Gemini)
  - Removes agent name from final output
  - Supports GPT-5, Claude Opus 4.1, and Gemini 2.5 models

### Python Bridge

- **whisper_bridge.py**: Standalone Python script for local Whisper
  - Accepts audio file path and model selection
  - Returns JSON with transcription result
  - Handles FFmpeg path resolution for bundled executable
  - 30-second timeout protection

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

### 3. Local Whisper Models

Models stored in `~/.cache/whisper/`:
- tiny: 39MB (fastest, lowest quality)
- base: 74MB (recommended balance)
- small: 244MB (better quality)
- medium: 769MB (high quality)
- large: 1.5GB (best quality)
- turbo: 809MB (fast with good quality)

### 4. Database Schema

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
```

### 5. Settings Storage

Settings stored in localStorage with these keys:
- `whisperModel`: Selected Whisper model
- `useLocalWhisper`: Boolean for local vs cloud
- `openaiApiKey`: Encrypted API key
- `anthropicApiKey`: Encrypted API key
- `geminiApiKey`: Encrypted API key
- `language`: Selected language code
- `agentName`: User's custom agent name
- `reasoningModel`: Selected AI model for processing (defaults to gpt-4o-mini)
- `reasoningProvider`: AI provider (openai/anthropic/gemini/local)
- `hotkey`: Custom hotkey configuration
- `hasCompletedOnboarding`: Onboarding completion flag

### 6. Language Support

58 languages supported (see src/utils/languages.ts):
- Each language has a two-letter code and label
- "auto" for automatic detection
- Passed to Whisper via --language parameter

### 7. Agent Naming System

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
    - Gemini 2.5 Flash Lite (gemini-2.5-flash-lite) - Fast and low-cost
    - Gemini 2.0 Flash (gemini-2.0-flash) - 1M token context
  - **Local**: Community models via LocalReasoningService (Qwen, LLaMA, Mistral)

### 8. API Integrations and Updates

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
- Direct API calls from renderer process
- Increased token limits for Gemini 2.5 Pro (2000 minimum)
- Proper handling of thinking process in responses
- Error handling for MAX_TOKENS finish reason

**API Key Persistence**:
- All API keys now properly persist to `.env` file
- Keys stored in environment variables and reloaded on app start
- Centralized `saveAllKeysToEnvFile()` method ensures consistency

### 9. Debug Mode

Enable with `--log-level=debug` or `OPENWHISPR_LOG_LEVEL=debug` (can be set in `.env`):
- Logs saved to platform-specific app data directory
- Comprehensive logging of audio pipeline
- FFmpeg path resolution details
- Audio level analysis
- Complete reasoning pipeline debugging with stage-by-stage logging

## Development Guidelines

### Adding New Features

1. **New IPC Channel**: Add to both ipcHandlers.js and preload.js
2. **New Setting**: Update useSettings.ts and SettingsPage.tsx
3. **New UI Component**: Follow shadcn/ui patterns in src/components/ui
4. **New Manager**: Create in src/helpers/, initialize in main.js

### Testing Checklist

- [ ] Test both local and cloud processing modes
- [ ] Verify hotkey works globally
- [ ] Check clipboard pasting on all platforms
- [ ] Test with different audio input devices
- [ ] Verify Python auto-installation
- [ ] Test all Whisper models
- [ ] Check agent naming functionality

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

4. **Build Issues**:
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

## Code Style and Conventions

- Use TypeScript for new React components
- Follow existing patterns in helpers/
- Descriptive error messages for users
- Comprehensive debug logging
- Clean up resources (files, listeners)
- Handle edge cases gracefully

## Performance Considerations

- Whisper model size vs speed tradeoff
- Audio blob size limits for IPC (10MB)
- Temporary file cleanup
- Memory usage with large models
- Process timeout protection (30s)

## Security Considerations

- API keys stored in system keychain when possible
- Context isolation enabled
- No remote code execution
- Sanitized file paths
- Limited IPC surface area

## Future Enhancements to Consider

- Streaming transcription support
- Custom wake word detection
- Multi-language UI
- Cloud model selection
- Batch transcription
- Export formats beyond clipboard
