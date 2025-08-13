#!/usr/bin/env node
const { execSync } = require('child_process');
const { existsSync, mkdirSync } = require('fs');
const path = require('path');
const { getFlatpakFilename, getElectronBuilderArch } = require('./version-utils');
const BuildUtils = require('./build-utils');

// Initialize build utils for consistent temp directory and path handling
const buildUtils = new BuildUtils();
const WORKING_DIR = buildUtils.getTempBuildDir();
const PROJECT_ROOT = buildUtils.projectRoot;
const BUILD_DIR = buildUtils.getTempPath('build-linux');
const FLATPAK_DIR = path.join(BUILD_DIR, 'flatpak');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'dist');

function log(message) {
  buildUtils.log(`[Flatpak Build] ${message}`);
}

function runCommand(command, cwd) {
  buildUtils.runCommand(command, cwd || WORKING_DIR);
}

async function buildFlatpak() {
  log('Starting Flatpak build...');
  
  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Prepare temp build directory and render manifests
  log('Preparing temp build directory...');
  buildUtils.prepareTempBuildDir();
  buildUtils.renderManifests();

  // Build the Electron app first
  log('Building Electron app...');
  runCommand('npm run build:renderer');
  const electronArch = getElectronBuilderArch();
  runCommand(`npm run pack -- --${electronArch}`);

  // Build Flatpak using Docker
  log('Building Flatpak package...');
  const arch = process.env.ARCH || 'amd64';
  const dockerCommand = [
    'docker run --rm',
    `-v "${WORKING_DIR}:/workspace"`,
    '-w /workspace',
    '--privileged',
    `open-whispr-flatpak-builder-${arch}`,
    'flatpak-builder',
    '--force-clean',
    '--repo=flatpak-repo',
    'flatpak-build',
    'build-linux/flatpak/com.herotools.openwhispr.yml'
  ].join(' ');
  
  runCommand(dockerCommand);

  // Export the Flatpak
  log('Exporting Flatpak...');
  const exportCommand = [
    'docker run --rm',
    `-v "${WORKING_DIR}:/workspace"`,
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
  buildUtils.copySpecificArtifacts(`dist/${getFlatpakFilename()}`);
  
  // Cleanup temp directory
  buildUtils.cleanup();

  log('Flatpak build completed successfully!');
  log(`Output: ${OUTPUT_DIR}/${getFlatpakFilename()}`);
}

if (require.main === module) {
  buildFlatpak().catch(console.error);
}