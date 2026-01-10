# Local Whisper Integration Guide

## ✅ What We've Accomplished

Your OpenWhispr app has been successfully refactored to support **local Whisper models** in addition to the OpenAI API. Here's what's been implemented:

### 🔧 Technical Implementation

1. **Python Bridge Script** (`whisper_bridge.py`)
   - Handles local audio transcription using OpenAI's Whisper models
   - Supports all Whisper models: tiny, base, small, medium, large, turbo
   - JSON output for integration with Electron app
   - Proper error handling and cleanup

2. **Enhanced Main Process** (`main.js`)
   - New IPC handlers for local Whisper transcription
   - Python executable detection across different systems
   - Whisper installation checking
   - Temporary file management with cleanup
   - 30-second timeout protection

3. **Updated Preload Script** (`preload.js`)
   - New IPC methods exposed to renderer
   - Type-safe interfaces for TypeScript

4. **Enhanced React App** (`src/App.jsx`)
   - Automatic fallback from local to OpenAI API
   - User preference storage in localStorage
   - Model selection support
   - Smart error handling

5. **Advanced Control Panel** (`src/components/ControlPanel.tsx`)
   - Complete UI for Whisper engine selection
   - Model selection dropdown with descriptions
   - Installation status checking
   - Privacy information display
   - Settings persistence

## 🚀 How to Use Local Whisper

### Step 1: Open the Control Panel
- Right-click the app tray icon (macOS) or use the overlay
- Navigate to "Whisper Engine Settings"

### Step 2: Enable Local Whisper
- Check the "Use Local Whisper (Privacy Mode)" checkbox
- Select your desired model:
  - **Tiny**: Fastest, lowest quality (39M params)
  - **Base**: Balanced speed/quality (74M params) - Recommended
  - **Small**: Better quality, slower (244M params)
  - **Medium**: High quality, much slower (769M params)
  - **Large**: Best quality, very slow (1550M params)
  - **Turbo**: Fast with good quality (809M params)

### Step 3: Save Settings
- Click "Save Whisper Settings"
- The app will now use local processing for all new transcriptions

## 🔒 Privacy Benefits

### Local Whisper Mode
- ✅ **Complete Privacy**: Audio never leaves your device
- ✅ **No Internet Required**: Works offline (after model download)
- ✅ **No API Costs**: Free to use after initial setup
- ✅ **Faster Response**: No network latency
- ⚠️ **Higher Resource Usage**: Uses CPU/memory for processing

### OpenAI API Mode  
- ⚠️ **Audio Sent to OpenAI**: Audio data transmitted to servers
- ⚠️ **Internet Required**: Needs active connection
- ⚠️ **API Costs**: Charges per minute of audio
- ✅ **Fast & Efficient**: Minimal local resource usage
- ✅ **Always Latest Model**: OpenAI's most advanced model

## 📦 Requirements

### ✅ Bundled Dependencies (No Installation Required)

The following are now **bundled with the app** and require no user installation:

- ✅ **FFmpeg**: Bundled with the app (no system installation needed)
- ✅ **Python Bridge Script**: Included in the app bundle
- ✅ **App Integration**: Fully implemented

### 🔧 Isolated Python Environment (Default)

For **local Whisper processing**, OpenWhispr now:

- ✅ Creates a per-user virtual environment automatically
- ✅ Installs OpenAI Whisper inside that environment
- ✅ Avoids modifying system Python (no global `pip install`)

If you want to force a specific interpreter, set `OPENWHISPR_PYTHON` to a Python 3.x path before launching the app.

**Note**: FFmpeg is bundled, so users no longer need to install it separately.

## 🧪 Testing Your Setup

### Test 1: Check Installation Status
1. Open the Control Panel
2. Look at the "Whisper Engine Settings" card
3. You should see "✅ Installed" next to the Local Whisper checkbox

### Test 2: Test Local Transcription
1. Enable "Use Local Whisper" in Control Panel
2. Select "base" model (recommended for testing)
3. Save settings
4. Press your hotkey (default: backtick `) to start dictation
5. Speak clearly for 2-3 seconds
6. Press your hotkey again to stop
7. The transcription should appear and paste automatically

### Test 3: Model Download (First Time)
- The first time you use a model, Whisper will download it automatically
- This may take a few minutes depending on your internet speed
- Subsequent uses will be much faster

## 🔄 Fallback Behavior

The app is configured with intelligent fallback:

1. **Primary**: Use local Whisper if enabled and working
2. **Fallback**: Automatically switch to OpenAI API if local fails
3. **Error Handling**: Clear messages about what's happening
4. **Hotkey Control**: All recording is controlled via customizable hotkey (no clicking required)

## 📊 Model Performance Guide

| Model  | Size  | Speed    | Quality | Memory | Best For |
|--------|-------|----------|---------|--------|----------|
| Tiny   | 39M   | Fastest  | Basic   | ~1GB   | Quick notes |
| Base   | 74M   | Fast     | Good    | ~1GB   | **Recommended** |
| Small  | 244M  | Medium   | Better  | ~2GB   | Professional use |
| Medium | 769M  | Slow     | High    | ~5GB   | High accuracy needed |
| Large  | 1550M | Slowest  | Best    | ~10GB  | Maximum quality |
| Turbo  | 809M  | Fast     | High    | ~6GB   | Best balance |

## 🛠 Troubleshooting

### "❌ Not Found" Status
If you see this status:
1. Click "Recheck Installation" button
2. Restart the app completely
3. Check Console logs for Python/Whisper errors

### Transcription Fails
1. Check your microphone permissions
2. Verify the model downloaded successfully
3. Try switching to a smaller model (tiny/base)
4. Check Console logs for detailed error messages

### Slow Performance
1. Use smaller models (tiny, base)
2. Close other resource-intensive apps
3. Check your system's available memory

### Model Download Issues
1. Ensure stable internet connection
2. Check available disk space (~2-15GB depending on model)
3. Try smaller model first

## 🔧 Advanced Configuration

### Custom Python Path
If you need to force a specific interpreter, set the `OPENWHISPR_PYTHON` environment variable before launching the app (e.g. `setx OPENWHISPR_PYTHON "C:\\Python312\\python.exe"` on Windows or `export OPENWHISPR_PYTHON=/opt/homebrew/bin/python3.12` on macOS).
When this is set, OpenWhispr will use that interpreter directly instead of its managed virtual environment, so ensure Whisper is installed in that environment.

### Managed Python Environment Location
The isolated environment lives under your app data directory:
- macOS: `~/Library/Application Support/OpenWhispr/python/venv`
- Windows: `%APPDATA%\\OpenWhispr\\python\\venv`
- Linux: `~/.config/OpenWhispr/python/venv`

### Model Storage Location
Models are downloaded to `~/.cache/whisper/` by default.
You can change this by modifying the bridge script.

### Timeout Settings
Current timeout is 30 seconds. To change:
1. Edit `main.js`
2. Find the `setTimeout` in the `transcribe-local-whisper` handler
3. Adjust the value (in milliseconds)

## 🎯 Next Steps

Your app now supports both local and cloud transcription! You can:

1. **Switch modes anytime** via Control Panel
2. **Test different models** to find your preference  
3. **Enjoy complete privacy** with local processing
4. **Keep API access** as a backup option
5. **Customize your hotkey** to any key you prefer
6. **Drag the panel** to position it anywhere on your screen

The integration is complete and ready for production use. All files have been modified and the Python bridge is fully functional.

## 📝 Files Modified

- ✅ `whisper_bridge.py` - New Python bridge script
- ✅ `main.js` - Added local Whisper IPC handlers
- ✅ `preload.js` - Added new IPC method exports
- ✅ `src/App.jsx` - Enhanced with local/API switching
- ✅ `src/components/ControlPanel.tsx` - New Whisper settings UI

Everything is ready to use! 🎉 
