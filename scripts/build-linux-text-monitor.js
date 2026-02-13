#!/usr/bin/env node

const { spawnSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const isLinux = process.platform === "linux";
if (!isLinux) {
  process.exit(0);
}

const projectRoot = path.resolve(__dirname, "..");
const cSource = path.join(projectRoot, "resources", "linux-text-monitor.c");
const outputDir = path.join(projectRoot, "resources", "bin");
const outputBinary = path.join(outputDir, "linux-text-monitor");
const hashFile = path.join(outputDir, ".linux-text-monitor.hash");

function log(message) {
  console.log(`[linux-text-monitor] ${message}`);
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

if (!fs.existsSync(cSource)) {
  console.error(`[linux-text-monitor] C source not found at ${cSource}`);
  process.exit(1);
}

ensureDir(outputDir);

let needsBuild = true;
if (fs.existsSync(outputBinary)) {
  try {
    const binaryStat = fs.statSync(outputBinary);
    const sourceStat = fs.statSync(cSource);
    if (binaryStat.mtimeMs >= sourceStat.mtimeMs) {
      needsBuild = false;
    }
  } catch {
    needsBuild = true;
  }
}

function getPkgConfigFlags() {
  try {
    const check = spawnSync("pkg-config", ["--exists", "atspi-2"], {
      stdio: "pipe",
      env: process.env,
    });
    if (check.status !== 0) return null;

    const result = spawnSync("pkg-config", ["--cflags", "--libs", "atspi-2"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });
    if (result.status !== 0) return null;

    return result.stdout.toString().trim().split(/\s+/).filter(Boolean);
  } catch {
    return null;
  }
}

const pkgFlags = getPkgConfigFlags();
if (!pkgFlags) {
  console.warn("[linux-text-monitor] AT-SPI2 development headers not found. Install libatspi2.0-dev to enable native text monitoring. Falling back to Python script.");
  process.exit(0);
}

function computeBuildHash() {
  const sourceContent = fs.readFileSync(cSource, "utf8");
  const flags = pkgFlags.join(" ");
  return crypto.createHash("sha256").update(sourceContent + flags).digest("hex");
}

if (!needsBuild && fs.existsSync(outputBinary)) {
  try {
    const currentHash = computeBuildHash();

    if (fs.existsSync(hashFile)) {
      const savedHash = fs.readFileSync(hashFile, "utf8").trim();
      if (savedHash !== currentHash) {
        log("Source or build flags changed, rebuild needed");
        needsBuild = true;
      }
    } else {
      fs.writeFileSync(hashFile, currentHash);
    }
  } catch (err) {
    log(`Hash check failed: ${err.message}, forcing rebuild`);
    needsBuild = true;
  }
}

if (!needsBuild) {
  process.exit(0);
}

function attemptCompile(command, args) {
  log(`Compiling with ${[command, ...args].join(" ")}`);
  return spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
  });
}

const compileArgs = ["-O2", cSource, "-o", outputBinary, ...pkgFlags];

log("AT-SPI2 headers found, compiling native text monitor");

let result = attemptCompile("gcc", compileArgs);

if (result.status !== 0) {
  result = attemptCompile("cc", compileArgs);
}

if (result.status !== 0) {
  console.warn("[linux-text-monitor] Failed to compile Linux text monitor binary. Install libatspi2.0-dev and libglib2.0-dev to enable native text monitoring. Falling back to Python script.");
  process.exit(0);
}

try {
  fs.chmodSync(outputBinary, 0o755);
} catch (error) {
  console.warn(`[linux-text-monitor] Unable to set executable permissions: ${error.message}`);
}

try {
  fs.writeFileSync(hashFile, computeBuildHash());
} catch (err) {
  log(`Warning: Could not save source hash: ${err.message}`);
}

log("Successfully built Linux text monitor binary.");
