/**
 * WindowsKeyManager - Handles key up/down detection for Push-to-Talk on Windows
 *
 * Uses a native Windows keyboard hook to detect when specific keys are
 * pressed and released, enabling Push-to-Talk functionality.
 */

const { spawn } = require("child_process");
const path = require("path");
const EventEmitter = require("events");
const fs = require("fs");

class WindowsKeyManager extends EventEmitter {
  constructor() {
    super();
    this.process = null;
    this.isSupported = process.platform === "win32";
    this.hasReportedError = false;
    this.currentKey = null;
    this.isReady = false;
  }

  /**
   * Start listening for the specified key
   * @param {string} key - The key to listen for (e.g., "`", "F8", "F11")
   */
  start(key = "`") {
    if (!this.isSupported) {
      return;
    }

    // If already running with the same key, do nothing
    if (this.process && this.currentKey === key) {
      return;
    }

    // Stop any existing listener
    this.stop();

    const listenerPath = this.resolveListenerBinary();
    if (!listenerPath) {
      // Binary not found - this is OK, Push-to-Talk will use fallback mode
      this.emit("unavailable", new Error("Windows key listener binary not found"));
      return;
    }

    this.hasReportedError = false;
    this.isReady = false;
    this.currentKey = key;

    console.log(`[WindowsKeyManager] Starting key listener for key: "${key}"`);
    console.log(`[WindowsKeyManager] Binary path: ${listenerPath}`);

    try {
      this.process = spawn(listenerPath, [key], {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch (error) {
      console.error(`[WindowsKeyManager] Failed to spawn process:`, error);
      this.reportError(error);
      return;
    }

    this.process.stdout.setEncoding("utf8");
    this.process.stdout.on("data", (chunk) => {
      // Log raw chunk for debugging
      console.log(`[WindowsKeyManager] RAW STDOUT: "${chunk.replace(/\r/g, '\\r').replace(/\n/g, '\\n')}"`);

      chunk
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach((line) => {
          console.log(`[WindowsKeyManager] Parsed line: "${line}"`);
          if (line === "READY") {
            console.log(`[WindowsKeyManager] Listener READY for key: "${key}"`);
            this.isReady = true;
            this.emit("ready");
          } else if (line === "KEY_DOWN") {
            console.log(`[WindowsKeyManager] KEY_DOWN detected for: "${key}"`);
            this.emit("key-down", key);
          } else if (line === "KEY_UP") {
            console.log(`[WindowsKeyManager] KEY_UP detected for: "${key}"`);
            this.emit("key-up", key);
          } else {
            console.log(`[WindowsKeyManager] Unknown line: "${line}"`);
          }
        });
    });

    this.process.stderr.setEncoding("utf8");
    this.process.stderr.on("data", (data) => {
      const message = data.toString().trim();
      if (message.length > 0) {
        console.error("WindowsKeyManager stderr:", message);
        this.reportError(new Error(message));
      }
    });

    this.process.on("error", (error) => {
      this.reportError(error);
      this.process = null;
    });

    this.process.on("exit", (code, signal) => {
      this.process = null;
      this.isReady = false;
      if (code !== 0) {
        const error = new Error(
          `Windows key listener exited with code ${code ?? "null"} signal ${signal ?? "null"}`
        );
        this.reportError(error);
      }
    });
  }

  /**
   * Stop the key listener
   */
  stop() {
    if (this.process) {
      try {
        this.process.kill();
      } catch {
        // Ignore kill errors
      }
      this.process = null;
    }
    this.isReady = false;
    this.currentKey = null;
  }

  /**
   * Check if the listener is available and ready
   */
  isAvailable() {
    return this.resolveListenerBinary() !== null;
  }

  /**
   * Report an error (only once)
   */
  reportError(error) {
    if (this.hasReportedError) {
      return;
    }
    this.hasReportedError = true;

    if (this.process) {
      try {
        this.process.kill();
      } catch {
        // Ignore
      } finally {
        this.process = null;
      }
    }

    console.error("WindowsKeyManager error:", error);
    this.emit("error", error);
  }

  /**
   * Find the listener binary in various possible locations
   */
  resolveListenerBinary() {
    const binaryName = "windows-key-listener.exe";
    const candidates = new Set([
      path.join(__dirname, "..", "..", "resources", "bin", binaryName),
      path.join(__dirname, "..", "..", "resources", binaryName),
    ]);

    if (process.resourcesPath) {
      [
        path.join(process.resourcesPath, binaryName),
        path.join(process.resourcesPath, "bin", binaryName),
        path.join(process.resourcesPath, "resources", binaryName),
        path.join(process.resourcesPath, "resources", "bin", binaryName),
        path.join(process.resourcesPath, "app.asar.unpacked", "resources", binaryName),
        path.join(process.resourcesPath, "app.asar.unpacked", "resources", "bin", binaryName),
      ].forEach((candidate) => candidates.add(candidate));
    }

    const candidatePaths = [...candidates];

    for (const candidate of candidatePaths) {
      try {
        const stats = fs.statSync(candidate);
        if (stats.isFile()) {
          return candidate;
        }
      } catch {
        continue;
      }
    }

    return null;
  }
}

module.exports = WindowsKeyManager;
