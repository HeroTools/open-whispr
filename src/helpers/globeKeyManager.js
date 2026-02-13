const { spawn } = require("child_process");
const path = require("path");
const EventEmitter = require("events");
const fs = require("fs");

class GlobeKeyManager extends EventEmitter {
  constructor() {
    super();
    this.process = null;
    this.isSupported = process.platform === "darwin";
    this.hasReportedError = false;
  }

  start() {
    if (!this.isSupported || this.process) {
      return;
    }

    const listenerPath = this.resolveListenerBinary();
    if (!listenerPath) {
      this.reportError(
        new Error(
          "macOS Globe listener binary not found. Run `npm run compile:globe` before packaging."
        )
      );
      return;
    }

    try {
      fs.accessSync(listenerPath, fs.constants.X_OK);
    } catch {
      try {
        fs.chmodSync(listenerPath, 0o755);
      } catch {
        this.reportError(
          new Error(`macOS Globe listener is not executable and chmod failed: ${listenerPath}`)
        );
        return;
      }
    }

    this.hasReportedError = false;
    this.process = spawn(listenerPath);

    this.process.stdout.setEncoding("utf8");
    this.process.stdout.on("data", (chunk) => {
      chunk
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach((line) => {
          if (line === "FN_DOWN") {
            this.emit("globe-down");
          } else if (line === "FN_UP") {
            this.emit("globe-up");
          } else if (line.startsWith("RIGHT_MOD_DOWN:")) {
            const modifier = line.replace("RIGHT_MOD_DOWN:", "").trim();
            if (modifier) {
              this.emit("right-modifier-down", modifier);
            }
          } else if (line.startsWith("RIGHT_MOD_UP:")) {
            const modifier = line.replace("RIGHT_MOD_UP:", "").trim();
            if (modifier) {
              this.emit("right-modifier-up", modifier);
            }
          } else if (line.startsWith("MODIFIER_UP:")) {
            const modifier = line.replace("MODIFIER_UP:", "").trim().toLowerCase();
            if (modifier) {
              this.emit("modifier-up", modifier);
            }
          }
        });
    });

    this.process.stderr.setEncoding("utf8");
    this.process.stderr.on("data", (data) => {
      const message = data.toString().trim();
      if (message.length > 0) {
        console.error("GlobeKeyManager stderr:", message);
        this.reportError(new Error(message));
      }
    });

    this.process.on("error", (error) => {
      this.reportError(error);
      this.process = null;
    });

    this.process.on("exit", (code, signal) => {
      this.process = null;
      if (code !== 0 && signal !== "SIGINT" && signal !== "SIGTERM") {
        const error = new Error(
          `Globe key listener exited with code ${code ?? "null"} signal ${signal ?? "null"}`
        );
        this.reportError(error);
      }
    });
  }

  stop() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }

  reportError(error) {
    if (this.hasReportedError) {
      return;
    }
    this.hasReportedError = true;
    if (this.process) {
      try {
        this.process.kill();
      } catch {
        // ignore
      } finally {
        this.process = null;
      }
    }
    console.error("GlobeKeyManager error:", error);
    this.emit("error", error);
  }

  resolveListenerBinary() {
    const candidates = new Set([
      path.join(__dirname, "..", "..", "resources", "bin", "macos-globe-listener"),
      path.join(__dirname, "..", "..", "resources", "macos-globe-listener"),
    ]);

    if (process.resourcesPath) {
      [
        path.join(process.resourcesPath, "macos-globe-listener"),
        path.join(process.resourcesPath, "bin", "macos-globe-listener"),
        path.join(process.resourcesPath, "resources", "macos-globe-listener"),
        path.join(process.resourcesPath, "resources", "bin", "macos-globe-listener"),
        path.join(process.resourcesPath, "app.asar.unpacked", "resources", "macos-globe-listener"),
        path.join(
          process.resourcesPath,
          "app.asar.unpacked",
          "resources",
          "bin",
          "macos-globe-listener"
        ),
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

module.exports = GlobeKeyManager;
