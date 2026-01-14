#!/usr/bin/env node
/**
 * Downloads nircmd.exe for Windows builds.
 *
 * nircmd is a small utility for Windows that allows sending keyboard input
 * and other system commands. Used for fast clipboard paste operations.
 *
 * Source: https://www.nirsoft.net/utils/nircmd.html
 * License: Free for non-commercial use
 */

const https = require("https");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const NIRCMD_URL = "https://www.nirsoft.net/utils/nircmd-x64.zip";
const BIN_DIR = path.join(__dirname, "..", "resources", "bin");
const NIRCMD_PATH = path.join(BIN_DIR, "nircmd.exe");

const REQUEST_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

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

      activeRequest.setTimeout(REQUEST_TIMEOUT, () => {
        cleanup();
        reject(new Error("Connection timed out"));
      });
    };

    request(url);
  }).catch(async (error) => {
    if (retryCount < MAX_RETRIES) {
      console.log(`\n  Retry ${retryCount + 1}/${MAX_RETRIES}: ${error.message}`);
      await sleep(RETRY_DELAY);
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
    execSync(
      `powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`,
      { stdio: "inherit" }
    );
  } else {
    execSync(`unzip -o "${zipPath}" -d "${destDir}"`, { stdio: "inherit" });
  }
}

async function main() {
  // Skip if not Windows and not building for all platforms
  if (process.platform !== "win32" && !process.argv.includes("--all")) {
    console.log("\nSkipping nircmd.exe download (Windows-only utility)\n");
    return;
  }

  console.log("\nDownloading nircmd.exe for Windows...\n");

  // Create bin directory
  fs.mkdirSync(BIN_DIR, { recursive: true });

  // Check if already exists
  if (fs.existsSync(NIRCMD_PATH)) {
    console.log("  nircmd.exe already exists, skipping\n");
    return;
  }

  const zipPath = path.join(BIN_DIR, "nircmd-x64.zip");

  try {
    console.log(`  Downloading from ${NIRCMD_URL}`);
    await downloadFile(NIRCMD_URL, zipPath);

    console.log("  Extracting...");
    const extractDir = path.join(BIN_DIR, "temp-nircmd");
    fs.mkdirSync(extractDir, { recursive: true });
    extractZip(zipPath, extractDir);

    // Copy nircmd.exe to bin directory
    const extractedPath = path.join(extractDir, "nircmd.exe");
    if (fs.existsSync(extractedPath)) {
      fs.copyFileSync(extractedPath, NIRCMD_PATH);
      const stats = fs.statSync(NIRCMD_PATH);
      console.log(`  ✓ nircmd.exe downloaded (${Math.round(stats.size / 1024)}KB)\n`);
    } else {
      console.error("  ✗ nircmd.exe not found in archive\n");
      process.exit(1);
    }

    // Cleanup
    fs.rmSync(extractDir, { recursive: true, force: true });
    fs.unlinkSync(zipPath);

  } catch (error) {
    console.error(`  ✗ Failed to download nircmd.exe: ${error.message}\n`);
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    process.exit(1);
  }
}

main().catch(console.error);
