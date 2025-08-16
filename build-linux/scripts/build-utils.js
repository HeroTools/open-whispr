#!/usr/bin/env node
const { execSync } = require('child_process');
const { existsSync, mkdirSync, rmSync, cpSync } = require('fs');
const path = require('path');
const { getCurrentArch } = require('./version-utils');
const TemplateRenderer = require('./template-renderer');

/**
 * Build utilities for managing temporary build directories and operations
 * @param {boolean} fixedBuildDirName - Use fixed build directory name
 */
class BuildUtils {
  constructor(fixedBuildDirName) {
    this.projectRoot = path.resolve(__dirname, '../..');
    this.outputDir = path.join(this.projectRoot, 'dist');
    this.buildLinuxDir = path.join(this.projectRoot, 'build-linux');
    this.arch = getCurrentArch();
    // Use OS temp directory to avoid copying project to subdirectory of itself
    const os = require('os');
    this.tempBuildDir = path.join(os.tmpdir(), `open-whispr-build-${this.arch}-${fixedBuildDirName ? 'tmp' : Date.now()}`);
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
    this.log(`➡️ Running: ${command}`);
    try {
      execSync(command, { stdio: 'inherit', cwd: cwd || this.projectRoot });
    } catch (error) {
      this.log(` 🚫 Command failed: ${command}`);
      throw error;
    }
  }

  /**
   * Create temporary build directory and copy entire repo
   * @param {boolean} skipClean - Skip cleaning existing temp directory
   */
  prepareTempBuildDir(skipClean) {
    this.log(`📂 Preparing temporary build directory: ${this.tempBuildDir}`);
    
    // Clean up existing temp directory
    if (!skipClean) {
      this.cleanup();
    } else {
      this.log("⏩ Skipping cleanup of existing temp directory...");
    }
    
    // Create temp directory
    mkdirSync(this.tempBuildDir, { recursive: true });
    
    // Copy entire repo to temp directory
    this.log('📂 Copying repository to temp build directory...');
    
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
    this.log(' 📝 Rendering manifest templates...');
    
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
      this.log(`🧹 Cleaning up temp build directory: ${this.tempBuildDir}`);
      rmSync(this.tempBuildDir, { recursive: true, force: true });
      this.log('✅ Cleanup completed');
    }
  }

  /**
   * Get current architecture
   */
  getCurrentArch() {
    return this.arch;
  }

  /**
   * Get path within the temporary build directory
   */
  getTempPath(...pathSegments) {
    return path.join(this.tempBuildDir, ...pathSegments);
  }

  /**
   * Copy specific artifacts to main dist directory
   * @param {string[]} artifactPaths - Array of artifact paths to copy, each path is absolute
   */
  copySpecificArtifacts(...artifactPaths) {
    if (!Array.isArray(artifactPaths) || artifactPaths.length === 0) {
      throw new Error(`Expected array of artifact paths, but got ${typeof artifactPaths} ${artifactPaths}`);
    }
    if (!artifactPaths.every(path => path.startsWith('/'))) {
      throw new Error(`Expected absolute paths, but got ${artifactPaths}`);
    }
    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true });
    }
    this.log(`📂 Copying specified artifacts to ${this.outputDir}: ${artifactPaths}`);
    
    for (const artifactPath of artifactPaths) {
      if (existsSync(artifactPath)) {
        const copyCommand = `cp -v "${artifactPath}" "${this.outputDir}/"`;
        try {
          this.runCommand(copyCommand);
          this.log(`✅ Copied ${artifactPath} to ${this.outputDir}`);
        } catch (error) {
          this.log(`❗ Error: Could not copy artifact ${artifactPath}`);
          throw error;
        }
      } else {
        throw new Error(`❗ Error: Artifact ${artifactPath} does not exist`);
      }
    }
  }

  /**
   * Ensure artifact in output directory
   * @param {string} artifactName - Artifact file name to ensure
   */
  ensureArtifactInOutput(artifactName) {
    const artifactPath = path.join(this.outputDir, artifactName);
    if (!existsSync(artifactPath)) {
      throw new Error(`❗ Error: Artifact ${artifactPath} does not exist in output directory`);
    }
    this.log(`✅ Artifact ${artifactPath} exists in output directory`);
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
    default:
      console.log('Usage: node build-utils.js <prepare|cleanup>');
  }
}
