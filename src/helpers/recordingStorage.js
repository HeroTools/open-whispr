const fs = require("fs");
const path = require("path");
const { app, dialog, shell } = require("electron");
const debugLogger = require("./debugLogger");
const { getSafeTempDir } = require("./safeTempDir");
const { convertToWav, getFFmpegPath } = require("./ffmpegUtils");

const MIN_DISK_SPACE_BYTES = 500 * 1024 * 1024; // 500 MB

class RecordingStorageManager {
  constructor() {
    this.defaultDir = null;
    this.configCache = null;
  }

  /**
   * Returns the default recording directory inside the app's userData folder.
   * Creates it if it doesn't exist.
   */
  getDefaultDirectory() {
    if (this.defaultDir) return this.defaultDir;

    const dir = path.join(app.getPath("userData"), "recordings");
    try {
      fs.mkdirSync(dir, { recursive: true });
      this.defaultDir = dir;
    } catch {
      // Fallback to safe temp dir
      this.defaultDir = path.join(getSafeTempDir(), "openwhispr-recordings");
      try {
        fs.mkdirSync(this.defaultDir, { recursive: true });
      } catch {
        // Last resort: just use safe temp dir itself
        this.defaultDir = getSafeTempDir();
      }
    }
    return this.defaultDir;
  }

  /**
   * Reads the persisted recording config from disk.
   * Settings like the custom directory path are stored here so the main
   * process can access them without localStorage.
   */
  _readConfig() {
    if (this.configCache) return this.configCache;

    const configPath = path.join(app.getPath("userData"), "recording-config.json");
    try {
      if (fs.existsSync(configPath)) {
        this.configCache = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        return this.configCache;
      }
    } catch {
      // ignore corrupt config
    }
    return {};
  }

  _writeConfig(config) {
    const configPath = path.join(app.getPath("userData"), "recording-config.json");
    try {
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      this.configCache = config;
      return true;
    } catch (error) {
      debugLogger.error("Failed to save recording config", { error: error.message });
      return false;
    }
  }

  /**
   * Returns the currently configured recording directory.
   * Falls back to the default if none is set or the custom path is invalid.
   */
  getConfiguredDirectory() {
    const config = this._readConfig();
    if (config.directory) {
      try {
        if (fs.existsSync(config.directory)) {
          return config.directory;
        }
        // Try to create it
        fs.mkdirSync(config.directory, { recursive: true });
        return config.directory;
      } catch {
        debugLogger.warn("Configured recording directory not accessible, using default", {
          configured: config.directory,
        });
      }
    }
    return this.getDefaultDirectory();
  }

  /**
   * Persist a custom directory choice. Pass null/empty to reset to default.
   */
  setDirectory(directory) {
    const config = this._readConfig();
    if (directory) {
      config.directory = directory;
    } else {
      delete config.directory;
    }
    this.configCache = null; // bust cache
    return this._writeConfig(config);
  }

  /**
   * Validates a directory: checks existence, write access, and available space.
   * Returns { valid, error, availableSpaceMB }.
   */
  async validateDirectory(dirPath) {
    const result = { valid: false, error: null, availableSpaceMB: 0, availableSpaceBytes: 0 };

    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      // Test write access
      const testFile = path.join(dirPath, `.openwhispr-write-test-${Date.now()}`);
      fs.writeFileSync(testFile, "test");
      fs.unlinkSync(testFile);

      // Check available space
      const stats = fs.statfsSync(dirPath);
      const available = stats.bavail * stats.bsize;
      result.availableSpaceBytes = available;
      result.availableSpaceMB = Math.round(available / (1024 * 1024));
      result.valid = true;
    } catch (error) {
      result.error = error.message;
    }

    return result;
  }

  /**
   * Check available disk space at the configured recording directory.
   * Returns { availableSpaceMB, sufficient }.
   */
  async checkDiskSpace(dirPath) {
    try {
      const dir = dirPath || this.getConfiguredDirectory();
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const stats = fs.statfsSync(dir);
      const available = stats.bavail * stats.bsize;
      return {
        availableSpaceBytes: available,
        availableSpaceMB: Math.round(available / (1024 * 1024)),
        sufficient: available >= MIN_DISK_SPACE_BYTES,
        minimumMB: Math.round(MIN_DISK_SPACE_BYTES / (1024 * 1024)),
      };
    } catch (error) {
      debugLogger.error("Disk space check failed", { error: error.message });
      // Don't block recording on check failure
      return { availableSpaceBytes: 0, availableSpaceMB: 0, sufficient: true, minimumMB: 500 };
    }
  }

  /**
   * Opens a native folder-picker dialog. Returns the selected path or null.
   */
  async selectDirectory(parentWindow) {
    const options = {
      properties: ["openDirectory", "createDirectory"],
      title: "Select Recording Storage Directory",
    };

    const result = parentWindow
      ? await dialog.showOpenDialog(parentWindow, options)
      : await dialog.showOpenDialog(options);

    if (result.canceled || !result.filePaths[0]) {
      return null;
    }

    return result.filePaths[0];
  }

  /**
   * Open the recording directory in the OS file manager.
   */
  openDirectory(dirPath) {
    const dir = dirPath || this.getConfiguredDirectory();
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      shell.openPath(dir);
      return true;
    } catch (error) {
      debugLogger.error("Failed to open recording directory", { error: error.message });
      return false;
    }
  }

  /**
   * Save an audio buffer as a Whisper-compatible WAV file (16 kHz, mono, PCM16).
   *
   * @param {ArrayBuffer|Buffer} audioBuffer - Raw audio data (typically webm from MediaRecorder)
   * @param {object} options
   * @param {string}  [options.mimeType='audio/webm'] - MIME type of the input audio
   * @param {number}  [options.timestamp]  - Recording start timestamp (for filename)
   * @param {number}  [options.partIndex]  - Chunk part number (for split recordings)
   * @returns {Promise<{success: boolean, path?: string, filename?: string, size?: number, error?: string}>}
   */
  async saveRecording(audioBuffer, options = {}) {
    const { mimeType = "audio/webm", timestamp, partIndex } = options;
    const dir = this.getConfiguredDirectory();

    const dateStr = timestamp
      ? new Date(timestamp).toISOString().replace(/[:.]/g, "-").slice(0, 19)
      : new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

    const suffix = partIndex !== undefined ? `_part${partIndex + 1}` : "";
    const wavFilename = `recording-${dateStr}${suffix}.wav`;
    const wavPath = path.join(dir, wavFilename);

    // Determine temp input extension from mime type
    const ext = mimeType.includes("ogg")
      ? "ogg"
      : mimeType.includes("mp4")
        ? "mp4"
        : mimeType.includes("wav")
          ? "wav"
          : "webm";

    const tempDir = getSafeTempDir();
    const tempInputPath = path.join(tempDir, `rec-save-${Date.now()}.${ext}`);

    try {
      const buffer = Buffer.from(audioBuffer);
      fs.writeFileSync(tempInputPath, buffer);

      // If input is already WAV at 16 kHz mono we could skip conversion,
      // but it's safer to always normalise through ffmpeg.
      const ffmpegPath = getFFmpegPath();
      if (!ffmpegPath) {
        // No ffmpeg — save the raw audio as-is (still useful, just not WAV)
        const rawFilename = `recording-${dateStr}${suffix}.${ext}`;
        const rawPath = path.join(dir, rawFilename);
        fs.copyFileSync(tempInputPath, rawPath);
        const stats = fs.statSync(rawPath);
        debugLogger.warn("FFmpeg unavailable — saved raw audio instead of WAV", {
          path: rawPath,
        });
        return { success: true, path: rawPath, filename: rawFilename, size: stats.size };
      }

      await convertToWav(tempInputPath, wavPath, { sampleRate: 16000, channels: 1 });

      const stats = fs.statSync(wavPath);
      debugLogger.debug("Recording saved as WAV", {
        path: wavPath,
        size: stats.size,
        filename: wavFilename,
      });

      return { success: true, path: wavPath, filename: wavFilename, size: stats.size };
    } catch (error) {
      debugLogger.error("Failed to save recording", { error: error.message });
      return { success: false, error: error.message };
    } finally {
      try {
        if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
      } catch {
        // ignore cleanup errors
      }
    }
  }

  /**
   * Append a raw audio chunk to an in-progress recording file on disk.
   * Used for incremental flushing during long recordings.
   *
   * @param {ArrayBuffer|Buffer} chunkBuffer
   * @param {string} sessionFile - Absolute path to the accumulating file
   * @returns {{ success: boolean, size?: number, error?: string }}
   */
  appendChunk(chunkBuffer, sessionFile) {
    try {
      const buffer = Buffer.from(chunkBuffer);
      fs.appendFileSync(sessionFile, buffer);
      const stats = fs.statSync(sessionFile);
      return { success: true, size: stats.size };
    } catch (error) {
      debugLogger.error("Failed to append recording chunk", { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Create a new session file for incremental chunk flushing.
   * Returns the absolute path of the new file.
   */
  createSessionFile(mimeType = "audio/webm") {
    const ext = mimeType.includes("ogg")
      ? "ogg"
      : mimeType.includes("mp4")
        ? "mp4"
        : "webm";
    const tempDir = getSafeTempDir();
    const filename = `openwhispr-session-${Date.now()}.${ext}`;
    const filePath = path.join(tempDir, filename);
    // Create empty file
    fs.writeFileSync(filePath, Buffer.alloc(0));
    return filePath;
  }

  /**
   * Finalize a session file: convert to WAV and move to the recordings directory.
   * Cleans up the session file afterwards.
   *
   * @param {string} sessionFile - Path to the accumulated raw audio file
   * @param {object} options
   * @param {number} [options.timestamp]
   * @param {number} [options.partIndex]
   * @returns {Promise<{success: boolean, path?: string, error?: string}>}
   */
  async finalizeSessionFile(sessionFile, options = {}) {
    try {
      if (!fs.existsSync(sessionFile)) {
        return { success: false, error: "Session file not found" };
      }
      const audioBuffer = fs.readFileSync(sessionFile);
      if (audioBuffer.length === 0) {
        return { success: false, error: "Session file is empty" };
      }

      const ext = path.extname(sessionFile).slice(1);
      const mimeMap = { webm: "audio/webm", ogg: "audio/ogg", mp4: "audio/mp4" };
      const mimeType = mimeMap[ext] || "audio/webm";

      const result = await this.saveRecording(audioBuffer, { ...options, mimeType });

      // Clean up session file
      try {
        fs.unlinkSync(sessionFile);
      } catch {
        // ignore
      }

      return result;
    } catch (error) {
      debugLogger.error("Failed to finalize session file", { error: error.message });
      return { success: false, error: error.message };
    }
  }
}

module.exports = RecordingStorageManager;
