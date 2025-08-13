# OpenWispr Packaging Documentation

## Current State Analysis

### Existing Packaging Setup
- **Primary Build System**: electron-builder
- **Current Targets**: 
  - macOS: dmg, zip (fully configured with signing)
  - Windows: nsis, portable
  - Linux: AppImage, deb (basic configuration)

### Key Findings

#### 1. Platform-Specific Issues Identified
- **macOS-specific dependency**: `@esbuild/darwin-arm64` in package.json breaks Linux builds
- **Current Linux support**: Limited to AppImage and deb only
- **Missing RPM and Flatpak support**: Not configured
- **Wayland support**: Not explicitly configured

#### 2. Current Architecture
- **Electron 36** with better-sqlite3 native modules
- **FFmpeg integration**: Bundled via ffmpeg-static, unpacked from ASAR
- **Python bridge**: whisper_bridge.py for local Whisper processing
- **Database**: better-sqlite3 with platform-specific native bindings

#### 3. Build Configuration Analysis
- **electron-builder.json**: Well-structured but macOS-focused
- **Native dependencies**: better-sqlite3, ffmpeg-static require careful handling
- **ASAR unpacking**: Required for whisper_bridge.py and ffmpeg-static
- **Entitlements**: Currently only configured for macOS

### Identified Requirements for Linux Packaging

#### 1. Package Formats Needed
- **Flatpak**: Modern sandboxed format, Wayland-native
- **AppImage**: Portable format (currently supported but needs enhancement)
- **Deb**: Debian/Ubuntu repositories (currently basic)
- **RPM**: RedHat/Fedora repositories (not implemented)

#### 2. Linux-Specific Considerations
- **Wayland support**: Enable by default for modern Linux distros
- **Native dependencies**: better-sqlite3 prebuilds for multiple architectures
- **Desktop integration**: .desktop files, MIME types, icons
- **Permissions**: Microphone access, X11/Wayland permissions
- **Dependencies**: System vs bundled libraries

#### 3. Platform Detection Strategy
Need automated handling of platform-specific dependencies like `@esbuild/darwin-arm64`

## Implementation Plan

### Phase 1: Infrastructure Setup
1. Create `build/` directory with all build manifests and scripts
2. Add `--version` CLI flag for headless testing
3. Handle platform-specific dependency issues
4. Set up TypeScript build scripts

### Phase 2: Docker/Container Environment
1. Create containerized build environments for each Linux distro
2. Set up distrobox testing infrastructure
3. Automate dependency management per platform

### Phase 3: Package Format Implementation
1. **Flatpak**: Create flatpak manifest with Wayland support
2. **Enhanced AppImage**: Improve current AppImage with better desktop integration
3. **Enhanced Deb**: Add proper dependencies, desktop files, post-install scripts
4. **RPM**: New RPM packaging with proper spec files

### Phase 4: Testing & Validation
1. Docker-based automated testing across distributions
2. Functionality testing with `open-wispr --version`
3. Reuse of existing Docker build images for efficient testing

## Technical Challenges

### 1. Native Dependencies
- **better-sqlite3**: Requires compilation for each platform/architecture
- **FFmpeg**: Currently bundled but may need system integration for some formats
- **Python bridge**: Ensure Python availability across distributions

### 2. Security & Sandboxing
- **Flatpak sandboxing**: Handle microphone permissions, file access
- **AppArmor/SELinux**: Ensure compatibility with security frameworks
- **Wayland protocol**: Native Wayland support vs X11 fallback

### 3. Distribution Differences
- **Package managers**: Different dependency resolution
- **Desktop environments**: Various integration requirements
- **Init systems**: systemd vs others for service integration

## Next Steps
1. Implement --version flag
2. Create build/ directory structure
3. Handle @esbuild/darwin-arm64 dependency issue
4. Set up Docker build environments
5. Implement each package format systematically

## Architecture Decisions Made
- **TypeScript build scripts**: For robustness and maintainability
- **Docker-based builds**: For consistent cross-platform building and testing
- **Wayland-first approach**: Modern Linux desktop support
- **Automated Docker testing**: Reuse build images for efficient validation