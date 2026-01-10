Bundled Python runtime

Place per-platform Python runtimes in this folder during packaging.
OpenWhispr will prefer these binaries if present and create an isolated
virtual environment under the user's app data directory.

IMPORTANT: The bundled Python MUST include venv and ensurepip modules.
The Windows embeddable distribution does NOT include these - use the full
installer or a relocatable build instead.

Expected layouts:
- Windows: resources/python/python.exe (full installer, NOT embeddable)
- macOS/Linux: resources/python/bin/python3 (relocatable Python build)

Requirements for bundled Python:
- Python 3.8+ (3.11 recommended)
- venv module (python -m venv must work)
- ensurepip module (for pip bootstrapping)

This folder ships with the app via electron-builder extraResources.
