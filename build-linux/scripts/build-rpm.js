#!/usr/bin/env node
const { existsSync } = require('fs');
const path = require('path');
const { getTarballFilename, getRpmFilename } = require('./version-utils');
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
  buildUtils.log(`[RPM Build] ${message}`);
}

function runCommand(command) {
  buildUtils.runCommand(command, WORKING_DIR);
}

async function buildRpm() {
  log('Starting RPM build...');
  
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
    `-v "${WORKING_DIR}:/workspace:Z"`,
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
  buildUtils.copySpecificArtifacts(path.join(WORKING_DIR, "dist", getRpmFilename()));

  buildUtils.ensureArtifactInOutput(getRpmFilename());

  log('RPM build completed successfully!');
}

if (require.main === module) {
  buildRpm().catch(error => {
    console.error(error);
    process.exit(1);
  });
}