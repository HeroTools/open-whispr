#!/usr/bin/env ts-node
import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import * as path from 'path';
import { getTarballFilename, getRpmFilename } from "./version-utils";

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const BUILD_DIR = path.join(PROJECT_ROOT, 'build');
const RPM_DIR = path.join(BUILD_DIR, 'rpm');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'dist');

function log(message: string) {
  console.log(`[RPM Build] ${message}`);
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

async function buildRpm() {
  log('Starting RPM build...');
  
  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Generate manifests first  
  log('Generating manifests with current version...');
  runCommand(`npx ts-node ${path.join(__dirname, 'generate-manifests.ts')}`);

  // Build the Electron app first
  log('Building Electron app...');
  runCommand('npm run build:renderer');
  runCommand('npm run build:linux');

  // Create source tarball
  log('Creating source tarball...');
  const tarballName = getTarballFilename();
  runCommand(`tar --exclude=node_modules --exclude=dist --exclude=.git -czf ${tarballName} .`);

  // Build RPM using Docker
  log('Building RPM package...');
  const dockerCommand = [
    'docker run --rm',
    `-v "${PROJECT_ROOT}:/workspace"`,
    '-w /workspace',
    'openwispr-rpm-builder',
    'bash -c',
    `"cp ${tarballName} /root/rpmbuild/SOURCES/ && `,
    `cp ${RPM_DIR}/open-wispr.spec /root/rpmbuild/SPECS/ && `,
    `rpmbuild -ba /root/rpmbuild/SPECS/open-wispr.spec && `,
    `cp /root/rpmbuild/RPMS/x86_64/${getRpmFilename()} ${OUTPUT_DIR}/"`
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