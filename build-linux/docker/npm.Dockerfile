FROM node:18-bullseye-slim

ENV DEBIAN_FRONTEND=noninteractive

# Install minimal system deps for Electron build and node-gyp
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    python3 \
    python3-pip \
    build-essential \
    # Electron runtime deps
    libx11-dev \
    libxkbfile-dev \
    libsecret-1-dev \
    libxtst6 \
    libnss3 \
    libasound2 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libxss1 \
    libgbm1 \
    # Utilities
    fakeroot \
    file \
    xz-utils \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

# Speed up npm (optional)
ENV npm_config_fund=false \
    npm_config_audit=false

CMD ["bash"]
