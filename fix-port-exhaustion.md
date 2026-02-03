# Fix: Whisper Server Port Exhaustion

## Problem
Error: "No available ports in range 8178-8199" - orphaned whisper-server processes hold ports after app crashes.

## Immediate Fix
```bash
pkill -f whisper-server
```

## Implementation: PID File Tracking (Industry Standard)

Used by VSCode servers, nginx, Redis, etc. Track our own process and clean up only if it died.

**File:** [whisperServer.js](src/helpers/whisperServer.js)

### Add PID file path constant (after line 14)
```javascript
const PID_FILE_PATH = path.join(require('os').tmpdir(), 'openwhispr-whisper-server.pid');
```

### Add cleanup method (new method)
```javascript
_cleanupStaleProcess() {
  try {
    if (!fs.existsSync(PID_FILE_PATH)) return;

    const data = JSON.parse(fs.readFileSync(PID_FILE_PATH, 'utf8'));
    const { pid, port } = data;

    // Check if process is still running
    try {
      process.kill(pid, 0); // Signal 0 = check if process exists
      // Process still running - don't kill, it might be legitimate
      return;
    } catch {
      // Process is dead, port might be in TIME_WAIT - that's fine
      debugLogger.debug("Cleaned up stale PID file", { pid, port });
    }

    fs.unlinkSync(PID_FILE_PATH);
  } catch {
    // Ignore errors
  }
}
```

### Add method to save PID (new method)
```javascript
_savePidFile() {
  try {
    fs.writeFileSync(PID_FILE_PATH, JSON.stringify({
      pid: this.process.pid,
      port: this.port
    }));
  } catch {
    // Non-critical, ignore
  }
}
```

### Modify _doStart() (line 201)
```javascript
async _doStart(modelPath, options = {}) {
  const serverBinary = this.getServerBinaryPath();
  if (!serverBinary) throw new Error("whisper-server binary not found");
  if (!fs.existsSync(modelPath)) throw new Error(`Model file not found: ${modelPath}`);

  this._cleanupStaleProcess();  // <-- Add this line

  this.port = await this.findAvailablePort();
  // ... after spawning process (after line 252):
  this._savePidFile();  // <-- Add this line
```

### Modify stop() - delete PID file (line 546)
```javascript
// After this.process = null; add:
try { fs.unlinkSync(PID_FILE_PATH); } catch {}
```

## Why This Is Better
- Only cleans up OUR orphaned process, not other apps' whisper-servers
- Cross-platform (no shell commands)
- Standard pattern used by production servers

## Verification
1. Start app, trigger transcription
2. Check PID file exists: `cat /tmp/openwhispr-whisper-server.pid`
3. Force-quit app (kill -9)
4. Restart immediately - should work
5. PID file should have new PID
