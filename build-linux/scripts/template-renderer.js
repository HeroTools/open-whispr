#!/usr/bin/env node
const { readFileSync, writeFileSync, mkdirSync } = require('fs');
const path = require('path');
const { getPackageVersion, getCurrentArch } = require('./version-utils');

/**
 * Template renderer utility for build manifests
 */
class TemplateRenderer {
  constructor() {
    this.buildLinuxDir = path.join(__dirname, '..');
    this.variables = this.getTemplateVariables();
  }

  /**
   * Get all template variables based on current build context
   */
  getTemplateVariables() {
    const version = getPackageVersion();
    const arch = getCurrentArch();
    
    // Architecture mappings for different package formats
    const debArch = arch === 'arm64' ? 'arm64' : 'amd64';
    const rpmArch = arch === 'arm64' ? 'aarch64' : 'x86_64';
    const appImageArch = arch === 'arm64' ? 'aarch64' : 'x86_64';
    
    return {
      VERSION: version,
      ARCH: debArch,
      RPM_ARCH: rpmArch,
      APPIMAGE_ARCH: appImageArch,
      DEB_ARCH: debArch
    };
  }

  /**
   * Render a template file with current variables
   * @param {string} templatePath - Full path to template file
   * @param {Object} additionalVars - Additional variables to merge
   * @returns {string} Rendered content
   */
  renderTemplate(templatePath, additionalVars = {}) {
    if (!require('fs').existsSync(templatePath)) {
      throw new Error(`Template not found: ${templatePath}`);
    }
    
    const templateContent = readFileSync(templatePath, 'utf8');
    const allVars = { ...this.variables, ...additionalVars };
    
    // Replace all {{VARIABLE}} placeholders
    let rendered = templateContent;
    for (const [key, value] of Object.entries(allVars)) {
      const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      rendered = rendered.replace(placeholder, value);
    }
    
    return rendered;
  }

  /**
   * Render template and write to output file
   * @param {string} templatePath - Full path to template file
   * @param {string} outputPath - Path to write rendered content
   * @param {Object} additionalVars - Additional variables
   */
  renderToFile(templatePath, outputPath, additionalVars = {}) {
    const rendered = this.renderTemplate(templatePath, additionalVars);
    
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    mkdirSync(outputDir, { recursive: true });
    
    writeFileSync(outputPath, rendered, 'utf8');
    console.log(`✅ Rendered ${path.basename(templatePath)} -> ${outputPath}`);
  }

  /**
   * Get current template variables (for debugging/logging)
   */
  getVariables() {
    return this.variables;
  }
}

module.exports = TemplateRenderer;

// CLI usage
if (require.main === module) {
  const renderer = new TemplateRenderer();
  
  console.log('Template Renderer');
  console.log('Current variables:', renderer.getVariables());
  
  if (process.argv.length < 4) {
    console.log('Usage: node template-renderer.js <template-path> <output-path> [additional-vars-json]');
    process.exit(1);
  }
  
  const templatePath = process.argv[2];
  const outputPath = process.argv[3];
  const additionalVars = process.argv[4] ? JSON.parse(process.argv[4]) : {};
  
  try {
    renderer.renderToFile(templatePath, outputPath, additionalVars);
  } catch (error) {
    console.error('Error rendering template:', error.message);
    process.exit(1);
  }
}
