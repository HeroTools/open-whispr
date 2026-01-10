# OpenWhispr Troubleshooting

## Quick Diagnostics

| Check | Command |
| --- | --- |
| Host architecture | `uname -m` |
| Node architecture | `node -p "process.arch"` |
| Native module arch | `file node_modules/better-sqlite3/build/Release/better_sqlite3.node` |
| FFmpeg availability | `ffmpeg -version` or `node -e "console.log(require('ffmpeg-static'))"` |
| Python install | `python3 --version && which python3` |
| Whisper cache size | `du -sh ~/Library/Application\ Support/whisper ~/.cache/whisper 2>/dev/null` |

If any of these look wrong (e.g., `x86_64` binaries on an Apple Silicon host), run `scripts/complete-uninstall.sh`, then reinstall dependencies.

## Common Issues

### 1. Architecture mismatch (arm64 vs x86_64)
**Symptoms:** the renderer crashes on launch, or `better_sqlite3.node` throws “wrong architecture” errors.

**Resolution:**
1. Run the diagnostics above. If `uname -m` reports `arm64` but `node -p "process.arch"` or `file …better_sqlite3.node` shows `x86_64`, Node was installed with Rosetta.
2. Uninstall the mismatched Node build (`brew uninstall node` or remove `/usr/local/bin/node`).
3. Reinstall an ARM build: `arch -arm64 brew install node@20` or download the arm64 pkg from nodejs.org.
4. Remove residual artifacts: run `scripts/complete-uninstall.sh` and allow it to delete caches.
5. Recreate dependencies: `rm -rf node_modules package-lock.json && npm ci`.
6. Rebuild (`npm run dev` or `npm run build`) and confirm onboarding starts normally.

### 2. “you” transcription bug
**Symptoms:** every transcription history entry shows the word “you”, even when you speak full sentences.

**Cause:** Whisper produced an empty/near-empty result and the legacy fallback string (`"you"`) is being saved. This usually happens when:
- the microphone permission was revoked mid-session,
- stale local Whisper caches contain zero-byte clips,
- or a hotkey collision triggers dictation without audio input.

**Resolution:**
1. Confirm microphone + accessibility permissions via macOS Settings, then re-run onboarding step 3 to re-test.
2. Clear SQLite history and caches: `scripts/complete-uninstall.sh` (answer “y” to Whisper model removal) or manually delete the folders listed in `CLEANUP_INSTRUCTIONS.md`.
3. Reinstall Whisper models from the Control Panel or rerun onboarding’s model picker.
4. Try a different dictation hotkey—reserved accelerators are now blocked in step 4 and settings.
5. If you rely on cloud transcription, verify your OpenAI key is valid (link in the UI now opens `https://platform.openai.com`).

### 3. FFmpeg missing
**Symptoms:** Local transcription fails immediately with “FFmpeg not found” or `ffmpeg-static` resolves to `null`.

**Resolution:**
1. Run `ffmpeg -version`. If the command is missing, install via `brew install ffmpeg` (Apple Silicon) or add it to your PATH.
2. Ensure npm dependencies pulled the static binary: `rm -rf node_modules package-lock.json && npm ci`.
3. Execute `npm run setup` so the bridge verifies FFmpeg before launching Electron.
4. If the packaged app still cannot find FFmpeg, run `scripts/complete-uninstall.sh` to clear frozen binaries, then rebuild via `npm run build:mac`.

### 4. Python install issues
**Symptoms:** Local Whisper install fails, or `window.electronAPI.installPython` never completes.

**Resolution:**
1. Verify you have a working Python 3: `python3 --version` and `which python3`. Apple Silicon should point to `/usr/bin/python3` or a Homebrew arm64 path.
2. OpenWhispr creates an isolated virtual environment under your user data directory. If it fails, delete the app’s `python/venv` folder and retry.
3. From the running app, open Settings → Whisper Models and click “Install Python” (uses the IPC bridge) or install Python manually from python.org.
4. If you see a “externally managed environment / PEP 668” error, you are trying to install into system Python. Use the app’s install button or unset `OPENWHISPR_PYTHON`.
5. Delete `~/Library/Application Support/whisper` if partially downloaded models exist, then try again.
6. As a last resort, run `scripts/complete-uninstall.sh`, reboot, and rerun onboarding so the installer can download a clean toolchain.

### 5. Local Whisper can't find Python on Windows
**Symptoms:** The toast shows `Whisper process error: spawn python ENOENT` as soon as transcription starts.

**Resolution:**
1. Update to the latest desktop build—recent releases probe the Windows `py` launcher plus the common `Python312`/`Python311` folders instead of relying on `python.exe` being on PATH.
2. Open `cmd` and run `py --version`. If this command fails, reinstall Python 3.11+ from [python.org](https://www.python.org/downloads/windows/) and keep the “Install launcher” checkbox ticked.
3. If you installed Python to a custom directory, set `OPENWHISPR_PYTHON` to the full path (e.g. `setx OPENWHISPR_PYTHON "D:\\Tools\\Python312\\python.exe"`) and restart the app so the bridge can pick it up.
4. Re-run the Local Whisper onboarding check or use the Control Panel → Whisper Engine card to verify detection succeeds.
5. If you would rather stay on cloud transcription, open the Control Panel, toggle off “Use Local Whisper”, or enable “Allow OpenAI fallback” so the app automatically switches to the API whenever Python is missing.

Need deeper help? Capture the diagnostic command output and attach it to an issue so we can see which stage failed.
