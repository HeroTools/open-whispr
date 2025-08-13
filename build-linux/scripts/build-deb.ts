#!/usr/bin/env ts-node
import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, chmodSync } from 'fs';
import * as path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const BUILD_DIR = path.join(PROJECT_ROOT, 'build');
const DEB_DIR = path.join(BUILD_DIR, 'deb');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'dist');

function log(message: string) {
  console.log(`[DEB Build] ${message}`);
}

function runCommand(command: string, cwd?: string) {
  log(`Running: ${command}`);
  try {
    execSync(command, { stdio: 'inherit', cwd: cwd || PROJECT_ROOT });
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

  // Build the Electron app first
  log('Building Electron app...');
  runCommand('npm run build:renderer');
  runCommand('npm run build:linux');

  // Prepare DEB package structure
  log('Preparing DEB package structure...');
  const debPackageDir = path.join(PROJECT_ROOT, 'deb-package');
  const debianDir = path.join(debPackageDir, 'DEBIAN');
  
  // Clean and create directories
  runCommand(`rm -rf ${debPackageDir}`);
  mkdirSync(debianDir, { recursive: true });
  mkdirSync(path.join(debPackageDir, 'opt/open-wispr'), { recursive: true });
  mkdirSync(path.join(debPackageDir, 'usr/bin'), { recursive: true });
  mkdirSync(path.join(debPackageDir, 'usr/share/applications'), { recursive: true });
  mkdirSync(path.join(debPackageDir, 'usr/share/icons/hicolor/512x512/apps'), { recursive: true });

  // Copy application files
  runCommand(`cp -r dist/linux-unpacked/* ${debPackageDir}/opt/open-wispr/`);
  
  // Create symlink for binary
  runCommand(`ln -sf /opt/open-wispr/open-wispr ${debPackageDir}/usr/bin/open-wispr`);
  
  // Copy desktop file and icon
  runCommand(`cp build-linux/flatpak/com.herotools.openwispr.desktop ${debPackageDir}/usr/share/applications/open-wispr.desktop`);
  runCommand(`cp assets/icon.png ${debPackageDir}/usr/share/icons/hicolor/512x512/apps/open-wispr.png`);
  
  // Copy control files
  runCommand(`cp ${DEB_DIR}/control ${debianDir}/`);
  runCommand(`cp ${DEB_DIR}/postinst ${debianDir}/`);
  runCommand(`cp ${DEB_DIR}/prerm ${debianDir}/`);
  
  // Make scripts executable
  chmodSync(path.join(debianDir, 'postinst'), 0o755);
  chmodSync(path.join(debianDir, 'prerm'), 0o755);

  // Build DEB package using Docker
  log('Building DEB package...');
  const dockerCommand = [
    'docker run --rm',
    `-v "${PROJECT_ROOT}:/workspace"`,
    '-w /workspace',
    'openwispr-deb-builder',
    'dpkg-deb',
    '--build',
    'deb-package',
    `${OUTPUT_DIR}/open-wispr_1.0.2_amd64.deb`
  ].join(' ');
  
  runCommand(dockerCommand);

  // Cleanup
  runCommand(`rm -rf ${debPackageDir}`);

  log('DEB build completed successfully!');
  log(`Output: ${OUTPUT_DIR}/open-wispr_1.0.2_amd64.deb`);
}

if (require.main === module) {
  buildDeb().catch(console.error);
}