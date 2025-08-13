#!/usr/bin/env ts-node
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import * as path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');

interface TestConfig {
  name: string;
  baseImage: string;
  packageFile: string;
  installCommand: string;
  testCommand: string;
  packageType: 'deb' | 'rpm' | 'flatpak' | 'appimage';
}

const testConfigs: TestConfig[] = [
  {
    name: 'Ubuntu 22.04',
    baseImage: 'openwispr-deb-builder', // Reuse our existing DEB builder
    packageFile: 'open-wispr_1.0.2_amd64.deb',
    installCommand: 'dpkg -i ./open-wispr_1.0.2_amd64.deb || (apt update && apt install -f -y)',
    testCommand: 'open-wispr --version',
    packageType: 'deb'
  },
  {
    name: 'Debian 12',
    baseImage: 'debian:12',
    packageFile: 'open-wispr_1.0.2_amd64.deb',
    installCommand: 'apt update && dpkg -i ./open-wispr_1.0.2_amd64.deb || (apt install -f -y)',
    testCommand: 'open-wispr --version',
    packageType: 'deb'
  },
  {
    name: 'Fedora 39',
    baseImage: 'openwispr-rpm-builder', // Reuse our existing RPM builder
    packageFile: 'open-wispr-1.0.2-1.*.x86_64.rpm',
    installCommand: 'dnf install -y ./open-wispr-1.0.2-1.*.x86_64.rpm',
    testCommand: 'open-wispr --version',
    packageType: 'rpm'
  },
  {
    name: 'CentOS Stream 9',
    baseImage: 'centos:stream9',
    packageFile: 'open-wispr-1.0.2-1.*.x86_64.rpm',
    installCommand: 'dnf install -y ./open-wispr-1.0.2-1.*.x86_64.rpm',
    testCommand: 'open-wispr --version',
    packageType: 'rpm'
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

async function ensureBuildImages() {
  log('Ensuring Docker build images are available...');
  
  const requiredImages = [
    'openwispr-deb-builder',
    'openwispr-rpm-builder'
  ];
  
  for (const imageName of requiredImages) {
    try {
      // Check if image exists
      runCommand(`docker image inspect ${imageName} > /dev/null 2>&1`);
      log(`✅ Image ${imageName} exists`);
    } catch (error) {
      log(`⚠️ Image ${imageName} not found, building it...`);
      const dockerfileName = imageName.replace('openwispr-', '').replace('-builder', '');
      const dockerfilePath = path.join(PROJECT_ROOT, 'build/docker', `Dockerfile.${dockerfileName}`);
      
      if (existsSync(dockerfilePath)) {
        runCommand(`docker build -f ${dockerfilePath} -t ${imageName} .`, path.join(PROJECT_ROOT, 'build/docker'));
        log(`✅ Built image ${imageName}`);
      } else {
        log(`❌ Dockerfile not found: ${dockerfilePath}`);
      }
    }
  }
}

async function testPackageInstallation(config: TestConfig): Promise<boolean> {
  // Find the package file (handle wildcards)
  let packagePath: string;
  if (config.packageFile.includes('*')) {
    const pattern = config.packageFile.replace(/\*/g, '.*');
    const regex = new RegExp(pattern);
    const files = require('fs').readdirSync(DIST_DIR);
    const matchingFiles = files.filter((f: string) => regex.test(f));
    
    if (matchingFiles.length === 0) {
      log(`❌ ${config.name}: No package found matching pattern ${config.packageFile}`);
      return false;
    }
    
    packagePath = path.join(DIST_DIR, matchingFiles[0]);
    config.packageFile = matchingFiles[0]; // Update for Docker command
  } else {
    packagePath = path.join(DIST_DIR, config.packageFile);
    
    if (!existsSync(packagePath)) {
      log(`❌ ${config.name}: Package not found: ${packagePath}`);
      return false;
    }
  }

  log(`🧪 Testing ${config.packageFile} on ${config.name}...`);
  
  try {
    // Create a test script that will be executed inside the container
    const testScript = `#!/bin/bash
set -e
cd /workspace/dist

echo "📦 Installing package..."
${config.installCommand}

echo "🔍 Testing installation..."
OUTPUT=$(${config.testCommand} 2>&1)
echo "Version output: '$OUTPUT'"

if [ "$OUTPUT" = "1.0.2" ]; then
  echo "✅ Version check passed"
  exit 0
else
  echo "❌ Version check failed. Expected '1.0.2', got '$OUTPUT'"
  exit 1
fi
`;

    // Run the test in Docker container
    const dockerCommand = [
      'docker run --rm',
      `-v "${PROJECT_ROOT}:/workspace"`,
      '-w /workspace',
      config.baseImage,
      'bash -c',
      `"${testScript.replace(/"/g, '\\"')}"`
    ].join(' ');
    
    const output = runCommand(dockerCommand);
    
    if (output.includes('✅ Version check passed')) {
      log(`✅ ${config.name}: Installation and version check successful`);
      return true;
    } else {
      log(`❌ ${config.name}: Test failed`);
      log(`Output: ${output}`);
      return false;
    }
    
  } catch (error) {
    log(`❌ ${config.name}: Installation or testing failed`);
    log(`Error: ${error}`);
    return false;
  }
}

async function testFlatpak(): Promise<boolean> {
  const flatpakPath = path.join(DIST_DIR, 'OpenWispr-1.0.2.flatpak');
  
  if (!existsSync(flatpakPath)) {
    log('❌ Flatpak: Package not found, skipping Flatpak test');
    return false;
  }
  
  log('🧪 Testing Flatpak package...');
  
  try {
    // Use our Flatpak builder Docker image for testing
    const testScript = `#!/bin/bash
set -e
cd /workspace/dist

echo "📦 Installing Flatpak..."
flatpak install --user --assumeyes ./OpenWispr-1.0.2.flatpak

echo "🔍 Testing installation..."
OUTPUT=$(flatpak run com.herotools.openwispr --version 2>&1)
echo "Version output: '$OUTPUT'"

if [ "$OUTPUT" = "1.0.2" ]; then
  echo "✅ Version check passed"
  flatpak uninstall --user com.herotools.openwispr --assumeyes
  exit 0
else
  echo "❌ Version check failed. Expected '1.0.2', got '$OUTPUT'"
  exit 1
fi
`;

    const dockerCommand = [
      'docker run --rm',
      `--privileged`, // Required for Flatpak
      `-v "${PROJECT_ROOT}:/workspace"`,
      '-w /workspace',
      '-e FLATPAK_USER_DIR=/tmp/flatpak-user',
      'openwispr-flatpak-builder',
      'bash -c',
      `"${testScript.replace(/"/g, '\\"')}"`
    ].join(' ');
    
    const output = runCommand(dockerCommand);
    
    if (output.includes('✅ Version check passed')) {
      log('✅ Flatpak: Installation and version check successful');
      return true;
    } else {
      log('❌ Flatpak: Test failed');
      log(`Output: ${output}`);
      return false;
    }
    
  } catch (error) {
    log('❌ Flatpak: Installation or testing failed');
    log(`Error: ${error}`);
    return false;
  }
}

async function testAppImage(): Promise<boolean> {
  const appImagePath = path.join(DIST_DIR, 'OpenWispr-1.0.2-x86_64.AppImage');
  
  if (!existsSync(appImagePath)) {
    log('❌ AppImage: Package not found, skipping AppImage test');
    return false;
  }
  
  log('🧪 Testing AppImage...');
  
  try {
    // Use our AppImage builder Docker image for testing
    const testScript = `#!/bin/bash
set -e
cd /workspace/dist

echo "🔍 Making AppImage executable and testing..."
chmod +x ./OpenWispr-1.0.2-x86_64.AppImage
OUTPUT=$(./OpenWispr-1.0.2-x86_64.AppImage --version 2>&1)
echo "Version output: '$OUTPUT'"

if [ "$OUTPUT" = "1.0.2" ]; then
  echo "✅ Version check passed"
  exit 0
else
  echo "❌ Version check failed. Expected '1.0.2', got '$OUTPUT'"
  exit 1
fi
`;

    const dockerCommand = [
      'docker run --rm',
      `--device /dev/fuse`,
      `--cap-add SYS_ADMIN`,
      `-v "${PROJECT_ROOT}:/workspace"`,
      '-w /workspace',
      '-e APPIMAGE_EXTRACT_AND_RUN=1',
      'openwispr-appimage-builder',
      'bash -c',
      `"${testScript.replace(/"/g, '\\"')}"`
    ].join(' ');
    
    const output = runCommand(dockerCommand);
    
    if (output.includes('✅ Version check passed')) {
      log('✅ AppImage: Version check successful');
      return true;
    } else {
      log('❌ AppImage: Test failed');
      log(`Output: ${output}`);
      return false;
    }
    
  } catch (error) {
    log('❌ AppImage: Testing failed');
    log(`Error: ${error}`);
    return false;
  }
}

async function runAllTests() {
  log('🚀 Starting Docker-based package installation tests...');
  
  const results = {
    passed: 0,
    failed: 0,
    total: 0
  };
  
  try {
    // Ensure our Docker build images are available
    await ensureBuildImages();
    
    // Test native packages (DEB and RPM)
    for (const config of testConfigs) {
      results.total++;
      log(`\n--- Testing ${config.name} ---`);
      const success = await testPackageInstallation(config);
      if (success) {
        results.passed++;
      } else {
        results.failed++;
      }
    }
    
    // Test Flatpak
    results.total++;
    log(`\n--- Testing Flatpak ---`);
    const flatpakSuccess = await testFlatpak();
    if (flatpakSuccess) {
      results.passed++;
    } else {
      results.failed++;
    }
    
    // Test AppImage
    results.total++;
    log(`\n--- Testing AppImage ---`);
    const appImageSuccess = await testAppImage();
    if (appImageSuccess) {
      results.passed++;
    } else {
      results.failed++;
    }
    
  } catch (error) {
    log(`💥 Critical error during testing: ${error}`);
    process.exit(1);
  }
  
  // Print summary
  log('\n' + '='.repeat(50));
  log('📊 TEST SUMMARY');
  log('='.repeat(50));
  log(`📦 Total tests: ${results.total}`);
  log(`✅ Passed: ${results.passed}`);
  log(`❌ Failed: ${results.failed}`);
  log(`📈 Success rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);
  log('='.repeat(50));
  
  if (results.failed > 0) {
    log('💥 Some tests failed. Check the output above for details.');
    process.exit(1);
  } else {
    log('🎉 All tests passed! Your packages are ready for distribution.');
  }
}

if (require.main === module) {
  runAllTests().catch(console.error);
}