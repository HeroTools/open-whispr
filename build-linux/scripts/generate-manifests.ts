#!/usr/bin/env ts-node
import { writeFileSync, readFileSync } from 'fs';
import * as path from 'path';
import { getPackageVersion } from './version-utils';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const BUILD_DIR = path.join(PROJECT_ROOT, 'build-linux');
const VERSION = getPackageVersion();

function generateDebControl() {
  const template = `Package: open-wispr
Version: ${VERSION}
Section: utils
Priority: optional
Architecture: amd64
Depends: libc6 (>= 2.17), libgcc-s1 (>= 3.0), libstdc++6 (>= 5.2), libasound2 (>= 1.0.16), libatk1.0-0 (>= 1.12.4), libcairo2 (>= 1.6.0), libdrm2 (>= 2.4.38), libgdk-pixbuf2.0-0 (>= 2.22.0), libgtk-3-0 (>= 3.9.10), libnspr4 (>= 2:4.9-2~), libnss3 (>= 2:3.22), libpango-1.0-0 (>= 1.14.0), libx11-6, libx11-xcb1, libxcb-dri3-0, libxcomposite1 (>= 1:0.3-1), libxdamage1 (>= 1:1.1), libxext6, libxfixes3, libxi6, libxrandr2, libxrender1, libxss1, libxtst6, ca-certificates, libasound2, libpulse0, python3 (>= 3.8)
Maintainer: OpenWispr Team <support@herotools.com>
Description: Desktop dictation application using OpenAI Whisper
 OpenWispr is a desktop dictation application that uses OpenAI Whisper for 
 speech-to-text transcription. It supports both local (privacy-focused) and 
 cloud (OpenAI API) processing modes.
 .
 Features include global hotkey activation, multiple language support,
 always-on-top dictation interface, clipboard integration, and transcription history.`;
  
  writeFileSync(path.join(BUILD_DIR, 'deb/control'), template);
}

function generateRpmSpec() {
  const template = `Name:           open-wispr
Version:        ${VERSION}
Release:        1%{?dist}
Summary:        Desktop dictation application using OpenAI Whisper

License:        MIT
URL:            https://github.com/HeroTools/open-wispr
Source0:        %{name}-%{version}.tar.gz

BuildRequires:  nodejs >= 16
BuildRequires:  npm
Requires:       alsa-lib
Requires:       atk
Requires:       cairo
Requires:       gdk-pixbuf2
Requires:       glibc
Requires:       gtk3
Requires:       libdrm
Requires:       libX11
Requires:       libXcomposite
Requires:       libXdamage
Requires:       libXext
Requires:       libXfixes
Requires:       libXi
Requires:       libXrandr
Requires:       libXrender
Requires:       libXScrnSaver
Requires:       libXtst
Requires:       nss
Requires:       python3 >= 3.8
Requires:       pulseaudio-libs

%description
OpenWispr is a desktop dictation application that uses OpenAI Whisper for 
speech-to-text transcription. It supports both local (privacy-focused) and 
cloud (OpenAI API) processing modes.

Features include global hotkey activation, multiple language support,
always-on-top dictation interface, clipboard integration, and transcription history.

%prep
%setup -q

%build
# Built with electron-builder

%install
rm -rf $RPM_BUILD_ROOT
mkdir -p $RPM_BUILD_ROOT/opt/open-wispr
mkdir -p $RPM_BUILD_ROOT/usr/bin
mkdir -p $RPM_BUILD_ROOT/usr/share/applications
mkdir -p $RPM_BUILD_ROOT/usr/share/icons/hicolor/512x512/apps

cp -r * $RPM_BUILD_ROOT/opt/open-wispr/
ln -sf /opt/open-wispr/open-wispr $RPM_BUILD_ROOT/usr/bin/open-wispr

cat > $RPM_BUILD_ROOT/usr/share/applications/open-wispr.desktop << EOF
[Desktop Entry]
Name=OpenWispr
Comment=Desktop dictation application using OpenAI Whisper
Exec=open-wispr
Icon=open-wispr
Type=Application
Categories=Office;Accessibility;AudioVideo;
StartupWMClass=OpenWispr
MimeType=audio/wav;audio/mp3;audio/flac;audio/ogg;
Keywords=dictation;speech;transcription;whisper;ai;
EOF

cp assets/icon.png $RPM_BUILD_ROOT/usr/share/icons/hicolor/512x512/apps/open-wispr.png

%files
/opt/open-wispr
/usr/bin/open-wispr
/usr/share/applications/open-wispr.desktop
/usr/share/icons/hicolor/512x512/apps/open-wispr.png

%post
/bin/touch --no-create %{_datadir}/icons/hicolor &>/dev/null || :
/usr/bin/update-desktop-database &> /dev/null || :

%postun
if [ $1 -eq 0 ] ; then
    /bin/touch --no-create %{_datadir}/icons/hicolor &>/dev/null
    /usr/bin/gtk-update-icon-cache %{_datadir}/icons/hicolor &>/dev/null || :
fi
/usr/bin/update-desktop-database &> /dev/null || :

%posttrans
/usr/bin/gtk-update-icon-cache %{_datadir}/icons/hicolor &>/dev/null || :

%changelog
* Mon Jan 01 2024 OpenWispr Team <support@herotools.com> - ${VERSION}-1
- Release version ${VERSION}`;

  writeFileSync(path.join(BUILD_DIR, 'rpm/open-wispr.spec'), template);
}

function generateAppImageBuilder() {
  const template = `version: 1
script:
  # Remove any previous build
  - rm -rf AppDir  | true
  # Create AppDir structure
  - mkdir -p AppDir/usr/bin
  - mkdir -p AppDir/usr/lib
  - mkdir -p AppDir/usr/share/applications
  - mkdir -p AppDir/usr/share/icons/hicolor/512x512/apps
  # Copy the application
  - cp -r dist/linux-unpacked/* AppDir/usr/lib/open-wispr/
  - ln -sf ../lib/open-wispr/open-wispr AppDir/usr/bin/open-wispr
  # Copy desktop files and icons
  - cp build-linux/flatpak/com.herotools.openwispr.desktop AppDir/usr/share/applications/open-wispr.desktop
  - cp assets/icon.png AppDir/usr/share/icons/hicolor/512x512/apps/open-wispr.png
  # Create AppRun
  - cp assets/icon.png AppDir/open-wispr.png
  - cp build-linux/flatpak/com.herotools.openwispr.desktop AppDir/open-wispr.desktop

AppDir:
  path: ./AppDir

  app_info:
    id: com.herotools.openwispr
    name: OpenWispr
    icon: open-wispr
    version: ${VERSION}
    exec: usr/bin/open-wispr
    exec_args: $@

  apt:
    arch: amd64
    sources:
      - sourceline: 'deb [arch=amd64] http://archive.ubuntu.com/ubuntu/ focal main restricted universe multiverse'
        key_url: 'http://keyserver.ubuntu.com/pks/lookup?op=get&search=0x3B4FE6ACC0B21F32'
    include:
      - libasound2
      - libatk1.0-0
      - libcairo-gobject2
      - libcairo2
      - libdrm2
      - libgdk-pixbuf2.0-0
      - libgtk-3-0
      - libnspr4
      - libnss3
      - libpango-1.0-0
      - libpangocairo-1.0-0
      - libx11-6
      - libx11-xcb1
      - libxcb-dri3-0
      - libxcomposite1
      - libxcursor1
      - libxdamage1
      - libxext6
      - libxfixes3
      - libxi6
      - libxrandr2
      - libxrender1
      - libxss1
      - libxtst6
      - python3
      - python3-pip

  runtime:
    env:
      APPIMAGE_UUID: c0dd3990-19e6-11ec-9621-0242ac130002

  test:
    fedora:
      image: appimagecrafters/tests-env:fedora-35
      command: ./AppRun --version
      use_host_x: true
    debian:
      image: appimagecrafters/tests-env:debian-oldstable
      command: ./AppRun --version
      use_host_x: true
    arch:
      image: appimagecrafters/tests-env:archlinux-latest
      command: ./AppRun --version
      use_host_x: true
    centos:
      image: appimagecrafters/tests-env:centos-7
      command: ./AppRun --version
      use_host_x: true
    ubuntu:
      image: appimagecrafters/tests-env:ubuntu-xenial
      command: ./AppRun --version
      use_host_x: true

AppImage:
  arch: x86_64
  file_name: OpenWispr-${VERSION}-x86_64.AppImage`;

  writeFileSync(path.join(BUILD_DIR, 'appimage/AppImageBuilder.yml'), template);
}

function main() {
  console.log(`[Generate Manifests] Generating manifests with version ${VERSION}...`);
  
  generateDebControl();
  console.log('✅ Generated DEB control file');
  
  generateRpmSpec();
  console.log('✅ Generated RPM spec file');
  
  generateAppImageBuilder();
  console.log('✅ Generated AppImage builder config');
  
  console.log('🎉 All manifests generated successfully!');
}

if (require.main === module) {
  main();
}