#!/usr/bin/env ts-node
import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import * as path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const BUILD_DIR = path.join(PROJECT_ROOT, 'build');
const FLATPAK_DIR = path.join(BUILD_DIR, 'flatpak');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'dist');

function log(message: string) {
  console.log(`[Flatpak Build] ${message}`);
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

async function buildFlatpak() {
  log('Starting Flatpak build...');
  
  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Build the Electron app first
  log('Building Electron app...');
  runCommand('npm run build:renderer');
  runCommand('npm run pack');

  // Build Flatpak using Docker
  log('Building Flatpak package...');
  const dockerCommand = [
    'docker run --rm',
    `-v "${PROJECT_ROOT}:/workspace"`,
    '-w /workspace',
    '--privileged',
    'openwispr-flatpak-builder',
    'flatpak-builder',
    '--force-clean',
    '--repo=flatpak-repo',
    'flatpak-build',
    'build/flatpak/com.herotools.openwispr.yml'
  ].join(' ');
  
  runCommand(dockerCommand);

  // Export the Flatpak
  log('Exporting Flatpak...');
  const exportCommand = [
    'docker run --rm',
    `-v "${PROJECT_ROOT}:/workspace"`,
    '-w /workspace',
    '--privileged',
    'openwispr-flatpak-builder',
    'flatpak build-bundle',
    'flatpak-repo',
    `${OUTPUT_DIR}/OpenWispr-1.0.2.flatpak`,
    'com.herotools.openwispr'
  ].join(' ');
  
  runCommand(exportCommand);

  log('Flatpak build completed successfully!');
  log(`Output: ${OUTPUT_DIR}/OpenWispr-1.0.2.flatpak`);
}

if (require.main === module) {
  buildFlatpak().catch(console.error);
}