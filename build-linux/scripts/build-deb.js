#!/usr/bin/env node
const { execSync } = require('child_process');
const { existsSync, mkdirSync, writeFileSync, chmodSync } = require('fs');
const path = require('path');
const { getDebFilename, getCurrentArch, getElectronBuilderArch } = require('./version-utils');

// Support both temp build directory mode (called from build-all.js) and standalone mode
const tempBuildDirArg = process.argv.find(arg => arg.startsWith('--temp-build-dir='));
const WORKING_DIR = tempBuildDirArg ? tempBuildDirArg.split('=')[1] : path.resolve(__dirname, '../..');
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const BUILD_DIR = path.join(WORKING_DIR, 'build-linux');
const DEB_DIR = path.join(BUILD_DIR, 'deb');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'dist');

function log(message) {
  console.log(`[DEB Build] ${message}`);
}

function runCommand(command, cwd) {
  log(`Running: ${command}`);
  try {
    execSync(command, { stdio: 'inherit', cwd: cwd || WORKING_DIR });
  } catch (error) {
    log(`Command failed: ${command}`);
    process.exit(1);
  }
}

async function buildDeb() {
  log('Starting DEB build...');
  
  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Check if we're in temp build mode (manifests already rendered) or standalone mode
  if (!tempBuildDirArg) {
    log('Running in standalone mode - rendering manifests...');
    const BuildUtils = require('./build-utils');
    const buildUtils = new BuildUtils();
    buildUtils.renderManifests();
  } else {
    log('Running in temp build mode - manifests already rendered');
  }

  // Build the Electron app first
  log('Building Electron app...');
  runCommand('npm run build:renderer');
  const electronArch = getElectronBuilderArch();
  runCommand(`npm run build:linux -- --${electronArch}`);

  // Prepare DEB package structure
  log('Preparing DEB package structure...');
  const debPackageDir = path.join(PROJECT_ROOT, 'deb-package');
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
    `openwhispr-deb-builder-${arch}`,
    'dpkg-deb',
    '--build',
    'deb-package',
    `${OUTPUT_DIR}/${getDebFilename()}`
  ].join(' ');
  
  runCommand(dockerCommand);

  // Cleanup
  runCommand(`rm -rf ${debPackageDir}`);

  log('DEB build completed successfully!');
  log(`Output: ${OUTPUT_DIR}/${getDebFilename()}`);
}

if (require.main === module) {
  buildDeb().catch(console.error);
}