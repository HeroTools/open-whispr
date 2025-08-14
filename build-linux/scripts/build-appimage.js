#!/usr/bin/env node
const { execSync } = require('child_process');
const { existsSync, mkdirSync, copyFileSync } = require('fs');
const path = require('path');
const { getAppImageFilename, getElectronBuilderArch } = require('./version-utils');
const BuildUtils = require('./build-utils');

// Initialize build utils for consistent temp directory and path handling
const buildUtils = new BuildUtils();

// Use orchestrator's temp directory if provided
const tempBuildDirArg = process.argv.find(arg => arg.startsWith('--temp-build-dir='));
if (tempBuildDirArg) {
  buildUtils.tempBuildDir = tempBuildDirArg.split('=')[1];
}

const WORKING_DIR = buildUtils.getTempBuildDir();
const PROJECT_ROOT = buildUtils.projectRoot;
const BUILD_DIR = buildUtils.getTempPath('build-linux');
const APPIMAGE_DIR = path.join(BUILD_DIR, 'appimage');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'dist');

function log(message) {
  buildUtils.log(`[AppImage Build] ${message}`);
}

function runCommand(command, cwd) {
  buildUtils.runCommand(command, cwd || WORKING_DIR);
}

async function buildAppImage() {
  log('Starting AppImage build...');
  
  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Orchestrator has already prepared directories and built the app

  // Build AppImage using Docker
  log('Building AppImage...');
  const arch = process.env.ARCH || 'amd64';
  const dockerCommand = [
    'docker run --rm',
    `--device /dev/fuse`,
    `--cap-add SYS_ADMIN`,
    `--security-opt apparmor:unconfined`,
    `-v "${WORKING_DIR}:/workspace"`,
    '-w /workspace',
    `open-whispr-appimage-builder-${arch}`,
    'appimage-builder',
    '--recipe build-linux/appimage/AppImageBuilder.yml'
  ].join(' ');
  
  runCommand(dockerCommand);

  // Copy artifacts to main dist directory
  const appImagePath = buildUtils.getTempPath(getAppImageFilename());
  
  if (existsSync(appImagePath)) {
    buildUtils.copySpecificArtifacts(getAppImageFilename());
    log('AppImage build completed successfully!');
    log(`Output: ${OUTPUT_DIR}/${getAppImageFilename()}`);
  } else {
    log('AppImage build failed - output file not found');
    buildUtils.cleanup();
    process.exit(1);
  }
  
  // Cleanup temp directory
  buildUtils.cleanup();
}

if (require.main === module) {
  buildAppImage().catch(error => {
    console.error(error);
    process.exit(1);
  });
}