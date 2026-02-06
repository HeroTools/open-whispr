/**
 * Simple ICO file creator from PNG buffers
 */
const fs = require("fs");

function createIco(pngPaths) {
  const pngBuffers = pngPaths.map((path) => fs.readFileSync(path));

  // ICO file header
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type (1 = ICO)
  header.writeUInt16LE(pngBuffers.length, 4); // Number of images

  // Image directory entries
  const entries = [];
  let dataOffset = 6 + pngBuffers.length * 16; // Header + directory entries

  for (const png of pngBuffers) {
    const entry = Buffer.alloc(16);
    const size = getPngSize(png);

    entry.writeUInt8(size > 255 ? 0 : size, 0); // Width (0 = 256)
    entry.writeUInt8(size > 255 ? 0 : size, 1); // Height (0 = 256)
    entry.writeUInt8(0, 2); // Color palette
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(png.length, 8); // Image data size
    entry.writeUInt32LE(dataOffset, 12); // Offset to image data

    entries.push(entry);
    dataOffset += png.length;
  }

  // Combine all parts
  return Buffer.concat([header, ...entries, ...pngBuffers]);
}

function getPngSize(buffer) {
  // PNG size is at bytes 16-19 (width) and 20-23 (height) in big-endian
  return buffer.readUInt32BE(16);
}

module.exports = createIco;
