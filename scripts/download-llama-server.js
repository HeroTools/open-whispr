#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const {
  downloadFile,
  extractZip,
  findBinaryInDir,
  parseArgs,
  setExecutable,
  cleanupFiles,
} = require("./lib/download-utils");

const LLAMA_CPP_REPO = "ggerganov/llama.cpp";
const LLAMA_CPP_VERSION = "b4621";

const BINARIES = {
  "darwin-arm64": {
    zipName: `llama-${LLAMA_CPP_VERSION}-bin-macos-arm64.zip`,
    binaryPath: "build/bin/llama-server",
    outputName: "llama-server-darwin-arm64",
    libPattern: "*.dylib",
    libDir: "build/bin",
  },
  "darwin-x64": {
    zipName: `llama-${LLAMA_CPP_VERSION}-bin-macos-x64.zip`,
    binaryPath: "build/bin/llama-server",
    outputName: "llama-server-darwin-x64",
    libPattern: "*.dylib",
    libDir: "build/bin",
  },
  "win32-x64": {
    zipName: `llama-${LLAMA_CPP_VERSION}-bin-win-avx2-x64.zip`,
    binaryPath: "build/bin/llama-server.exe",
    outputName: "llama-server-win32-x64.exe",
    libPattern: "*.dll",
    libDir: "build/bin",
  },
  "linux-x64": {
    zipName: `llama-${LLAMA_CPP_VERSION}-bin-ubuntu-x64.zip`,
    binaryPath: "build/bin/llama-server",
    outputName: "llama-server-linux-x64",
    libPattern: "*.so*",
    libDir: "build/bin",
  },
};

const BIN_DIR = path.join(__dirname, "..", "resources", "bin");

function getDownloadUrl(zipName) {
  return `https://github.com/${LLAMA_CPP_REPO}/releases/download/${LLAMA_CPP_VERSION}/${zipName}`;
}

function findLibrariesInDir(dir, pattern, maxDepth = 5, currentDepth = 0) {
  if (currentDepth >= maxDepth) return [];

  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      results.push(...findLibrariesInDir(fullPath, pattern, maxDepth, currentDepth + 1));
    } else if (matchesPattern(entry.name, pattern)) {
      results.push(fullPath);
    }
  }

  return results;
}

function matchesPattern(filename, pattern) {
  // Handle patterns like "*.dylib", "*.dll", "*.so*"
  if (pattern === "*.dylib") {
    return filename.endsWith(".dylib");
  } else if (pattern === "*.dll") {
    return filename.endsWith(".dll");
  } else if (pattern === "*.so*") {
    // Match .so files with optional version suffix (e.g., libfoo.so, libfoo.so.1, libfoo.so.1.2.3)
    return /\.so(\.\d+)*$/.test(filename) || filename.endsWith(".so");
  }
  return false;
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

    const binaryName = path.basename(config.binaryPath);
    let binaryPath = path.join(extractDir, config.binaryPath);

    if (!fs.existsSync(binaryPath)) {
      binaryPath = findBinaryInDir(extractDir, binaryName);
    }

    if (binaryPath && fs.existsSync(binaryPath)) {
      fs.copyFileSync(binaryPath, outputPath);
      setExecutable(outputPath);
      console.log(`  ${platformArch}: Extracted to ${config.outputName}`);

      // Copy shared libraries (dylib/dll/so files)
      if (config.libPattern) {
        const libDir = path.join(extractDir, config.libDir);
        const libraries = findLibrariesInDir(libDir, config.libPattern);

        for (const libPath of libraries) {
          const libName = path.basename(libPath);
          const destPath = path.join(BIN_DIR, libName);

          // Only copy if not already exists (libraries are shared across architectures on same OS)
          if (!fs.existsSync(destPath)) {
            fs.copyFileSync(libPath, destPath);
            setExecutable(destPath);
            console.log(`  ${platformArch}: Copied library ${libName}`);
          }
        }
      }
    } else {
      console.error(`  ${platformArch}: Binary '${binaryName}' not found in archive`);
      return false;
    }

    fs.rmSync(extractDir, { recursive: true, force: true });
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    return true;
  } catch (error) {
    console.error(`  ${platformArch}: Failed - ${error.message}`);
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    return false;
  }
}

async function main() {
  console.log(`\nDownloading llama-server binaries (${LLAMA_CPP_VERSION})...\n`);

  fs.mkdirSync(BIN_DIR, { recursive: true });

  const args = parseArgs();

  if (args.isCurrent) {
    if (!BINARIES[args.platformArch]) {
      console.error(`Unsupported platform/arch: ${args.platformArch}`);
      process.exitCode = 1;
      return;
    }

    console.log(`Downloading for target platform (${args.platformArch}):`);
    const ok = await downloadBinary(args.platformArch, BINARIES[args.platformArch]);
    if (!ok) {
      console.error(`Failed to download binaries for ${args.platformArch}`);
      process.exitCode = 1;
      return;
    }

    if (args.shouldCleanup) {
      cleanupFiles(BIN_DIR, "llama-server", `llama-server-${args.platformArch}`);
    }
  } else {
    console.log("Downloading binaries for all platforms:");
    for (const platformArch of Object.keys(BINARIES)) {
      await downloadBinary(platformArch, BINARIES[platformArch]);
    }
  }

  console.log("\n---");

  const files = fs.readdirSync(BIN_DIR).filter((f) => f.startsWith("llama-server"));
  if (files.length > 0) {
    console.log("Available llama-server binaries:\n");
    files.forEach((f) => {
      const stats = fs.statSync(path.join(BIN_DIR, f));
      console.log(`  - ${f} (${Math.round(stats.size / 1024 / 1024)}MB)`);
    });
  } else {
    console.log("No binaries downloaded yet.");
    console.log(`\nCheck: https://github.com/${LLAMA_CPP_REPO}/releases/tag/${LLAMA_CPP_VERSION}`);
  }
}

main().catch(console.error);
