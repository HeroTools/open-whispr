# Local Personal Setup Playbook

This guide is for running OpenWhispr locally for personal use while keeping your setup reproducible, private by default, and easy to maintain.

## Goals

- Keep day-to-day usage stable after upstream updates
- Prefer local transcription for privacy/cost control
- Use cloud features only when needed
- Keep your fork clean and easy to sync

## One-Time Setup

1. Clone your fork and set upstream

```bash
git clone https://github.com/<your-user>/openwhispr.git
cd openwhispr
git remote add upstream https://github.com/OpenWhispr/openwhispr.git
git remote -v
```

2. Install dependencies

```bash
npm ci
```

Use `npm install` only when you intentionally change dependencies.

3. Optional cloud keys (only if you need BYOK providers)

```bash
cp .env.example .env
```

We keep this fork in a local-only configuration for now, so `.env` leaves every cloud key commented out and pins `VITE_DEV_SERVER_PORT=5191` / `OPENWHISPR_DEV_SERVER_PORT=5191`. Keep cloud keys disabled until you need them and enable only the ones you intend to use (e.g., `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`).

4. Download local speech binary (recommended)

```bash
npm run download:whisper-cpp
npm run download:llama-server
npm run download:sherpa-onnx
```

We also pulled the Whisper `base` model and NVIDIA Parakeet `parakeet-tdt-0.6b-v3` archive via the helpers; they now live under `~/.cache/openwhispr/whisper-models` and `.../parakeet-models`, respectively, so the local transcription providers can start immediately.

5. Build and run

```bash
npm run build
npm run dev
```

The dev server listens on the odd port `5191` (see `.env`). VS Code has an `npm: dev` task in `.vscode/tasks.json`, so you can start the app from Run/Debug while preserving the custom port and hotkey setup. Run `npm run doctor:local` after setup to validate local binaries, model caches, and dev port alignment. The app launches successfully with those local models and transcribes, though the Whisper/Parakeet output stays fairly rough - keep custom dictionary words updated and experiment with higher-quality models if you need better accuracy.

6. In-app first-run recommendations

- Set local transcription to Whisper `base` for best speed/quality balance
- Keep cloud disabled unless needed for reasoning or specific models
- Confirm microphone and accessibility permissions on your OS

## Preferred Daily Mode

- Use local Whisper/Parakeet as your default
- Keep custom dictionary updated for names/technical terms
- Switch to cloud only when you need higher quality reasoning or model-specific behavior

## Fork Sync Routine (Weekly)

Use this exact sequence from your local `main` branch:

```bash
git checkout main
git fetch upstream
git rebase upstream/main
git push origin main
```

If you do feature work, rebase your branch before opening/updating PRs:

```bash
git checkout <feature-branch>
git fetch upstream
git rebase upstream/main
git push --force-with-lease origin <feature-branch>
```

Notes:

- `origin` should be your fork
- `upstream` should be `OpenWhispr/openwhispr`
- Use `--force-with-lease` (not plain `--force`) after rebasing your own feature branch

## Safe Update Routine (After Pulling Changes)

Run this after syncing from upstream:

```bash
npm ci
npm run doctor:local
npm run lint
npm run build
```

Then do a quick smoke test:

- App launches
- Hotkey starts/stops recording
- One local transcription works end-to-end
- Auto-paste works in your target app(s)

## Security and Reliability Practices

- Keep `contextIsolation` enabled (default in this project)
- Do not expose new broad IPC methods without validation
- Avoid adding secrets to tracked files; keep keys in `.env` or in-app secure storage
- Keep `package-lock.json` committed for deterministic dependency state
- Pin Node.js with `.nvmrc` (`22`) to reduce local environment drift
- Run `npm audit` periodically and upgrade intentionally
- For personal packaged builds, keep Electron fuses hardened (disable `RunAsNode` and unnecessary CLI inspect/node options)

## Optional Personal Release Build

Create a local standalone app:

```bash
npm run pack
```

Use the produced app in `dist/` for your platform.

## Deterministic Local Mode

- Use `nvm use` (or equivalent) to align with `.nvmrc`
- Keep `.env` local-first: cloud keys commented until needed
- Prefer `npm ci` for clean reinstalls and reproducible smoke tests
- Run `npm run doctor:local` after dependency or upstream updates

## Linux Notes (If Applicable)

For reliable auto-paste, install at least one supported tool:

- X11: `xdotool`
- Wayland: `wtype` or `ydotool` (`ydotoold` must be running)

GNOME Wayland uses native shortcut integration and tap-to-talk behavior.

## Monthly Maintenance Checklist

```bash
git checkout main
git fetch upstream
git rebase upstream/main
git push origin main
npm install
npm audit
npm run lint
npm run build
```

If `npm audit` reports issues, update dependencies in a dedicated branch and rerun smoke tests.
