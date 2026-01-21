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
const { execSync } = require("child_process");

// Configuration - Update WHISPER_CPP_VERSION when releasing new builds
const WHISPER_CPP_REPO = "gabrielste1n/whisper.cpp";
const WHISPER_CPP_VERSION = "0.0.5"; // Bump version for server binaries

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
    zipName: "whisper-cpp-win32-x64.zip",
    binaryName: "whisper-cpp-win32-x64.exe",
    outputName: "whisper-cpp-win32-x64.exe",
  },
  "linux-x64": {
    zipName: "whisper-cpp-linux-x64.zip",
    binaryName: "whisper-cpp-linux-x64",
    outputName: "whisper-cpp-linux-x64",
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
    zipName: "whisper-server-win32-x64.zip",
    binaryName: "whisper-server-win32-x64.exe",
    outputName: "whisper-server-win32-x64.exe",
  },
  "linux-x64": {
    zipName: "whisper-server-linux-x64.zip",
    binaryName: "whisper-server-linux-x64",
    outputName: "whisper-server-linux-x64",
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

function extractZip(zipPath, destDir) {
  if (process.platform === "win32") {
    execSync(`powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`, { stdio: "inherit" });
  } else {
    execSync(`unzip -o "${zipPath}" -d "${destDir}"`, { stdio: "inherit" });
  }
}

async function downloadBinary(platformArch, config, label) {
  if (!config) {
    console.log(`  ${label} ${platformArch}: Not supported`);
    return false;
  }

  const outputPath = path.join(BIN_DIR, config.outputName);

  if (fs.existsSync(outputPath)) {
    console.log(`  ${label} ${platformArch}: Already exists, skipping`);
    return true;
  }

  const url = getDownloadUrl(config.zipName);
  console.log(`  ${label} ${platformArch}: Downloading from ${url}`);

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
      console.log(`  ${label} ${platformArch}: Extracted to ${config.outputName}`);
    } else {
      console.error(`  ${label} ${platformArch}: Binary not found in archive`);
      return false;
    }

    // Cleanup
    fs.rmSync(extractDir, { recursive: true, force: true });
    fs.unlinkSync(zipPath);
    return true;

  } catch (error) {
    console.error(`  ${label} ${platformArch}: Failed - ${error.message}`);
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    return false;
  }
}

async function downloadForPlatform(platformArch) {
  // Download both CLI and server binaries for the platform
  const cliOk = await downloadBinary(platformArch, CLI_BINARIES[platformArch], "[cli]");
  const serverOk = await downloadBinary(platformArch, SERVER_BINARIES[platformArch], "[server]");
  return cliOk && serverOk;
}

async function main() {
  console.log(`\nDownloading whisper.cpp binaries (${WHISPER_CPP_VERSION})...\n`);

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
    const downloadOk = await downloadForPlatform(targetPlatformArch);
    if (!downloadOk) {
      console.error(`Failed to download binaries for ${targetPlatformArch}`);
      process.exitCode = 1;
      return;
    }

    if (shouldCleanup) {
      // Clean old binaries that don't match target platform/arch
      const existingFiles = fs.readdirSync(BIN_DIR).filter(f => f.startsWith("whisper-"));
      const targetPrefix = `whisper-cpp-${targetPlatformArch}`;
      const targetServerPrefix = `whisper-server-${targetPlatformArch}`;

      existingFiles.forEach(file => {
        if (!file.startsWith(targetPrefix) && !file.startsWith(targetServerPrefix)) {
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
      await downloadBinary(platformArch, CLI_BINARIES[platformArch], "[cli]");
    }
  } else if (process.argv.includes("--all")) {
    // Download all platforms
    console.log("Downloading all platform binaries (CLI + server):");
    for (const platformArch of Object.keys(CLI_BINARIES)) {
      await downloadForPlatform(platformArch);
    }
  } else {
    // Default: download for build targets (all platforms)
    console.log("Downloading binaries for all platforms (CLI + server):");
    for (const platformArch of Object.keys(CLI_BINARIES)) {
      await downloadForPlatform(platformArch);
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
