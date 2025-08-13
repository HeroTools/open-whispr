const { readFileSync } = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../..');

function getPackageVersion() {
  const packageJsonPath = path.join(PROJECT_ROOT, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  return packageJson.version;
}

function getVersionedFilename(base, extension) {
  const version = getPackageVersion();
  return `${base}-${version}.${extension}`;
}

function getDebFilename(arch) {
  const version = getPackageVersion();
  const architecture = arch || (process.env.ARCH === 'arm64' ? 'arm64' : 'amd64');
  return `open-whispr_${version}_${architecture}.deb`;
}

function getRpmFilename(arch) {
  const version = getPackageVersion();
  const architecture = arch || (process.env.ARCH === 'arm64' ? 'aarch64' : 'x86_64');
  return `open-whispr-${version}-1.*.${architecture}.rpm`;
}

function getFlatpakFilename() {
  const version = getPackageVersion();
  return `OpenWhispr-${version}.flatpak`;
}

function getAppImageFilename(arch) {
  const version = getPackageVersion();
  const architecture = arch || (process.env.ARCH === 'arm64' ? 'aarch64' : 'x86_64');
  return `OpenWhispr-${version}-${architecture}.AppImage`;
}

function getTarballFilename() {
  const version = getPackageVersion();
  return `open-whispr-${version}.tar.gz`;
}

function getCurrentArch() {
  return process.env.ARCH || 'amd64';
}

function getElectronBuilderArch() {
  const arch = getCurrentArch();
  return arch === 'amd64' ? 'x64' : arch;
}

module.exports = {
  getPackageVersion,
  getVersionedFilename,
  getDebFilename,
  getRpmFilename,
  getFlatpakFilename,
  getAppImageFilename,
  getTarballFilename,
  getCurrentArch,
  getElectronBuilderArch
};