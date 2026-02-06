#!/usr/bin/env node
/**
 * Generate app icons from SVG source
 * Generates icon.png (1024x1024) and icon.ico (multiple sizes) from icon.svg
 */

const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ASSETS_DIR = path.join(__dirname, "..", "src", "assets");
const SVG_SOURCE = path.join(ASSETS_DIR, "icon.svg");
const PNG_OUTPUT = path.join(ASSETS_DIR, "icon.png");
const ICO_OUTPUT = path.join(ASSETS_DIR, "icon.ico");
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

async function generateIcons() {
  console.log("🎨 Generating app icons from SVG...");

  // Check if source SVG exists
  if (!fs.existsSync(SVG_SOURCE)) {
    console.error(`❌ Source SVG not found: ${SVG_SOURCE}`);
    process.exit(1);
  }

  try {
    // Generate PNG (1024x1024 for high-quality app icon)
    console.log("  → Generating icon.png (1024x1024)...");
    await sharp(SVG_SOURCE)
      .resize(1024, 1024, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 }, // Transparent background
      })
      .png()
      .toFile(PNG_OUTPUT);
    console.log(`  ✓ Created ${PNG_OUTPUT}`);

    // Generate ICO with multiple sizes
    console.log("  → Generating icon.ico (16, 32, 48, 256)...");

    // Create temporary PNG files for each size
    const tempDir = path.join(ASSETS_DIR, ".temp-ico");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const pngFiles = [];
    for (const size of ICO_SIZES) {
      const pngPath = path.join(tempDir, `icon-${size}.png`);
      await sharp(SVG_SOURCE)
        .resize(size, size, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer()
        .then((buffer) => fs.writeFileSync(pngPath, buffer));
      pngFiles.push(pngPath);
    }

    // Try to use imagemagick if available
    try {
      const magickPath = process.platform === "win32" ? "magick" : "convert";
      const icoCommand = `${magickPath} ${pngFiles.join(" ")} "${ICO_OUTPUT}"`;
      execSync(icoCommand, { stdio: "ignore" });
      console.log(`  ✓ Created ${ICO_OUTPUT}`);
    } catch (error) {
      // ImageMagick not available, use Node.js approach
      console.log("  → ImageMagick not available, trying Node.js approach...");

      // Manual ICO creation
      const createIco = require("./lib/create-ico");
      const icoBuffer = await createIco(pngFiles);
      fs.writeFileSync(ICO_OUTPUT, icoBuffer);
      console.log(`  ✓ Created ${ICO_OUTPUT}`);
    }

    // Clean up temp files
    fs.rmSync(tempDir, { recursive: true, force: true });

    console.log("✨ Icon generation complete!");
  } catch (error) {
    console.error("❌ Error generating icons:", error);
    process.exit(1);
  }
}

generateIcons();
