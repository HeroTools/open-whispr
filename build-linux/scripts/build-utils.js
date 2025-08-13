#!/usr/bin/env node
const { execSync } = require('child_process');
const { existsSync, mkdirSync, rmSync, cpSync } = require('fs');
const path = require('path');
const { getCurrentArch } = require('./version-utils');
const TemplateRenderer = require('./template-renderer');

/**
 * Build utilities for managing temporary build directories and operations
 */
class BuildUtils {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '../..');
    this.buildLinuxDir = path.join(this.projectRoot, 'build-linux');
    this.arch = getCurrentArch();
    // Use OS temp directory to avoid copying project to subdirectory of itself
    const os = require('os');
    this.tempBuildDir = path.join(os.tmpdir(), `open-whispr-build-${this.arch}-${Date.now()}`);
    this.renderer = new TemplateRenderer();
  }

  /**
   * Log message with build utils prefix
   */
  log(message) {
    console.log(`[Build Utils] ${message}`);
  }

  /**
   * Run command with error handling
   */
  runCommand(command, cwd) {
    this.log(`Running: ${command}`);
    try {
      execSync(command, { stdio: 'inherit', cwd: cwd || this.projectRoot });
    } catch (error) {
      this.log(`Command failed: ${command}`);
      throw error;
    }
  }

  /**
   * Create temporary build directory and copy entire repo
   */
  prepareTempBuildDir() {
    this.log(`Preparing temporary build directory: ${this.tempBuildDir}`);
    
    // Clean up existing temp directory
    if (existsSync(this.tempBuildDir)) {
      this.log('Removing existing temp build directory...');
      rmSync(this.tempBuildDir, { recursive: true, force: true });
    }
    
    // Create temp directory
    mkdirSync(this.tempBuildDir, { recursive: true });
    
    // Copy entire repo to temp directory
    this.log('Copying repository to temp build directory...');
    
    // Use cp to copy files with filtering
    cpSync(this.projectRoot, this.tempBuildDir, {
      recursive: true,
      filter: (src) => {
        const relativePath = path.relative(this.projectRoot, src);
        return !relativePath.includes('node_modules') && 
               !relativePath.includes('dist') &&
               !relativePath.includes('dist-linux') &&
               !relativePath.includes('.git') &&
               !relativePath.endsWith('.log') &&
               !relativePath.includes('.DS_Store') &&
               !relativePath.includes('Thumbs.db');
      }
    });
    
    this.log(`✅ Repository copied to ${this.tempBuildDir}`);
    return this.tempBuildDir;
  }

  /**
   * Render all manifest templates in the temp build directory
   */
  renderManifests() {
    this.log('Rendering manifest templates...');
    
    const tempBuildLinuxDir = path.join(this.tempBuildDir, 'build-linux');
    
    // Render DEB control file
    this.renderer.renderToFile(
      path.join(tempBuildLinuxDir, 'deb/control.template'),
      path.join(tempBuildLinuxDir, 'deb/control')
    );
    
    // Render RPM spec file
    this.renderer.renderToFile(
      path.join(tempBuildLinuxDir, 'rpm/open-whispr.spec.template'),
      path.join(tempBuildLinuxDir, 'rpm/open-whispr.spec')
    );
    
    // Render AppImage builder config
    this.renderer.renderToFile(
      path.join(tempBuildLinuxDir, 'appimage/AppImageBuilder.yml.template'),
      path.join(tempBuildLinuxDir, 'appimage/AppImageBuilder.yml')
    );
    
    this.log('✅ All manifests rendered successfully');
  }

  /**
   * Clean up temporary build directory
   */
  cleanup() {
    if (existsSync(this.tempBuildDir)) {
      this.log(`Cleaning up temp build directory: ${this.tempBuildDir}`);
      rmSync(this.tempBuildDir, { recursive: true, force: true });
      this.log('✅ Cleanup completed');
    }
  }

  /**
   * Get the temporary build directory path
   */
  getTempBuildDir() {
    return this.tempBuildDir;
  }

  /**
   * Get path within the temporary build directory
   */
  getTempPath(...pathSegments) {
    return path.join(this.tempBuildDir, ...pathSegments);
  }

  /**
   * Copy build artifacts from temp directory to main dist directory
   */
  copyArtifacts(sourcePattern, destDir) {
    const mainDistDir = path.join(this.projectRoot, 'dist');
    mkdirSync(mainDistDir, { recursive: true });
    
    const destPath = path.join(mainDistDir, destDir || '');
    mkdirSync(destPath, { recursive: true });
    
    this.log(`Copying artifacts from temp build to ${destPath}`);
    
    // Use glob pattern to copy artifacts - use find with exec for better reliability
    const findCommand = `find . -maxdepth 2 -name "${sourcePattern}" -exec cp {} ${destPath}/ \\;`;
    try {
      this.runCommand(findCommand, this.tempBuildDir);
      this.log('✅ Artifacts copied successfully');
    } catch (error) {
      this.log(`Warning: Could not copy artifacts with pattern ${sourcePattern}`);
    }
  }

  /**
   * Copy specific artifacts to main dist directory
   */
  copySpecificArtifacts(...artifactPaths) {
    const mainDistDir = path.join(this.projectRoot, 'dist');
    mkdirSync(mainDistDir, { recursive: true });
    
    for (const artifactPath of artifactPaths) {
      const fullPath = path.join(this.tempBuildDir, artifactPath);
      if (existsSync(fullPath)) {
        const copyCommand = `cp -v "${fullPath}" "${mainDistDir}/"`;
        try {
          this.runCommand(copyCommand);
          this.log(`✅ Copied ${artifactPath} to dist/`);
        } catch (error) {
          this.log(`Warning: Could not copy artifact ${artifactPath}`);
        }
      }
    }
  }
}

module.exports = BuildUtils;

// CLI usage for testing
if (require.main === module) {
  const buildUtils = new BuildUtils();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'prepare':
      buildUtils.prepareTempBuildDir();
      buildUtils.renderManifests();
      break;
    case 'cleanup':
      buildUtils.cleanup();
      break;
    case 'test':
      console.log('Build Utils Test');
      console.log('Project Root:', buildUtils.projectRoot);
      console.log('Temp Build Dir:', buildUtils.getTempBuildDir());
      console.log('Architecture:', buildUtils.arch);
      break;
    default:
      console.log('Usage: node build-utils.js <prepare|cleanup|test>');
  }
}
