#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const {
  downloadFile,
  extractZip,
  parseArgs,
  setExecutable,
  cleanupFiles,
} = require("./lib/download-utils");

const WHISPER_CPP_REPO = "OpenWhispr/whisper.cpp";
const WHISPER_CPP_VERSION = "0.0.5";

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

// Platform-specific binary info for whisper-server (HTTP API)
const BINARIES = {
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
      outputName: "whisper-server-win32-x64.exe",
    },
    gpu: {
      zipName: "whisper-server-win32-x64-cuda.zip",
      binaryName: "whisper-server-win32-x64-cuda.exe",
      outputName: "whisper-server-win32-x64-gpu.exe",
    },
  },
  "linux-x64": {
    cpu: {
      zipName: "whisper-server-linux-x64-cpu.zip",
      binaryName: "whisper-server-linux-x64-cpu",
      outputName: "whisper-server-linux-x64",
    },
    gpu: {
      zipName: "whisper-server-linux-x64-cuda.zip",
      binaryName: "whisper-server-linux-x64-cuda",
      outputName: "whisper-server-linux-x64-gpu",
    },
  },
};

const BIN_DIR = path.join(__dirname, "..", "resources", "bin");

function getDownloadUrl(zipName) {
  return `https://github.com/${WHISPER_CPP_REPO}/releases/download/${WHISPER_CPP_VERSION}/${zipName}`;
}

function resolveVariantConfig(config, variant) {
  if (!config) return null;
  if (config.cpu || config.gpu) {
    const selectedVariant = variant || "cpu";
    if (!config[selectedVariant]) {
      return null;
    }
    return { ...config[selectedVariant], variant: selectedVariant };
  }
  return config;
}

async function downloadBinary(platformArch, variant = null, forceDownload = false) {
  const config = resolveVariantConfig(BINARIES[platformArch], variant);

  if (!config) {
    const variantTag = variant ? ` (${variant})` : "";
    console.log(`  [server]${variantTag} ${platformArch}: Not supported`);
    return false;
  }

  const outputPath = path.join(BIN_DIR, config.outputName);

  const variantTag = config.variant ? ` (${config.variant})` : "";
  if (!forceDownload && fs.existsSync(outputPath)) {
    console.log(`  [server]${variantTag} ${platformArch}: Already exists, skipping`);
    return true;
  }

  const url = getDownloadUrl(config.zipName);
  console.log(`  [server]${variantTag} ${platformArch}: Downloading from ${url}`);

  const zipPath = path.join(BIN_DIR, config.zipName);

  try {
    await downloadFile(url, zipPath);

    const extractDir = path.join(BIN_DIR, `temp-whisper-${platformArch}${variantTag ? `-${config.variant}` : ""}`);
    fs.mkdirSync(extractDir, { recursive: true });
    extractZip(zipPath, extractDir);

    const binaryPath = path.join(extractDir, config.binaryName);
    if (fs.existsSync(binaryPath)) {
      fs.copyFileSync(binaryPath, outputPath);
      setExecutable(outputPath);
      console.log(`  [server]${variantTag} ${platformArch}: Extracted to ${config.outputName}`);
    } else {
      console.error(`  [server]${variantTag} ${platformArch}: Binary not found in archive`);
      return false;
    }

    fs.rmSync(extractDir, { recursive: true, force: true });
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    return true;
  } catch (error) {
    console.error(`  [server]${variantTag} ${platformArch}: Failed - ${error.message}`);
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    return false;
  }
}

async function downloadForPlatform(platformArch, variant = null, forceDownload = false) {
  const config = BINARIES[platformArch];

  // If platform has both CPU and GPU variants and no variant specified, download both
  if (config && config.cpu && config.gpu && !variant) {
    console.log(`\n${platformArch}: Downloading both CPU and GPU variants...`);
    const cpuOk = await downloadBinary(platformArch, "cpu", forceDownload);
    const gpuOk = await downloadBinary(platformArch, "gpu", forceDownload);
    return cpuOk && gpuOk;
  }

  // Otherwise download specified variant (or single variant for macOS)
  return await downloadBinary(platformArch, variant, forceDownload);
}

async function main() {
  const args = parseArgs();
  let variant = null;
  let forceDownload = false;

  // Parse variant flags
  if (process.argv.includes("--cpu")) {
    variant = "cpu";
    forceDownload = true;
  } else if (process.argv.includes("--gpu") || process.argv.includes("--cuda")) {
    variant = "gpu";
    forceDownload = true;
  }

  // Auto-detect GPU if downloading for current platform without explicit variant
  const autoDetect = args.isCurrent && !variant && (process.platform === "win32" || process.platform === "linux");
  if (autoDetect) {
    console.log("\nDetecting GPU...");
    variant = await detectGpuVariant();
    forceDownload = true;
  }

  const variantTag = variant ? ` ${variant}` : "";
  console.log(`\nDownloading whisper-server binaries (${WHISPER_CPP_VERSION})${variantTag}...\n`);

  fs.mkdirSync(BIN_DIR, { recursive: true });

  if (args.isCurrent) {
    if (!BINARIES[args.platformArch]) {
      console.error(`Unsupported platform/arch: ${args.platformArch}`);
      process.exitCode = 1;
      return;
    }

    console.log(`Downloading for target platform (${args.platformArch}):`);
    const ok = await downloadForPlatform(args.platformArch, variant, forceDownload);
    if (!ok) {
      console.error(`Failed to download binaries for ${args.platformArch}`);
      process.exitCode = 1;
      return;
    }

    if (args.shouldCleanup) {
      cleanupFiles(BIN_DIR, "whisper-server", `whisper-server-${args.platformArch}`);
    }
  } else {
    console.log("Downloading binaries for all platforms:");
    for (const platformArch of Object.keys(BINARIES)) {
      await downloadForPlatform(platformArch, variant, forceDownload);
    }
  }

  console.log("\n---");

  const files = fs.readdirSync(BIN_DIR).filter((f) => f.startsWith("whisper-server"));
  if (files.length > 0) {
    console.log("Available whisper-server binaries:\n");
    files.forEach((f) => {
      const stats = fs.statSync(path.join(BIN_DIR, f));
      console.log(`  - ${f} (${Math.round(stats.size / 1024 / 1024)}MB)`);
    });
  } else {
    console.log("No binaries downloaded yet.");
    console.log(`\nMake sure release exists: https://github.com/${WHISPER_CPP_REPO}/releases`);
  }
}

main().catch(console.error);
