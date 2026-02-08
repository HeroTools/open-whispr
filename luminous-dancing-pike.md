# Real-Time Streaming Transcription with Live Overlay

## Context

Users currently have to wait for recording to finish before transcription begins. The goal is to stream audio to a transcription service during recording and display live text flowing beside the floating dictation icon, so the transcript is ready the instant the user toggles off.

OpenWhispr already has ~90% of the infrastructure: AssemblyAI WebSocket streaming is fully implemented, the `partialTranscript` state exists in `useAudioRecording.js` but is never rendered, and the AudioWorklet is referenced but the file doesn't exist. This plan fills the gaps and adds 3 more streaming backends.

## Architecture Overview

```
Mic → AudioWorklet (16kHz PCM) → IPC → Main Process → WebSocket → STT Service
                                                          ↓
                  LiveTranscriptOverlay ← IPC ← partial transcript JSON
```

All 4 backends share the same AudioWorklet PCM pipeline, the same IPC event pattern (`streaming-partial-transcript`, `streaming-final-transcript`), and the same overlay UI component.

## Implementation Phases

### Phase 1: Shared UI + AssemblyAI (MVP)

Zero backend work — just render what's already there.

**1a. Create the missing AudioWorklet file**

- **Create** `src/pcm-streaming-processor.js`
- Converts float32 samples to int16 PCM, posts to main thread via port
- **Modify** `src/vite.config.mjs` — configure `publicDir` or asset handling so the worklet file is served at the document base URI

**1b. Create LiveTranscriptOverlay component**

- **Create** `src/components/ui/LiveTranscriptOverlay.tsx`
- Semi-transparent dark box with white text, positioned to the left of the mic button
- Max-width 400px, max-height 120px, auto-scrolls to bottom on text update
- Renders only when `isStreaming && (partialTranscript !== "")`
- Click-through (non-interactive) — users don't interact with transcript text
- Styling: `text-sm text-white/90 bg-black/60 backdrop-blur-sm rounded-lg`

**1c. Wire into overlay window**

- **Modify** `src/helpers/windowConfig.js` — add `WITH_TRANSCRIPT: { width: 480, height: 160 }`
- **Modify** `src/App.jsx`:
  - Import and render `LiveTranscriptOverlay` with `partialTranscript` and `isStreaming` props
  - Add window resize to `WITH_TRANSCRIPT` when streaming text is visible
  - Resize back to `BASE` when recording/streaming stops

**Files:** windowConfig.js, App.jsx, new LiveTranscriptOverlay.tsx, new pcm-streaming-processor.js, vite.config.mjs

---

### Phase 2: Deepgram Backend (primary new addition)

Best streaming STT: low latency, accurate, affordable ($0.0043/min).

**2a. Create Deepgram streaming client**

- **Create** `src/helpers/deepgramStreaming.js`
- WebSocket to `wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=16000&channels=1&model=nova-3&punctuate=true&interim_results=true&utterance_end_ms=1000&smart_format=true`
- Auth via `Authorization: Token <key>` header
- Send raw int16 PCM binary frames
- Receive JSON `Results` messages: `is_final: false` → partial, `is_final: true` → final
- Close by sending `{ "type": "CloseStream" }` JSON
- Follow the same class structure as `assemblyAiStreaming.js` (connect/sendAudio/disconnect pattern)

**2b. API key management**

- **Modify** `src/helpers/environment.js` — add `getDeepgramKey()` / `saveDeepgramKey()`
- **Modify** `src/helpers/ipcHandlers.js` — add `get-deepgram-key`, `save-deepgram-key` handlers
- **Modify** `preload.js` — add bridge methods
- **Modify** `src/hooks/useSettings.ts` — add `deepgramApiKey` setting

**2c. IPC handlers for streaming**

- **Modify** `src/helpers/ipcHandlers.js` — add `deepgram-streaming-start/send/stop` handlers
- Emit `streaming-partial-transcript` and `streaming-final-transcript` to renderer (same events as AssemblyAI generalized)

**2d. Wire into audioManager**

- **Modify** `src/helpers/audioManager.js`:
  - Refactor `shouldUseStreaming()` to check `streamingProvider` setting
  - Refactor `startStreamingRecording()` to dispatch to Deepgram/AssemblyAI/etc. based on provider
  - Reuse existing AudioWorklet PCM pipeline

**2e. Settings UI**

- **Modify** `src/hooks/useSettings.ts` — add `streamingProvider` setting (`"auto"` | `"off"` | `"deepgram"` | `"assemblyai"` | `"openai-realtime"` | `"parakeet"`)
- **Modify** `src/components/SettingsPage.tsx` — add "Live Transcription" section with provider dropdown and conditional Deepgram API key input

**Files:** new deepgramStreaming.js, environment.js, ipcHandlers.js, preload.js, useSettings.ts, SettingsPage.tsx, audioManager.js

---

### Phase 3: Local Parakeet Chunked Streaming

Privacy-focused, no cloud dependency. The sherpa-onnx binary is `sherpa-onnx-offline-websocket-server` (batch only), so true streaming isn't available. Use chunked re-transcription instead.

**Approach: Accumulate + re-transcribe every 2 seconds**

- AudioWorklet streams PCM chunks to main process
- Main process accumulates chunks in a growing buffer
- Every 2 seconds, send the full accumulated buffer to `parakeetWsServer.transcribe()`
- Each result replaces the previous partial transcript (each one is a full re-transcription)
- ~2s latency, but fully local and private
- On stop: send final accumulated buffer, use last result as final transcript

**Implementation:**

- **Modify** `src/helpers/audioManager.js` — add Parakeet streaming path in `startStreamingRecording()` with accumulation buffer and 2-second interval timer
- **Modify** `src/helpers/ipcHandlers.js` — add `parakeet-streaming-transcribe` handler that accepts buffer and routes to `parakeetWsServer.transcribe()`
- **Modify** `preload.js` — add bridge for parakeet streaming IPC

**Files:** audioManager.js, ipcHandlers.js, preload.js

---

### Phase 4: OpenAI Realtime API

Uses existing OpenAI API key. More expensive (~$0.06/min) but no new account needed.

**4a. Create OpenAI Realtime streaming client**

- **Create** `src/helpers/openaiRealtimeStreaming.js`
- WebSocket to `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview`
- Auth via `Authorization: Bearer <key>` header
- On connect: send `session.update` with `{ input_audio_format: "pcm16", input_audio_transcription: { model: "gpt-4o-mini-transcribe" } }`
- Send audio: `{ type: "input_audio_buffer.append", audio: <base64 PCM> }`
- Receive: `conversation.item.input_audio_transcription.completed` for final text, `response.audio_transcript.delta` for partials
- Note: PCM must be base64-encoded (33% overhead), which is unique to this backend

**4b. IPC handlers**

- **Modify** `src/helpers/ipcHandlers.js` — add `openai-realtime-streaming-start/send/stop`
- **Modify** `preload.js` — add bridge methods

**4c. Wire into audioManager**

- **Modify** `src/helpers/audioManager.js` — add OpenAI Realtime path in streaming dispatch

**Files:** new openaiRealtimeStreaming.js, ipcHandlers.js, preload.js, audioManager.js

---

## Complete File List

### New files (4)

| File | Purpose |
|------|---------|
| `src/pcm-streaming-processor.js` | AudioWorklet: mic → 16kHz int16 PCM chunks |
| `src/components/ui/LiveTranscriptOverlay.tsx` | Live text display beside mic icon |
| `src/helpers/deepgramStreaming.js` | Deepgram WebSocket client |
| `src/helpers/openaiRealtimeStreaming.js` | OpenAI Realtime WebSocket client |

### Modified files (9)

| File | Changes |
|------|---------|
| `src/helpers/windowConfig.js` | Add `WITH_TRANSCRIPT` size |
| `src/App.jsx` | Render LiveTranscriptOverlay, window resize for streaming |
| `src/helpers/audioManager.js` | Multi-provider streaming dispatch, Parakeet chunked streaming |
| `src/helpers/ipcHandlers.js` | Deepgram/OpenAI/Parakeet streaming handlers, Deepgram key handlers |
| `src/helpers/environment.js` | Deepgram API key get/save |
| `src/hooks/useSettings.ts` | `streamingProvider`, `deepgramApiKey` settings |
| `src/hooks/useAudioRecording.js` | Ensure `partialTranscript` and `isStreaming` are properly exported |
| `src/components/SettingsPage.tsx` | "Live Transcription" settings section |
| `preload.js` | Bridge methods for all new IPC channels |
| `src/vite.config.mjs` | Serve AudioWorklet as static asset |

## Verification

### Phase 1 (AssemblyAI + UI)
- Enable streaming in settings (requires OpenWhispr Cloud subscription)
- Record speech → verify live text appears beside icon
- Verify text auto-scrolls as new words appear
- Verify window resizes to `WITH_TRANSCRIPT` during streaming
- Verify window resizes back to `BASE` on stop
- Verify final transcript is correct and pastes immediately on hotkey toggle

### Phase 2 (Deepgram)
- Add Deepgram API key in settings
- Select Deepgram as streaming provider
- Record speech → verify partial transcripts appear in real-time
- Test language selection
- Test error handling (invalid key, network failure)

### Phase 3 (Parakeet)
- Select Parakeet as streaming provider with local mode enabled
- Record speech → verify text appears with ~2s latency
- Verify no cloud calls made (network tab / debug logs)
- Test with various recording lengths

### Phase 4 (OpenAI Realtime)
- Select OpenAI Realtime as streaming provider (uses existing OpenAI key)
- Record speech → verify transcription appears
- Compare latency and cost vs Deepgram
