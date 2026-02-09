#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const {
  downloadFile,
  extractArchive,
  fetchLatestRelease,
  findBinaryInDir,
  parseArgs,
  setExecutable,
  cleanupFiles,
} = require("./lib/download-utils");

const LLAMA_CPP_REPO = "ggerganov/llama.cpp";

// Version can be pinned via environment variable for reproducible builds
const VERSION_OVERRIDE = process.env.LLAMA_CPP_VERSION || null;

const WINDOWS_BACKENDS = [
  {
    id: "cuda",
    isGpu: true,
    assetPattern: /^llama-.*-bin-win-cuda.*-x64\.zip$/i,
  },
  {
    id: "vulkan",
    isGpu: true,
    assetPattern: /^llama-.*-bin-win-vulkan.*-x64\.zip$/,
  },
  {
    id: "hip",
    isGpu: true,
    assetPattern: /^llama-.*-bin-win-hip.*-x64\.zip$/,
  },
  {
    id: "cpu",
    required: true,
    assetPattern: /^llama-.*-bin-win-cpu-x64\.zip$/,
  },
];

// Asset name patterns to match in the release (version-independent)
const BINARIES = {
  "darwin-arm64": {
    assetPattern: /^llama-.*-bin-macos-arm64\.tar\.gz$/,
    binaryPath: "build/bin/llama-server",
    outputName: "llama-server-darwin-arm64",
    libPattern: "*.dylib",
  },
  "darwin-x64": {
    assetPattern: /^llama-.*-bin-macos-x64\.tar\.gz$/,
    binaryPath: "build/bin/llama-server",
    outputName: "llama-server-darwin-x64",
    libPattern: "*.dylib",
  },
  "win32-x64": {
    binaryPath: "build/bin/llama-server.exe",
    outputName: "llama-server-win32-x64",
    libPattern: "*.dll",
    windowsBackends: WINDOWS_BACKENDS,
  },
  "linux-x64": {
    assetPattern: /^llama-.*-bin-ubuntu-x64\.tar\.gz$/,
    binaryPath: "build/bin/llama-server",
    outputName: "llama-server-linux-x64",
    libPattern: "*.so*",
  },
};

const BIN_DIR = path.join(__dirname, "..", "resources", "bin");

// Cache the release info to avoid multiple API calls
let cachedRelease = null;

async function getRelease() {
  if (cachedRelease) return cachedRelease;

  if (VERSION_OVERRIDE) {
    cachedRelease = await fetchLatestRelease(LLAMA_CPP_REPO, { tagPrefix: VERSION_OVERRIDE });
  } else {
    cachedRelease = await fetchLatestRelease(LLAMA_CPP_REPO);
  }
  return cachedRelease;
}

function findAssetByPattern(release, pattern) {
  return release?.assets?.find((a) => pattern.test(a.name));
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

async function downloadBinary(platformArch, config, release, isForce = false, backend = null) {
  if (!config) {
    console.log(`  ${platformArch}: Not supported`);
    return false;
  }

  const backendLabel = backend ? ` (${backend.id})` : "";
  const outputPath = backend
    ? path.join(BIN_DIR, config.outputName, backend.id)
    : path.join(BIN_DIR, config.outputName);

  if (fs.existsSync(outputPath) && !isForce) {
    console.log(`  ${platformArch}${backendLabel}: Already exists (use --force to re-download)`);
    return true;
  }

  const asset = backend
    ? findAssetByPattern(release, backend.assetPattern)
    : findAssetByPattern(release, config.assetPattern);
  if (!asset) {
    console.error(`  ${platformArch}${backendLabel}: No matching asset found`);
    return false;
  }

  console.log(`  ${platformArch}${backendLabel}: Downloading from ${asset.url}`);

  const zipPath = path.join(BIN_DIR, asset.name);

  try {
    await downloadFile(asset.url, zipPath);

    const extractDir = path.join(BIN_DIR, `temp-llama-${platformArch}${backend ? `-${backend.id}` : ""}`);
    fs.mkdirSync(extractDir, { recursive: true });
    extractArchive(zipPath, extractDir);

    const binaryName = path.basename(config.binaryPath);
    let binaryPath = path.join(extractDir, config.binaryPath);

    if (!fs.existsSync(binaryPath)) {
      binaryPath = findBinaryInDir(extractDir, binaryName);
    }

    if (binaryPath && fs.existsSync(binaryPath)) {
      if (backend) {
        fs.rmSync(outputPath, { recursive: true, force: true });
        fs.mkdirSync(outputPath, { recursive: true });

        const destBinary = path.join(outputPath, path.basename(binaryPath));
        fs.copyFileSync(binaryPath, destBinary);
        setExecutable(destBinary);
        console.log(`  ${platformArch}${backendLabel}: Installed backend`);

        const libraries = findLibrariesInDir(extractDir, config.libPattern);
        for (const libPath of libraries) {
          const destPath = path.join(outputPath, path.basename(libPath));
          if (!fs.existsSync(destPath)) {
            fs.copyFileSync(libPath, destPath);
            setExecutable(destPath);
          }
        }
      } else {
        fs.copyFileSync(binaryPath, outputPath);
        setExecutable(outputPath);
        console.log(`  ${platformArch}: Extracted to ${config.outputName}`);

        // Copy shared libraries (dylib/dll/so files)
        if (config.libPattern) {
          const libraries = findLibrariesInDir(extractDir, config.libPattern);

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
      }
    } else {
      console.error(`  ${platformArch}${backendLabel}: Binary '${binaryName}' not found in archive`);
      return false;
    }

    fs.rmSync(extractDir, { recursive: true, force: true });
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    return true;
  } catch (error) {
    console.error(`  ${platformArch}${backendLabel}: Failed - ${error.message}`);
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    return false;
  }
}

async function downloadWindowsBackends(platformArch, config, release, isForce) {
  let downloadedGpu = 0;

  for (const backend of config.windowsBackends) {
    const ok = await downloadBinary(platformArch, config, release, isForce, backend);
    if (!ok) {
      if (backend.required) {
        return false;
      }
      console.warn(`  ${platformArch} (${backend.id}): backend not available, skipping`);
      continue;
    }

    if (backend.isGpu) {
      downloadedGpu++;
    }
  }

  if (downloadedGpu === 0) {
    console.warn(`  ${platformArch}: No GPU backend bundle downloaded; CPU-only fallback will be used`);
  }
  return true;
}

async function main() {
  if (VERSION_OVERRIDE) {
    console.log(`\n[llama-server] Using pinned version: ${VERSION_OVERRIDE}`);
  } else {
    console.log("\n[llama-server] Fetching latest release...");
  }
  const release = await getRelease();

  if (!release) {
    console.error(`[llama-server] Could not fetch release from ${LLAMA_CPP_REPO}`);
    console.log(`\nMake sure release exists: https://github.com/${LLAMA_CPP_REPO}/releases`);
    process.exitCode = 1;
    return;
  }

  console.log(`\nDownloading llama-server binaries (${release.tag})...\n`);

  fs.mkdirSync(BIN_DIR, { recursive: true });

  const args = parseArgs();

  if (args.isCurrent) {
    if (!BINARIES[args.platformArch]) {
      console.error(`Unsupported platform/arch: ${args.platformArch}`);
      process.exitCode = 1;
      return;
    }

    console.log(`Downloading for target platform (${args.platformArch}):`);
    const config = BINARIES[args.platformArch];
    const ok =
      args.platformArch === "win32-x64" && config.windowsBackends
        ? await downloadWindowsBackends(args.platformArch, config, release, args.isForce)
        : await downloadBinary(args.platformArch, config, release, args.isForce);
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
      const config = BINARIES[platformArch];
      const ok =
        platformArch === "win32-x64" && config.windowsBackends
          ? await downloadWindowsBackends(platformArch, config, release, args.isForce)
          : await downloadBinary(platformArch, config, release, args.isForce);
      if (!ok) {
        console.error(`Failed to download binaries for ${platformArch}`);
        process.exitCode = 1;
        return;
      }
    }
  }

  console.log("\n---");

  const entries = fs.readdirSync(BIN_DIR).filter((f) => f.startsWith("llama-server"));
  if (entries.length > 0) {
    console.log("Available llama-server binaries:\n");
    entries.forEach((entry) => {
      const fullPath = path.join(BIN_DIR, entry);
      const stats = fs.statSync(fullPath);
      if (stats.isDirectory()) {
        console.log(`  - ${entry}/`);
      } else {
        console.log(`  - ${entry} (${Math.round(stats.size / 1024 / 1024)}MB)`);
      }
    });
  } else {
    console.log("No binaries downloaded yet.");
    console.log(`\nMake sure release exists: https://github.com/${LLAMA_CPP_REPO}/releases`);
  }
}

main().catch(console.error);
