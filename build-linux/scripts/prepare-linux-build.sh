#!/bin/bash
set -e

echo "🔧 Preparing Linux build environment..."

# Backup original package.json
if [ ! -f package.json.backup ]; then
    cp package.json package.json.backup
    echo "📦 Backed up package.json"
fi

# Use Linux-specific package.json
if [ -f package.linux.json ]; then
    cp package.linux.json package.json
    echo "🐧 Using Linux-specific package.json"
else
    echo "❌ package.linux.json not found! Run 'tsx build-linux/scripts/handle-platform-deps.ts' first"
    exit 1
fi

# Clean and install dependencies
echo "🧹 Cleaning node_modules..."
rm -rf node_modules package-lock.json

echo "📥 Installing Linux dependencies..."
npm install

# Build the project
echo "🔨 Building project..."
npm run build

echo "✅ Linux build preparation complete!"
