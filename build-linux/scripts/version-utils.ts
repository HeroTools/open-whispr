import { readFileSync } from 'fs';
import * as path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

export function getPackageVersion(): string {
  const packageJsonPath = path.join(PROJECT_ROOT, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  return packageJson.version;
}

export function getVersionedFilename(base: string, extension: string): string {
  const version = getPackageVersion();
  return `${base}-${version}.${extension}`;
}

export function getDebFilename(): string {
  const version = getPackageVersion();
  return `open-wispr_${version}_amd64.deb`;
}

export function getRpmFilename(): string {
  const version = getPackageVersion();
  return `open-wispr-${version}-1.*.x86_64.rpm`;
}

export function getFlatpakFilename(): string {
  const version = getPackageVersion();
  return `OpenWispr-${version}.flatpak`;
}

export function getAppImageFilename(): string {
  const version = getPackageVersion();
  return `OpenWispr-${version}-x86_64.AppImage`;
}

export function getTarballFilename(): string {
  const version = getPackageVersion();
  return `open-wispr-${version}.tar.gz`;
}