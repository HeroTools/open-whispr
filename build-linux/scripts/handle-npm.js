#!/usr/bin/env node
const {
  readFileSync,
  writeFileSync,
  existsSync,
  rmSync,
  copyFileSync,
  unlinkSync,
} = require("fs");
const path = require("path");
const BuildUtils = require("./build-utils");

const buildUtils = new BuildUtils();

// Use orchestrator's temp directory
const tempDirArg = process.argv.find((arg) =>
  arg.startsWith("--temp-build-dir=")
);
let tempDirArgValue = null;
if (tempDirArg) {
  tempDirArgValue = tempDirArg?.split("=")[1];
} else {
  throw new Error("Missing --temp-build-dir argument");
}
const WORKING_DIR = tempDirArgValue;

function log(message) {
  console.log(`[Handle NPM] ${message}`);
}

// Only Linux-specific esbuild dependencies
const LINUX_ESBUILD_DEPS = ["@esbuild/linux-x64", "@esbuild/linux-arm64"];

const skipCleanArg = process.argv.find((arg) => arg.startsWith("--skip-clean"));
const SKIP_CLEAN = skipCleanArg ? true : false;

function filterDependenciesForLinux(deps) {
  if (!deps) return {};

  const filtered = {};

  for (const [depName, version] of Object.entries(deps)) {
    // Include all non-esbuild dependencies
    if (!depName.startsWith("@esbuild/")) {
      filtered[depName] = version;
    }
    // Only include Linux esbuild dependencies
    else if (LINUX_ESBUILD_DEPS.includes(depName)) {
      filtered[depName] = version;
    } else {
      log(`Excluding non-Linux esbuild dependency: ${depName}`);
    }
  }

  return filtered;
}

function createLinuxPackageJson() {
  const packageJsonPath = path.join(WORKING_DIR, "package.json");
  const originalPackageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

  log("Creating Linux-specific package.json...");

  const linuxPackageJson = {
    ...originalPackageJson,
    devDependencies: filterDependenciesForLinux(
      originalPackageJson.devDependencies
    ),
    optionalDependencies: filterDependenciesForLinux(
      originalPackageJson.optionalDependencies
    ),
  };

  const outputPath = path.join(WORKING_DIR, "package.linux.json");
  writeFileSync(outputPath, JSON.stringify(linuxPackageJson, null, 2));
  log(`Created ${outputPath}`);
}

function npmInstallAndElectronBuild() {
  log(
    "🔧 Installing dependencies for Linux build and running electron build..."
  );
  const packageJsonPath = path.join(WORKING_DIR, "package.json");
  const packageLinuxPath = path.join(WORKING_DIR, "package.linux.json");

  // Use Linux-specific package.json
  log(`Using package.linux.json: ${packageLinuxPath}`);
  if (existsSync(packageLinuxPath)) {
    copyFileSync(packageLinuxPath, packageJsonPath);
  } else {
    throw new Error(
      "package.linux.json not found! Run 'node build-linux/scripts/handle-npm.js create-linux-package-json' first"
    );
  }

  // Clean dependencies
  if (SKIP_CLEAN === false) {
    log("🧹 Cleaning node_modules...");
    rmSync(path.join(WORKING_DIR, "node_modules"), {
      recursive: true,
      force: true,
    });
  } else {
    log("⏩ Skipping node_modules cleanup...");
  }
  rmSync(path.join(WORKING_DIR, "package-lock.json"), { force: true });

  // Install dependencies
  const { execSync } = require("child_process");
  log("📥 Installing npm dependencies...");
  execSync("npm install", { stdio: "inherit", cwd: WORKING_DIR });

  log("🔨 Running electron build...");
  execSync("npm run build", { stdio: "inherit", cwd: WORKING_DIR });

  if (existsSync(path.join(WORKING_DIR, "dist/linux-unpacked"))) {
    log("✅ Finished npm install and electron build!");
  } else {
    log("❌ Electron build failed - output directory not found");
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  log("Work dir: ", WORKING_DIR);

  switch (command) {
    case "create-linux-package-json":
      log("Creating Linux-specific package.json...");
      createLinuxPackageJson();
      log("✅ Linux package.json created");
      break;

    case "npm-install-and-electron-build":
      log(
        "Installing dependencies for Linux build and running electron build..."
      );
      npmInstallAndElectronBuild();
      break;

    default:
      log("Usage:");
      log("  create-linux-package-json - Create Linux-specific package.json");
      log(
        "  npm-install-and-electron-build - Install dependencies for Linux build and run electron build"
      );
  }
}

if (require.main === module) {
  main();
}
