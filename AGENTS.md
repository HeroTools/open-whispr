# OpenWayl Project Context & Rules

## Project Overview

OpenWayl is a fork of OpenWhispr focused on adding native Wayland support for Linux while maintaining full compatibility with macOS and Windows.

## Core Development Rules

### 1. Goal: Wayland & Linux Compatibility

- Prioritize native Wayland solutions (e.g., using portals, DBus, or Wayland protocols) over X11/XWayland fallbacks.
- Ensure global hotkeys and clipboard operations work reliably on major compositors (GNOME, KDE, Hyprland).

### 2. Philosophy: Tread Lightly

- Make passive, non-invasive changes.
- Avoid rewriting core logic unless absolutely necessary.
- Isolate Linux-specific logic to separate modules or files where possible to avoid cluttering cross-platform code.

### 3. Upstream Focus

- **Design for Merge:** All changes should be structured as if they will be submitted as PRs to the upstream OpenWhispr repository.
- **Conditional Logic:** Use clear platform checks (`process.platform === 'linux'`) or feature detection.
- **No breaking changes:** Do not alter the fundamental architecture in a way that makes merging upstream difficult.

### 4. Cross-Platform Stability

- **DO NOT break other OSes.**
- Always verify (or ask the user to verify) that changes do not negatively impact macOS or Windows builds.
- Use `electron-is-dev` or similar helpers to handle environment differences gracefully.

### 5. Maintenance

- Minimize the diff delta from upstream.
- Document reasons for divergence clearly in code comments.
- Prefer extending existing classes/functions over replacing them.

## Technical Context

- **Framework**: Electron
- **Frontend**: React + Vite + Tailwind
- **IPC**: strict context isolation (preload.js)
- **Native Modules**: Be careful with native dependencies; ensure they build on all platforms.
