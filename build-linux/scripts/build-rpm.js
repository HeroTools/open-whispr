#!/usr/bin/env node
const { execSync } = require('child_process');
const { existsSync, mkdirSync, writeFileSync } = require('fs');
const path = require('path');
const { getTarballFilename, getRpmFilename, getElectronBuilderArch } = require('./version-utils');
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
const RPM_DIR = path.join(BUILD_DIR, 'rpm');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'dist');

function log(message) {
  buildUtils.log(`[RPM Build] ${message}`);
}

function runCommand(command, cwd) {
  buildUtils.runCommand(command, cwd || WORKING_DIR);
}

async function buildRpm() {
  log('Starting RPM build...');
  
  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Orchestrator has already prepared directories and built the app

  // Create source tarball in temp directory
  log('Creating source tarball...');
  const tarballName = getTarballFilename();
  const tarballPath = buildUtils.getTempPath(tarballName);
  runCommand(`tar --exclude=node_modules --exclude=dist --exclude=.git -czf ${tarballPath} .`);

  // Build RPM using Docker
  log('Building RPM package...');
  const arch = process.env.ARCH || 'amd64';
  const rpmArch = arch === 'arm64' ? 'aarch64' : 'x86_64';
  const dockerCommand = [
    'docker run --rm',
    `-v "${WORKING_DIR}:/workspace"`,
    '-w /workspace',
    `open-whispr-rpm-builder-${arch}`,
    'bash -c',
    `"cp ${tarballName} /root/rpmbuild/SOURCES/ && `,
    `cp build-linux/rpm/open-whispr.spec /root/rpmbuild/SPECS/ && `,
    `rpmbuild -ba /root/rpmbuild/SPECS/open-whispr.spec && `,
    `cp /root/rpmbuild/RPMS/${rpmArch}/${getRpmFilename()} dist/"`
  ].join(' ');
  
  runCommand(dockerCommand);
  
  // Copy artifacts to main dist directory
  buildUtils.copySpecificArtifacts(`dist/${getRpmFilename()}`);

  // Cleanup temp directory
  buildUtils.cleanup();

  log('RPM build completed successfully!');
  log(`Output: ${OUTPUT_DIR}/${getRpmFilename()}`);
}

if (require.main === module) {
  buildRpm().catch(error => {
    console.error(error);
    process.exit(1);
  });
}