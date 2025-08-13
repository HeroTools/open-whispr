#!/usr/bin/env node
const { readFileSync, writeFileSync, existsSync } = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../..');

function log(message) {
  console.log(`[Linux Platform Deps] ${message}`);
}

// Only Linux-specific esbuild dependencies
const LINUX_ESBUILD_DEPS = [
  '@esbuild/linux-x64',
  '@esbuild/linux-arm64'
];

function filterDependenciesForLinux(deps) {
  if (!deps) return {};
  
  const filtered = {};
  
  for (const [depName, version] of Object.entries(deps)) {
    // Include all non-esbuild dependencies
    if (!depName.startsWith('@esbuild/')) {
      filtered[depName] = version;
    } 
    // Only include Linux esbuild dependencies
    else if (LINUX_ESBUILD_DEPS.includes(depName)) {
      filtered[depName] = version;
    } else {
      log(`Excluding non-Linux esbuild dependency: ${depName}`);
    }
  }
  
  return filtered;
}

function createLinuxPackageJson() {
  const packageJsonPath = path.join(PROJECT_ROOT, 'package.json');
  const originalPackageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  
  log('Creating Linux-specific package.json...');
  
  const linuxPackageJson = {
    ...originalPackageJson,
    devDependencies: filterDependenciesForLinux(originalPackageJson.devDependencies),
    optionalDependencies: filterDependenciesForLinux(originalPackageJson.optionalDependencies)
  };
  
  const outputPath = path.join(PROJECT_ROOT, 'package.linux.json');
  writeFileSync(outputPath, JSON.stringify(linuxPackageJson, null, 2));
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
      log('Creating Linux-specific package.json...');
      createLinuxPackageJson();
      log('✅ Linux package.json created');
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
      log('  create-platform-package-json - Create Linux-specific package.json');
      log('  prepare-linux-npm-build     - Prepare npm environment for Linux build');
      log('  restore                     - Restore original package.json from backup');
  }
}

if (require.main === module) {
  main().catch(console.error);
}