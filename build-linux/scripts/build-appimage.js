#!/usr/bin/env node
const { existsSync } = require('fs');
const path = require('path');
const { getAppImageFilename } = require('./version-utils');
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

const WORKING_DIR = tempBuildDir;

function log(message) {
  buildUtils.log(`[AppImage Build] ${message}`);
}

function runCommand(command) {
  buildUtils.runCommand(command, WORKING_DIR);
}

async function buildAppImage() {
  log('Starting AppImage build...');
  
  // Orchestrator has already prepared directories and built the app

  // Build AppImage using Docker
  log('Building AppImage...');
  const arch = process.env.ARCH || 'amd64';
  const dockerCommand = [
    'docker run --rm',
    `--device /dev/fuse`,
    `--cap-add SYS_ADMIN`,
    `--security-opt apparmor:unconfined`,
    `-v "${WORKING_DIR}:/workspace:Z"`,
    '-w /workspace',
    `open-whispr-appimage-builder-${arch}`,
    'appimage-builder',
    '--recipe build-linux/appimage/AppImageBuilder.yml'
  ].join(' ');
  
  runCommand(dockerCommand);

  // Copy artifacts to main dist directory
  buildUtils.copySpecificArtifacts(path.join(WORKING_DIR, "dist", getAppImageFilename()));
  
  buildUtils.ensureArtifactInOutput(getAppImageFilename());

  log('AppImage build completed successfully!');
}

if (require.main === module) {
  buildAppImage().catch(error => {
    console.error(error);
    process.exit(1);
  });
}