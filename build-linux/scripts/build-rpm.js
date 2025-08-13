#!/usr/bin/env node
const { execSync } = require('child_process');
const { existsSync, mkdirSync, writeFileSync } = require('fs');
const path = require('path');
const { getTarballFilename, getRpmFilename, getElectronBuilderArch } = require('./version-utils');

const tempBuildDirArg = process.argv.find(arg => arg.startsWith('--temp-build-dir='));
const WORKING_DIR = tempBuildDirArg ? tempBuildDirArg.split('=')[1] : path.resolve(__dirname, '../..');
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const BUILD_DIR = path.join(PROJECT_ROOT, 'build');
const RPM_DIR = path.join(BUILD_DIR, 'rpm');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'dist');

function log(message) {
  console.log(`[RPM Build] ${message}`);
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

async function buildRpm() {
  log('Starting RPM build...');
  
  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Generate manifests first  
  log('Generating manifests with current version...');
  runCommand(`node ${path.join(__dirname, 'generate-manifests.js')}`);

  // Build the Electron app first
  log('Building Electron app...');
  runCommand('npm run build:renderer');
  const electronArch = getElectronBuilderArch();
  runCommand(`npm run build:linux -- --${electronArch}`);

  // Create source tarball
  log('Creating source tarball...');
  const tarballName = getTarballFilename();
  runCommand(`tar --exclude=node_modules --exclude=dist --exclude=.git -czf ${tarballName} .`);

  // Build RPM using Docker
  log('Building RPM package...');
  const arch = process.env.ARCH || 'amd64';
  const rpmArch = arch === 'arm64' ? 'aarch64' : 'x86_64';
  const dockerCommand = [
    'docker run --rm',
    `-v "${PROJECT_ROOT}:/workspace"`,
    '-w /workspace',
    `openwhispr-rpm-builder-${arch}`,
    'bash -c',
    `"cp ${tarballName} /root/rpmbuild/SOURCES/ && `,
    `cp ${RPM_DIR}/open-whispr.spec /root/rpmbuild/SPECS/ && `,
    `rpmbuild -ba /root/rpmbuild/SPECS/open-whispr.spec && `,
    `cp /root/rpmbuild/RPMS/${rpmArch}/${getRpmFilename()} ${OUTPUT_DIR}/"`
  ].join(' ');
  
  runCommand(dockerCommand);

  // Cleanup
  runCommand(`rm -f ${tarballName}`);

  log('RPM build completed successfully!');
  log(`Output: ${OUTPUT_DIR}/${getRpmFilename()}`);
}

if (require.main === module) {
  buildRpm().catch(console.error);
}