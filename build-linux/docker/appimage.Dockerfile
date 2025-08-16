FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install required packages (lean) and Python for appimage-builder
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    wget \
    git \
    python3 \
    python3-pip \
    file \
    desktop-file-utils \
    libfuse2 \
    fuse \
    xz-utils \
  && rm -rf /var/lib/apt/lists/*

# Install appimage-builder
RUN pip3 install --no-cache-dir appimage-builder

# Multi-arch install of appimagetool (x86_64/aarch64)
ARG TARGETARCH
ENV TARGETARCH=${TARGETARCH}
RUN set -eux; \
    if [ "${TARGETARCH}" = "arm64" ]; then ARCH_B="aarch64"; else ARCH_B="x86_64"; fi; \
    URL="https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-${ARCH_B}.AppImage"; \
    echo "Fetching ${URL}"; \
    curl -fsSL "$URL" -o /usr/local/bin/appimagetool; \
    chmod +x /usr/local/bin/appimagetool

WORKDIR /workspace

# Set up environment for AppImage building
ENV ARCH=x86_64
ENV APPIMAGE_EXTRACT_AND_RUN=1