# OpenWhispr Complete Cleanup Instructions

## The Problem

If you've installed both the **production DMG** and tried to run **development mode**, they share the same data directories, which can cause conflicts:

- Same database files
- Same settings/localStorage
- Same `.env` configuration
- Same Whisper models cache
- Same system preferences

This can lead to issues like:
- Microphone not working in dev but working in production
- Settings not persisting correctly
- Database conflicts
- Mixed configurations

## Quick Solution: Use the Cleanup Script

### Step 1: Run the automated cleanup script

```bash
cd /path/to/open-whispr
bash scripts/complete-uninstall.sh
```

This script will:
- Stop all OpenWhispr processes
- Remove the production app
- Delete all application data
- Clear caches and logs
- Optionally remove Whisper models
- Clean up temp files

### Step 2: Start fresh

**For Production:**
```bash
# Download fresh DMG from releases
# Install and run normally
```

**For Development:**
```bash
# Make sure you have ARM64 Node.js
node -p "process.arch"  # Should output: arm64

# Clean install
rm -rf node_modules package-lock.json
npm install

# Run dev
npm run dev
```

---

## Manual Cleanup (if script doesn't work)

### 1. Stop all OpenWhispr processes

```bash
# Kill production app
pkill -f "OpenWhispr"

# Kill dev processes
pkill -f "open-whispr"
pkill -f "electron"
```

### 2. Remove the Application

```bash
rm -rf /Applications/OpenWhispr.app
```

### 3. Remove Application Data

**Application Support** (contains databases, settings, logs):
```bash
rm -rf "$HOME/Library/Application Support/OpenWhispr"
rm -rf "$HOME/Library/Application Support/open-whispr"
```

**Preferences** (system-level settings):
```bash
rm -rf "$HOME/Library/Preferences/com.openwhispr.app.plist"
rm -rf "$HOME/Library/Preferences/com.electron.openwhispr.plist"
```

**Caches**:
```bash
rm -rf "$HOME/Library/Caches/OpenWhispr"
rm -rf "$HOME/Library/Caches/open-whispr"
```

**Logs**:
```bash
rm -rf "$HOME/Library/Logs/OpenWhispr"
rm -rf "$HOME/Library/Logs/open-whispr"
```

**Saved Application State**:
```bash
rm -rf "$HOME/Library/Saved Application State/com.openwhispr.app.savedState"
```

### 4. Remove Whisper Models (optional, ~2-3GB)

```bash
rm -rf "$HOME/.cache/whisper"
rm -rf "$HOME/.cache/huggingface"
```

### 5. Remove Temp Files

```bash
find /tmp -name "whisper_audio_*" -delete
find /tmp -name "openwhispr_*" -delete
```

### 6. Clean Development Environment

If you're setting up for development:

```bash
cd /path/to/open-whispr

# Remove dev database and env file
rm -f .env
rm -rf node_modules
rm -f package-lock.json

# Clear npm cache
npm cache clean --force
```

### 7. Reset macOS System Permissions (Optional)

The cleanup script **cannot** remove macOS system permissions. These persist even after uninstalling.

**This is usually fine** - permissions will automatically apply to a fresh install.

**To completely reset permissions** (rarely needed):

```bash
# Reset microphone permission
tccutil reset Microphone com.openwhispr.app

# Reset accessibility permission
tccutil reset Accessibility com.openwhispr.app

# For dev mode (Terminal)
tccutil reset Microphone com.apple.Terminal
tccutil reset Accessibility com.apple.Terminal
```

After running these commands, macOS will prompt for permissions again when you run the app.

**When to reset permissions:**
- Microphone not working after reinstall
- "Permission denied" errors even though you granted access
- Troubleshooting strange permission issues

**Note:** You cannot manually remove apps from System Settings → Privacy lists. They only disappear when the app is uninstalled, but the permission record persists in the TCC database.

---

## Complete Fresh Start for Development

After cleanup, follow these steps for a clean dev environment:

### 1. Verify ARM64 Node.js (Apple Silicon Macs)

```bash
# Check architecture
node -p "process.arch"  # Must show: arm64

# If it shows x64, install ARM64 Node:
# Option A: Using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install --lts
nvm use --lts

# Option B: Download from nodejs.org
# Get macOS ARM64 installer from https://nodejs.org/
```

### 2. Clean Install Dependencies

```bash
cd /path/to/open-whispr

# Remove everything
rm -rf node_modules package-lock.json

# Fresh install
npm install

# Verify better-sqlite3 architecture
file node_modules/better-sqlite3/build/Release/better_sqlite3.node
# Should show: Mach-O 64-bit bundle arm64
```

### 3. Setup Environment

```bash
# Create fresh .env file
touch .env

# Add your API keys
echo "OPENAI_API_KEY=your_key_here" >> .env
```

### 4. Run Development Mode

```bash
npm run dev
```

---

## Troubleshooting

### Issue: "better-sqlite3 architecture mismatch"

**Solution:**
```bash
# Your Node is running in x64 mode via Rosetta
# Follow "Verify ARM64 Node.js" section above
```

### Issue: "Microphone prints 'you' instead of transcription"

**Solution:**
```bash
# Corrupted database or settings - run cleanup script
bash scripts/complete-uninstall.sh

# Then reinstall/re-run
```

### Issue: "Database initialization failed"

**Solution:**
```bash
# Remove database files specifically
rm -rf "$HOME/Library/Application Support/OpenWhispr"
rm -rf "$HOME/Library/Application Support/open-whispr"

# Rebuild dependencies
npm run postinstall
```

### Issue: Production DMG works but dev doesn't

**Cause:** They're sharing data directories but using different configurations.

**Solution:**
1. Run complete cleanup script
2. Choose either production OR development (don't mix)
3. If developing, uninstall production app first

---

## Data Locations Reference

All OpenWhispr data is stored in these locations:

| Type | Location |
|------|----------|
| **Databases** | `~/Library/Application Support/OpenWhispr/transcriptions.db` |
| **Dev Database** | `~/Library/Application Support/OpenWhispr/transcriptions-dev.db` |
| **Settings** | Browser localStorage (in Electron's userData) |
| **API Keys** | `.env` file in project root (dev) |
| **Logs** | `~/Library/Application Support/OpenWhispr/logs/` |
| **Debug Logs** | `~/Library/Logs/OpenWhispr/` |
| **Whisper Models** | `~/.cache/whisper/` |
| **Preferences** | `~/Library/Preferences/com.openwhispr.app.plist` |
| **Caches** | `~/Library/Caches/OpenWhispr/` |
| **Temp Audio** | `/tmp/whisper_audio_*.wav` |

---

## Prevention Tips

1. **Don't mix production and development** - Choose one or the other
2. **Use separate branches** - Keep production DMG uninstalled when developing
3. **Check Node architecture** - Always verify `node -p "process.arch"` shows `arm64`
4. **Clean installs** - When switching modes, run cleanup script first
5. **Backup data** - Export important transcriptions before cleanup

---

## Getting Help

If cleanup doesn't solve your issue:

1. Check the architecture: `node -p "process.arch"`
2. Check Node version: `node -v`
3. Check Electron version: `npm list electron`
4. Run with debug mode: `npm run dev -- --debug`
5. Check logs in: `~/Library/Application Support/OpenWhispr/logs/`

Report issues with this information at: [GitHub Issues](https://github.com/your-repo/open-whispr/issues)
