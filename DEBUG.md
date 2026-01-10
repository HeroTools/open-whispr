# OpenWhispr Debug Mode

## Enabling Debug Logging

When experiencing issues like "no audio detected", you can enable verbose debug logging to help diagnose the problem.

### Method 1: Command Line Flag
Run the app with the `--log-level=debug` flag:
```bash
# macOS
/Applications/OpenWhispr.app/Contents/MacOS/OpenWhispr --log-level=debug

# Windows
OpenWhispr.exe --log-level=debug
```

### Method 2: Environment Variable
Set the `OPENWHISPR_LOG_LEVEL=debug` environment variable:
```bash
# macOS/Linux
export OPENWHISPR_LOG_LEVEL=debug
open /Applications/OpenWhispr.app

# Windows
set OPENWHISPR_LOG_LEVEL=debug
OpenWhispr.exe
```
You can also put `OPENWHISPR_LOG_LEVEL=debug` in the app's `.env` file and restart:

- **macOS**: `~/Library/Application Support/OpenWhispr/.env`
- **Windows**: `%APPDATA%\OpenWhispr\.env`
- **Linux**: `~/.config/OpenWhispr/.env`

## Finding the Debug Logs

When debug mode is enabled, logs are saved to:

- **macOS**: `~/Library/Application Support/OpenWhispr/logs/debug-[timestamp].log`
- **Windows**: `%APPDATA%\OpenWhispr\logs\debug-[timestamp].log`
- **Linux**: `~/.config/OpenWhispr/logs/debug-[timestamp].log`

## Log Levels (Quick Guide)

Log levels control how verbose logging is. Setting `--log-level=debug` means you'll see everything at `debug` and above.

- `trace`: very detailed, internal flow (most verbose)
- `debug`: detailed diagnostics for troubleshooting
- `info`: normal operational events
- `warn`: something unexpected, but the app can continue
- `error`: a failure occurred
- `fatal`: the app can't continue

## What the Logs Include

The debug logs capture comprehensive information about the audio pipeline:

1. **🎬 FFmpeg Detection**
   - All paths checked for FFmpeg (bundled and system)
   - File existence, permissions, and executable status
   - ASAR unpacking verification
   - Environment variable configuration
   - Final FFmpeg path resolution

2. **🎙️ Audio Recording**
   - Microphone permission requests and grants
   - Audio track details (enabled, muted, label, settings)
   - Real-time audio chunk reception (size and count)
   - Audio level analysis (average, max, silence detection)
   - Recording duration and blob creation

3. **🔊 Audio Processing**
   - Audio data types and conversion
   - Temporary file creation and permissions
   - File sizes at each stage
   - First bytes of audio data (hex)
   - Whisper command construction
   - Python process environment setup

4. **📡 Process Communication**
   - IPC messages between renderer and main process
   - Audio blob transfer details
   - Whisper process stdout/stderr
   - Process exit codes
   - Error propagation

5. **🎯 Pipeline Stages**
   - Each stage is clearly marked with descriptive labels
   - Timing information for performance analysis
   - Success/failure status at each step

## Common Issues and What to Look For

### "No Audio Detected"
Look for these specific log entries:
- `Audio appears to be silent` - Check `maxLevel` value (should be > 0.01)
- `Audio chunk received, size: 0` - MediaRecorder not capturing data
- `FFmpeg not available` - FFmpeg path resolution failed
- `Bundled FFmpeg not found` - ASAR unpacking issue
- `FFmpeg exists but is not executable` - Permission problem
- `No audio chunks received after 3 seconds` - Microphone not working
- `Whisper reported no audio detected` - FFmpeg processing failed

### Transcription Fails
Look for:
- `Whisper stderr:` - Check for Python errors or FFmpeg issues
- `Failed to parse Whisper output` - Invalid JSON response
- `Process closed with code: [non-zero]` - Process failure
- `Audio file is empty after writing` - File I/O issue
- `Unsupported audio data type` - Audio format problem

### Slow Performance
Look for:
- Large `blobSize` values (> 10MB) - Consider audio optimization
- Multiple `Checking alternative path` entries - FFmpeg search overhead
- `Whisper process closed` with long delays - Model processing time

### Permission Issues
Look for:
- `Microphone Access Denied` - System permission required
- `dirReadable: false` - Directory access problems
- `permissions: [number]` - Check file permission octals

## Interpreting Key Debug Messages

### FFmpeg Path Resolution
```
🎬 FFmpeg Debug - Initial ffmpeg-static path {
  "ffmpegPath": "/path/to/ffmpeg",
  "exists": true,
  "fileInfo": {
    "size": 74750976,
    "isFile": true,
    "isExecutable": true,
    "permissions": "100755"
  }
}
```
- `exists: false` - Path resolution failed
- `isExecutable: false` - Permission issue
- `permissions` - Should be executable (755 or similar)

### Audio Level Analysis
```
🔊 Audio level analysis {
  "duration": "3.45s",
  "samples": 165888,
  "averageLevel": "0.002134",
  "maxLevel": "0.045632",
  "isSilent": false
}
```
- `maxLevel < 0.01` - Audio too quiet/silent
- `samples: 0` - No audio data captured
- `isSilent: true` - Definite silence detected

### Whisper Process Environment
```
🚀 Starting process {
  "command": "python3",
  "args": ["whisper_bridge.py", "/tmp/whisper_audio.wav", "--model", "base"],
  "env": {
    "FFMPEG_PATH": "/path/to/ffmpeg",
    "FFMPEG_EXECUTABLE": "/path/to/ffmpeg",
    "FFMPEG_BINARY": "/path/to/ffmpeg"
  }
}
```
- All three FFmpeg env vars should point to valid path
- Empty env vars indicate FFmpeg not found

## Sharing Debug Logs

When reporting issues:

1. Enable debug mode and reproduce the issue
2. Find the debug log file (path is shown at startup)
3. Look for any sensitive information and redact if needed
4. Share the relevant portions of the log file
5. Include the error message shown to the user
6. Note your system configuration (macOS version, mic type)

## Disabling Debug Mode

Debug mode is disabled by default. To ensure it's off:
- Don't use `--log-level=debug`
- Unset the environment variable: `unset OPENWHISPR_LOG_LEVEL`
