FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

# Install minimal build tools for DEB packaging
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        devscripts \
        debhelper \
        dh-make \
        fakeroot \
        lintian \
        file \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

# Set up environment for package building
ENV DEB_BUILD_OPTIONS=nocheck