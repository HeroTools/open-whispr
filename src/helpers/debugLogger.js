const fs = require("fs");
const path = require("path");
const { app } = require("electron");

class DebugLogger {
  constructor() {
    // Only enable debug mode when explicitly requested
    this.debugMode =
      process.env.OPENWISPR_DEBUG === "true" ||
      process.argv.includes("--debug") ||
      this.checkDebugFile();
    this.logFile = null;
    this.logStream = null;

    if (this.debugMode) {
      // Create logs directory
      const logsDir = path.join(app.getPath("userData"), "logs");
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      // Create log file with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      this.logFile = path.join(logsDir, `debug-${timestamp}.log`);

      // Create write stream for better performance
      this.logStream = fs.createWriteStream(this.logFile, { flags: "a" });

      this.log("🚀 Debug logging enabled", `Log file: ${this.logFile}`);
      this.log("System Info:", {
        platform: process.platform,
        nodeVersion: process.version,
        electronVersion: process.versions.electron,
        appPath: app.getAppPath(),
        userDataPath: app.getPath("userData"),
        resourcesPath: process.resourcesPath,
        environment: process.env.NODE_ENV,
      });
    }
  }

  log(...args) {
    if (!this.debugMode) return;

    const timestamp = new Date().toISOString();
    const message = args
      .map((arg) =>
        typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
      )
      .join(" ");

    const logLine = `[${timestamp}] ${message}\n`;

    console.log(...args);

    if (this.logStream) {
      this.logStream.write(logLine);
    }
  }

  logReasoning(stage, details) {
    if (!this.debugMode) return;

    const reasoningInfo = {
      stage,
      timestamp: new Date().toISOString(),
      ...details,
    };

    // Special formatting for reasoning logs to make them stand out
    console.log(`\n🤖 === REASONING ${stage.toUpperCase()} ===`);
    console.log(reasoningInfo);
    console.log(`================================\n`);

    this.log(`🤖 Reasoning Pipeline - ${stage}`, reasoningInfo);
  }

  error(...args) {
    if (!this.debugMode) return;

    const timestamp = new Date().toISOString();
    const message =
      "❌ ERROR: " +
      args
        .map((arg) =>
          typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
        )
        .join(" ");

    const logLine = `[${timestamp}] ${message}\n`;

    console.error(...args);

    if (this.logStream) {
      this.logStream.write(logLine);
    }
  }

  logFFmpegDebug(context, ffmpegPath, additionalInfo = {}) {
    if (!this.debugMode) return;

    const debugInfo = {
      context,
      ffmpegPath,
      exists: ffmpegPath ? fs.existsSync(ffmpegPath) : false,
      platform: process.platform,
      ...additionalInfo,
    };

    if (ffmpegPath && fs.existsSync(ffmpegPath)) {
      try {
        const stats = fs.statSync(ffmpegPath);
        debugInfo.fileInfo = {
          size: stats.size,
          isFile: stats.isFile(),
          // Skip X_OK check on Windows (not reliable)
          isExecutable: process.platform !== "win32" ? !!(stats.mode & fs.constants.X_OK) : "N/A (Windows)",
          permissions: stats.mode.toString(8),
          modified: stats.mtime,
        };
      } catch (e) {
        debugInfo.statError = e.message;
      }
    }

    // Check parent directory permissions
    if (ffmpegPath) {
      const dir = path.dirname(ffmpegPath);
      try {
        fs.accessSync(dir, fs.constants.R_OK);
        debugInfo.dirReadable = true;
      } catch (e) {
        debugInfo.dirReadable = false;
        debugInfo.dirError = e.message;
      }
    }

    // Platform-specific path checks
    let possiblePaths = [];
    if (process.platform === "win32") {
      possiblePaths = [
        ffmpegPath,
        ffmpegPath?.replace(/app\.asar([/\\])/, 'app.asar.unpacked$1'),
        path.join(process.resourcesPath || "", "app.asar.unpacked", "node_modules", "ffmpeg-static", "ffmpeg.exe"),
        path.join(process.env.ProgramFiles || "C:\\Program Files", "ffmpeg", "bin", "ffmpeg.exe"),
        "C:\\ffmpeg\\bin\\ffmpeg.exe",
      ].filter(Boolean);
    } else {
      possiblePaths = [
        ffmpegPath,
        ffmpegPath?.replace("app.asar", "app.asar.unpacked"),
        path.join(process.resourcesPath || "", "app.asar.unpacked", "node_modules", "ffmpeg-static", "ffmpeg"),
        "/usr/local/bin/ffmpeg",
        "/opt/homebrew/bin/ffmpeg",
        "/usr/bin/ffmpeg",
      ].filter(Boolean);
    }

    debugInfo.pathChecks = possiblePaths.map((p) => ({
      path: p,
      exists: fs.existsSync(p),
      normalized: path.normalize(p),
    }));

    this.log(`🎬 FFmpeg Debug - ${context}`, debugInfo);
  }

  logWindowsPythonSearch(context, details) {
    if (!this.debugMode || process.platform !== "win32") return;

    this.log(`🐍 Windows Python Search - ${context}`, {
      ...details,
      platform: process.platform,
      PATH: process.env.PATH?.substring(0, 300) + "...",
      LOCALAPPDATA: process.env.LOCALAPPDATA,
      ProgramFiles: process.env.ProgramFiles,
    });
  }

  logAudioData(context, audioBlob) {
    if (!this.debugMode) return;

    const audioInfo = {
      context,
      type: audioBlob?.type || "unknown",
      size: audioBlob?.size || 0,
      constructor: audioBlob?.constructor?.name || "unknown",
    };

    if (audioBlob instanceof ArrayBuffer) {
      audioInfo.byteLength = audioBlob.byteLength;
      // Check first few bytes
      const view = new Uint8Array(
        audioBlob,
        0,
        Math.min(16, audioBlob.byteLength)
      );
      audioInfo.firstBytes = Array.from(view)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(" ");
    } else if (audioBlob instanceof Uint8Array) {
      audioInfo.byteLength = audioBlob.byteLength;
      const view = audioBlob.slice(0, Math.min(16, audioBlob.byteLength));
      audioInfo.firstBytes = Array.from(view)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(" ");
    }

    this.log("🔊 Audio Data Debug", audioInfo);
  }

  logProcessStart(command, args, options = {}) {
    if (!this.debugMode) return;

    this.log("🚀 Starting process", {
      command,
      args,
      cwd: options.cwd || process.cwd(),
      env: {
        FFMPEG_PATH: options.env?.FFMPEG_PATH,
        FFMPEG_EXECUTABLE: options.env?.FFMPEG_EXECUTABLE,
        FFMPEG_BINARY: options.env?.FFMPEG_BINARY,
        PATH_preview: options.env?.PATH?.substring(0, 200) + "...",
      },
    });
  }

  logProcessOutput(processName, type, data) {
    if (!this.debugMode) return;

    const output = data.toString().trim();
    if (output) {
      this.log(`📝 ${processName} ${type}:`, output);
    }
  }

  logWhisperPipeline(stage, details) {
    if (!this.debugMode) return;

    this.log(`🎙️ Whisper Pipeline - ${stage}`, details);
  }

  getLogPath() {
    return this.logFile;
  }

  isEnabled() {
    return this.debugMode;
  }

  close() {
    if (this.logStream) {
      this.log("📝 Debug logger closing");
      this.logStream.end();
      this.logStream = null;
    }
  }

  checkDebugFile() {
    try {
      const debugFilePath = path.join(app.getPath("userData"), "ENABLE_DEBUG");
      return fs.existsSync(debugFilePath);
    } catch (e) {
      return false;
    }
  }
}

// Singleton instance
const debugLogger = new DebugLogger();

module.exports = debugLogger;
