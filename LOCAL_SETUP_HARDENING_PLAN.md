# Local Setup Hardening Plan and Progress

This document tracks implementation of local-first, reproducible, and private-by-default improvements.

## Scope

- Enforce local-first defaults in app settings and onboarding.
- Align dev server port defaults and callback behavior.
- Make `.env.example` private-by-default for local usage.
- Replace stale setup workflow/docs (`npm run setup`) with current guidance.
- Add deterministic setup guidance (`npm ci`, pinned toolchain notes).
- Add local preflight/doctor command for faster troubleshooting.
- Add local security hardening guidance for personal packaged builds.

## TDD Plan

1. Add failing contract tests for:
   - Local-first defaults and onboarding wording
   - Port/default consistency across runtime files
   - Setup/docs consistency expectations
   - `.env.example` private-default behavior
2. Implement code and docs to satisfy tests.
3. Run tests, lint, and build.

## Progress

- [x] Audit current gaps and target files
- [x] Create plan and tracker document
- [x] Add tests first (expected to fail initially)
- [x] Implement local-first defaults and onboarding updates
- [x] Implement env/port consistency updates
- [x] Implement setup/docs and security guidance updates
- [x] Add local doctor script and docs
- [x] Verify with test/lint/build

## File Targets

- `src/hooks/useSettings.ts`
- `src/components/OnboardingFlow.tsx`
- `src/vite.config.mjs`
- `src/helpers/devServerManager.js`
- `src/lib/neonAuth.ts`
- `.env.example`
- `README.md`
- `TROUBLESHOOTING.md`
- `LOCAL_PERSONAL_SETUP.md`
- `package.json`
- `tests/**/*.test.cjs` (new)
- `scripts/local-doctor.js` (new)

## Verification Commands

```bash
npm test
npm run lint
npm run build
```
