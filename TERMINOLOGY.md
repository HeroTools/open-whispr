# OpenWhispr Terminology & Prompt Reference

> Use this reference to communicate precisely with AI assistants about the OpenWhispr codebase.

---

## Architecture Concepts

| Term | What It Means | When to Use |
|------|---------------|-------------|
| **Main Process** | Electron's Node.js backend thread — runs all Managers, IPC handlers, native binaries | "Fix the bug in the main process" or "Add an IPC handler in the main process" |
| **Renderer Process** | Electron's browser/React thread — runs UI, hooks, services | "Update the renderer to show a toast" |
| **Main Window** / **Dictation Panel** / **Overlay** | The small, draggable, always-on-top floating panel where recording happens | "Move the button on the dictation panel" (all three terms are interchangeable) |
| **Control Panel** | The full-size settings/history window | "Add a new tab to the Control Panel" |
| **Preload Script** (`preload.js`) | Secure bridge exposing `window.electronAPI` to the renderer via context isolation | "Expose a new IPC method in the preload script" |
| **IPC** (Inter-Process Communication) | Message-passing between main and renderer via Electron's `ipcMain`/`ipcRenderer` | "Create a new IPC channel for X" |
| **Context Isolation** | Electron security boundary preventing renderer from accessing Node.js APIs directly | Rarely referenced directly; just know all main↔renderer communication goes through IPC |

---

## Naming Patterns (What to Call Things)

| Pattern | Convention | Example | When Creating New Ones |
|---------|-----------|---------|----------------------|
| **Manager** | Main-process class managing a system resource's lifecycle | `HotkeyManager`, `ClipboardManager`, `WindowManager` | "Create a new FooManager in `src/helpers/`" |
| **Service** | Renderer-safe business logic class (no Electron APIs) | `ReasoningService`, `LocalReasoningService` | "Create a new FooService in `src/services/`" |
| **Server** (or **ServerManager**) | Wraps a subprocess (HTTP/WebSocket server) | `WhisperServerManager`, `ParakeetServerManager`, `LlamaServerManager` | "Add a new FooServerManager in `src/helpers/`" |
| **Bridge** | Adapter connecting incompatible module systems or cross-process boundaries | `modelManagerBridge.js`, `localReasoningBridge.js` | "Create a bridge for the new module" |
| **Hook** | React custom hook (`use` + PascalCase) | `useSettings`, `useAudioRecording`, `useHotkey` | "Create a `useFoo` hook in `src/hooks/`" |
| **Picker** | UI component for selecting/downloading models | `TranscriptionModelPicker`, `LocalModelPicker` | "Add a FooPicker component" |
| **Helper** (`src/helpers/`) | Main-process module with system integration and side effects | `clipboard.js`, `whisper.js`, `database.js` | "Add a helper in `src/helpers/`" |
| **Util** (`src/utils/`) | Pure function, no side effects, importable everywhere | `formatBytes.ts`, `platform.ts`, `retry.ts` | "Add a utility in `src/utils/`" |
| **IPC Channel** | kebab-case string identifier | `transcribe-local-whisper`, `db-save-transcription` | "Register the `foo-bar` IPC channel" |
| **localStorage Key** | camelCase string | `whisperModel`, `reasoningProvider`, `customDictionary` | "Store it in localStorage as `fooBar`" |
| **Database Column** | snake_case | `original_text`, `processed_text`, `is_processed` | "Add a `foo_bar` column" |
| **Environment Variable** | UPPER_SNAKE_CASE in `.env` | `LOCAL_TRANSCRIPTION_PROVIDER`, `PARAKEET_MODEL` | "Persist it as `FOO_BAR` in `.env`" |
| **Component** | PascalCase `.tsx` file | `ControlPanel.tsx`, `SettingsPage.tsx` | "Create a `FooBar.tsx` component" |
| **shadcn/ui Component** | lowercase `.tsx` in `src/components/ui/` | `button.tsx`, `input.tsx`, `dialog.tsx` | Follow shadcn/ui conventions |
| **Custom UI Component** | PascalCase `.tsx` in `src/components/ui/` | `ApiKeyInput.tsx`, `LiveTranscriptOverlay.tsx` | PascalCase in same `ui/` directory |
| **Constant** | UPPER_SNAKE_CASE at module level | `PORT_RANGE_START`, `CACHE_TTL_MS`, `PASTE_DELAY_MS` | "Define a `FOO_BAR` constant" |
| **TypeScript Interface** | PascalCase with suffix: `Props`, `Config`, `Settings`, `Data`, `Definition`, `Return` | `ReasoningConfig`, `LocalModelPickerProps`, `UseClipboardReturn` | "Define a `FooBarProps` interface" |

---

## Transcription & Audio Pipeline

| Term | What It Means | When to Use |
|------|---------------|-------------|
| **Transcription** | Converting speech audio to text | "Fix the transcription pipeline" |
| **Local Processing** / `useLocalWhisper` | Transcription on the user's device via whisper.cpp or Parakeet | "When local processing is enabled..." |
| **Cloud Processing** | Transcription via remote API (OpenAI, Groq, OpenWhispr Cloud) | "Switch to cloud processing" |
| **whisper.cpp** | C++ implementation of OpenAI Whisper — the local transcription engine | "The whisper.cpp binary isn't found" |
| **NVIDIA Parakeet** / **sherpa-onnx** | Alternative local ASR engine using ONNX models | "Start the Parakeet server" (sherpa-onnx is the runtime, Parakeet is the model family) |
| **GGML** | Quantized model format used by whisper.cpp | "Download the GGML model" |
| **GGUF** | Quantized model format used by llama.cpp for local LLMs | "The GGUF model file" |
| **WhisperManager** | Main-process class wrapping whisper.cpp | "WhisperManager.transcribeLocalWhisper()" |
| **ParakeetManager** | Main-process class wrapping sherpa-onnx | "ParakeetManager needs a model path" |
| **AudioManager** (`audioManager.js`) | Handles audio device enumeration and transcription orchestration | "AudioManager detects no microphone" |
| **FFmpeg** | Bundled audio processing tool (converts formats) | "FFmpeg path resolution fails" |
| **Audio Blob** / **Audio Buffer** | Raw recorded audio data from MediaRecorder | "Send the audio buffer via IPC" |
| **Audio Chunks** | Individual pieces collected during recording | "Assemble audio chunks into a blob" |
| **Custom Dictionary** | User-added words/phrases passed as prompt hints to Whisper | "Add a word to the custom dictionary" — stored in localStorage as `customDictionary` |
| **Transcription Provider** | The engine doing speech-to-text (`whisper`, `nvidia`, `openai`, `groq`, etc.) | "Change the transcription provider to Parakeet" |
| **`localTranscriptionProvider`** | localStorage key: `"whisper"` or `"nvidia"` | "Set localTranscriptionProvider to nvidia" |

---

## Streaming (Real-Time Transcription)

| Term | What It Means | When to Use |
|------|---------------|-------------|
| **Streaming Transcription** | Real-time speech-to-text via WebSocket (text appears as you speak) | "Enable streaming transcription" |
| **Batch Transcription** | Traditional: record fully, then transcribe | "Use batch transcription instead" |
| **Partial Transcript** | In-progress, incomplete text during streaming | "Update the UI with partial transcripts" |
| **Final Transcript** | Confirmed, complete text after silence/VAD detection | "Save the final transcript to the database" |
| **AssemblyAI Streaming** | WebSocket streaming provider (`assemblyAiStreaming.js`) | "Fix the AssemblyAI streaming connection" |
| **Deepgram Streaming** | WebSocket streaming provider (`deepgramStreaming.js`) | "Add Deepgram streaming support" |
| **OpenAI Realtime** | OpenAI's WebSocket Realtime API (`openaiRealtimeStreaming.js`) | "Connect to OpenAI Realtime" |
| **Parakeet Streaming** | Local chunked streaming via WebSocket (`parakeetWsServer.js`) | "Start Parakeet streaming" |
| **LiveTranscriptOverlay** | UI component showing partial transcripts in real-time on the dictation panel | "Style the LiveTranscriptOverlay" |
| **Warmup** | Pre-opening a WebSocket connection before recording starts | "Warmup the AssemblyAI connection" |
| **VAD** (Voice Activity Detection) | Server-side silence detection that triggers final transcript | Background concept; rarely referenced directly |

---

## Reasoning & AI Processing

| Term | What It Means | When to Use |
|------|---------------|-------------|
| **Reasoning** | AI post-processing of transcribed text (cleanup, formatting, command execution) | "Enable reasoning on this transcription" |
| **ReasoningService** | Renderer-side TypeScript class routing to cloud AI providers | "ReasoningService handles OpenAI calls" |
| **LocalReasoningService** | Renderer-side class for local LLM inference | "LocalReasoningService queries llama-server" |
| **localReasoningBridge** | Main-process JS adapter for local reasoning IPC | "The bridge between renderer and llama-server" |
| **Reasoning Provider** (`reasoningProvider`) | Which AI service processes text: `openai`, `anthropic`, `gemini`, `groq`, `local`, `custom` | "Set reasoningProvider to anthropic" |
| **Reasoning Model** (`reasoningModel`) | Specific model ID for processing: `gpt-5.2`, `claude-sonnet-4-5`, etc. | "Switch reasoningModel to claude-opus-4-5" |
| **Agent** / **Agent Name** (`agentName`) | User's custom AI assistant name (e.g., "Jarvis") | "The user's agent name is stored in localStorage" |
| **Agent-Addressed Command** | Speech starting with "Hey [AgentName], ..." that triggers AI processing | "Detect agent-addressed commands in the transcript" |
| **Processing Method** | Database field: `'none'`, `'reasoning'`, `'byok'` | "Set processing_method to reasoning" |
| **System Prompt** / **UNIFIED_SYSTEM_PROMPT** | The instruction template sent to AI models (defined in `promptData.json`) | "Update the unified system prompt" |
| **llama.cpp** / **llama-server** | Local LLM inference engine for reasoning | "Start the llama-server for local reasoning" |
| **LlamaServerManager** | Main-process class managing the llama.cpp subprocess | "LlamaServerManager.start()" |

---

## Hotkey & Activation

| Term | What It Means | When to Use |
|------|---------------|-------------|
| **Hotkey** / **Dictation Key** (`dictationKey`) | Global keyboard shortcut triggering recording (default: backtick on Win/Linux, Globe on macOS) | "Change the dictation key" or "Update the hotkey" |
| **Activation Mode** (`activationMode`) | How the hotkey works: `"tap"` or `"push"` | "Switch activation mode to push" |
| **Tap-to-Talk** | Press once to start, press again to stop | "Tap-to-talk mode" |
| **Push-to-Talk** / **Hold** | Hold key to record, release to stop | "Push-to-talk mode" |
| **HotkeyManager** | Main-process class handling global shortcut registration | "HotkeyManager.setupShortcuts()" |
| **GnomeShortcutManager** (`gnomeShortcut.js`) | D-Bus integration for GNOME Wayland global shortcuts | "GnomeShortcutManager registers via gsettings" |
| **WindowsKeyManager** | Native low-level keyboard hook for Windows push-to-talk | "WindowsKeyManager listens for key-down/key-up" |
| **GlobeKeyManager** | macOS Globe/Fn key detection via Swift binary | "GlobeKeyManager fires globe-down" |
| **Compound Hotkey** | Multi-key combination like `Ctrl+Shift+F11` | "Support compound hotkeys" |
| **Hotkey Capture Mode** / **Listening Mode** | State when app captures the next key press for configuration | "Enter hotkey capture mode" |
| **Keysym** | GNOME keyboard symbol format (e.g., `<Alt>r`, `grave`) | "Convert Electron hotkey format to GNOME keysym" |

---

## Clipboard & Pasting

| Term | What It Means | When to Use |
|------|---------------|-------------|
| **ClipboardManager** (`clipboard.js`) | Cross-platform paste orchestration | "ClipboardManager.pasteText()" |
| **Paste Tools** | Platform-specific tools for simulating paste: `xdotool`, `wtype`, `ydotool`, `nircmd`, AppleScript | "Check which paste tools are available" |
| **Auto-Paste** | Automatically paste transcribed text into the active application | "Auto-paste after transcription" |
| **Terminal Detection** | Detecting if active window is a terminal (uses `Ctrl+Shift+V` instead of `Ctrl+V`) | "Terminal detection via AT-SPI2" |
| **AT-SPI2** | Linux accessibility API for detecting active application on GNOME Wayland | "AT-SPI2 detects the focused app" |
| **Paste Delay** (`PASTE_DELAY_MS`) | 50ms delay before paste to allow clipboard to settle | "Adjust the paste delay" |
| **XWayland** | X11 compatibility layer on Wayland — `xdotool` works here | "xdotool works for XWayland apps" |

---

## Cloud & Authentication

| Term | What It Means | When to Use |
|------|---------------|-------------|
| **OpenWhispr Cloud** | First-party cloud transcription/reasoning service | "Use OpenWhispr Cloud for transcription" |
| **BYOK** (Bring Your Own Key) | Mode where user provides their own API keys | "Switch to BYOK mode" |
| **`cloudTranscriptionMode`** | localStorage: `"openwhispr"` or `"byok"` | "Set cloudTranscriptionMode to byok" |
| **`cloudReasoningMode`** | localStorage: `"openwhispr"` or `"byok"` | "Set cloudReasoningMode to byok" |
| **Free Tier** | OpenWhispr Cloud: 2,000 words/week | "The free tier limit" |
| **Pro** | Paid OpenWhispr Cloud plan (unlimited) | "Pro plan features" |

---

## Model Registry

| Term | What It Means | When to Use |
|------|---------------|-------------|
| **Model Registry** (`modelRegistryData.json`) | Single source of truth for all AI model definitions | "Add a new model to the model registry" |
| **ModelRegistry.ts** | TypeScript wrapper with helper methods | "Use ModelRegistry to look up model info" |
| **`cloudProviders`** | Registry section: OpenAI, Anthropic, Gemini, Groq cloud models | "Add a model to cloudProviders" |
| **`localProviders`** | Registry section: GGUF models (Qwen, Llama, Mistral) for llama.cpp | "Add a model to localProviders" |
| **`whisperModels`** | Registry section: Whisper GGML model definitions | "Update whisperModels metadata" |
| **`parakeetModels`** | Registry section: NVIDIA Parakeet ONNX model definitions | "Add a Parakeet model" |
| **`transcriptionProviders`** | Registry section: Cloud transcription service providers | "Add a transcription provider" |
| **`hfRepo`** | HuggingFace repository path for model downloads | "Set the hfRepo for the new model" |
| **`promptTemplate`** | Chat format for local models: `"chatml"`, `"llama"`, `"mistral"` | "This model uses the chatml prompt template" |
| **ModelManager** (`ModelManager.ts` / `modelManagerBridge.js`) | Manages local GGUF model downloads and lifecycle | "ModelManager.downloadModel()" |

---

## Settings Flow

| Term | What It Means | When to Use |
|------|---------------|-------------|
| **useSettings** hook | Central React hook for all app settings | "Read the setting via useSettings" |
| **EnvironmentManager** (`environment.js`) | Manages API keys and `.env` persistence | "EnvironmentManager.saveAllKeysToEnvFile()" |
| **`saveAllKeysToEnvFile()`** | Writes all persisted keys to the `.env` file | "Call saveAllKeysToEnvFile after updating keys" |
| **`syncStartupPreferences()`** | Syncs renderer settings to main process env vars for server pre-warming | "Sync startup preferences on model change" |
| **Server Pre-warming** | Starting whisper/parakeet/llama servers at app launch based on saved settings | "Pre-warm the whisper server on startup" |

---

## Platform-Specific Terms

| Term | Platform | What It Means |
|------|----------|---------------|
| **D-Bus** | Linux | Inter-process communication system used for GNOME shortcuts |
| **gsettings** | Linux/GNOME | GNOME configuration system for registering keyboard shortcuts |
| **`com.openwhispr.App`** | Linux/GNOME | D-Bus service name for OpenWhispr's GNOME integration |
| **ydotoold** | Linux/Wayland | Daemon required by `ydotool` paste tool |
| **wtype** | Linux/Wayland | Virtual keyboard input tool (requires compositor support) |
| **xdotool** | Linux/X11 | Keyboard/mouse automation tool (works in XWayland too) |
| **nircmd.exe** | Windows | Bundled utility for clipboard operations |
| **windows-key-listener.exe** | Windows | Native C binary for low-level keyboard hooks |
| **globe-listener** | macOS | Swift binary for Globe/Fn key detection |
| **AppleScript** | macOS | Automation language used for paste operations |
| **pavucontrol** | Linux | PulseAudio volume control (recommended for audio device management) |

---

## Database

| Term | What It Means | When to Use |
|------|---------------|-------------|
| **better-sqlite3** | SQLite library used for local storage | "Query better-sqlite3 for transcriptions" |
| **Transcription History** | Past transcription records in SQLite | "Clear the transcription history" |
| **`original_text`** | Raw transcribed text (database column) | "Save the original_text" |
| **`processed_text`** | AI-processed result (database column) | "Update the processed_text" |
| **`is_processed`** | Boolean flag (database column) | "Mark is_processed = 1" |
| **`processing_method`** | How text was processed: `'none'`, `'reasoning'`, `'byok'` (database column) | "Set processing_method" |

---

## Key Files Quick Reference

| File | What It Is | When to Reference |
|------|-----------|-------------------|
| `main.js` | Electron main process entry point | "In main.js, the initialization order is..." |
| `preload.js` | IPC context bridge (`window.electronAPI`) | "Expose a new method in preload.js" |
| `src/App.jsx` | Dictation panel React component | "The dictation overlay in App.jsx" |
| `src/components/ControlPanel.tsx` | Settings window UI | "Add a section to ControlPanel" |
| `src/helpers/ipcHandlers.js` | All 150+ IPC handlers | "Register a handler in ipcHandlers.js" |
| `src/helpers/clipboard.js` | Cross-platform paste logic | "Fix the paste logic in clipboard.js" |
| `src/helpers/hotkeyManager.js` | Global hotkey registration | "HotkeyManager hotkey fallback logic" |
| `src/helpers/gnomeShortcut.js` | GNOME Wayland D-Bus shortcuts | "GnomeShortcutManager D-Bus service" |
| `src/helpers/whisper.js` | whisper.cpp binary wrapper | "WhisperManager model discovery" |
| `src/helpers/parakeet.js` | Parakeet/sherpa-onnx wrapper | "ParakeetManager server pre-warming" |
| `src/services/ReasoningService.ts` | Cloud AI reasoning logic | "ReasoningService provider routing" |
| `src/hooks/useSettings.ts` | Central settings hook | "Read settings via useSettings" |
| `src/hooks/useAudioRecording.js` | MediaRecorder wrapper | "useAudioRecording audio chunk handling" |
| `src/models/modelRegistryData.json` | Single source of truth for all models | "Add a model to the registry" |
| `src/config/constants.ts` | API endpoints, cache config, token limits | "Update API_ENDPOINTS in constants.ts" |
| `src/config/prompts.ts` / `promptData.json` | System prompts for AI | "Update the unified system prompt" |

---

## Abbreviations

| Abbreviation | Meaning |
|-------------|---------|
| **ASR** | Automatic Speech Recognition |
| **STT** | Speech-to-Text |
| **LLM** | Large Language Model |
| **IPC** | Inter-Process Communication |
| **BYOK** | Bring Your Own Key |
| **VAD** | Voice Activity Detection |
| **GGML** | Quantized model format (whisper.cpp) |
| **GGUF** | Quantized model format (llama.cpp) |
| **ONNX** | Open Neural Network Exchange (sherpa-onnx runtime) |
| **INT8** | 8-bit integer quantization |
| **HF** | HuggingFace (model hosting) |
| **DE** | Desktop Environment (GNOME, KDE, etc.) |
| **ASAR** | Electron Archive format |

---

## Prompt Tips

When asking an AI assistant to work on this codebase:

1. **Use exact class names**: Say "HotkeyManager" not "the hotkey handler", "ClipboardManager" not "the paste module"
2. **Use exact file paths**: Say "`src/helpers/clipboard.js`" not "the clipboard file"
3. **Distinguish Manager vs Service**: Managers are main-process, Services are renderer-safe
4. **Distinguish Provider types**: "transcription provider" (STT engine) vs "reasoning provider" (AI model) vs "streaming provider" (real-time WebSocket)
5. **Use IPC channel names**: Say "the `paste-text` IPC channel" not "the paste handler"
6. **Reference localStorage keys precisely**: Say "`localTranscriptionProvider`" not "the provider setting"
7. **Name the window**: Say "dictation panel" or "control panel" not "the window"
8. **Specify platform**: Say "GNOME Wayland" not just "Linux" when relevant to shortcuts/paste
9. **Use model format names**: Say "GGML model" (whisper), "GGUF model" (llama.cpp), "ONNX model" (Parakeet)
10. **Reference the registry**: Say "add to `modelRegistryData.json`" not "add a new model somewhere"
