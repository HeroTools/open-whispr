# Commit Skill Reference (OpenWhispr)

This reference supports `.opencode/skills/commit/SKILL.md` for OpenWhispr.

## Commit Message Structure

Use concise conventional commits:

```text
<type>(<scope>): <subject>

- why this change was needed
- impact/risk notes
- local-first implications (if applicable)
```

Examples:

```text
fix(settings): default transcription mode to local

- switch useLocalWhisper default to true for privacy-first behavior
- aligns onboarding and runtime defaults with LOCAL_PERSONAL_SETUP.md
```

```text
ci(build): add verify job before platform packaging

- gate build-and-notarize workflow behind lint and test checks
- catches regressions earlier and reduces expensive cross-platform failures
```

## Scope Guidance

- `audio` / `transcription` / `whisper` / `parakeet`: recording, models, local ASR
- `ipc` / `hotkey` / `clipboard`: Electron process bridges and input/paste behavior
- `settings` / `onboarding` / `ui`: renderer user experience and defaults
- `build` / `ci` / `deps`: pipelines, packaging, infrastructure
- `docs` / `test`: documentation and test-only updates

## Local Verification Gate

Run from repo root:

```bash
npm run lint
npm run test
npm run build:renderer
```

Optional for local setup/model changes:

```bash
npm run doctor:local
```

## Safety Rules

- Never commit secrets (`.env`, tokens, credentials).
- Never run destructive git commands in this workflow (`reset --hard`, `checkout --`, `clean -fd`, force push).
- Never push from the skill workflow; local commits only.
- If commit lands on wrong branch, use non-destructive recovery:

```bash
git switch <intended-branch>
git cherry-pick <commit-sha>

# Optional cleanup on original branch
git switch <original-branch>
git revert <commit-sha>
```

## Typical OpenWhispr Commit Patterns

1. **Feature/fix touching app behavior**
   - include scope (`settings`, `onboarding`, `transcription`, etc.)
   - include 1-2 bullets on why and user impact

2. **CI/build updates**
   - include the workflow/script path in body when useful
   - mention failure mode being prevented (for example, catch test failures before packaging)

3. **Docs-only updates**
   - `docs(<scope>): ...`
   - explain which workflow/setup path changed and why

## Quick Troubleshooting

- **No staged changes with `-Mode staged`**: stage files first (`git add <paths>`).
- **Lint/test/build fails**: fix failures and rerun workflow; do not bypass checks.
- **Pre-commit hook modifies files**: stage modifications and create a new commit attempt.

## Project Context

**Project**: OpenWhispr
**Stack**: Electron + React + TypeScript + Tailwind + Node scripts
**Primary paths**: `main.js`, `preload.js`, `src/`, `src/helpers/`, `resources/`, `scripts/`, `tests/`
