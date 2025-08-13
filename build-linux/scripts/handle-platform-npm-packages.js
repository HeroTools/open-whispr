#!/usr/bin/env node
const { readFileSync, writeFileSync, existsSync } = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../..');

function log(message) {
  console.log(`[Platform Deps] ${message}`);
}

const PLATFORM_SPECIFIC_DEPS = {
  '@esbuild/darwin-arm64': ['darwin'],
  '@esbuild/darwin-x64': ['darwin'],
  '@esbuild/win32-x64': ['win32'],
  '@esbuild/win32-ia32': ['win32'],
  '@esbuild/linux-x64': ['linux'],
  '@esbuild/linux-arm64': ['linux']
};

function shouldIncludeDependency(depName, targetPlatform) {
  const platforms = PLATFORM_SPECIFIC_DEPS[depName];
  
  if (!platforms) {
    return true; // Include non-platform-specific dependencies
  }
  
  const currentPlatform = targetPlatform || process.platform;
  return platforms.includes(currentPlatform);
}

function filterDependenciesForPlatform(deps, targetPlatform) {
  if (!deps) return {};
  
  const filtered = {};
  
  for (const [depName, version] of Object.entries(deps)) {
    if (shouldIncludeDependency(depName, targetPlatform)) {
      filtered[depName] = version;
    } else {
      log(`Excluding platform-specific dependency: ${depName} (not needed for ${targetPlatform || process.platform})`);
    }
  }
  
  return filtered;
}

function createPlatformPackageJson(targetPlatform) {
  const packageJsonPath = path.join(PROJECT_ROOT, 'package.json');
  const originalPackageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  
  log(`Creating platform-specific package.json for ${targetPlatform}...`);
  
  const platformPackageJson = {
    ...originalPackageJson,
    devDependencies: filterDependenciesForPlatform(originalPackageJson.devDependencies, targetPlatform),
    optionalDependencies: filterDependenciesForPlatform(originalPackageJson.optionalDependencies, targetPlatform)
  };
  
  const outputPath = path.join(PROJECT_ROOT, `package.${targetPlatform}.json`);
  writeFileSync(outputPath, JSON.stringify(platformPackageJson, null, 2));
  log(`Created ${outputPath}`);
}

function restoreOriginalPackageJson() {
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
    case 'create-platform-package-json':
      log('Creating platform-specific package.json files...');
      createPlatformPackageJson('linux');
      log('✅ Platform configurations created');
      break;
      
    case 'restore':
      restoreOriginalPackageJson();
      break;
      
    case 'prepare-linux-npm-build':
      log('Preparing for Linux build...');
      const { execSync } = require('child_process');
      execSync('./build-linux/scripts/prepare-linux-npm-build.sh', { stdio: 'inherit', cwd: PROJECT_ROOT });
      break;
      
    default:
      log('Usage:');
      log('  create-platform-package-json - Create platform-specific package.json files');
      log('  prepare-linux-npm-build - Prepare npm environment for Linux build');
      log('  restore                 - Restore original package.json from backup');
  }
}

if (require.main === module) {
  main().catch(console.error);
}