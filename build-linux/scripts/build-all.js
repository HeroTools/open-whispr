#!/usr/bin/env node
const { existsSync } = require("fs");
const path = require("path");
const { getDebFilename, getRpmFilename, getFlatpakFilename, getAppImageFilename } = require("./version-utils");
const BuildUtils = require("./build-utils");

const SCRIPTS_DIR = __dirname;

const skipCleanArg = process.argv.find((arg) => arg.startsWith("--skip-clean"));
const SKIP_CLEAN = skipCleanArg ? true : false;

const skipNpmBuildArg = process.argv.find((arg) =>
  arg.startsWith("--skip-npm-build")
);
const SKIP_NPM_BUILD = skipNpmBuildArg ? true : false;

const skipFlatpakBuildPreparationArg = process.argv.find((arg) =>
  arg.startsWith("--skip-flatpak-build-preparation")
);
const SKIP_FLATPAK_BUILD_PREPARATION = skipFlatpakBuildPreparationArg
  ? true
  : false;

const buildOnlyArg = process.argv.find((arg) => arg.startsWith("--build-only="));
const buildOnlyArgValue = buildOnlyArg ? buildOnlyArg.split("=")[1] : null;
let BUILD_ONLY = null;
if (buildOnlyArgValue === "flatpak") {
  BUILD_ONLY = "flatpak";
} else if (buildOnlyArgValue === "appimage") {
  BUILD_ONLY = "appimage";
} else if (buildOnlyArgValue === "deb") {
  BUILD_ONLY = "deb";
} else if (buildOnlyArgValue === "rpm") {
  BUILD_ONLY = "rpm";
} else if (buildOnlyArg !== null && buildOnlyArg !== undefined) {
  throw new Error("Invalid --build-only value");
}

const fixedBuildDirNameArg = process.argv.find((arg) =>
  arg.startsWith("--fixed-build-dir-name")
);
const FIXED_BUILD_DIR_NAME = fixedBuildDirNameArg ? true : false;

const buildUtils = new BuildUtils(FIXED_BUILD_DIR_NAME);

function log(message) {
  console.log(`[Build All] ${message}`);
}

async function buildAll() {
  log("Starting complete Linux packaging build...");

  if (SKIP_CLEAN) {
    log("⏩ Skipping cleanup and reusing existing build caches");
  }
  if (SKIP_NPM_BUILD) {
    log("⏩ Skipping npm build");
  }
  if (SKIP_FLATPAK_BUILD_PREPARATION) {
    log("⏩ Skipping flatpak build preparation");
  }

  // Step 1: Prepare temporary build directory with full repo copy
  log("Preparing temporary build environment...");
  const tempBuildDir = buildUtils.prepareTempBuildDir(SKIP_CLEAN);

  // Step 2: Build Docker images
  log("Building Docker images...");
  await buildDockerImages(buildUtils);

  // Step 3: Render all manifest templates with current version/arch
  log("Rendering manifest templates...");
  buildUtils.renderManifests();

  // Step 4: Handle platform-specific dependencies in temp directory
  log("Handling platform-specific dependencies...");
  const tempScriptDir = path.join(tempBuildDir, "build-linux/scripts");
  buildUtils.runCommand(
    `node ${path.join(
      tempScriptDir,
      "handle-npm.js"
    )} create-linux-package-json --temp-build-dir=${tempBuildDir}`,
    tempBuildDir
  );

  // Step 5: Build renderer and electron app inside npm/electron Docker container
  log("Building renderer and Electron app inside Docker (npm builder)...");
  const arch = buildUtils.getCurrentArch();
  const platform = arch === "amd64" ? "linux/amd64" : "linux/arm64";
  // Run the preparation script (installs deps and runs electron build) inside the container
  const npmBuildCmd = [
    "docker run --rm",
    `-v "${tempBuildDir}:/workspace:Z"`,
    "-w /workspace",
    `open-whispr-npm-builder-${arch}`,
    "bash -lc",
    `"node ./build-linux/scripts/handle-npm.js npm-install-and-electron-build --temp-build-dir=/workspace ${
      SKIP_CLEAN ? "--skip-clean" : ""
    }"`,
  ].join(" ");

  if (!SKIP_NPM_BUILD) {
    buildUtils.runCommand(npmBuildCmd);
  } else {
    log("⏩ Skipping npm build...");
  }

  // Step 6: Verify electron-builder output exists
  const distLinuxUnpacked = path.join(tempBuildDir, "dist/linux-unpacked");
  if (!existsSync(distLinuxUnpacked)) {
    throw new Error(
      `Electron app build failed - ${distLinuxUnpacked} does not exist`
    );
  }
  log(`✅ Electron app built successfully at ${distLinuxUnpacked}`);

  // Step 7: Build all package formats in temp directory
  log("Building all package formats...");

  let buildScripts = [
    "build-flatpak.js",
    "build-appimage.js",
    "build-deb.js",
    "build-rpm.js",
  ];
  if (BUILD_ONLY) {
    buildScripts = [`build-${BUILD_ONLY}.js`];
  }

  for (const script of buildScripts) {
    const scriptPath = path.join(SCRIPTS_DIR, script);
    if (existsSync(scriptPath)) {
      log(`Running ${script}...`);
      // Pass temp build directory as working directory
      buildUtils.runCommand(
        `node ${scriptPath} --temp-build-dir=${tempBuildDir} ${
          SKIP_CLEAN ? "--skip-clean" : ""
        } ${
          SKIP_FLATPAK_BUILD_PREPARATION
            ? "--skip-flatpak-build-preparation"
            : ""
        }`,
        tempBuildDir
      );
    }
  }

  // Step 8: Ensure artifacts are present in dist directory
  buildUtils.ensureArtifactInOutput(getFlatpakFilename());
  buildUtils.ensureArtifactInOutput(getAppImageFilename());
  buildUtils.ensureArtifactInOutput(getDebFilename());
  buildUtils.ensureArtifactInOutput(getRpmFilename());

  log("All builds completed successfully!");
  log("Check the dist/ directory for all package formats.");
}

async function buildDockerImages(buildUtils) {
  const dockerDir = buildUtils.getTempPath("build-linux/docker");
  const arch = process.env.ARCH || "amd64";
  const platform = arch === "arm64" ? "linux/arm64" : "linux/amd64";

  // Define list of Dockerfiles to build for all architectures
  let dockerFiles = [
    "npm.Dockerfile",
    "flatpak.Dockerfile",
    "appimage.Dockerfile",
    "deb.Dockerfile",
    "rpm.Dockerfile",
  ];
  if (BUILD_ONLY) {
    dockerFiles = ["npm.Dockerfile", `${BUILD_ONLY}.Dockerfile`];
  }

  for (const dockerfile of dockerFiles) {
    const formatName = dockerfile.split(".")[0]; // e.g., "flatpak" from "flatpak.Dockerfile"
    const imageName = `open-whispr-${formatName}-builder-${arch}`;
    log(`Building Docker image: ${imageName} for ${platform}`);

    buildUtils.runCommand(
      `docker build --platform ${platform} -f ${dockerfile} -t ${imageName} .`,
      dockerDir
    );
  }
}

function showHelpIfRequested() {
  const helpArg = process.argv.find((arg) => arg.startsWith("--help") || arg.startsWith("-h"));
  if (!helpArg) {
    return;
  }

  console.log("Usage: node build-all.js [options]");
  console.log("Options:");
  console.log("  --skip-clean: Skip cleanup of temp build directory before and after build");
  console.log("  --skip-npm-build: Skip npm build");
  console.log("  --skip-flatpak-build-preparation: Skip flatpak build preparation");
  console.log("  --build-only=<format>: Build only the specified format (flatpak, appimage, deb, rpm)");
  console.log("  --fixed-build-dir-name: Use fixed build directory name, otherwise a time-based one is generated");
  console.log("  --help or -h: Show this help message");

  process.exit(0);
}

if (require.main === module) {
  let wasError = false;
  showHelpIfRequested();
  buildAll()
    .catch((error) => {
      console.error("[Build All] Build failed: ", error);
      wasError = true;
    })
    .finally(() => {
      if (SKIP_CLEAN) {
        log("⏩ Skipping cleanup of temp build directory...");
      } else {
        log("🧹 Cleaning up temp build directory...");
        buildUtils.cleanup();
      }
    })
    .then(() => {
      if (wasError) {
        process.exit(1);
      }
    });
}
