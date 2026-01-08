Bundled Python runtime

Place per-platform Python runtimes in this folder during packaging.
OpenWhispr will prefer these binaries if present and create an isolated
virtual environment under the user's app data directory.

Expected layouts:
- Windows: resources/python/python.exe (python.org embeddable distribution)
- macOS/Linux: resources/python/bin/python3 (relocatable Python build)

This folder ships with the app via electron-builder extraResources.
