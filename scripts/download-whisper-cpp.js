#!/usr/bin/env node
/**
 * Downloads whisper.cpp binaries from OpenWhispr's fork releases.
 *
 * Binaries are built via GitHub Actions and published to:
 * https://github.com/gabrielste1n/whisper.cpp/releases
 *
 * Downloads both whisper-cli (transcription tool) and whisper-server (HTTP API server).
 */

const https = require("https");
const fs = require("fs");
const path = require("path");
const { execSync, spawn } = require("child_process");

// Configuration - Update WHISPER_CPP_VERSION when releasing new builds
const WHISPER_CPP_REPO = "gabrielste1n/whisper.cpp";
const WHISPER_CPP_VERSION = "0.0.5"; // Bump version for server binaries

const DEFAULT_VARIANT = "cpu";

/**
 * Detects if an NVIDIA GPU is present using nvidia-smi command.
 * Returns 'gpu' if GPU found, 'cpu' otherwise.
 */
function detectGpuVariant() {
  return new Promise((resolve) => {
    // Only check on Windows and Linux (macOS uses Metal, not CUDA)
    if (process.platform !== "win32" && process.platform !== "linux") {
      resolve("cpu");
      return;
    }

    let settled = false;

    const proc = spawn("nvidia-smi", ["--query-gpu=name", "--format=csv,noheader"], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
    });

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      console.log("  GPU detection timed out, defaulting to CPU");
      // Kill the process to prevent zombie
      if (proc.exitCode === null) {
        proc.kill();
      }
      resolve("cpu");
    }, 3000);

    let stdout = "";

    proc.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    proc.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (code === 0 && stdout.trim()) {
        const gpuName = stdout.trim().split("\n")[0];
        console.log(`  Detected NVIDIA GPU: ${gpuName}`);
        resolve("gpu");
      } else {
        console.log("  No NVIDIA GPU detected, using CPU variant");
        resolve("cpu");
      }
    });

    proc.on("error", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      console.log("  nvidia-smi not found, using CPU variant");
      resolve("cpu");
    });
  });
}

// Platform-specific binary info for whisper-cli
const CLI_BINARIES = {
  "darwin-arm64": {
    zipName: "whisper-cpp-darwin-arm64.zip",
    binaryName: "whisper-cpp-darwin-arm64",
    outputName: "whisper-cpp-darwin-arm64",
  },
  "darwin-x64": {
    zipName: "whisper-cpp-darwin-x64.zip",
    binaryName: "whisper-cpp-darwin-x64",
    outputName: "whisper-cpp-darwin-x64",
  },
  "win32-x64": {
    cpu: {
      zipName: "whisper-cpp-win32-x64-cpu.zip",
      binaryName: "whisper-cpp-win32-x64-cpu.exe",
      outputName: "whisper-cpp-win32-x64.exe", // Keep default naming (no breaking change)
    },
    gpu: {
      zipName: "whisper-cpp-win32-x64-cuda.zip",
      binaryName: "whisper-cpp-win32-x64-cuda.exe",
      outputName: "whisper-cpp-win32-x64-gpu.exe", // GPU variant with -gpu suffix
    },
  },
  "linux-x64": {
    cpu: {
      zipName: "whisper-cpp-linux-x64-cpu.zip",
      binaryName: "whisper-cpp-linux-x64-cpu",
      outputName: "whisper-cpp-linux-x64", // Keep default naming (no breaking change)
    },
    gpu: {
      zipName: "whisper-cpp-linux-x64-cuda.zip",
      binaryName: "whisper-cpp-linux-x64-cuda",
      outputName: "whisper-cpp-linux-x64-gpu", // GPU variant with -gpu suffix
    },
  },
};

// Platform-specific binary info for whisper-server (HTTP API)
const SERVER_BINARIES = {
  "darwin-arm64": {
    zipName: "whisper-server-darwin-arm64.zip",
    binaryName: "whisper-server-darwin-arm64",
    outputName: "whisper-server-darwin-arm64",
  },
  "darwin-x64": {
    zipName: "whisper-server-darwin-x64.zip",
    binaryName: "whisper-server-darwin-x64",
    outputName: "whisper-server-darwin-x64",
  },
  "win32-x64": {
    cpu: {
      zipName: "whisper-server-win32-x64-cpu.zip",
      binaryName: "whisper-server-win32-x64-cpu.exe",
      outputName: "whisper-server-win32-x64.exe", // Keep default naming (no breaking change)
    },
    gpu: {
      zipName: "whisper-server-win32-x64-cuda.zip",
      binaryName: "whisper-server-win32-x64-cuda.exe",
      outputName: "whisper-server-win32-x64-gpu.exe", // GPU variant with -gpu suffix
    },
  },
  "linux-x64": {
    cpu: {
      zipName: "whisper-server-linux-x64-cpu.zip",
      binaryName: "whisper-server-linux-x64-cpu",
      outputName: "whisper-server-linux-x64", // Keep default naming (no breaking change)
    },
    gpu: {
      zipName: "whisper-server-linux-x64-cuda.zip",
      binaryName: "whisper-server-linux-x64-cuda",
      outputName: "whisper-server-linux-x64-gpu", // GPU variant with -gpu suffix
    },
  },
};

const BIN_DIR = path.join(__dirname, "..", "resources", "bin");

function getDownloadUrl(zipName) {
  return `https://github.com/${WHISPER_CPP_REPO}/releases/download/${WHISPER_CPP_VERSION}/${zipName}`;
}

const REQUEST_TIMEOUT = 30000; // 30 seconds for connection
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds between retries

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function downloadFile(url, dest, retryCount = 0) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    let activeRequest = null;

    const cleanup = () => {
      if (activeRequest) {
        activeRequest.destroy();
        activeRequest = null;
      }
      file.close();
    };

    const request = (currentUrl, redirectCount = 0) => {
      // Prevent infinite redirects
      if (redirectCount > 5) {
        cleanup();
        reject(new Error("Too many redirects"));
        return;
      }

      activeRequest = https.get(currentUrl, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          const redirectUrl = response.headers.location;
          if (!redirectUrl) {
            cleanup();
            reject(new Error("Redirect without location header"));
            return;
          }
          request(redirectUrl, redirectCount + 1);
          return;
        }

        if (response.statusCode !== 200) {
          cleanup();
          reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
          return;
        }

        const total = parseInt(response.headers["content-length"], 10);
        let downloaded = 0;

        response.on("data", (chunk) => {
          downloaded += chunk.length;
          const pct = total ? Math.round((downloaded / total) * 100) : 0;
          process.stdout.write(`\r  Downloading: ${pct}%`);
        });

        response.on("error", (err) => {
          cleanup();
          reject(err);
        });

        response.pipe(file);
        file.on("finish", () => {
          file.close();
          console.log(" Done");
          resolve();
        });

        file.on("error", (err) => {
          cleanup();
          reject(err);
        });
      });

      activeRequest.on("error", (err) => {
        cleanup();
        reject(err);
      });

      // Connection timeout
      activeRequest.setTimeout(REQUEST_TIMEOUT, () => {
        cleanup();
        reject(new Error("Connection timed out"));
      });
    };

    request(url);
  }).catch(async (error) => {
    // Retry logic for transient failures
    if (retryCount < MAX_RETRIES) {
      console.log(`\n  Retry ${retryCount + 1}/${MAX_RETRIES}: ${error.message}`);
      await sleep(RETRY_DELAY);
      // Clean up partial file before retry
      if (fs.existsSync(dest)) {
        fs.unlinkSync(dest);
      }
      return downloadFile(url, dest, retryCount + 1);
    }
    throw error;
  });
}

function resolveVariantConfig(config, variant) {
  if (!config) return null;
  if (config.cpu || config.gpu) {
    const selectedVariant = variant || DEFAULT_VARIANT;
    if (!config[selectedVariant]) {
      return null;
    }
    return { ...config[selectedVariant], variant: selectedVariant };
  }
  return config;
}

function parseVariant(args) {
  const hasCpuFlag = args.includes("--cpu");
  const hasGpuFlag = args.includes("--gpu") || args.includes("--cuda"); // Support both --gpu and --cuda for compatibility
  const variantIndex = args.indexOf("--variant");
  let variant = process.env.WHISPER_CPP_VARIANT || null;

  if (hasCpuFlag && hasGpuFlag) {
    console.error("Choose only one of --cpu or --gpu.");
    return null;
  }

  if (variantIndex !== -1) {
    const value = args[variantIndex + 1];
    if (!value) {
      console.error("Missing value for --variant (cpu or gpu).");
      return null;
    }
    // Normalize 'cuda' to 'gpu' for backward compatibility
    variant = value === "cuda" ? "gpu" : value;
  }

  if (hasCpuFlag) variant = "cpu";
  if (hasGpuFlag) variant = "gpu";

  // Normalize environment variable (cuda -> gpu)
  if (variant === "cuda") variant = "gpu";

  if (variant && variant !== "cpu" && variant !== "gpu") {
    console.error(`Unsupported variant: ${variant}. Use cpu or gpu.`);
    return null;
  }

  return variant;
}

function extractZip(zipPath, destDir) {
  if (process.platform === "win32") {
    execSync(`powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`, { stdio: "inherit" });
  } else {
    execSync(`unzip -o "${zipPath}" -d "${destDir}"`, { stdio: "inherit" });
  }
}

async function downloadBinary(platformArch, configMap, label, variant, forceDownload) {
  const config = resolveVariantConfig(configMap[platformArch], variant);
  if (!config) {
    const variantTag = variant ? ` (${variant})` : "";
    console.log(`  ${label}${variantTag} ${platformArch}: Not supported`);
    return false;
  }

  const outputPath = path.join(BIN_DIR, config.outputName);

  const variantTag = config.variant ? ` (${config.variant})` : "";
  if (!forceDownload && fs.existsSync(outputPath)) {
    console.log(`  ${label}${variantTag} ${platformArch}: Already exists, skipping`);
    return true;
  }

  const url = getDownloadUrl(config.zipName);
  console.log(`  ${label}${variantTag} ${platformArch}: Downloading from ${url}`);

  const zipPath = path.join(BIN_DIR, config.zipName);

  try {
    await downloadFile(url, zipPath);

    // Remove brackets from label for safe directory names on Windows
    const safeLabel = label.replace(/[[\]]/g, "");
    const extractDir = path.join(BIN_DIR, `temp-${safeLabel}-${platformArch}`);
    fs.mkdirSync(extractDir, { recursive: true });
    extractZip(zipPath, extractDir);

    // Find and copy the binary
    const binaryPath = path.join(extractDir, config.binaryName);
    if (fs.existsSync(binaryPath)) {
      fs.copyFileSync(binaryPath, outputPath);
      if (process.platform !== "win32") {
        fs.chmodSync(outputPath, 0o755);
      }
      console.log(`  ${label}${variantTag} ${platformArch}: Extracted to ${config.outputName}`);

      // For Windows, handle CUDA DLLs for GPU variant
      if (platformArch === "win32-x64" && config.variant === "gpu") {
        const cudaDlls = ["cudart64_12.dll", "cublas64_12.dll", "cublasLt64_12.dll"];
        // Extract bundled CUDA DLLs for GPU variant
        for (const dll of cudaDlls) {
          const dllPath = path.join(extractDir, dll);
          if (fs.existsSync(dllPath)) {
            const destPath = path.join(BIN_DIR, dll);
            fs.copyFileSync(dllPath, destPath);
            console.log(`  ${label}${variantTag} ${platformArch}: Extracted ${dll}`);
          }
        }
      }
    } else {
      console.error(`  ${label}${variantTag} ${platformArch}: Binary not found in archive`);
      return false;
    }

    // Cleanup
    fs.rmSync(extractDir, { recursive: true, force: true });
    fs.unlinkSync(zipPath);
    return true;

  } catch (error) {
    console.error(`  ${label}${variantTag} ${platformArch}: Failed - ${error.message}`);
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    return false;
  }
}

async function downloadForPlatform(platformArch, variant, forceDownload) {
  const config = CLI_BINARIES[platformArch];

  // If platform has both CPU and GPU variants and no variant specified, download both
  if (config && config.cpu && config.gpu && !variant) {
    console.log(`\n${platformArch}: Downloading both CPU and GPU variants...`);
    const cpuCliOk = await downloadBinary(platformArch, CLI_BINARIES, "[cli]", "cpu", forceDownload);
    const cpuServerOk = await downloadBinary(platformArch, SERVER_BINARIES, "[server]", "cpu", forceDownload);
    const gpuCliOk = await downloadBinary(platformArch, CLI_BINARIES, "[cli]", "gpu", forceDownload);
    const gpuServerOk = await downloadBinary(platformArch, SERVER_BINARIES, "[server]", "gpu", forceDownload);
    return cpuCliOk && cpuServerOk && gpuCliOk && gpuServerOk;
  }

  // Otherwise download specified variant (or single variant for macOS)
  const cliOk = await downloadBinary(platformArch, CLI_BINARIES, "[cli]", variant, forceDownload);
  const serverOk = await downloadBinary(platformArch, SERVER_BINARIES, "[server]", variant, forceDownload);
  return cliOk && serverOk;
}

async function main() {
  let variant = parseVariant(process.argv);
  if (variant === null) {
    process.exitCode = 1;
    return;
  }

  const autoDetect = process.argv.includes("--auto-detect");
  const implicitAutoDetect = process.argv.includes("--current") && !variant;
  let forceDownload =
    process.argv.includes("--force") ||
    process.argv.includes("--cpu") ||
    process.argv.includes("--cuda") ||
    process.argv.includes("--variant") ||
    autoDetect;

  // Auto-detect GPU if --auto-detect flag is used or when downloading for current platform without explicit variant
  if (autoDetect || implicitAutoDetect) {
    console.log("\nDetecting GPU...");
    variant = await detectGpuVariant();
    // Force download when auto-detecting to ensure correct variant is installed
    // even if a different variant's binary already exists
    forceDownload = true;
  }

  const variantTag = variant ? ` ${variant}` : "";
  console.log(`\nDownloading whisper.cpp binaries (${WHISPER_CPP_VERSION})${variantTag}...\n`);

  // Create bin directory
  fs.mkdirSync(BIN_DIR, { recursive: true });

  const currentPlatform = process.platform;
  const currentArch = process.arch;

  // Parse command-line arguments for explicit platform/arch
  let targetPlatform = currentPlatform;
  let targetArch = currentArch;

  const platformIndex = process.argv.indexOf('--platform');
  if (platformIndex !== -1 && process.argv[platformIndex + 1]) {
    targetPlatform = process.argv[platformIndex + 1];
  }

  const archIndex = process.argv.indexOf('--arch');
  if (archIndex !== -1 && process.argv[archIndex + 1]) {
    targetArch = process.argv[archIndex + 1];
  }

  const targetPlatformArch = `${targetPlatform}-${targetArch}`;
  const isCI = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";
  const shouldCleanup = process.argv.includes("--clean") || isCI;

  if (process.argv.includes("--current")) {
    if (!CLI_BINARIES[targetPlatformArch] || !SERVER_BINARIES[targetPlatformArch]) {
      console.error(`Unsupported platform/arch: ${targetPlatformArch}`);
      process.exitCode = 1;
      return;
    }

    // Only download for specified platform/arch
    console.log(`Downloading for target platform (${targetPlatformArch}):`);
    const downloadOk = await downloadForPlatform(targetPlatformArch, variant, forceDownload);
    if (!downloadOk) {
      console.error(`Failed to download binaries for ${targetPlatformArch}`);
      process.exitCode = 1;
      return;
    }

    if (shouldCleanup) {
      // Clean old binaries that don't match target platform/arch (keep both CPU and GPU variants)
      const existingFiles = fs.readdirSync(BIN_DIR).filter(f => f.startsWith("whisper-"));
      const keepPrefixes = [
        `whisper-cpp-${targetPlatformArch}`,      // CPU variant (default naming)
        `whisper-cpp-${targetPlatformArch}-gpu`,  // GPU variant
        `whisper-server-${targetPlatformArch}`,   // Server CPU variant
        `whisper-server-${targetPlatformArch}-gpu` // Server GPU variant
      ];

      existingFiles.forEach(file => {
        const shouldKeep = keepPrefixes.some(prefix => file.startsWith(prefix));
        if (!shouldKeep) {
          const filePath = path.join(BIN_DIR, file);
          console.log(`Removing old binary: ${file}`);
          fs.unlinkSync(filePath);
        }
      });
    }
  } else if (process.argv.includes("--cli-only")) {
    // Only download CLI binaries (no server)
    console.log("Downloading CLI binaries only:");
    for (const platformArch of Object.keys(CLI_BINARIES)) {
      await downloadBinary(platformArch, CLI_BINARIES, "[cli]", variant, forceDownload);
    }
  } else if (process.argv.includes("--all")) {
    // Download all platforms
    console.log("Downloading all platform binaries (CLI + server):");
    for (const platformArch of Object.keys(CLI_BINARIES)) {
      await downloadForPlatform(platformArch, variant, forceDownload);
    }
  } else {
    // Default: download for build targets (all platforms)
    console.log("Downloading binaries for all platforms (CLI + server):");
    for (const platformArch of Object.keys(CLI_BINARIES)) {
      await downloadForPlatform(platformArch, variant, forceDownload);
    }
  }

  console.log("\n---");

  // List what we have
  const files = fs.readdirSync(BIN_DIR).filter(f => f.startsWith("whisper-"));
  if (files.length > 0) {
    console.log("Available binaries:");

    // Group by type
    const cliFiles = files.filter(f => f.startsWith("whisper-cpp"));
    const serverFiles = files.filter(f => f.startsWith("whisper-server"));

    if (cliFiles.length > 0) {
      console.log("\n  CLI (whisper-cli):");
      cliFiles.forEach(f => {
        const stats = fs.statSync(path.join(BIN_DIR, f));
        console.log(`    - ${f} (${Math.round(stats.size / 1024 / 1024)}MB)`);
      });
    }

    if (serverFiles.length > 0) {
      console.log("\n  Server (whisper-server):");
      serverFiles.forEach(f => {
        const stats = fs.statSync(path.join(BIN_DIR, f));
        console.log(`    - ${f} (${Math.round(stats.size / 1024 / 1024)}MB)`);
      });
    }
  } else {
    console.log("No binaries downloaded yet.");
    console.log("\nMake sure you've created a release in your whisper.cpp fork:");
    console.log(`  https://github.com/${WHISPER_CPP_REPO}/releases`);
    console.log("\nRun the GitHub Actions workflow 'Build Binaries for OpenWhispr' first.");
  }
}

main().catch(console.error);
