#!/bin/bash
set -euo pipefail

CACHE_DIR="$HOME/.cache/dictatevoice"
MODELS_DIR="$CACHE_DIR/models"

if [ -d "$MODELS_DIR" ]; then
  rm -rf "$MODELS_DIR"
  echo "Removed DictateVoice cached models"
fi

if [ -d "$CACHE_DIR" ]; then
  rmdir "$CACHE_DIR" 2>/dev/null || true
fi
