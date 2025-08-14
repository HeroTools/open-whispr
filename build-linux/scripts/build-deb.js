#!/usr/bin/env node
const { execSync } = require('child_process');
const { existsSync, mkdirSync, writeFileSync, chmodSync } = require('fs');
const path = require('path');
const { getDebFilename, getCurrentArch, getElectronBuilderArch } = require('./version-utils');
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
const DEB_DIR = path.join(BUILD_DIR, 'deb');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'dist');

function log(message) {
  buildUtils.log(`[DEB Build] ${message}`);
}

function runCommand(command, cwd) {
  buildUtils.runCommand(command, cwd || WORKING_DIR);
}

async function buildDeb() {
  log('Starting DEB build...');
  
  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Orchestrator has already prepared directories and built the app

  // Prepare DEB package structure in temp directory
  log('Preparing DEB package structure...');
  const debPackageDir = buildUtils.getTempPath('deb-package');
  const debianDir = path.join(debPackageDir, 'DEBIAN');
  
  // Clean and create directories
  runCommand(`rm -rf ${debPackageDir}`);
  mkdirSync(debianDir, { recursive: true });
  mkdirSync(path.join(debPackageDir, 'opt/open-whispr'), { recursive: true });
  mkdirSync(path.join(debPackageDir, 'usr/bin'), { recursive: true });
  mkdirSync(path.join(debPackageDir, 'usr/share/applications'), { recursive: true });
  mkdirSync(path.join(debPackageDir, 'usr/share/icons/hicolor/512x512/apps'), { recursive: true });

  // Copy application files
  runCommand(`cp -r ${WORKING_DIR}/dist/linux-unpacked/* ${debPackageDir}/opt/open-whispr/`);
  
  // Create symlink for binary
  runCommand(`ln -sf /opt/open-whispr/open-whispr ${debPackageDir}/usr/bin/open-whispr`);
  
  // Copy desktop file and icon
  runCommand(`cp ${WORKING_DIR}/build-linux/flatpak/com.herotools.openwhispr.desktop ${debPackageDir}/usr/share/applications/open-whispr.desktop`);
  runCommand(`cp ${WORKING_DIR}/assets/icon.png ${debPackageDir}/usr/share/icons/hicolor/512x512/apps/open-whispr.png`);
  
  // Copy control files
  runCommand(`cp ${DEB_DIR}/control ${debianDir}/`);
  runCommand(`cp ${DEB_DIR}/postinst ${debianDir}/`);
  runCommand(`cp ${DEB_DIR}/prerm ${debianDir}/`);
  
  // Make scripts executable
  chmodSync(path.join(debianDir, 'postinst'), 0o755);
  chmodSync(path.join(debianDir, 'prerm'), 0o755);

  // Build DEB package using Docker
  log('Building DEB package...');
  const arch = process.env.ARCH || 'amd64';
  const dockerCommand = [
    'docker run --rm',
    `-v "${WORKING_DIR}:/workspace"`,
    '-w /workspace',
    `open-whispr-deb-builder-${arch}`,
    'dpkg-deb',
    '--build',
    'deb-package',
    `dist/${getDebFilename()}`
  ].join(' ');
  
  runCommand(dockerCommand);
  
  // Copy artifacts to main dist directory
  buildUtils.copySpecificArtifacts(`dist/${getDebFilename()}`);

  // Cleanup temp directory
  buildUtils.cleanup();

  log('DEB build completed successfully!');
  log(`Output: ${OUTPUT_DIR}/${getDebFilename()}`);
}

if (require.main === module) {
  buildDeb().catch(error => {
    console.error(error);
    process.exit(1);
  });
}