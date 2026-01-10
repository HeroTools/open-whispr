# Windows Troubleshooting Guide

This guide addresses common Windows-specific issues in OpenWhispr.

## Quick Fixes

### Issue: "No transcriptions" or "Audio file is empty"

**Symptoms:**
- Recording indicator shows, but no text appears
- Error: "Audio file is empty"
- Error: "Audio data too small"

**Solutions:**

1. **Check Microphone Permissions**
   - Open Windows Settings → Privacy & Security → Microphone
   - Ensure "Microphone access" is ON
   - Ensure "Let apps access your microphone" is ON
   - Restart OpenWhispr

2. **Verify Microphone Selection**
   - Right-click speaker icon in system tray
   - Select "Sound settings"
   - Under "Input", select your microphone
   - Test by speaking - the volume bar should move
   - Set volume to 70-100%

3. **Test Recording**
   - Open Windows Voice Recorder
   - Record a short clip
   - If Voice Recorder works but OpenWhispr doesn't, enable debug mode (see below)

### Issue: "Python not found" or ENOENT error

**Symptoms:**
- Error: "spawn python ENOENT"
- Error: "Python 3.x not found"
- Transcription fails immediately

**Solutions:**

1. **Install Python via OpenWhispr**
   - Open Control Panel (click OpenWhispr icon → Control Panel)
   - Go to Settings tab
   - Click "Install Python" button
   - Wait for installation to complete
   - Restart OpenWhispr

2. **Manual Python Installation**
   - Download Python 3.11+ from [python.org](https://www.python.org/downloads/)
   - **IMPORTANT**: Check "Add Python to PATH" during installation
   - Choose "Install for all users" if you have admin rights
   - After installation, restart your computer
   - Restart OpenWhispr

3. **Verify Python Installation**
   - Open Command Prompt (Win + R, type `cmd`)
   - Type: `python --version`
   - Should show: `Python 3.x.x`
   - Type: `where python`
   - Should show path to python.exe

4. **Set Python Path Manually**
   - Find your Python installation (usually `C:\Users\YourName\AppData\Local\Programs\Python\Python311\python.exe`)
   - Create/edit `.env` file in OpenWhispr directory
   - Add: `OPENWHISPR_PYTHON=C:\Path\To\Your\python.exe`
   - Restart OpenWhispr

### Issue: "FFmpeg not found" or transcription fails silently

**Symptoms:**
- Recording completes but never transcribes
- Error mentions FFmpeg
- Local Whisper mode doesn't work

**Solutions:**

1. **Reinstall OpenWhispr**
   - Uninstall OpenWhispr completely
   - Download latest version
   - Install to default location
   - FFmpeg is bundled and should work automatically

2. **Install System FFmpeg** (if bundled version fails)
   - Download FFmpeg from [ffmpeg.org](https://ffmpeg.org/download.html#build-windows)
   - Extract to `C:\ffmpeg`
   - Add to PATH:
     - Open System Properties → Environment Variables
     - Edit "Path" variable
     - Add: `C:\ffmpeg\bin`
   - Restart OpenWhispr

3. **Verify FFmpeg**
   - Open Command Prompt
   - Type: `ffmpeg -version`
   - Should show FFmpeg version info

## Enable Debug Mode

Debug mode creates detailed logs for troubleshooting:

### Method 1: Command Line
```batch
cd "C:\Users\YourName\AppData\Local\Programs\OpenWhispr"
OpenWhispr.exe --log-level=debug
```

### Method 2: Environment Variable
```batch
set OPENWHISPR_LOG_LEVEL=debug
"C:\Users\YourName\AppData\Local\Programs\OpenWhispr\OpenWhispr.exe"
```
You can also set it in `%APPDATA%\OpenWhispr\.env`:
```
OPENWHISPR_LOG_LEVEL=debug
```
Then restart OpenWhispr.

### Find Debug Logs
Logs are saved to: `%APPDATA%\OpenWhispr\logs\`

To open:
1. Press Win + R
2. Type: `%APPDATA%\OpenWhispr\logs`
3. Press Enter
4. Open the most recent `debug-*.log` file

## Common Error Messages Explained

### "Audio buffer is empty - no audio data received"
**Meaning:** The microphone didn't capture any audio data.

**Fix:**
- Check microphone is not muted
- Check microphone permissions
- Try a different microphone
- Ensure no other app is blocking microphone access

### "Python version check failed"
**Meaning:** Python is installed but not responding correctly.

**Fix:**
- Reinstall Python
- Ensure Python is in PATH
- Check Windows Defender isn't blocking Python
- Run OpenWhispr as Administrator (temporarily)

### "FFmpeg not found at any location"
**Meaning:** Cannot find FFmpeg executable.

**Fix:**
- Reinstall OpenWhispr to get bundled FFmpeg
- Install FFmpeg separately (see above)
- Check antivirus isn't quarantining FFmpeg

### "Whisper installation failed"
**Meaning:** Cannot install the Whisper AI package.

**Fix:**
- Ensure Python is installed correctly
- Check internet connection
- Install Microsoft Visual C++ Redistributable
- Try Cloud mode instead (requires OpenAI API key)

## Performance Tips

### Slow Transcription
- Use smaller Whisper model (tiny or base)
- Enable GPU acceleration if you have NVIDIA GPU
- Use Cloud mode for faster results
- Close other apps while transcribing

### High CPU Usage
- Use "tiny" or "base" model instead of "large"
- Enable Cloud mode
- Reduce recording length

## Windows-Specific Issues

### Windows Defender Blocks
If Windows Defender blocks OpenWhispr:
1. Open Windows Security
2. Go to Virus & threat protection
3. Click "Manage settings"
4. Add OpenWhispr to exclusions

### Firewall Issues (Cloud Mode)
If Cloud transcription fails:
1. Open Windows Firewall settings
2. Allow OpenWhispr through firewall
3. Check your antivirus isn't blocking internet access

### Permission Errors
If you see "Access denied" errors:
1. Right-click OpenWhispr shortcut
2. Choose "Run as administrator"
3. If it works, add permanent admin rights:
   - Right-click → Properties → Compatibility
   - Check "Run this program as administrator"

## Getting Help

If none of these solutions work:

1. **Collect Debug Logs**
   - Enable debug mode (see above)
   - Reproduce the issue
   - Locate log file in `%APPDATA%\OpenWhispr\logs`

2. **Report Issue**
   - Go to: https://github.com/HeroTools/open-whispr/issues
   - Create new issue
   - Include:
     - Windows version (Win + R → `winver`)
     - OpenWhispr version (Help → About)
     - Debug log contents
     - Steps to reproduce

3. **System Information**
   Helpful to include:
   - Python version: `python --version`
   - FFmpeg installed: `ffmpeg -version`
   - Microphone working: Test in Voice Recorder
   - Other dictation apps working: Try Windows built-in dictation

## Registry Cleanup (Advanced)

If you want to completely uninstall and start fresh:

```batch
# Uninstall OpenWhispr first, then:
rd /s /q "%APPDATA%\OpenWhispr"
rd /s /q "%LOCALAPPDATA%\OpenWhispr"
```

Then reinstall.

## Success Indicators

OpenWhispr is working correctly when:
- ✓ Microphone indicator shows activity when speaking
- ✓ Recording stops cleanly when hotkey pressed
- ✓ Transcribed text appears within 5-10 seconds
- ✓ Text is pasted into active application
- ✓ No error messages appear

## Notes for IT Administrators

If deploying OpenWhispr in enterprise environment:

1. **Python Installation**
   - Deploy Python 3.11+ system-wide
   - Add to system PATH
   - Install for all users

2. **FFmpeg**
   - Include in application deployment
   - Whitelist in antivirus
   - Ensure ASAR unpacking works

3. **Permissions**
   - Microphone access required
   - Internet access for Cloud mode
   - File write access to %APPDATA%
   - Registry read access for Python detection

4. **Group Policy**
   - Allow microphone access
   - Don't block Python/FFmpeg executables
   - Allow network access if using Cloud mode
