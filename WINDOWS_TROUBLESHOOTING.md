# Windows Troubleshooting

## Quick Fixes

### No Window Appears

**Symptoms:** OpenWhispr runs in Task Manager but no window shows

**Solutions:**
1. Check system tray (click ^ caret) for OpenWhispr icon
2. Run with debug: `OpenWhispr.exe --log-level=debug`
3. Try disabling GPU: `OpenWhispr.exe --disable-gpu`

### No Transcriptions

**Symptoms:** Recording works but no text appears

**Solutions:**
1. Check microphone permissions: Settings → Privacy → Microphone
2. Verify mic is selected: Sound settings → Input
3. Test recording in Windows Voice Recorder first

### Python Not Found

**Symptoms:** "spawn python ENOENT" error

**Solutions:**
1. Use OpenWhispr's built-in Python installer (Control Panel → Settings)
2. Or install Python 3.11+ from [python.org](https://python.org) with "Add to PATH" checked
3. Verify: `python --version` in Command Prompt
4. Set custom path: `setx OPENWHISPR_PYTHON "C:\Path\To\python.exe"`

### FFmpeg Issues

**Symptoms:** Transcription fails silently

**Solutions:**
1. Reinstall OpenWhispr (FFmpeg is bundled)
2. Check antivirus isn't quarantining FFmpeg
3. Install system FFmpeg and add to PATH if needed

## Debug Mode

```batch
# Run with debug logging
OpenWhispr.exe --log-level=debug

# Or set in .env file at %APPDATA%\OpenWhispr\.env
OPENWHISPR_LOG_LEVEL=debug
```

Logs saved to: `%APPDATA%\OpenWhispr\logs\`

## Common Errors

| Error | Meaning | Fix |
|-------|---------|-----|
| Audio buffer empty | Mic not capturing | Check permissions, try different mic |
| Python version check failed | Python not responding | Reinstall Python, check PATH |
| FFmpeg not found | Can't find FFmpeg | Reinstall app, check antivirus |
| Whisper installation failed | Can't install Whisper | Check Python, internet; try cloud mode |

## Windows-Specific Tips

### Windows Defender
Add OpenWhispr to exclusions if blocked:
Settings → Virus & threat protection → Exclusions

### Firewall (Cloud Mode)
Allow OpenWhispr through firewall for cloud transcription

### Permission Errors
Right-click → Run as administrator (or set in Properties → Compatibility)

## Complete Reset

```batch
# Uninstall OpenWhispr first, then:
rd /s /q "%APPDATA%\OpenWhispr"
rd /s /q "%LOCALAPPDATA%\OpenWhispr"
```

Then reinstall.

## Getting Help

Report issues at https://github.com/HeroTools/open-whispr/issues with:
- Windows version (`winver`)
- OpenWhispr version
- Debug log contents
- Steps to reproduce
