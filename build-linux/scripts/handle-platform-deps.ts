#!/usr/bin/env ts-node
import { readFileSync, writeFileSync, existsSync } from 'fs';
import * as path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

interface PackageJson {
  name: string;
  version: string;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  [key: string]: any;
}

function log(message: string) {
  console.log(`[Platform Deps] ${message}`);
}

const PLATFORM_SPECIFIC_DEPS = {
  '@esbuild-linux/darwin-arm64': ['darwin'],
  '@esbuild-linux/darwin-x64': ['darwin'],
  '@esbuild-linux/win32-x64': ['win32'],
  '@esbuild-linux/win32-ia32': ['win32'],
  '@esbuild-linux/linux-x64': ['linux'],
  '@esbuild-linux/linux-arm64': ['linux']
};

function shouldIncludeDependency(depName: string, targetPlatform?: string): boolean {
  const platforms = PLATFORM_SPECIFIC_DEPS[depName as keyof typeof PLATFORM_SPECIFIC_DEPS];
  
  if (!platforms) {
    return true; // Include non-platform-specific dependencies
  }
  
  const currentPlatform = targetPlatform || process.platform;
  return platforms.includes(currentPlatform);
}

function filterDependenciesForPlatform(
  deps: Record<string, string> | undefined,
  targetPlatform?: string
): Record<string, string> {
  if (!deps) return {};
  
  const filtered: Record<string, string> = {};
  
  for (const [depName, version] of Object.entries(deps)) {
    if (shouldIncludeDependency(depName, targetPlatform)) {
      filtered[depName] = version;
    } else {
      log(`Excluding platform-specific dependency: ${depName} (not needed for ${targetPlatform || process.platform})`);
    }
  }
  
  return filtered;
}

function createPlatformPackageJson(targetPlatform: string): void {
  const packageJsonPath = path.join(PROJECT_ROOT, 'package.json');
  const originalPackageJson: PackageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  
  log(`Creating platform-specific package.json for ${targetPlatform}...`);
  
  const platformPackageJson: PackageJson = {
    ...originalPackageJson,
    devDependencies: filterDependenciesForPlatform(originalPackageJson.devDependencies, targetPlatform),
    optionalDependencies: filterDependenciesForPlatform(originalPackageJson.optionalDependencies, targetPlatform)
  };
  
  const outputPath = path.join(PROJECT_ROOT, `package.${targetPlatform}.json`);
  writeFileSync(outputPath, JSON.stringify(platformPackageJson, null, 2));
  log(`Created ${outputPath}`);
}

function createLinuxBuildScript(): void {
  const scriptContent = `#!/bin/bash
set -e

echo "🔧 Preparing Linux build environment..."

# Backup original package.json
if [ ! -f package.json.backup ]; then
    cp package.json package.json.backup
    echo "📦 Backed up package.json"
fi

# Use Linux-specific package.json
if [ -f package.linux.json ]; then
    cp package.linux.json package.json
    echo "🐧 Using Linux-specific package.json"
else
    echo "❌ package.linux.json not found! Run 'tsx build-linux/scripts/handle-platform-deps.ts' first"
    exit 1
fi

# Clean and install dependencies
echo "🧹 Cleaning node_modules..."
rm -rf node_modules package-lock.json

echo "📥 Installing Linux dependencies..."
npm install

# Build the project
echo "🔨 Building project..."
npm run build

echo "✅ Linux build preparation complete!"
`;

  const scriptPath = path.join(PROJECT_ROOT, 'build-linux/scripts/prepare-linux-build.sh');
  writeFileSync(scriptPath, scriptContent);
  
  // Make executable
  require('child_process').execSync(`chmod +x "${scriptPath}"`);
  log(`Created Linux build preparation script: ${scriptPath}`);
}

function restoreOriginalPackageJson(): void {
  const backupPath = path.join(PROJECT_ROOT, 'package.json.backup');
  const packageJsonPath = path.join(PROJECT_ROOT, 'package.json');
  
  if (existsSync(backupPath)) {
    log('Restoring original package.json...');
    writeFileSync(packageJsonPath, readFileSync(backupPath, 'utf8'));
    require('fs').unlinkSync(backupPath);
    log('✅ Original package.json restored');
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case 'create-platform-configs':
      log('Creating platform-specific package.json files...');
      createPlatformPackageJson('linux');
      createPlatformPackageJson('darwin');  
      createPlatformPackageJson('win32');
      createLinuxBuildScript();
      log('✅ Platform configurations created');
      break;
      
    case 'restore':
      restoreOriginalPackageJson();
      break;
      
    case 'linux-build':
      log('Preparing for Linux build...');
      const { execSync } = require('child_process');
      execSync('./build-linux/scripts/prepare-linux-build.sh', { stdio: 'inherit', cwd: PROJECT_ROOT });
      break;
      
    default:
      log('Usage:');
      log('  create-platform-configs - Create platform-specific package.json files');
      log('  restore                  - Restore original package.json from backup');
      log('  linux-build             - Prepare environment for Linux build');
  }
}

if (require.main === module) {
  main().catch(console.error);
}