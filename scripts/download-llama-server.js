#!/usr/bin/env node
/**
 * Downloads llama-server binaries from official llama.cpp releases.
 *
 * Binaries are built by the llama.cpp project and published to:
 * https://github.com/ggerganov/llama.cpp/releases
 */

const https = require("https");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Configuration - Update LLAMA_CPP_VERSION when new stable release is available
const LLAMA_CPP_REPO = "ggerganov/llama.cpp";
const LLAMA_CPP_VERSION = "b4621"; // Release tag (e.g., b4621)

// Platform-specific binary info
// Official llama.cpp release naming convention
const BINARIES = {
  "darwin-arm64": {
    zipName: `llama-${LLAMA_CPP_VERSION}-bin-macos-arm64.zip`,
    binaryPath: "build/bin/llama-server",
    outputName: "llama-server-darwin-arm64",
  },
  "darwin-x64": {
    zipName: `llama-${LLAMA_CPP_VERSION}-bin-macos-x64.zip`,
    binaryPath: "build/bin/llama-server",
    outputName: "llama-server-darwin-x64",
  },
  "win32-x64": {
    zipName: `llama-${LLAMA_CPP_VERSION}-bin-win-avx2-x64.zip`,
    binaryPath: "build/bin/llama-server.exe",
    outputName: "llama-server-win32-x64.exe",
  },
  "linux-x64": {
    zipName: `llama-${LLAMA_CPP_VERSION}-bin-ubuntu-x64.zip`,
    binaryPath: "build/bin/llama-server",
    outputName: "llama-server-linux-x64",
  },
};

const BIN_DIR = path.join(__dirname, "..", "resources", "bin");

function getDownloadUrl(zipName) {
  return `https://github.com/${LLAMA_CPP_REPO}/releases/download/${LLAMA_CPP_VERSION}/${zipName}`;
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

function findBinaryInDir(dir, binaryName) {
  // Recursively search for the binary
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      const found = findBinaryInDir(fullPath, binaryName);
      if (found) return found;
    } else if (entry.name === binaryName) {
      return fullPath;
    }
  }

  return null;
}

async function downloadBinary(platformArch, config) {
  if (!config) {
    console.log(`  ${platformArch}: Not supported`);
    return false;
  }

  const outputPath = path.join(BIN_DIR, config.outputName);

  if (fs.existsSync(outputPath)) {
    console.log(`  ${platformArch}: Already exists, skipping`);
    return true;
  }

  const url = getDownloadUrl(config.zipName);
  console.log(`  ${platformArch}: Downloading from ${url}`);

  const zipPath = path.join(BIN_DIR, config.zipName);

  try {
    await downloadFile(url, zipPath);

    const extractDir = path.join(BIN_DIR, `temp-llama-${platformArch}`);
    fs.mkdirSync(extractDir, { recursive: true });
    extractZip(zipPath, extractDir);

    // Find the binary - try exact path first, then search
    const binaryName = path.basename(config.binaryPath);
    let binaryPath = path.join(extractDir, config.binaryPath);

    if (!fs.existsSync(binaryPath)) {
      // Search recursively
      binaryPath = findBinaryInDir(extractDir, binaryName);
    }

    if (binaryPath && fs.existsSync(binaryPath)) {
      fs.copyFileSync(binaryPath, outputPath);
      if (process.platform !== "win32") {
        fs.chmodSync(outputPath, 0o755);
      }
      console.log(`  ${platformArch}: Extracted to ${config.outputName}`);
    } else {
      console.error(`  ${platformArch}: Binary '${binaryName}' not found in archive`);
      // List contents for debugging
      console.error("  Archive contents:");
      const listContents = (dir, indent = "    ") => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries.slice(0, 20)) {
          console.error(`${indent}${entry.name}${entry.isDirectory() ? "/" : ""}`);
          if (entry.isDirectory()) {
            listContents(path.join(dir, entry.name), indent + "  ");
          }
        }
        if (entries.length > 20) {
          console.error(`${indent}... and ${entries.length - 20} more`);
        }
      };
      listContents(extractDir);
      return false;
    }

    // Cleanup
    fs.rmSync(extractDir, { recursive: true, force: true });
    fs.unlinkSync(zipPath);
    return true;

  } catch (error) {
    console.error(`  ${platformArch}: Failed - ${error.message}`);
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    return false;
  }
}

async function main() {
  console.log(`\nDownloading llama-server binaries (${LLAMA_CPP_VERSION})...\n`);

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
    if (!BINARIES[targetPlatformArch]) {
      console.error(`Unsupported platform/arch: ${targetPlatformArch}`);
      process.exitCode = 1;
      return;
    }

    // Only download for specified platform/arch
    console.log(`Downloading for target platform (${targetPlatformArch}):`);
    const downloadOk = await downloadBinary(targetPlatformArch, BINARIES[targetPlatformArch]);
    if (!downloadOk) {
      console.error(`Failed to download binaries for ${targetPlatformArch}`);
      process.exitCode = 1;
      return;
    }

    if (shouldCleanup) {
      // Clean old binaries that don't match target platform/arch
      const existingFiles = fs.readdirSync(BIN_DIR).filter(f => f.startsWith("llama-server"));
      const targetPrefix = `llama-server-${targetPlatformArch}`;

      existingFiles.forEach(file => {
        if (!file.startsWith(targetPrefix)) {
          const filePath = path.join(BIN_DIR, file);
          console.log(`Removing old binary: ${file}`);
          fs.unlinkSync(filePath);
        }
      });
    }
  } else if (process.argv.includes("--all")) {
    // Download all platforms
    console.log("Downloading all platform binaries:");
    for (const platformArch of Object.keys(BINARIES)) {
      await downloadBinary(platformArch, BINARIES[platformArch]);
    }
  } else {
    // Default: download for all platforms (build targets)
    console.log("Downloading binaries for all platforms:");
    for (const platformArch of Object.keys(BINARIES)) {
      await downloadBinary(platformArch, BINARIES[platformArch]);
    }
  }

  console.log("\n---");

  // List what we have
  const files = fs.readdirSync(BIN_DIR).filter(f => f.startsWith("llama-server"));
  if (files.length > 0) {
    console.log("Available llama-server binaries:\n");
    files.forEach(f => {
      const stats = fs.statSync(path.join(BIN_DIR, f));
      console.log(`  - ${f} (${Math.round(stats.size / 1024 / 1024)}MB)`);
    });
  } else {
    console.log("No binaries downloaded yet.");
    console.log("\nCheck that the release exists:");
    console.log(`  https://github.com/${LLAMA_CPP_REPO}/releases/tag/${LLAMA_CPP_VERSION}`);
  }
}

main().catch(console.error);
