#!/bin/bash
set -e

echo "[prepare-linux-npm-build.sh] 🔧 Preparing Linux build environment..."

# Backup original package.json
if [ ! -f package.json.backup ]; then
    cp package.json package.json.backup
    echo "[prepare-linux-npm-build.sh] 📦 Backed up package.json"
fi

# Use Linux-specific package.json
if [ -f package.linux.json ]; then
    cp package.linux.json package.json
    echo "[prepare-linux-npm-build.sh] 🐧 Using Linux-specific package.json"
else
    echo "[prepare-linux-npm-build.sh] ❌ package.linux.json not found! Run 'node build-linux/scripts/handle-platform-npm-packages.js' first"
    exit 1
fi

# Clean and install dependencies
echo "[prepare-linux-npm-build.sh] 🧹 Cleaning node_modules..."
rm -rf node_modules package-lock.json

echo "[prepare-linux-npm-build.sh] 📥 Installing Linux dependencies..."
npm install

# Build the project
echo "[prepare-linux-npm-build.sh] 🔨 Building project..."
npm run build

echo "[prepare-linux-npm-build.sh] ✅ Linux build preparation complete!"
