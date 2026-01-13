# Troubleshooting

## Quick Diagnostics

| Check | Command |
|-------|---------|
| Host architecture | `uname -m` |
| Node architecture | `node -p "process.arch"` |
| whisper.cpp install | `which whisper` or `which whisper-cpp` |
| FFmpeg availability | `ffmpeg -version` |

## Common Issues

### Architecture Mismatch (Apple Silicon)

**Symptoms:** Crashes on launch, "wrong architecture" errors

**Fix:**
1. Check if Node is x86_64 on arm64: `node -p "process.arch"` vs `uname -m`
2. Uninstall mismatched Node and reinstall native build
3. Run `rm -rf node_modules package-lock.json && npm ci`
4. Rebuild the app

### Empty Transcriptions

**Symptoms:** History shows "you" or empty entries

**Causes:**
- Microphone permission revoked mid-session
- Stale Whisper cache with corrupted clips
- Hotkey triggering without audio input

**Fix:**
1. Check microphone permissions in System Settings
2. Clear caches: `rm -rf ~/.cache/whisper`
3. Try a different hotkey
4. Re-run onboarding

### FFmpeg Not Found

**Symptoms:** "FFmpeg not found" error, transcription fails immediately

**Fix:**
1. Reinstall dependencies: `rm -rf node_modules && npm ci`
2. Run `npm run setup` to verify FFmpeg
3. If using packaged app, try reinstalling

### whisper.cpp Issues

**Symptoms:** Local transcription fails, "whisper.cpp not found"

**Fix:**
1. The whisper.cpp binary is bundled with the app
2. If bundled binary fails, install via package manager:
   - macOS: `brew install whisper-cpp`
   - Linux: Build from source at https://github.com/ggml-org/whisper.cpp
3. Clear model cache: `rm -rf ~/.cache/openwhispr/whisper-models`
4. Try cloud transcription as fallback

### Windows-Specific Issues

See [WINDOWS_TROUBLESHOOTING.md](WINDOWS_TROUBLESHOOTING.md) for:
- Window visibility issues
- FFmpeg permission problems

## Enable Debug Mode

For detailed diagnostics, see [DEBUG.md](DEBUG.md).

## Getting Help

1. Enable debug mode and reproduce the issue
2. Collect diagnostic output from commands above
3. Open an issue at https://github.com/HeroTools/open-whispr/issues with:
   - OS version
   - OpenWhispr version
   - Relevant log sections
   - Steps to reproduce
