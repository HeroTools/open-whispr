#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const {
  downloadFile,
  extractZip,
  fetchLatestRelease,
  parseArgs,
  setExecutable,
  cleanupFiles,
} = require("./lib/download-utils");

const WHISPER_CPP_REPO = "OpenWhispr/whisper.cpp";

// Version can be pinned via environment variable for reproducible builds
const VERSION_OVERRIDE = process.env.WHISPER_CPP_VERSION || null;

const BINARIES = {
  "darwin-arm64": [
    {
      variant: "default",
      zipName: "whisper-server-darwin-arm64.zip",
      binaryName: "whisper-server-darwin-arm64",
      outputName: "whisper-server-darwin-arm64",
    },
  ],
  "darwin-x64": [
    {
      variant: "default",
      zipName: "whisper-server-darwin-x64.zip",
      binaryName: "whisper-server-darwin-x64",
      outputName: "whisper-server-darwin-x64",
    },
  ],
  "win32-x64": [
    {
      variant: "cuda",
      zipName: "whisper-server-win32-x64-cuda.zip",
      binaryName: "whisper-server-win32-x64-cuda.exe",
      outputName: "whisper-server-win32-x64-cuda.exe",
    },
    {
      variant: "cpu",
      zipName: "whisper-server-win32-x64-cpu.zip",
      binaryName: "whisper-server-win32-x64-cpu.exe",
      outputName: "whisper-server-win32-x64-cpu.exe",
    },
  ],
  "linux-x64": [
    {
      variant: "cuda",
      zipName: "whisper-server-linux-x64-cuda.zip",
      binaryName: "whisper-server-linux-x64-cuda",
      outputName: "whisper-server-linux-x64-cuda",
    },
    {
      variant: "cpu",
      zipName: "whisper-server-linux-x64-cpu.zip",
      binaryName: "whisper-server-linux-x64-cpu",
      outputName: "whisper-server-linux-x64-cpu",
    },
  ],
};

const BIN_DIR = path.join(__dirname, "..", "resources", "bin");

// Cache the release info to avoid multiple API calls
let cachedRelease = null;

async function getRelease() {
  if (cachedRelease) return cachedRelease;

  if (VERSION_OVERRIDE) {
    cachedRelease = await fetchLatestRelease(WHISPER_CPP_REPO, { tagPrefix: VERSION_OVERRIDE });
  } else {
    cachedRelease = await fetchLatestRelease(WHISPER_CPP_REPO);
  }
  return cachedRelease;
}

function getDownloadUrl(release, zipName) {
  const asset = release?.assets?.find((a) => a.name === zipName);
  return asset?.url || null;
}

async function downloadBinary(platformArch, config, release, isForce = false) {
  if (!config) {
    console.log(`  [server] ${platformArch}: Not supported`);
    return false;
  }

  const outputPath = path.join(BIN_DIR, config.outputName);

  if (fs.existsSync(outputPath) && !isForce) {
    console.log(`  [server] ${platformArch}: Already exists (use --force to re-download)`);
    return true;
  }

  const url = getDownloadUrl(release, config.zipName);
  if (!url) {
    console.error(`  [server] ${platformArch}: Asset ${config.zipName} not found in release`);
    return false;
  }
  console.log(`  [server] ${platformArch}: Downloading from ${url}`);

  const zipPath = path.join(BIN_DIR, config.zipName);

  try {
    await downloadFile(url, zipPath);

    const extractDir = path.join(BIN_DIR, `temp-whisper-${platformArch}`);
    fs.mkdirSync(extractDir, { recursive: true });
    extractZip(zipPath, extractDir);

    const binaryPath = path.join(extractDir, config.binaryName);
    if (fs.existsSync(binaryPath)) {
      fs.copyFileSync(binaryPath, outputPath);
      setExecutable(outputPath);
      console.log(`  [server] ${platformArch}: Extracted to ${config.outputName}`);
    } else {
      console.error(`  [server] ${platformArch}: Binary not found in archive`);
      return false;
    }

    fs.rmSync(extractDir, { recursive: true, force: true });
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    return true;
  } catch (error) {
    console.error(`  [server] ${platformArch}: Failed - ${error.message}`);
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    return false;
  }
}

async function main() {
  if (VERSION_OVERRIDE) {
    console.log(`\n[whisper-server] Using pinned version: ${VERSION_OVERRIDE}`);
  } else {
    console.log("\n[whisper-server] Fetching latest release...");
  }
  const release = await getRelease();

  if (!release) {
    console.error(`[whisper-server] Could not fetch release from ${WHISPER_CPP_REPO}`);
    console.log(`\nMake sure release exists: https://github.com/${WHISPER_CPP_REPO}/releases`);
    process.exitCode = 1;
    return;
  }

  console.log(`\nDownloading whisper-server binaries (${release.tag})...\n`);

  fs.mkdirSync(BIN_DIR, { recursive: true });

  const args = parseArgs();

  if (args.isCurrent) {
    if (!BINARIES[args.platformArch]) {
      console.error(`Unsupported platform/arch: ${args.platformArch}`);
      process.exitCode = 1;
      return;
    }

    console.log(`Downloading for target platform (${args.platformArch}):`);
    const configs = BINARIES[args.platformArch];

    for (const config of configs) {
      const variantLabel = config.variant === "default" ? "" : `-${config.variant}`;
      const ok = await downloadBinary(`${args.platformArch}${variantLabel}`, config, release, args.isForce);
      if (!ok && config.variant !== "cuda") {
        // Only fail if CPU binary fails, CUDA is optional
        console.error(`Failed to download binaries for ${args.platformArch}`);
        process.exitCode = 1;
        return;
      }
    }

    if (args.shouldCleanup) {
      cleanupFiles(BIN_DIR, "whisper-server", `whisper-server-${args.platformArch}`);
    }
  } else {
    console.log("Downloading binaries for all platforms:");
    for (const platformArch of Object.keys(BINARIES)) {
      const configs = BINARIES[platformArch];
      for (const config of configs) {
        const variantLabel = config.variant === "default" ? "" : `-${config.variant}`;
        await downloadBinary(`${platformArch}${variantLabel}`, config, release, args.isForce);
      }
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
