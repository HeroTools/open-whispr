# Open-Whispr Linux Packaging

This directory contains all the necessary files and scripts for building Open-Whispr packages for Linux distributions.

## Quick Start

1. **Setup packaging environment:**

   ```bash
   npm run package-linux:setup
   ```

2. **Build all Linux packages:**

   ```bash
   npm run package-linux:all-amd64
   ```

3. **Test packages on different distributions:**

   ```bash
   npm run package-linux:test
   ```

4. **That's it!** All packages will be built to the `dist/` directory.

## Package Formats

### Flatpak

- **File**: `build-linux/flatpak/`
- **Build**: Individual builds not supported - use `npm run package-linux:all-amd64`
- **Features**: Wayland-first, sandboxed, automatic dependency management

### AppImage

- **File**: `build-linux/appimage/`
- **Build**: Individual builds not supported - use `npm run package-linux:all-amd64`
- **Features**: Portable, no installation required, works across distributions

### DEB (Debian/Ubuntu)

- **File**: `build-linux/deb/`
- **Build**: Individual builds not supported - use `npm run package-linux:all-amd64`
- **Features**: Native package management integration, automatic dependency resolution

### RPM (Fedora/RHEL/CentOS)

- **File**: `build-linux/rpm/`
- **Build**: Individual builds not supported - use `npm run package-linux:all-amd64`
- **Features**: Native package management integration, system service integration

## Docker Build Environment

Each package format has its own Docker container to ensure consistent builds:

- `open-whispr-flatpak-builder`: Fedora-based with Flatpak tools
- `open-whispr-appimage-builder`: Ubuntu-based with AppImage tools
- `open-whispr-deb-builder`: Ubuntu-based with DEB packaging tools
- `open-whispr-rpm-builder`: Fedora-based with RPM packaging tools

## Platform Dependency Handling

The build system automatically handles platform-specific dependencies like `@esbuild-linux/darwin-arm64` that break Linux builds:

1. Creates platform-specific package.json files
2. Temporarily removes incompatible dependencies during Linux builds
3. Restores original configuration after build

## Testing

### Automated Testing

The test suite uses Docker containers to test installations across multiple distributions:

- Ubuntu 22.04 (using open-whispr-deb-builder)
- Debian 12 (using debian:12 base image)
- Fedora 39 (using open-whispr-rpm-builder)
- CentOS Stream 9 (using centos:stream9 base image)

The testing automatically reuses our existing Docker build images, making it fast and reliable.

### Manual Testing

Test individual packages:

```bash
# Test version flag works
./dist/Open-Whispr-1.0.2-x86_64.AppImage --version

# Install DEB package
sudo dpkg -i dist/open-whispr_1.0.2_amd64.deb
open-whispr --version

# Install RPM package
sudo dnf install dist/open-whispr-1.0.2-1.*.x86_64.rpm
open-whispr --version

# Install Flatpak
flatpak install --user dist/Open-Whispr-1.0.2.flatpak
flatpak run com.herotools.openwhispr --version
```

## Architecture

### Native Dependencies

- **better-sqlite3**: Compiled for each target architecture
- **FFmpeg**: Bundled via ffmpeg-static, extracted from ASAR
- **Python bridge**: whisper_bridge.py for local Whisper processing

### Desktop Integration

- `.desktop` files for application launchers
- Icon installation in hicolor theme
- MIME type associations for audio files
- Proper categorization (Office, Accessibility, AudioVideo)

### Wayland Support

All packages are configured with Wayland-first support and X11 fallback:

- Flatpak uses `--socket=wayland --socket=fallback-x11`
- Native packages include required Wayland libraries

## Build Output

All packages are built to the `dist/` directory:

```
dist/
├── Open-Whispr-1.0.2.flatpak
├── Open-Whispr-1.0.2-x86_64.AppImage
├── open-whispr_1.0.2_amd64.deb
└── open-whispr-1.0.2-1.fc39.x86_64.rpm
```

## Troubleshooting

### Docker Issues

```bash
# Rebuild all Docker images
docker system prune -f
cd build-linux/docker
for dockerfile in *.Dockerfile; do
    format_name="${dockerfile%.Dockerfile}"
    image_name="open-whispr-${format_name}-builder-amd64"
    docker build -f "$dockerfile" -t "$image_name" .
done
```

### Package Issues

```bash
# Clean everything and rebuild
npm run clean
rm -rf dist/ node_modules/
npm install
npm run package-linux:all-amd64
```

### Testing Issues

```bash
# Clean Docker containers and images
docker container prune -f
docker image prune -f
npm run package-linux:test
```

## Contributing

When modifying packaging:

1. Update relevant manifest files in `build-linux/`
2. Test on all supported distributions
3. Update this documentation
4. Run the full test suite

## Dependencies

### Build Dependencies

- Node.js 16+
- Docker
- tsx (installed via npm)

### Runtime Dependencies

Automatically handled by each package format's dependency system.
