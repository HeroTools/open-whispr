const { spawn } = require("child_process");
const fs = require("fs");
const net = require("net");
const path = require("path");
const http = require("http");
const debugLogger = require("./debugLogger");
const { killProcess } = require("../utils/process");
const { getSafeTempDir } = require("./safeTempDir");

const PORT_RANGE_START = 8200;
const PORT_RANGE_END = 8220;
const STARTUP_TIMEOUT_MS = 60000;
const HEALTH_CHECK_INTERVAL_MS = 5000;
const HEALTH_CHECK_TIMEOUT_MS = 2000;
const STARTUP_POLL_INTERVAL_MS = 500;
const HEALTH_CHECK_FAILURE_THRESHOLD = 3;

class LlamaServerManager {
  constructor() {
    this.process = null;
    this.port = null;
    this.ready = false;
    this.modelPath = null;
    this.startupPromise = null;
    this.healthCheckInterval = null;
    this.healthCheckFailures = 0;
    this.cachedServerBinaryPath = null;
  }

  getServerBinaryPath() {
    if (this.cachedServerBinaryPath) return this.cachedServerBinaryPath;

    const platform = process.platform;
    const arch = process.arch;
    const platformArch = `${platform}-${arch}`;
    const binaryName =
      platform === "win32" ? `llama-server-${platformArch}.exe` : `llama-server-${platformArch}`;
    const genericName = platform === "win32" ? "llama-server.exe" : "llama-server";

    const candidates = [];

    // Production: check resourcesPath
    if (process.resourcesPath) {
      candidates.push(
        path.join(process.resourcesPath, "bin", binaryName),
        path.join(process.resourcesPath, "bin", genericName)
      );
    }

    // Development: check relative to this file
    candidates.push(
      path.join(__dirname, "..", "..", "resources", "bin", binaryName),
      path.join(__dirname, "..", "..", "resources", "bin", genericName)
    );

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        try {
          fs.statSync(candidate);
          this.cachedServerBinaryPath = candidate;
          return candidate;
        } catch {
          // Can't access binary
        }
      }
    }

    return null;
  }

  isAvailable() {
    return this.getServerBinaryPath() !== null;
  }

  async findAvailablePort() {
    for (let port = PORT_RANGE_START; port <= PORT_RANGE_END; port++) {
      if (await this.isPortAvailable(port)) return port;
    }
    throw new Error(`No available ports in range ${PORT_RANGE_START}-${PORT_RANGE_END}`);
  }

  isPortAvailable(port) {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once("error", () => resolve(false));
      server.once("listening", () => {
        server.close();
        resolve(true);
      });
      server.listen(port, "127.0.0.1");
    });
  }

  async start(modelPath, options = {}) {
    if (this.startupPromise) return this.startupPromise;

    // Already running with same model
    if (this.ready && this.modelPath === modelPath) return;

    // Stop existing server if running
    if (this.process) {
      await this.stop();
    }

    this.startupPromise = this._doStart(modelPath, options);
    try {
      await this.startupPromise;
    } finally {
      this.startupPromise = null;
    }
  }

  async _doStart(modelPath, options = {}) {
    const serverBinary = this.getServerBinaryPath();
    if (!serverBinary) throw new Error("llama-server binary not found");
    if (!fs.existsSync(modelPath)) throw new Error(`Model file not found: ${modelPath}`);

    this.port = await this.findAvailablePort();
    this.modelPath = modelPath;

    const args = [
      "--model",
      modelPath,
      "--host",
      "127.0.0.1",
      "--port",
      String(this.port),
      "--ctx-size",
      String(options.contextSize || 4096),
      "--threads",
      String(options.threads || 4),
    ];

    // Add GPU layers if specified
    if (options.gpuLayers) {
      args.push("--n-gpu-layers", String(options.gpuLayers));
    }

    debugLogger.debug("Starting llama-server", { port: this.port, modelPath, args });

    // Set library path for dynamic library loading
    const binDir = path.dirname(serverBinary);
    const env = { ...process.env };

    if (process.platform === "darwin") {
      // macOS: Set DYLD_LIBRARY_PATH to find .dylib files
      env.DYLD_LIBRARY_PATH = binDir + (env.DYLD_LIBRARY_PATH ? `:${env.DYLD_LIBRARY_PATH}` : "");
    } else if (process.platform === "linux") {
      // Linux: Set LD_LIBRARY_PATH to find .so files
      env.LD_LIBRARY_PATH = binDir + (env.LD_LIBRARY_PATH ? `:${env.LD_LIBRARY_PATH}` : "");
    }

    this.process = spawn(serverBinary, args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      cwd: getSafeTempDir(),
      env,
    });

    let stderrBuffer = "";
    let exitCode = null;
    let exitSignal = null;

    this.process.stdout.on("data", (data) => {
      debugLogger.debug("llama-server stdout", { data: data.toString().trim() });
    });

    this.process.stderr.on("data", (data) => {
      stderrBuffer += data.toString();
      debugLogger.debug("llama-server stderr", { data: data.toString().trim() });
    });

    this.process.on("error", (error) => {
      debugLogger.error("llama-server process error", { error: error.message });
      this.ready = false;
    });

    this.process.on("close", (code, signal) => {
      exitCode = code;
      exitSignal = signal;
      debugLogger.debug("llama-server process exited", { code, signal });
      this.ready = false;
      this.process = null;
      this.stopHealthCheck();
    });

    await this.waitForReady(() => ({ stderr: stderrBuffer, exitCode, exitSignal }));
    this.startHealthCheck();

    debugLogger.info("llama-server started successfully", {
      port: this.port,
      model: path.basename(modelPath),
    });
  }

  async waitForReady(getProcessInfo) {
    const startTime = Date.now();
    let pollCount = 0;

    while (Date.now() - startTime < STARTUP_TIMEOUT_MS) {
      if (!this.process || this.process.killed) {
        const info = getProcessInfo ? getProcessInfo() : {};
        const signal = info.exitSignal;
        const diagParts = [];
        if (signal) diagParts.push(`signal: ${signal}`);
        else if (info.exitCode !== null && info.exitCode !== undefined)
          diagParts.push(`exit code: ${info.exitCode}`);
        const oomHint =
          signal === "SIGKILL"
            ? " — the process was killed by the OS, likely due to insufficient memory. Try a smaller/more quantized model, or reduce the context size."
            : "";
        const stderr = info.stderr ? info.stderr.trim().slice(-800) : "";
        const diagStr = diagParts.length ? ` (${diagParts.join(", ")})` : "";
        throw new Error(
          `llama-server process died during startup${diagStr}${oomHint}${stderr ? `\nProcess output: ${stderr}` : ""}`
        );
      }

      pollCount++;
      if (await this.checkHealth()) {
        this.ready = true;
        debugLogger.debug("llama-server ready", {
          startupTimeMs: Date.now() - startTime,
          pollCount,
        });
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, STARTUP_POLL_INTERVAL_MS));
    }

    throw new Error(`llama-server failed to start within ${STARTUP_TIMEOUT_MS}ms`);
  }

  checkHealth() {
    return new Promise((resolve) => {
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: this.port,
          path: "/health",
          method: "GET",
          timeout: HEALTH_CHECK_TIMEOUT_MS,
        },
        (res) => {
          resolve(res.statusCode === 200);
          res.resume();
        }
      );

      req.on("error", () => resolve(false));
      req.on("timeout", () => {
        req.destroy();
        resolve(false);
      });
      req.end();
    });
  }

  startHealthCheck() {
    this.stopHealthCheck();
    this.healthCheckFailures = 0;
    this.healthCheckInterval = setInterval(async () => {
      try {
        if (!this.process) {
          this.stopHealthCheck();
          return;
        }
        if (await this.checkHealth()) {
          this.healthCheckFailures = 0;
        } else {
          this.healthCheckFailures++;
          if (this.healthCheckFailures >= HEALTH_CHECK_FAILURE_THRESHOLD) {
            debugLogger.warn("llama-server health check failed", {
              consecutiveFailures: this.healthCheckFailures,
            });
            this.ready = false;
          }
        }
      } catch (err) {
        debugLogger.error("Health check error", { error: err.message });
      }
    }, HEALTH_CHECK_INTERVAL_MS);
  }

  stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  async inference(messages, options = {}) {
    if (!this.ready || !this.process) {
      throw new Error("llama-server is not running");
    }

    const body = JSON.stringify({
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 512,
      stream: false,
    });

    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: this.port,
          path: "/v1/chat/completions",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body),
          },
          timeout: 300000, // 5 minute timeout for inference
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => {
            data += chunk;
          });
          res.on("end", () => {
            debugLogger.debug("llama-server inference completed", {
              statusCode: res.statusCode,
              elapsed: Date.now() - startTime,
            });

            if (res.statusCode !== 200) {
              reject(new Error(`llama-server returned status ${res.statusCode}: ${data}`));
              return;
            }

            try {
              const response = JSON.parse(data);
              // Extract text from OpenAI-compatible response
              const text = response.choices?.[0]?.message?.content || "";
              resolve(text.trim());
            } catch (e) {
              reject(new Error(`Failed to parse llama-server response: ${e.message}`));
            }
          });
        }
      );

      req.on("error", (error) => {
        reject(new Error(`llama-server request failed: ${error.message}`));
      });
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("llama-server request timed out"));
      });

      req.write(body);
      req.end();
    });
  }

  async stop() {
    this.stopHealthCheck();

    if (!this.process) {
      this.ready = false;
      return;
    }

    debugLogger.debug("Stopping llama-server");

    try {
      killProcess(this.process, "SIGTERM");

      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          if (this.process) {
            killProcess(this.process, "SIGKILL");
          }
          resolve();
        }, 5000);

        if (this.process) {
          this.process.once("close", () => {
            clearTimeout(timeout);
            resolve();
          });
        } else {
          clearTimeout(timeout);
          resolve();
        }
      });
    } catch (error) {
      debugLogger.error("Error stopping llama-server", { error: error.message });
    }

    this.process = null;
    this.ready = false;
    this.port = null;
    this.modelPath = null;
  }

  getStatus() {
    return {
      available: this.isAvailable(),
      running: this.ready && this.process !== null,
      port: this.port,
      modelPath: this.modelPath,
      modelName: this.modelPath ? path.basename(this.modelPath, ".gguf") : null,
    };
  }
}

module.exports = LlamaServerManager;
