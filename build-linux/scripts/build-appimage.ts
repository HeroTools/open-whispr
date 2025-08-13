#!/usr/bin/env ts-node
import { execSync } from 'child_process';
import { existsSync, mkdirSync, copyFileSync } from 'fs';
import * as path from 'path';
import { getAppImageFilename } from "./version-utils";

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const BUILD_DIR = path.join(PROJECT_ROOT, 'build');
const APPIMAGE_DIR = path.join(BUILD_DIR, 'appimage');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'dist');

function log(message: string) {
  console.log(`[AppImage Build] ${message}`);
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

async function buildAppImage() {
  log('Starting AppImage build...');
  
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

  // Build AppImage using Docker
  log('Building AppImage...');
  const dockerCommand = [
    'docker run --rm',
    `--device /dev/fuse`,
    `--cap-add SYS_ADMIN`,
    `--security-opt apparmor:unconfined`,
    `-v "${PROJECT_ROOT}:/workspace"`,
    '-w /workspace',
    'openwispr-appimage-builder',
    'appimage-builder',
    '--recipe build-linux/appimage/AppImageBuilder.yml'
  ].join(' ');
  
  runCommand(dockerCommand);

  // Move the created AppImage to output directory
  const appImagePath = `${PROJECT_ROOT}/${getAppImageFilename()}`;
  const outputPath = `${OUTPUT_DIR}/${getAppImageFilename()}`;
  
  if (existsSync(appImagePath)) {
    copyFileSync(appImagePath, outputPath);
    log('AppImage build completed successfully!');
    log(`Output: ${outputPath}`);
  } else {
    log('AppImage build failed - output file not found');
    process.exit(1);
  }
}

if (require.main === module) {
  buildAppImage().catch(console.error);
}