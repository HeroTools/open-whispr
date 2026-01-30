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
const STARTUP_TIMEOUT_MS = 120000; // 2 minutes for GPU initialization (Vulkan/CUDA)
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
    this.gpuPreference = "auto"; // User preference: "auto", "force-cpu", or "force-gpu"
    this.lastGpuPreference = null;
    this.gpuDetectionCache = null; // Cache GPU detection result
    this.gpuDetectionTimestamp = 0;
    this.GPU_DETECTION_CACHE_TTL = 60000; // Cache for 60 seconds
    this.lastLoggedBinaryPath = null; // Track last logged binary to avoid spam
    this.hasLoggedMissingBinary = false; // Track if we already logged missing binary warning
  }

  setGpuPreference(preference) {
    if (this.gpuPreference !== preference) {
      debugLogger.info("GPU preference changed", { from: this.gpuPreference, to: preference });
      this.gpuPreference = preference;
      // Clear cached path to force re-detection
      this.cachedServerBinaryPath = null;
    }
  }

  getGpuStatus() {
    const binaryPath = this.getServerBinaryPath();
    const gpuDetected = this.detectGPU("auto"); // Check actual GPU without user preference
    const usingGpu = binaryPath ? (binaryPath.includes("-vulkan") || binaryPath.includes("-cuda")) : false;

    return {
      preference: this.gpuPreference || "auto",
      gpuAvailable: gpuDetected !== null,
      usingGpu,
      binaryPath: binaryPath || null,
      binaryType: binaryPath?.includes("-vulkan") ? "Vulkan" : binaryPath?.includes("-cuda") ? "CUDA" : "CPU",
    };
  }

  detectGPU(preference = "auto") {
    // Respect user preference
    if (preference === "force-cpu") {
      return null;
    }

    if (preference === "force-gpu") {
      return "vulkan"; // or "cuda" depending on platform
    }

    // Auto-detect: Only check for GPU on Windows and Linux (macOS uses Metal, not needed)
    if (process.platform !== "win32" && process.platform !== "linux") {
      return null;
    }

    // Use cached result if still valid
    const now = Date.now();
    if (this.gpuDetectionCache !== null && now - this.gpuDetectionTimestamp < this.GPU_DETECTION_CACHE_TTL) {
      return this.gpuDetectionCache;
    }

    try {
      const { execSync } = require("child_process");
      // Check if nvidia-smi is available (indicates NVIDIA GPU with drivers)
      execSync("nvidia-smi", { stdio: "ignore", timeout: 3000 });
      // Linux uses Vulkan, Windows can use CUDA
      this.gpuDetectionCache = process.platform === "linux" ? "vulkan" : "cuda";
      this.gpuDetectionTimestamp = now;
      debugLogger.info(`NVIDIA GPU detected via nvidia-smi (using ${this.gpuDetectionCache})`);
      return this.gpuDetectionCache;
    } catch {
      this.gpuDetectionCache = null;
      this.gpuDetectionTimestamp = now;
      debugLogger.debug("No NVIDIA GPU detected (nvidia-smi not found or failed)");
      return null;
    }
  }

  getServerBinaryPath() {
    const gpuPreference = this.gpuPreference || "auto";

    // Clear cache if preference changed
    if (this.cachedServerBinaryPath && this.lastGpuPreference !== gpuPreference) {
      this.cachedServerBinaryPath = null;
    }
    this.lastGpuPreference = gpuPreference;

    if (this.cachedServerBinaryPath) return this.cachedServerBinaryPath;

    const platform = process.platform;
    const arch = process.arch;
    const platformArch = `${platform}-${arch}`;

    // Detect GPU and prefer GPU binary if available
    const gpuVariant = this.detectGPU(gpuPreference);

    const candidates = [];

    // Build binary name candidates in priority order
    if (process.resourcesPath) {
      // Production paths
      if (gpuVariant === "vulkan") {
        // Try Vulkan binary first (Linux)
        const vulkanBinaryName = `llama-server-${platformArch}-vulkan`;
        candidates.push(path.join(process.resourcesPath, "bin", vulkanBinaryName));
      } else if (gpuVariant === "cuda") {
        // Try CUDA binaries first (Windows)
        const cudaBinaryName = platform === "win32"
          ? `llama-server-${platformArch}-cuda.exe`
          : `llama-server-${platformArch}-cuda`;
        candidates.push(path.join(process.resourcesPath, "bin", cudaBinaryName));
      }

      // Fallback to CPU binary
      const cpuBinaryName = platform === "win32"
        ? `llama-server-${platformArch}-cpu.exe`
        : `llama-server-${platformArch}-cpu`;
      candidates.push(path.join(process.resourcesPath, "bin", cpuBinaryName));

      // Legacy names (for backwards compatibility)
      const binaryName = platform === "win32"
        ? `llama-server-${platformArch}.exe`
        : `llama-server-${platformArch}`;
      const genericName = platform === "win32" ? "llama-server.exe" : "llama-server";
      candidates.push(
        path.join(process.resourcesPath, "bin", binaryName),
        path.join(process.resourcesPath, "bin", genericName)
      );
    }

    // Development paths
    if (gpuVariant === "vulkan") {
      const vulkanBinaryName = `llama-server-${platformArch}-vulkan`;
      candidates.push(path.join(__dirname, "..", "..", "resources", "bin", vulkanBinaryName));
    } else if (gpuVariant === "cuda") {
      const cudaBinaryName = platform === "win32"
        ? `llama-server-${platformArch}-cuda.exe`
        : `llama-server-${platformArch}-cuda`;
      candidates.push(path.join(__dirname, "..", "..", "resources", "bin", cudaBinaryName));
    }

    const cpuBinaryName = platform === "win32"
      ? `llama-server-${platformArch}-cpu.exe`
      : `llama-server-${platformArch}-cpu`;
    candidates.push(path.join(__dirname, "..", "..", "resources", "bin", cpuBinaryName));

    // Legacy names
    const binaryName = platform === "win32"
      ? `llama-server-${platformArch}.exe`
      : `llama-server-${platformArch}`;
    const genericName = platform === "win32" ? "llama-server.exe" : "llama-server";
    candidates.push(
      path.join(__dirname, "..", "..", "resources", "bin", binaryName),
      path.join(__dirname, "..", "..", "resources", "bin", genericName)
    );

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        try {
          fs.statSync(candidate);
          this.cachedServerBinaryPath = candidate;
          const variant = candidate.includes("-vulkan") ? "Vulkan" : candidate.includes("-cuda") ? "CUDA" : "CPU";
          // Only log once when binary is first found, not on every cache hit
          if (!this.lastLoggedBinaryPath || this.lastLoggedBinaryPath !== candidate) {
            debugLogger.info(`Using llama-server binary: ${variant}`, { path: candidate });
            this.lastLoggedBinaryPath = candidate;
          }
          return candidate;
        } catch {
          // Can't access binary
        }
      }
    }

    // Only log warning once
    if (!this.hasLoggedMissingBinary) {
      debugLogger.warn("No llama-server binary found", { checkedPaths: candidates });
      this.hasLoggedMissingBinary = true;
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

    // Add GPU layers if using GPU binary (auto-detect or user-specified)
    const isGpuBinary = serverBinary.includes("-vulkan") || serverBinary.includes("-cuda");
    if (isGpuBinary) {
      // If user didn't specify gpuLayers, use all layers (99 means all)
      const gpuLayers = options.gpuLayers !== undefined ? options.gpuLayers : 99;
      args.push("--n-gpu-layers", String(gpuLayers));
      debugLogger.info("Using GPU acceleration", {
        binaryType: serverBinary.includes("-vulkan") ? "Vulkan" : "CUDA",
        gpuLayers,
      });
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

    this.process.on("close", (code) => {
      exitCode = code;
      debugLogger.debug("llama-server process exited", { code });
      this.ready = false;
      this.process = null;
      this.stopHealthCheck();
    });

    await this.waitForReady(() => ({ stderr: stderrBuffer, exitCode }));
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
      // Only throw error if process actually exited (not just starting up)
      if (!this.process || this.process.killed) {
        const info = getProcessInfo ? getProcessInfo() : {};
        // Only error if we have an exit code (process actually died)
        if (info.exitCode !== null && info.exitCode !== undefined) {
          const stderr = info.stderr ? info.stderr.trim().slice(0, 1000) : "";
          throw new Error(`llama-server process died during startup (exit code: ${info.exitCode})${stderr ? `: ${stderr}` : ""}`);
        }
        // Otherwise process might just be initializing, continue waiting
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
