#!/usr/bin/env node
/**
 * Downloads prebuilt Windows text monitor binary from GitHub releases.
 * Used for auto-learn correction monitoring on Windows.
 *
 * Usage:
 *   node scripts/download-windows-text-monitor.js [--force]
 *
 * Options:
 *   --force    Re-download even if binary already exists
 */

const fs = require("fs");
const path = require("path");
const { downloadFile, extractZip, fetchLatestRelease, setExecutable } = require("./lib/download-utils");

const REPO = "OpenWhispr/openwhispr";
const TAG_PREFIX = "windows-text-monitor-v";
const ZIP_NAME = "windows-text-monitor-win32-x64.zip";
const BINARY_NAME = "windows-text-monitor.exe";

const VERSION_OVERRIDE = process.env.WINDOWS_TEXT_MONITOR_VERSION || null;

const BIN_DIR = path.join(__dirname, "..", "resources", "bin");

async function main() {
  if (process.platform !== "win32") {
    console.log("[windows-text-monitor] Skipping download (not Windows)");
    return;
  }

  const forceDownload = process.argv.includes("--force");
  const outputPath = path.join(BIN_DIR, BINARY_NAME);

  if (fs.existsSync(outputPath) && !forceDownload) {
    console.log("[windows-text-monitor] Already exists (use --force to re-download)");
    console.log(`  ${outputPath}`);
    return;
  }

  if (VERSION_OVERRIDE) {
    console.log(`\n[windows-text-monitor] Using pinned version: ${VERSION_OVERRIDE}`);
  } else {
    console.log("\n[windows-text-monitor] Fetching latest release...");
  }
  const tagToFind = VERSION_OVERRIDE || TAG_PREFIX;
  const release = await fetchLatestRelease(REPO, { tagPrefix: tagToFind });

  if (!release) {
    console.error("[windows-text-monitor] Could not find a release matching prefix:", TAG_PREFIX);
    console.log("[windows-text-monitor] Auto-learn correction monitoring will be disabled");
    return;
  }

  const zipAsset = release.assets.find((a) => a.name === ZIP_NAME);
  if (!zipAsset) {
    console.error(`[windows-text-monitor] Release ${release.tag} does not contain ${ZIP_NAME}`);
    console.log("[windows-text-monitor] Available assets:", release.assets.map((a) => a.name).join(", "));
    return;
  }

  console.log(`\nDownloading Windows text monitor (${release.tag})...\n`);

  fs.mkdirSync(BIN_DIR, { recursive: true });

  const zipPath = path.join(BIN_DIR, ZIP_NAME);
  console.log(`  Downloading from: ${zipAsset.url}`);

  try {
    await downloadFile(zipAsset.url, zipPath);

    const extractDir = path.join(BIN_DIR, "temp-windows-text-monitor");
    fs.mkdirSync(extractDir, { recursive: true });

    console.log("  Extracting...");
    extractZip(zipPath, extractDir);

    const binaryPath = path.join(extractDir, BINARY_NAME);
    if (fs.existsSync(binaryPath)) {
      fs.copyFileSync(binaryPath, outputPath);
      setExecutable(outputPath);
      console.log(`  Extracted to: ${BINARY_NAME}`);
    } else {
      throw new Error(`Binary not found in archive: ${BINARY_NAME}`);
    }

    fs.rmSync(extractDir, { recursive: true, force: true });
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }

    const stats = fs.statSync(outputPath);
    console.log(`\n[windows-text-monitor] Successfully downloaded ${release.tag} (${Math.round(stats.size / 1024)}KB)`);
  } catch (error) {
    console.error(`\n[windows-text-monitor] Download failed: ${error.message}`);

    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }

    console.log("[windows-text-monitor] Auto-learn correction monitoring will be disabled");
    console.log("[windows-text-monitor] To compile locally, install Visual Studio Build Tools or MinGW-w64");
  }
}

main().catch((error) => {
  console.error("[windows-text-monitor] Unexpected error:", error);
});
