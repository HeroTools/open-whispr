FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install build tools and dependencies
RUN apt-get update && \
    apt-get install -y \
        build-essential \
        devscripts \
        debhelper \
        dh-make \
        nodejs \
        npm \
        python3 \
        python3-pip \
        git \
        curl \
        file \
        fakeroot \
        lintian \
        && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

# Set up environment for package building
ENV DEB_BUILD_OPTIONS=nocheck