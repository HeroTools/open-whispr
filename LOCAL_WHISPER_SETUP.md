# Local Whisper Setup

OpenWhispr supports local speech-to-text processing using OpenAI's Whisper models. This keeps your audio completely private—nothing leaves your device.

## Quick Start

1. Open the **Control Panel** (right-click tray icon or click the overlay)
2. Go to **Settings** → **Speech to Text Processing**
3. Enable **Use Local Whisper**
4. Select a model (recommended: `base`)
5. Click **Save**

The first transcription will download the model automatically.

## Model Selection

| Model  | Size   | Speed    | Quality | RAM    | Best For              |
|--------|--------|----------|---------|--------|-----------------------|
| tiny   | 39MB   | Fastest  | Basic   | ~1GB   | Quick notes           |
| base   | 74MB   | Fast     | Good    | ~1GB   | **Recommended**       |
| small  | 244MB  | Medium   | Better  | ~2GB   | Professional use      |
| medium | 769MB  | Slow     | High    | ~5GB   | High accuracy         |
| large  | 1.5GB  | Slowest  | Best    | ~10GB  | Maximum quality       |
| turbo  | 809MB  | Fast     | High    | ~6GB   | Best speed/quality    |

## How It Works

OpenWhispr automatically:
1. Creates an isolated Python virtual environment (no system modifications)
2. Installs Whisper and dependencies into that environment
3. Downloads the selected model on first use
4. Processes audio locally using FFmpeg (bundled with the app)

## Requirements

- **Disk Space**: 39MB–1.5GB depending on model
- **RAM**: 1GB–10GB depending on model
- **Python**: System Python 3.7+ (used only to create the venv)

## File Locations

| Data              | macOS                                        | Windows                              | Linux                           |
|-------------------|----------------------------------------------|--------------------------------------|---------------------------------|
| Virtual Env       | `~/Library/Application Support/OpenWhispr/python/venv` | `%APPDATA%\OpenWhispr\python\venv` | `~/.config/OpenWhispr/python/venv` |
| Models            | `~/.cache/whisper/`                          | `%USERPROFILE%\.cache\whisper\`      | `~/.cache/whisper/`             |

## Advanced: Custom Python

To use a specific Python interpreter instead of the managed venv:

```bash
# macOS/Linux
export OPENWHISPR_PYTHON=/usr/local/bin/python3.11

# Windows (permanent)
setx OPENWHISPR_PYTHON "C:\Python311\python.exe"
```

When set, OpenWhispr uses this interpreter directly. Ensure Whisper is installed in that environment.

## Troubleshooting

### "Not Found" Status
1. Click **Recheck Installation** in Control Panel
2. Restart the app
3. Check console logs for Python/Whisper errors

### Transcription Fails
1. Verify microphone permissions
2. Try a smaller model (tiny/base)
3. Check disk space for model downloads

### Slow Performance
1. Use smaller models (tiny or base)
2. Close resource-intensive apps
3. Consider using cloud mode for large files

## Privacy Comparison

| Mode  | Audio Leaves Device | Internet Required | Cost      |
|-------|---------------------|-------------------|-----------|
| Local | No                  | Only for model download | Free |
| Cloud | Yes (to OpenAI)     | Yes               | API usage |
