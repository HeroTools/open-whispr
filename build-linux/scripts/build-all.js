#!/usr/bin/env node
const { existsSync } = require('fs');
const path = require('path');
const BuildUtils = require('./build-utils');

const SCRIPTS_DIR = __dirname;

function log(message) {
  console.log(`[Build All] ${message}`);
}

async function buildAll() {
  const buildUtils = new BuildUtils();
  
  try {
    log('Starting complete Linux packaging build...');
    
    // Step 1: Prepare temporary build directory with full repo copy
    log('Preparing temporary build environment...');
    const tempBuildDir = buildUtils.prepareTempBuildDir();
    
    // Step 2: Render all manifest templates with current version/arch
    log('Rendering manifest templates...');
    buildUtils.renderManifests();
    
    // Step 3: Handle platform-specific dependencies in temp directory
    log('Handling platform-specific dependencies...');
    buildUtils.runCommand(`node ${path.join(SCRIPTS_DIR, 'handle-patform-npm-packages.js')} create-platform-package-json`, tempBuildDir);
    buildUtils.runCommand(`node ${path.join(SCRIPTS_DIR, 'handle-patform-npm-packages.js')} prepare-linux-npm-build`, tempBuildDir);
    
    // Step 4: Build Docker images first
    log('Building Docker images...');
    await buildDockerImages(buildUtils);
    
    // Step 5: Build all package formats in temp directory
    log('Building all package formats...');
    
    const buildScripts = [
      'build-flatpak.js',
      'build-appimage.js', 
      'build-deb.js',
      'build-rpm.js'
    ];
    
    for (const script of buildScripts) {
      const scriptPath = path.join(SCRIPTS_DIR, script);
      if (existsSync(scriptPath)) {
        log(`Running ${script}...`);
        // Pass temp build directory as working directory
        buildUtils.runCommand(`node ${scriptPath} --temp-build-dir=${tempBuildDir}`, tempBuildDir);
      }
    }
    
    log('All builds completed successfully!');
    log('Check the dist/ directory for all package formats.');
    
  } catch (error) {
    log(`Build failed: ${error.message}`);
    throw error;
  } finally {
    // Always clean up temporary directory
    log('Cleaning up temporary build directory...');
    buildUtils.cleanup();
  }
}


async function buildDockerImages(buildUtils) {
  const dockerFiles = [
    'Dockerfile.flatpak',
    'Dockerfile.appimage',
    'Dockerfile.deb',
    'Dockerfile.rpm'
  ];
  
  const dockerDir = buildUtils.getTempPath('build-linux/docker');
  const arch = process.env.ARCH || 'amd64';
  const platform = arch === 'arm64' ? 'linux/arm64' : 'linux/amd64';
  
  for (const dockerfile of dockerFiles) {
    const baseImageName = `openwispr-${dockerfile.split('.')[1]}-builder`;
    const imageName = `${baseImageName}-${arch}`;
    log(`Building Docker image: ${imageName} for ${platform}`);
    
    buildUtils.runCommand(`docker build --platform ${platform} -f ${dockerfile} -t ${imageName} .`, dockerDir);
  }
}

if (require.main === module) {
  buildAll().catch(console.error);
}