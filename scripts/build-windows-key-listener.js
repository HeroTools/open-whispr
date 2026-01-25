#!/usr/bin/env node

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const isWindows = process.platform === "win32";
if (!isWindows) {
  // Only build on Windows
  process.exit(0);
}

const projectRoot = path.resolve(__dirname, "..");
const cSource = path.join(projectRoot, "resources", "windows-key-listener.c");
const outputDir = path.join(projectRoot, "resources", "bin");
const outputBinary = path.join(outputDir, "windows-key-listener.exe");

function log(message) {
  console.log(`[windows-key-listener] ${message}`);
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

if (!fs.existsSync(cSource)) {
  console.error(`[windows-key-listener] C source not found at ${cSource}`);
  process.exit(1);
}

ensureDir(outputDir);

// Check if rebuild is needed
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

if (!needsBuild) {
  log("Binary is up to date, skipping build.");
  process.exit(0);
}

// Try different compilers in order of preference
const compilers = [
  // MSVC (Visual Studio)
  {
    name: "MSVC",
    command: "cl",
    args: ["/O2", "/nologo", cSource, `/Fe:${outputBinary}`, "user32.lib"],
  },
  // MinGW-w64
  {
    name: "MinGW-w64",
    command: "gcc",
    args: ["-O2", "-mwindows", cSource, "-o", outputBinary, "-luser32"],
  },
  // Clang (LLVM)
  {
    name: "Clang",
    command: "clang",
    args: ["-O2", cSource, "-o", outputBinary, "-luser32"],
  },
];

let success = false;
for (const compiler of compilers) {
  log(`Trying ${compiler.name}...`);

  // Check if compiler is available
  const checkResult = spawnSync(compiler.command, ["--version"], {
    stdio: "pipe",
    shell: true,
  });

  if (checkResult.status !== 0 && checkResult.error) {
    log(`${compiler.name} not found, trying next...`);
    continue;
  }

  log(`Compiling with: ${compiler.command} ${compiler.args.join(" ")}`);
  const result = spawnSync(compiler.command, compiler.args, {
    stdio: "inherit",
    cwd: projectRoot,
    shell: true,
  });

  if (result.status === 0) {
    success = true;
    log(`Successfully built with ${compiler.name}`);
    break;
  } else {
    log(`${compiler.name} compilation failed, trying next...`);
  }
}

if (!success) {
  console.warn("[windows-key-listener] Could not compile Windows key listener.");
  console.warn("[windows-key-listener] Push to Talk on Windows will use fallback mode.");
  console.warn("[windows-key-listener] To enable, install Visual Studio Build Tools or MinGW-w64.");
  // Don't fail the build - Push to Talk can work in fallback mode
  process.exit(0);
}

log("Windows key listener built successfully.");
