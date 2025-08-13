FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install required packages
RUN apt-get update && \
    apt-get install -y \
        curl \
        wget \
        git \
        build-essential \
        nodejs \
        npm \
        python3 \
        python3-pip \
        file \
        desktop-file-utils \
        libfuse2 \
        fuse \
        && rm -rf /var/lib/apt/lists/*

# Install appimage-builder
RUN pip3 install appimage-builder

# Download and install appimagetool
RUN wget -O /usr/local/bin/appimagetool \
    https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage && \
    chmod +x /usr/local/bin/appimagetool

WORKDIR /workspace

# Set up environment for AppImage building
ENV ARCH=x86_64
ENV APPIMAGE_EXTRACT_AND_RUN=1