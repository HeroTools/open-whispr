#!/usr/bin/env tsx
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');

interface TestConfig {
  distro: string;
  image: string;
  packageFile: string;
  installCommand: string;
  testCommand: string;
}

const testConfigs: TestConfig[] = [
  {
    distro: 'ubuntu-test',
    image: 'ubuntu:22.04',
    packageFile: 'open-wispr_1.0.2_amd64.deb',
    installCommand: 'apt update && apt install -y ./open-wispr_1.0.2_amd64.deb',
    testCommand: 'open-wispr --version'
  },
  {
    distro: 'debian-test',
    image: 'debian:12',
    packageFile: 'open-wispr_1.0.2_amd64.deb', 
    installCommand: 'apt update && apt install -y ./open-wispr_1.0.2_amd64.deb',
    testCommand: 'open-wispr --version'
  },
  {
    distro: 'fedora-test',
    image: 'fedora:39',
    packageFile: 'open-wispr-1.0.2-1.fc39.x86_64.rpm',
    installCommand: 'dnf install -y ./open-wispr-1.0.2-1.*.x86_64.rpm',
    testCommand: 'open-wispr --version'
  },
  {
    distro: 'centos-test',
    image: 'centos:stream9',
    packageFile: 'open-wispr-1.0.2-1.el9.x86_64.rpm',
    installCommand: 'dnf install -y ./open-wispr-1.0.2-1.*.x86_64.rpm',
    testCommand: 'open-wispr --version'
  }
];

function log(message: string) {
  console.log(`[Package Test] ${message}`);
}

function runCommand(command: string, cwd?: string): string {
  log(`Running: ${command}`);
  try {
    return execSync(command, { encoding: 'utf8', cwd: cwd || PROJECT_ROOT });
  } catch (error) {
    log(`Command failed: ${command}`);
    throw error;
  }
}

async function setupDistrobox() {
  log('Setting up distrobox containers for testing...');
  
  for (const config of testConfigs) {
    try {
      // Create distrobox container
      log(`Creating distrobox container: ${config.distro}`);
      runCommand(`distrobox create --name ${config.distro} --image ${config.image} --yes`);
    } catch (error) {
      log(`Failed to create container ${config.distro}, skipping...`);
      continue;
    }
  }
}

async function testPackageInstallation(config: TestConfig) {
  const packagePath = path.join(DIST_DIR, config.packageFile);
  
  if (!existsSync(packagePath)) {
    log(`Package not found: ${packagePath}, skipping ${config.distro}`);
    return false;
  }

  log(`Testing ${config.packageFile} on ${config.distro}...`);
  
  try {
    // Copy package to container
    log(`Copying package to ${config.distro}...`);
    runCommand(`distrobox enter ${config.distro} -- cp /home/$USER/Projects/open-wispr/dist/${config.packageFile} .`);
    
    // Install package
    log(`Installing package on ${config.distro}...`);
    runCommand(`distrobox enter ${config.distro} -- sudo bash -c "${config.installCommand}"`);
    
    // Test the installation
    log(`Testing installation on ${config.distro}...`);
    const output = runCommand(`distrobox enter ${config.distro} -- ${config.testCommand}`);
    
    if (output.trim() === '1.0.2') {
      log(`✅ ${config.distro}: Installation and version check successful`);
      return true;
    } else {
      log(`❌ ${config.distro}: Version check failed. Expected '1.0.2', got '${output.trim()}'`);
      return false;
    }
    
  } catch (error) {
    log(`❌ ${config.distro}: Installation or testing failed - ${error}`);
    return false;
  }
}

async function testFlatpak() {
  const flatpakPath = path.join(DIST_DIR, 'OpenWispr-1.0.2.flatpak');
  
  if (!existsSync(flatpakPath)) {
    log('Flatpak not found, skipping Flatpak test');
    return false;
  }
  
  log('Testing Flatpak package...');
  
  try {
    // Install the Flatpak
    runCommand(`flatpak install --user --assumeyes ${flatpakPath}`);
    
    // Test the installation
    const output = runCommand('flatpak run com.herotools.openwispr --version');
    
    if (output.trim() === '1.0.2') {
      log('✅ Flatpak: Installation and version check successful');
      // Cleanup
      runCommand('flatpak uninstall --user com.herotools.openwispr --assumeyes');
      return true;
    } else {
      log(`❌ Flatpak: Version check failed. Expected '1.0.2', got '${output.trim()}'`);
      return false;
    }
    
  } catch (error) {
    log(`❌ Flatpak: Installation or testing failed - ${error}`);
    return false;
  }
}

async function testAppImage() {
  const appImagePath = path.join(DIST_DIR, 'OpenWispr-1.0.2-x86_64.AppImage');
  
  if (!existsSync(appImagePath)) {
    log('AppImage not found, skipping AppImage test');
    return false;
  }
  
  log('Testing AppImage...');
  
  try {
    // Make AppImage executable and test
    runCommand(`chmod +x "${appImagePath}"`);
    const output = runCommand(`"${appImagePath}" --version`);
    
    if (output.trim() === '1.0.2') {
      log('✅ AppImage: Version check successful');
      return true;
    } else {
      log(`❌ AppImage: Version check failed. Expected '1.0.2', got '${output.trim()}'`);
      return false;
    }
    
  } catch (error) {
    log(`❌ AppImage: Testing failed - ${error}`);
    return false;
  }
}

async function cleanup() {
  log('Cleaning up test containers...');
  
  for (const config of testConfigs) {
    try {
      runCommand(`distrobox rm ${config.distro} --force`);
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

async function runAllTests() {
  log('Starting package installation tests...');
  
  const results = {
    passed: 0,
    failed: 0,
    total: 0
  };
  
  try {
    // Setup distrobox containers
    await setupDistrobox();
    
    // Test native packages
    for (const config of testConfigs) {
      results.total++;
      const success = await testPackageInstallation(config);
      if (success) {
        results.passed++;
      } else {
        results.failed++;
      }
    }
    
    // Test Flatpak
    results.total++;
    const flatpakSuccess = await testFlatpak();
    if (flatpakSuccess) {
      results.passed++;
    } else {
      results.failed++;
    }
    
    // Test AppImage
    results.total++;
    const appImageSuccess = await testAppImage();
    if (appImageSuccess) {
      results.passed++;
    } else {
      results.failed++;
    }
    
  } finally {
    // Cleanup
    await cleanup();
  }
  
  // Print summary
  log('\n=== Test Summary ===');
  log(`Total tests: ${results.total}`);
  log(`Passed: ${results.passed}`);
  log(`Failed: ${results.failed}`);
  log(`Success rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);
  
  if (results.failed > 0) {
    process.exit(1);
  } else {
    log('🎉 All tests passed!');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}