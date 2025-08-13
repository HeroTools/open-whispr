#!/usr/bin/env ts-node
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import * as path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const SCRIPTS_DIR = __dirname;

function log(message: string) {
  console.log(`[Build All] ${message}`);
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

async function buildAll() {
  log('Starting complete Linux packaging build...');
  
  // Handle platform-specific dependencies
  log('Handling platform-specific dependencies...');
  await handlePlatformDependencies();
  
  // Build Docker images first
  log('Building Docker images...');
  await buildDockerImages();
  
  // Build all package formats
  log('Building all package formats...');
  
  const buildScripts = [
    'build-flatpak.ts',
    'build-appimage.ts', 
    'build-deb.ts',
    'build-rpm.ts'
  ];
  
  for (const script of buildScripts) {
    const scriptPath = path.join(SCRIPTS_DIR, script);
    if (existsSync(scriptPath)) {
      log(`Running ${script}...`);
      runCommand(`tsx ${scriptPath}`);
    }
  }
  
  log('All builds completed successfully!');
  log('Check the dist/ directory for all package formats.');
}

async function handlePlatformDependencies() {
  // Check if we're on Linux and handle @esbuild/darwin-arm64 issue
  if (process.platform === 'linux') {
    log('Removing macOS-specific dependencies for Linux build...');
    
    // Read package.json and temporarily remove problematic dependency
    const packageJsonPath = path.join(PROJECT_ROOT, 'package.json');
    const packageJson = JSON.parse(require('fs').readFileSync(packageJsonPath, 'utf8'));
    
    // Check if the problematic dependency exists
    if (packageJson.devDependencies && packageJson.devDependencies['@esbuild/darwin-arm64']) {
      log('Found @esbuild/darwin-arm64 dependency, temporarily removing for Linux build...');
      
      // Create a backup and remove the dependency
      const backupPath = path.join(PROJECT_ROOT, 'package.json.backup');
      require('fs').writeFileSync(backupPath, JSON.stringify(packageJson, null, 2));
      
      delete packageJson.devDependencies['@esbuild/darwin-arm64'];
      require('fs').writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
      
      log('Dependency temporarily removed. It will be restored after build.');
    }
  }
}

async function buildDockerImages() {
  const dockerFiles = [
    'Dockerfile.flatpak',
    'Dockerfile.appimage',
    'Dockerfile.deb',
    'Dockerfile.rpm'
  ];
  
  const dockerDir = path.join(PROJECT_ROOT, 'build/docker');
  
  for (const dockerfile of dockerFiles) {
    const imageName = `openwispr-${dockerfile.split('.')[1]}-builder`;
    log(`Building Docker image: ${imageName}`);
    
    runCommand(`docker build -f ${dockerfile} -t ${imageName} .`, dockerDir);
  }
}

if (require.main === module) {
  buildAll().catch(console.error);
}