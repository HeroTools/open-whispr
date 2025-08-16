#!/usr/bin/env node
const { existsSync } = require('fs');
const path = require('path');
const { getFlatpakFilename } = require('./version-utils');
const BuildUtils = require('./build-utils');

// Initialize build utils for consistent temp directory and path handling
const buildUtils = new BuildUtils();

// Use orchestrator's temp directory
const tempBuildDirArg = process.argv.find(arg => arg.startsWith('--temp-build-dir='));
let tempBuildDir;
if (tempBuildDirArg) {
  tempBuildDir = tempBuildDirArg.split('=')[1];
} else {
  throw new Error('Missing --temp-build-dir argument');
}

const skipCleanArg = process.argv.find((arg) => arg.startsWith("--skip-clean"));
const SKIP_CLEAN = skipCleanArg ? true : false;

const skipFlatpakBuildPreparationArg = process.argv.find((arg) => arg.startsWith("--skip-flatpak-build-preparation"));
const SKIP_FLATPAK_BUILD_PREPARATION = skipFlatpakBuildPreparationArg ? true : false;

const WORKING_DIR = tempBuildDir;

function log(message) {
  console.log(`[Flatpak Build] ${message}`);
}

function runCommand(command) {
  buildUtils.runCommand(command, WORKING_DIR);
}

async function buildFlatpak() {
  log('Starting Flatpak build...');

  // Orchestrator has already prepared directories and built the app

  // Build Flatpak using Docker
  log('Building Flatpak package...');
  const arch = process.env.ARCH || 'amd64';
  const flatpakBuildCommand = [
    "docker run --rm",
    `-v "${WORKING_DIR}:/workspace"`,
    "-w /workspace",
    "--privileged",
    `open-whispr-flatpak-builder-${arch}`,
    "flatpak-builder",
    SKIP_CLEAN ? "" : "--force-clean",
    "--repo=flatpak-repo",
    "flatpak-build",
    "build-linux/flatpak/com.herotools.openwhispr.yml",
  ].join(" ");
  
  if (!SKIP_FLATPAK_BUILD_PREPARATION) {
    runCommand(flatpakBuildCommand);
  } else {
    log("⏩ Skipping flatpak build preparation");
  }

  // Export the Flatpak
  log('Exporting Flatpak...');
  const exportCommand = [
    'docker run --rm',
    `-v "${WORKING_DIR}:/workspace:Z"`,
    '-w /workspace',
    '--privileged',
    `open-whispr-flatpak-builder-${arch}`,
    'flatpak build-bundle',
    'flatpak-repo',
    `dist/${getFlatpakFilename()}`,
    'com.herotools.openwhispr'
  ].join(' ');
  
  runCommand(exportCommand);
  
  // Copy artifacts to main dist directory
  const artifactPath = path.join(WORKING_DIR, "dist", getFlatpakFilename());
  buildUtils.copySpecificArtifacts(artifactPath);
  
  buildUtils.ensureArtifactInOutput(getFlatpakFilename());

  log('Flatpak build completed successfully!');
}

if (require.main === module) {
  buildFlatpak().catch(error => {
    console.error(error);
    process.exit(1);
  });
}