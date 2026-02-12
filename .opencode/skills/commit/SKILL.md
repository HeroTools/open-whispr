---
name: commit
description: Generate concise OpenWhispr commit messages and run a safe local-only commit workflow. Validate with npm lint/test/build checks and never use destructive git commands.
compatibility: Requires git 2.35+, Node.js 22.x, npm 10+, PowerShell 5.1+ (Windows) or bash 3.x+ (macOS/Linux)
metadata:
  project: OpenWhispr
  tech: Electron 36 + React 19 + TypeScript + Tailwind v4
---

# Commit Message Generation

Generate professional commit messages and automate local commits for OpenWhispr.

## When to use

- Multi-file changes (features, refactors, fixes)
- Changes that affect user behavior, setup, CI, packaging, or security defaults
- Skip: trivial one-line typo-only changes

## Pre-commit verification gate

All commits are blocked unless these checks pass from the repo root:

- `npm run lint` - ESLint checks for main + renderer code
- `npm run test` - Contract/unit tests via Node test runner
- `npm run build:renderer` - Renderer build integrity

Optional when touching local setup, binaries, or model workflows:

- `npm run doctor:local`

## Quick start

```powershell
# 1. Ask the AI agent to use this skill
# "Follow commit skill to commit my recent changes"

# 2. Agent writes commit_msg.txt and invokes workflow script
powershell -ExecutionPolicy Bypass -File ".opencode/skills/commit/scripts/commit-workflow.ps1" -MessageFile "commit_msg.txt" -Mode staged

# 3. Script runs autonomously:
#    - gathers git status
#    - stages changes based on mode
#    - runs verification gate
#    - blocks commit on failure
#    - commits with -F commit_msg.txt on success
```

## Message template

```
<type>(<scope>): <subject>

- why this change was needed
- user-visible impact and/or risk notes
- local-first behavior implications (if applicable)
```

## Commit types and scopes

**Types**: `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `chore`, `ci`

**Scopes**: `audio`, `transcription`, `whisper`, `parakeet`, `ipc`, `hotkey`, `clipboard`, `settings`, `onboarding`, `build`, `ci`, `docs`, `deps`, `ui`

## Subject line rules

- Imperative mood ("add" not "added")
- Lowercase except proper nouns
- No period at end
- 40-72 characters

## Workflow steps

1. Agent writes commit message to `commit_msg.txt`.
2. Agent invokes `commit-workflow.ps1`.
3. Script validates repo state, stages changes, runs gate, commits locally.
4. Agent reports success/failure and failing check details.

## OpenWhispr defaults and safety rules

- Preserve local-first behavior unless explicitly instructed otherwise.
- Never change default transcription preference from local to cloud without a stated requirement.
- Never use destructive git commands in this workflow (`git reset --hard`, `git checkout -- <file>`, `git clean -fd`, force push).
- Never push from this skill; local commits only.
- Never commit secrets (`.env`, API keys, private tokens).

## Project context

**Repo**: OpenWhispr
**Stack**: Electron + React + TypeScript + Tailwind + Node scripts
**Key paths**: `main.js`, `preload.js`, `src/`, `src/helpers/`, `resources/`, `scripts/`, `tests/`

See `references/REFERENCE.md` for detailed examples and troubleshooting.
